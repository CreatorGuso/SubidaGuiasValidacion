const XmlBuilder = require('../xml/builder');
const XmlSigner = require('../xml/signer');
const sunatGreService = require('./sunat-gre.service');
const erpRepository = require('../database/erp.repository');
const config = require('../config');
const logger = require('../utils/logger');

class GuiaRemisionService {
  constructor() {
    this.xmlBuilder = new XmlBuilder();
    this.xmlSigner = new XmlSigner(config.certificates.dir);
  }

  /**
   * Proceso completo de una guía: construir XML, firmar, enviar a SUNAT,
   * esperar el estado final y registrar la respuesta en el ERP.
   *
   * @param {import('mssql').ConnectionPool} pool - Pool del ERP dueño del documento
   * @param {Object} guia - Modelo Despatch
   * @param {Object} empresa - Fila de v_empresas (certificado, RUC)
   * @param {Object} credenciales - Credenciales SUNAT de la empresa
   * @param {string} idDocumento
   * @returns {Promise<{success: boolean, ticket: string|null, descripcion: string}>}
   */
  async emitir(pool, guia, empresa, credenciales, idDocumento) {
    const identificador = guia.getIdentificador();

    try {
      logger.info(`[${identificador}] Generando XML...`);
      const xml = this.xmlBuilder.build(guia);
      logger.info(`[${identificador}] XML generado: ${xml.length} bytes`);

      logger.info(`[${identificador}] Firmando con ${empresa.nomcertificadopfx}...`);
      const xmlFirmado = this.xmlSigner.signPfx(
        xml,
        empresa.nomcertificadopfx,
        empresa.clacertificadopfx
      );

      const { ticket } = await sunatGreService.enviar(
        xmlFirmado,
        guia.getNombreArchivo(),
        credenciales
      );

      const estado = await sunatGreService.esperarEstado(ticket, credenciales);
      const aceptado = estado.estado === '0';

      await erpRepository.actualizarEnvio(pool, idDocumento, {
        respuestaSunat: Number(estado.estado) || 0,
        idSunat: ticket,
        codError: aceptado ? '' : String(estado.numError || estado.estado || ''),
      });

      if (aceptado) {
        logger.info(`[${identificador}] ACEPTADA por SUNAT (ticket ${ticket})`);
      } else {
        logger.error(
          `[${identificador}] RECHAZADA por SUNAT (ticket ${ticket}): ` +
          `${estado.numError || ''} ${estado.descripcion}`
        );
      }

      return {
        success: aceptado,
        ticket,
        estado: estado.estado,
        descripcion: estado.descripcion,
        numError: estado.numError,
      };
    } catch (error) {
      logger.error(`[${identificador}] Error al emitir: ${error.message}`);

      try {
        await erpRepository.actualizarEnvio(pool, idDocumento, {
          respuestaSunat: 99,
          idSunat: '',
          codError: error.codigo || '99',
        });
      } catch (dbError) {
        logger.error(`[${identificador}] No se pudo registrar el error en el ERP: ${dbError.message}`);
      }

      return {
        success: false,
        ticket: null,
        descripcion: error.message,
      };
    }
  }
}

module.exports = new GuiaRemisionService();