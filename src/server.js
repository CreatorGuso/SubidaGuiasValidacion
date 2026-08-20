const express = require('express');
const cors = require('cors');
require('dotenv').config();

const config = require('./config');
const logger = require('./utils/logger');
const guiaRoutes = require('./routes/guia.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/guias', guiaRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err.message);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Greenter API corriendo en puerto ${PORT}`);
});

module.exports = app;
