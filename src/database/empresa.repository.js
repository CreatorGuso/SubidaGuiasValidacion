const { getConnection, sql } = require('../database/connection');

class EmpresaRepository {
  async getById(idEmpresa) {
    const pool = await getConnection();
    const result = await pool.request()
      .input('idEmpresa', sql.VarChar(10), String(idEmpresa))
      .query('SELECT * FROM v_empresas WHERE idempresa = @idEmpresa');
    return result.recordset[0] || null;
  }

  async getAll() {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT * FROM v_empresas');
    return result.recordset;
  }
}

module.exports = new EmpresaRepository();
