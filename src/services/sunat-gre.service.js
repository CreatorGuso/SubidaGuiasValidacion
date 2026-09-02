const axios = require('axios');
const config = require('../config');
const sunatAuth = require('./sunat-auth.service');
const ZipService = require('./zip.service');
const logger = require('../utils/logger');

class SunatGreService {
  constructor() {
    this.zipService = new ZipService();
  }

  /**
   * Envía Guía de Remisión a SUNAT vía REST API
   * POST https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/{RUC}-09-{SERIE}-{NRO}
   * @param {string} xmlFirmado - XML firmado
   * @param {string} nombreArchivo - Nombre del archivo sin extensión (RUC-TIPO-SERIE-NRO)
   * @returns {Promise<{ ticket: string, success: boolean }>}
   */
  async enviar(xmlFirmado, nombreArchivo) {
    // Comprimir XML a ZIP
    const { zip, hash } = await this.zipService.compress(xmlFirmado, nombreArchivo);
    const zipBase64 = zip.toString('base64');

    const token = await sunatAuth.getToken();

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

      logger.info(`GRE enviada. Ticket: ${response.data.numTicket}`);

      return {
        ticket: response.data.numTicket,
        success: true,
      };
    } catch (error) {
      if (error.response) {
        logger.error(`Error SUNAT [${error.response.status}]: ${JSON.stringify(error.response.data)}`);
        throw new Error(
          `SUNAT ${error.response.status}: ${JSON.stringify(error.response.data)}`
        );
      }
      throw error;
    }
  }

  /**
   * Consulta estado de una GRE enviada
   * GET https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/envios/{numTicket}
   * codRespuesta: "98" en proceso, "99" con error, "0" aceptado
   * @param {string} ticket
   * @returns {Promise<Object>}
   */
  async consultarEstado(ticket) {
    const token = await sunatAuth.getToken();

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

    const data = response.data;

    const resultado = {
      estado: data.codRespuesta,
      descripcion:
        data.codRespuesta === '0'
          ? 'Aceptado por SUNAT'
          : data.codRespuesta === '98'
            ? 'En proceso'
            : (data.error && data.error.desError) || 'Envío con error',
      numError: (data.error && data.error.numError) || null,
      cdr: data.arcCdr || null,
      indCdrGenerado: data.indCdrGenerado || null,
      ticket,
    };

    if (data.codRespuesta === '99') {
      logger.error(`GRE rechazada. Ticket ${ticket}: ${resultado.numError} - ${resultado.descripcion}`);
    }

    return resultado;
  }
}

module.exports = new SunatGreService();
