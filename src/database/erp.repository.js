const { sql } = require('./connection');

// idtipo de la guía de remisión en el ERP (030009)
const ID_TIPO_GUIA = '030009';

class ErpRepository {
  /**
   * Encabezado del documento en documentos_sve: sirve para resolver
   * idempresa / idoficina / serie / número que exige el SP de detalle.
   * @param {import('mssql').ConnectionPool} pool
   * @param {string} idDocumento
   */
  async getDocumento(pool, idDocumento) {
    const result = await pool.request()
      .input('idDocumento', sql.Char(12), String(idDocumento).trim())
      .query(`
        SELECT TOP 1 idempresa, idoficina, iddocumento, idtipo, estado,
               serie_doc, numero_doc, fecha_doc
        FROM documentos_sve
        WHERE iddocumento = @idDocumento AND idtipo = '09'
        ORDER BY fecha_doc DESC
      `);
    return result.recordset[0] || null;
  }

  /**
   * Detalle completo de la guía (spMuestraComprobanteGuia).
   * @param {import('mssql').ConnectionPool} pool
   * @param {string} idEmpresa
   * @param {string} idOficina
   * @param {string} serie
   * @param {string} nro
   */
  async getDetalleGuia(pool, idEmpresa, idOficina, serie, nro) {
    const result = await pool.request()
      .input('idempresa', sql.Char(2), String(idEmpresa).trim())
      .input('idoficina', sql.Char(2), String(idOficina).trim())
      .input('idtipoguia', sql.Char(6), ID_TIPO_GUIA)
      .input('serieguia', sql.VarChar(5), String(serie || '').trim())
      .input('nroguia', sql.Char(8), String(nro || '').trim())
      .query('exec spMuestraComprobanteGuia @idempresa, @idoficina, @idtipoguia, @serieguia, @nroguia');

    return result.recordset || [];
  }

  /**
   * Datos de la emisora (v_empresas): RUC, credenciales SOL y certificado PFX.
   * @param {import('mssql').ConnectionPool} pool
   * @param {string} idEmpresa
   */
  async getEmpresa(pool, idEmpresa) {
    const result = await pool.request()
      .input('idempresa', sql.Char(2), String(idEmpresa).trim())
      .query('SELECT * FROM v_empresas WHERE idempresa = @idempresa');
    return result.recordset[0] || null;
  }

  /**
   * Credenciales OAuth2 de SUNAT guardadas en el ERP:
   *   700014 -> client_id      (SUNAT_CLIENT_ID)
   *   700013 -> client_secret  (SUNAT_CLIENT_SECRET)
   * @param {import('mssql').ConnectionPool} pool
   * @param {string} idEmpresa
   */
  async getCredencialesOAuth(pool, idEmpresa) {
    const result = await pool.request()
      .input('idempresa', sql.Char(2), String(idEmpresa).trim())
      .query(`
        SELECT idcodigo, descripcion
        FROM tablas_empresas
        WHERE idempresa = @idempresa AND idcodigo IN ('700013', '700014')
      `);

    const porCodigo = {};
    for (const row of result.recordset) {
      porCodigo[String(row.idcodigo).trim()] = String(row.descripcion || '').trim();
    }

    return {
      clientId: porCodigo['700014'] || '',
      clientSecret: porCodigo['700013'] || '',
    };
  }

  /**
   * Guías que siguen pendientes de corrección en el ERP.
   *
   * 'estado = 2' es lo único que el ERP mantiene cuando un envío no fue
   * aceptado: con 'respuesta_sunat = 99' y su código de error. El ERP mueve
   * el documento a '5' (aceptado, validado = 1) o a '6' (cerrado/anulado)
   * cuando lo resuelve, así que este filtro coincide con lo que devuelve
   * spPyOValidaGuia.
   * @param {import('mssql').ConnectionPool} pool
   */
  async getPendientesConError(pool) {
    const result = await pool.request().query(`
      SELECT idempresa, idoficina, iddocumento, serie_doc, numero_doc,
             estado, validado, respuesta_sunat, coderror_sunat, fecha_sunat, fecha_doc
      FROM documentos_sve
      WHERE idtipo = '09'
        AND estado = '2'
        AND respuesta_sunat = 99
        AND LTRIM(RTRIM(coderror_sunat)) <> ''
      ORDER BY iddocumento
    `);
    return result.recordset || [];
  }

  /**
   * Registra la respuesta de SUNAT. NO se toca 'estado': ese campo lo
   * administra el ERP. Si idSunat viene vacío se conserva el ticket previo.
   * @param {import('mssql').ConnectionPool} pool
   * @param {string} idDocumento
   * @param {{respuestaSunat: number|string, idSunat?: string, codError?: string}} datos
   */
  async actualizarEnvio(pool, idDocumento, datos) {
    await pool.request()
      .input('idDocumento', sql.Char(12), String(idDocumento).trim())
      .input('respuestaSunat', sql.Int, Number(datos.respuestaSunat) || 0)
      .input('idSunat', sql.VarChar(50), datos.idSunat || '')
      .input('fechaSunat', sql.DateTime, new Date())
      .input('codErrorSunat', sql.Char(4), String(datos.codError || '').slice(0, 4))
      .query(`
        UPDATE documentos_sve
        SET respuesta_sunat = @respuestaSunat,
            id_sunat = ISNULL(NULLIF(@idSunat, ''), id_sunat),
            fecha_sunat = @fechaSunat,
            coderror_sunat = @codErrorSunat
        WHERE iddocumento = @idDocumento
      `);
  }
}

module.exports = new ErpRepository();