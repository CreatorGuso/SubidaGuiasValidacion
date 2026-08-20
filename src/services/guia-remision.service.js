const XmlBuilder = require('../xml/builder');
const XmlSigner = require('../xml/signer');
const ZipService = require('./zip.service');
const sunatGreService = require('./sunat-gre.service');
const documentoRepository = require('../database/documento.repository');
const config = require('../config');
const logger = require('../utils/logger');

class GuiaRemisionService {
  constructor() {
    this.xmlBuilder = new XmlBuilder();
    this.xmlSigner = new XmlSigner(config.certificates.dir);
    this.zipService = new ZipService();
  }

  /**
   * Proceso completo: construir XML, firmar, enviar a SUNAT
   * @param {Object} guia - Modelo Despatch
   * @param {Object} empresa - Datos de la empresa (v_empresas)
   * @param {string} idDocumento - ID del documento en BD
   */
  async emitir(guia, empresa, idDocumento) {
    try {
      logger.info(`Iniciando emisión GRE: ${guia.getIdentificador()}`);

      // 1. Construir XML
      const xml = this.xmlBuilder.build(guia);
      logger.info(`XML generado: ${xml.length} bytes`);

      // 2. Firmar XML
      const xmlFirmado = this.xmlSigner.signPfx(
        xml,
        empresa.nomcertificadopfx,
        empresa.clacertificadopfx
      );
      logger.info('XML firmado correctamente');

      // 3. Enviar a SUNAT
      const resultado = await sunatGreService.enviar(
        xmlFirmado,
        guia.getNombreArchivo(),
        empresa
      );

      // 4. Actualizar BD con el ticket
      await documentoRepository.actualizarEnvio(
        idDocumento,
        3, // estado: en proceso
        '',
        resultado.ticket,
        ''
      );

      logger.info(`GRE enviada. Ticket: ${resultado.ticket}`);

      return {
        success: true,
        ticket: resultado.ticket,
        mensaje: 'Guía enviada a SUNAT. Use el ticket para consultar estado.',
      };
    } catch (error) {
      logger.error(`Error emitiendo GRE: ${error.message}`);

      // Actualizar BD con error
      await documentoRepository.actualizarEnvio(
        idDocumento,
        0, // estado: error
        error.message,
        '',
        '99'
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Consultar estado de una GRE
   * @param {string} ticket
   * @param {Object} empresa
   */
  async consultarEstado(ticket, empresa) {
    return await sunatGreService.consultarEstado(ticket, empresa);
  }
}

module.exports = new GuiaRemisionService();
