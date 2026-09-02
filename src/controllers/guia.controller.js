const empresaRepository = require('../database/empresa.repository');
const documentoRepository = require('../database/documento.repository');
const guiaMapper = require('../services/guia.mapper');
const guiaRemisionService = require('../services/guia-remision.service');
const logger = require('../utils/logger');

class GuiaController {
  /**
   * GET /api/guias/pendientes/:idEmpresa
   * Lista guías pendientes de envío
   */
  async listarPendientes(req, res) {
    try {
      const { idEmpresa } = req.params;
      const documentos = await documentoRepository.getGuiasPendientes(idEmpresa);
      res.json({ success: true, data: documentos });
    } catch (error) {
      logger.error(`Error listando guías pendientes: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/guias/detalle/:idEmpresa/:idOficina/:idDocumento?serie=&nrodoc=
   * Obtiene detalle completo de una guía (spmuestracomprobanteguia)
   */
  async obtenerDetalle(req, res) {
    try {
      const { idEmpresa, idOficina, idDocumento } = req.params;
      const { serie = '', nrodoc = '' } = req.query;
      const rows = await documentoRepository.getDetalleDocumento(
        idEmpresa, idOficina, idDocumento, serie, nrodoc
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error(`Error obteniendo detalle: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/guias/emitir
   * Emite una guía de remisión
   * Body: { idEmpresa, idOficina, idDocumento, serie, nroDoc }
   */
  async emitir(req, res) {
    try {
      const { idEmpresa, idOficina, idDocumento, serie, nroDoc } = req.body;

      if (!serie || !nroDoc) {
        return res.status(400).json({
          success: false,
          error: 'serie y nroDoc son obligatorios',
        });
      }

      // 1. Obtener empresa
      const empresa = await empresaRepository.getById(idEmpresa);
      if (!empresa) {
        return res.status(404).json({
          success: false,
          error: 'Empresa no encontrada',
        });
      }

      // 2. Obtener detalle del documento
      const rows = await documentoRepository.getDetalleDocumento(
        idEmpresa, idOficina, idDocumento, serie, nroDoc
      );
      if (!rows || rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Documento no encontrado',
        });
      }

      // 3. Mapear a modelo de dominio
      const guia = guiaMapper.mapGuiaFromSp(rows, empresa);

      // 4. Emitir
      const resultado = await guiaRemisionService.emitir(guia, empresa, idDocumento);

      if (resultado.success) {
        res.json(resultado);
      } else {
        res.status(400).json(resultado);
      }
    } catch (error) {
      logger.error(`Error emitiendo guía: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/guias/estado/:ticket
   * Consulta estado de una GRE en SUNAT y sincroniza la BD
   */
  async consultarEstado(req, res) {
    try {
      const { ticket } = req.params;

      const resultado = await guiaRemisionService.consultarEstado(ticket);

      // Sincronizar estado del documento si se encuentra por ticket
      try {
        const doc = await documentoRepository.getByTicket(ticket);
        if (doc) {
          if (resultado.estado === '0') {
            await documentoRepository.actualizarEnvio(doc.iddocumento, 1, 0, ticket, '');
          } else if (resultado.estado === '98') {
            await documentoRepository.actualizarEnvio(doc.iddocumento, 3, 98, ticket, '');
          } else if (resultado.estado === '99') {
            await documentoRepository.actualizarEnvio(
              doc.iddocumento, 5, 99, ticket,
              String(resultado.numError || '').slice(0, 4)
            );
          }
        }
      } catch (dbErr) {
        logger.warn(`No se pudo sincronizar estado en BD: ${dbErr.message}`);
      }

      res.json({ success: true, data: resultado });
    } catch (error) {
      logger.error(`Error consultando estado: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/guias/emitir-lote
   * Emite múltiples guías
   * Body: { idEmpresa, documentos: [{ idOficina, idDocumento, serie, nroDoc }] }
   */
  async emitirLote(req, res) {
    try {
      const { idEmpresa, documentos } = req.body;

      const empresa = await empresaRepository.getById(idEmpresa);
      if (!empresa) {
        return res.status(404).json({
          success: false,
          error: 'Empresa no encontrada',
        });
      }

      const resultados = [];
      for (const doc of documentos) {
        try {
          const rows = await documentoRepository.getDetalleDocumento(
            idEmpresa, doc.idOficina, doc.idDocumento, doc.serie, doc.nroDoc
          );
          const guia = guiaMapper.mapGuiaFromSp(rows, empresa);
          const resultado = await guiaRemisionService.emitir(
            guia, empresa, doc.idDocumento
          );
          resultados.push({ idDocumento: doc.idDocumento, ...resultado });
        } catch (error) {
          resultados.push({
            idDocumento: doc.idDocumento,
            success: false,
            error: error.message,
          });
        }
      }

      res.json({ success: true, data: resultados });
    } catch (error) {
      logger.error(`Error en lote: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new GuiaController();
