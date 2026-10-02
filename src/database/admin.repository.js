const { sql, getAdminPool } = require('./connection');

class AdminRepository {
  /**
   * Guías pendientes de validar según la BD central.
   * spPyOValidaGuia no recibe parámetros y devuelve:
   *   ID        -> Conexiones.id (a qué ERP pertenece la guía)
   *   idEmpresa -> idempresa dentro de ese ERP
   *   idDocumento
   *   Estado    -> 1 = pendiente de validar/enviar
   *   DriveID
   * @returns {Promise<Array<{ID: number, idEmpresa: string, idDocumento: string, Estado: number, DriveID: string}>>}
   */
  async getGuiasPendientes() {
    const pool = await getAdminPool();
    const result = await pool.request().query('exec spPyOValidaGuia');
    return result.recordset || [];
  }

  /**
   * Datos de conexión de un ERP.
   * @param {number} id - Conexiones.id
   */
  async getConexion(id) {
    const pool = await getAdminPool();
    const result = await pool.request()
      .input('id', sql.Int, Number(id))
      .query('SELECT * FROM Conexiones WHERE id = @id');
    return result.recordset[0] || null;
  }
}

module.exports = new AdminRepository();