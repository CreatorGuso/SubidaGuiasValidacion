const express = require('express');
const router = express.Router();
const guiaController = require('../controllers/guia.controller');

// Listar guías pendientes
router.get('/pendientes/:idEmpresa', guiaController.listarPendientes);

// Obtener detalle de una guía
router.get('/detalle/:idEmpresa/:idOficina/:idDocumento', guiaController.obtenerDetalle);

// Emitir una guía
router.post('/emitir', guiaController.emitir);

// Emitir lote de guías
router.post('/emitir-lote', guiaController.emitirLote);

// Consultar estado en SUNAT
router.get('/estado/:ticket', guiaController.consultarEstado);

module.exports = router;
