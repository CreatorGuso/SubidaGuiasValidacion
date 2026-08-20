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
      logger.error('Error listando guías pendientes:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/guias/detalle/:idEmpresa/:idOficina/:idDocumento
   * Obtiene detalle completo de una guía
   */
  async obtenerDetalle(req, res) {
    try {
      const { idEmpresa, idOficina, idDocumento } = req.params;
      const rows = await documentoRepository.getDetalleDocumento(
        idEmpresa, idOficina, idDocumento
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error('Error obteniendo detalle:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/guias/emitir
   * Emite una guía de remisión
   * Body: { idEmpresa, idOficina, idDocumento }
   */
  async emitir(req, res) {
    try {
      const { idEmpresa, idOficina, idDocumento } = req.body;

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
        idEmpresa, idOficina, idDocumento
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
      logger.error('Error emitiendo guía:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/guias/estado/:ticket
   * Consulta estado de una GRE en SUNAT
   */
  async consultarEstado(req, res) {
    try {
      const { ticket } = req.params;
      const { idEmpresa } = req.query;

      const empresa = await empresaRepository.getById(idEmpresa || 1);
      const resultado = await guiaRemisionService.consultarEstado(ticket, empresa);

      res.json({ success: true, data: resultado });
    } catch (error) {
      logger.error('Error consultando estado:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/guias/emitir-lote
   * Emite múltiples guías
   * Body: { idEmpresa, documentos: [{ idOficina, idDocumento }] }
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
            idEmpresa, doc.idOficina, doc.idDocumento
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
      logger.error('Error en lote:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new GuiaController();
