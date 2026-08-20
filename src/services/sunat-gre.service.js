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
   * @param {string} xmlFirmado - XML firmado
   * @param {string} nombreArchivo - Nombre del archivo (sin extensión)
   * @param {Object} empresa - Datos de la empresa
   * @returns {Promise<{ ticket: string, success: boolean }>}
   */
  async enviar(xmlFirmado, nombreArchivo, empresa) {
    try {
      // Obtener token
      const token = await sunatAuth.getToken(
        empresa.clientId,
        empresa.clientSecret
      );

      // Comprimir XML a ZIP
      const { zip, hash } = await this.zipService.compress(xmlFirmado, nombreArchivo);
      const zipBase64 = zip.toString('base64');

      // Preparar body
      const body = {
        tipoCpe: '09',
        serieCorrelativo: nombreArchivo.split('-').slice(1).join('-'),
        fechaEmision: this._formatDate(new Date()),
        ruc: empresa.ruc,
        coditoHash: hash,
        archivo: zipBase64,
      };

      logger.info(`Enviando GRE a SUNAT: ${body.serieCorrelativo}`);

      const response = await axios.post(
        `${config.sunat.apiBase}/v1/cpe`,
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

      logger.info(`GRE enviado. Ticket: ${response.data.ticket}`);

      return {
        ticket: response.data.ticket,
        success: true,
      };
    } catch (error) {
      if (error.response) {
        logger.error('Error SUNAT:', JSON.stringify(error.response.data));
        throw new Error(
          `SUNAT ${error.response.status}: ${JSON.stringify(error.response.data)}`
        );
      }
      throw error;
    }
  }

  /**
   * Consulta estado de una GRE enviada
   * @param {string} ticket
   * @param {Object} empresa
   * @returns {Promise<Object>}
   */
  async consultarEstado(ticket, empresa) {
    try {
      const token = await sunatAuth.getToken(
        empresa.clientId,
        empresa.clientSecret
      );

      const response = await axios.get(
        `${config.sunat.apiBase}/v1/cpe/${ticket}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
          timeout: 30000,
        }
      );

      const data = response.data;

      return {
        estado: data.codRespuesta || data.estado,
        ticket,
        cdr: data.cdr || null,
        descripcion: data.descripcion || '',
      };
    } catch (error) {
      logger.error('Error consultando estado GRE:', error.message);
      throw error;
    }
  }

  _formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

module.exports = new SunatGreService();
