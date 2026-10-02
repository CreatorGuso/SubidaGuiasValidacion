const sql = require('mssql');
const config = require('../config');
const logger = require('../utils/logger');

let adminPool = null;

/**
 * Pool de la BD central (admin). Singleton: se crea una sola vez.
 */
async function getAdminPool() {
  if (!adminPool) {
    const pool = new sql.ConnectionPool(config.db);
    _vigilar(pool, 'admin');
    await pool.connect();
    adminPool = pool;
  }
  return adminPool;
}

/**
 * Crea y abre un pool contra el ERP de una conexión de admin.Conexiones.
 * Si la apertura falla, el pool se descarta para no dejar conexiones colgadas.
 * @param {{server: string, database: string, user: string, password: string}} conn
 * @returns {Promise<import('mssql').ConnectionPool>}
 */
async function createErpPool(conn) {
  const etiqueta = `${conn.server}/${conn.database}`;
  const pool = new sql.ConnectionPool({
    server: conn.server,
    port: config.db.port,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    options: config.db.options,
    connectionTimeout: 20000,
    requestTimeout: 60000,
    pool: { max: 4, min: 0, idleTimeoutMillis: 30000 },
  });

  _vigilar(pool, etiqueta);

  try {
    await pool.connect();
  } catch (error) {
    await pool.close().catch(() => {});
    throw error;
  }

  return pool;
}

/**
 * mssql emite 'error' en el pool cuando una conexión se cae. Sin un listener,
 * Node lo trata como unhandled 'error' event y **aborta el proceso** a mitad
 * de la corrida. Solo se registra: el request que falla ya maneja su error.
 */
function _vigilar(pool, etiqueta) {
  pool.on('error', (error) => {
    logger.error(`Error en el pool ${etiqueta}: ${error.message}`);
  });
}

/**
 * Cierra un pool y descarta la referencia del singleton de admin.
 * @param {import('mssql').ConnectionPool} pool
 */
async function closePool(pool) {
  if (!pool) return;
  try {
    await pool.close();
  } catch (error) {
    logger.error(`Error cerrando el pool: ${error.message}`);
  } finally {
    if (pool === adminPool) adminPool = null;
  }
}

async function closeAdminPool() {
  await closePool(adminPool);
}

module.exports = { sql, getAdminPool, createErpPool, closePool, closeAdminPool };