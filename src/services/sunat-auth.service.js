const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class SunatAuthService {
  constructor() {
    // Cache de tokens por empresa: { [clave]: { token, expiry } }
    this.tokens = new Map();
  }

  /**
   * Obtiene token OAuth2 de SUNAT (flujo password grant) para una empresa.
   * POST https://api-seguridad.sunat.gob.pe/v1/clientessol/{client_id}/oauth2/token/
   * @param {{clientId: string, clientSecret: string, ruc: string, usuarioSol: string, claveSol: string}} credenciales
   * @returns {Promise<string>}
   */
  async getToken(credenciales) {
    const { clientId, clientSecret, ruc, usuarioSol, claveSol } = credenciales || {};

    if (!clientId || !clientSecret || !ruc || !usuarioSol || !claveSol) {
      throw new Error(
        `Faltan credenciales SUNAT de la empresa (client_id: ${clientId ? 'ok' : 'falta'}, ` +
        `client_secret: ${clientSecret ? 'ok' : 'falta'}, ruc: ${ruc || 'falta'}, ` +
        `usuario_sol: ${usuarioSol ? 'ok' : 'falta'}, clave_sol: ${claveSol ? 'ok' : 'falta'})`
      );
    }

    const clave = `${clientId}|${ruc}|${usuarioSol}`;

    const cacheado = this.tokens.get(clave);
    if (cacheado && Date.now() < cacheado.expiry) {
      return cacheado.token;
    }

    const username = `${ruc}${usuarioSol}`;

    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('scope', config.sunat.scope);
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('username', username);
      params.append('password', claveSol);

      const response = await axios.post(
        `${config.sunat.seguridadBase}/clientessol/${clientId}/oauth2/token/`,
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      // Expira 5 min antes del tiempo real
      const expiry = Date.now() + (Number(response.data.expires_in) - 300) * 1000;
      this.tokens.set(clave, { token: response.data.access_token, expiry });

      logger.info(`Token SUNAT obtenido (RUC ${ruc}, usuario ${usuarioSol})`);
      return response.data.access_token;
    } catch (error) {
      if (error.response) {
        logger.error(`Error al obtener token SUNAT [${error.response.status}]: ${JSON.stringify(error.response.data)}`);
        throw new Error(`Error SUNAT Auth ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      }
      logger.error(`Error al obtener token SUNAT (RUC ${ruc}): ${error.message}`);
      throw error;
    }
  }
}

module.exports = new SunatAuthService();