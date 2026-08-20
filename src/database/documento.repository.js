const { getConnection, sql } = require('../database/connection');

class DocumentoRepository {
  /**
   * Lista guías de remisión pendientes de envío (estado=2, tipo=09)
   */
  async getGuiasPendientes(idEmpresa) {
    const pool = await getConnection();
    const result = await pool.request()
      .input('idEmpresa', sql.Int, idEmpresa)
      .query(`
        SELECT *
        FROM documentos_sve
        WHERE estado = 2
          AND idtipo = '09'
          AND idempresa = @idEmpresa
        ORDER BY fecha_doc DESC
      `);
    return result.recordset;
  }

  /**
   * Obtiene el detalle completo de un documento usando el stored procedure
   * @param {number} idEmpresa
   * @param {number} idOficina
   * @param {string} idDocumento
   */
  async getDetalleDocumento(idEmpresa, idOficina, idDocumento) {
    const pool = await getConnection();
    const result = await pool.request()
      .input('idEmpresa', sql.Int, idEmpresa)
      .input('idOficina', sql.Int, idOficina)
      .input('idDocumento', sql.VarChar(20), idDocumento)
      .execute('sppyomuestradocumentos');
    return result.recordset;
  }

  /**
   * Actualiza estado del documento después de enviar a SUNAT
   */
  async actualizarEnvio(idDocumento, estado, respuestaSunat, idSunat, codError) {
    const pool = await getConnection();
    await pool.request()
      .input('idDocumento', sql.VarChar(20), idDocumento)
      .input('estado', sql.Int, estado)
      .input('respuestaSunat', sql.VarChar(500), respuestaSunat || '')
      .input('idSunat', sql.VarChar(100), idSunat || '')
      .input('fechaSunat', sql.DateTime, new Date())
      .input('codErrorSunat', sql.VarChar(10), codError || '')
      .query(`
        UPDATE documentos_sve
        SET estado = @estado,
            respuesta_sunat = @respuestaSunat,
            id_sunat = @idSunat,
            fecha_sunat = @fechaSunat,
            coderror_sunat = @codErrorSunat
        WHERE iddocumento = @idDocumento
      `);
  }
}

module.exports = new DocumentoRepository();
