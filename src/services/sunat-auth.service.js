const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class SunatAuthService {
  constructor() {
    this.token = null;
    this.tokenExpiry = null;
  }

  /**
   * Obtiene token OAuth2 de SUNAT
   */
  async getToken(clientId, clientSecret) {
    const id = clientId || config.sunat.clientId;
    const secret = clientSecret || config.sunat.clientSecret;

    if (!id || !secret) {
      throw new Error('Faltan credenciales SUNAT OAuth2 (client_id, client_secret)');
    }

    // Verificar si el token sigue vigente
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    try {
      const params = new URLSearchParams();
      params.append('client_id', id);
      params.append('client_secret', secret);
      params.append('grant_type', 'client_credentials');

      const response = await axios.post(
        `${config.sunat.apiBase}/v1/security/oauth/auth`,
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      this.token = response.data.access_token;
      // Expira 5 min antes del tiempo real
      this.tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);

      logger.info('Token SUNAT obtenido correctamente');
      return this.token;
    } catch (error) {
      logger.error('Error al obtener token SUNAT:', error.message);
      throw new Error(`Error SUNAT Auth: ${error.message}`);
    }
  }
}

module.exports = new SunatAuthService();
