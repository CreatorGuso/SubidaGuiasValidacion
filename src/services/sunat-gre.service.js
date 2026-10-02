const axios = require('axios');
const config = require('../config');
const sunatAuth = require('./sunat-auth.service');
const ZipService = require('./zip.service');
const logger = require('../utils/logger');

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class SunatGreService {
  constructor() {
    this.zipService = new ZipService();
  }

  /**
   * Envía Guía de Remisión a SUNAT vía REST API
   * POST https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/{RUC}-09-{SERIE}-{NRO}
   * @param {string} xmlFirmado - XML firmado
   * @param {string} nombreArchivo - Nombre del archivo sin extensión (RUC-TIPO-SERIE-NRO)
   * @param {Object} credenciales - Credenciales SUNAT de la empresa emisora
   * @returns {Promise<{ ticket: string, success: boolean }>}
   */
  async enviar(xmlFirmado, nombreArchivo, credenciales) {
    // Comprimir XML a ZIP
    const { zip, hash } = await this.zipService.compress(xmlFirmado, nombreArchivo);
    const zipBase64 = zip.toString('base64');

    const token = await sunatAuth.getToken(credenciales);

    const body = {
      archivo: {
        nomArchivo: `${nombreArchivo}.zip`,
        arcGreZip: zipBase64,
        hashZip: hash,
      },
    };

    logger.info(`Enviando GRE a SUNAT: ${nombreArchivo}`);

    try {
      const response = await axios.post(
        `${config.sunat.apiBase}/contribuyente/gem/comprobantes/${nombreArchivo}`,
        body,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          timeout: 60000,
        }
      );

      const ticket = response.data.numTicket;
      logger.info(`GRE enviada. Ticket: ${ticket}`);

      return { ticket, success: true };
    } catch (error) {
      if (error.response) {
        logger.error(`Error SUNAT [${error.response.status}]: ${JSON.stringify(error.response.data)}`);
        throw new Error(`SUNAT ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Consulta el estado de una GRE enviada en SUNAT.
   * GET .../gem/comprobantes/envios/{numTicket}
   * codRespuesta: "98" en proceso, "99" con error, "0" aceptado
   * @param {string} ticket
   * @param {Object} credenciales
   * @returns {Promise<Object>}
   */
  async consultarEstado(ticket, credenciales) {
    const token = await sunatAuth.getToken(credenciales);

    const response = await axios.get(
      `${config.sunat.apiBase}/contribuyente/gem/comprobantes/envios/${ticket}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        timeout: 30000,
      }
    );

    const data = response.data || {};

    return {
      estado: data.codRespuesta,
      descripcion:
        data.codRespuesta === '0'
          ? 'Aceptado por SUNAT'
          : data.codRespuesta === '98'
            ? 'En proceso'
            : (data.error && data.error.desError) || 'Envío con error',
      numError: (data.error && data.error.numError) || null,
      indCdrGenerado: data.indCdrGenerado || null,
      ticket,
    };
  }

  /**
   * Consulta el estado del ticket hasta que SUNAT responda un estado final
   * ('0' aceptado o distinto de '98'). Si se agotan los intentos devuelve la
   * última respuesta (en proceso).
   * @param {string} ticket
   * @param {Object} credenciales
   * @returns {Promise<Object>}
   */
  async esperarEstado(ticket, credenciales) {
    const intentos = config.sunat.consultaIntentos;
    const espera = config.sunat.consultaEspera;
    let resultado = null;

    for (let i = 1; i <= intentos; i++) {
      resultado = await this.consultarEstado(ticket, credenciales);

      if (resultado.estado !== '98') {
        logger.info(`Ticket ${ticket}: ${resultado.descripcion} (codRespuesta ${resultado.estado})`);
        return resultado;
      }

      if (i < intentos) {
        logger.info(`Ticket ${ticket} en proceso (intento ${i}/${intentos})...`);
        await dormir(espera);
      }
    }

    logger.warn(`Ticket ${ticket}: sigue en proceso tras ${intentos} intentos`);
    return resultado;
  }
}

module.exports = new SunatGreService();