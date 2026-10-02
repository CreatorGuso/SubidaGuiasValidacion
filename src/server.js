require('dotenv').config();

const procesoService = require('./services/proceso.service');
const logger = require('./utils/logger');

/**
 * Proceso por consola: recorre las guías pendientes de validación y las
 * emite a SUNAT. Al terminar cierra todas las conexiones y sale solo
 * (los pools se cierran en el servicio; no hay handles colgados).
 */
async function main() {
  const resumen = await procesoService.ejecutar();

  if (resumen.error) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  logger.error(`Error no manejado: ${error.message}`);
  process.exitCode = 1;
});