const adminRepository = require('../database/admin.repository');
const erpRepository = require('../database/erp.repository');
const { getAdminPool, createErpPool, closePool, closeAdminPool } = require('../database/connection');
const guiaMapper = require('./guia.mapper');
const guiaRemisionService = require('./guia-remision.service');
const { descripcionError } = require('../utils/motivos-error');
const config = require('../config');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

/** Formatea una fecha de mssql (Date o string) como YYYY-MM-DD. */
function _fecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const texto = String(valor).trim();
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? texto : fecha.toISOString().slice(0, 10);
}

class ProcesoService {
  /**
   * Recorre todas las guías pendientes de validación y las emite a SUNAT.
   *
   * 1. BD central (admin): exec spPyOValidaGuia
   * 2. Se filtran las de Estado = 1 y se agrupan por ID (Conexiones.id)
   * 3. Por cada grupo: se lee Conexiones y se abre el pool de ese ERP
   * 4. Por cada guía: detalle en el ERP -> XML -> firma -> SUNAT -> respuesta
   * 5. Se cierra el pool del ERP y se pasa al siguiente grupo
   *
   * @returns {Promise<Object>} Resumen de la ejecución
   */
  async ejecutar() {
    const resumen = {
      pendientes: 0,
      procesadas: 0,
      aceptadas: 0,
      rechazadas: 0,
      conError: 0,
      conexiones: [],
      detalles: [],
      reporte: null,
    };

    logger.info('=== Iniciando proceso de envío de GRE ===');

    try {
      // 1. Guías pendientes desde la BD central
      const todas = await adminRepository.getGuiasPendientes();
      const pendientes = todas.filter((row) => String(row.Estado).trim() === '1');

      logger.info(`spPyOValidaGuia devolvió ${todas.length} guías; ${pendientes.length} con Estado = 1`);
      resumen.pendientes = pendientes.length;

      if (pendientes.length === 0) {
        logger.info('No hay guías pendientes de validar.');
      } else {
        // 2. Agrupar por conexión (ERP)
        const grupos = new Map();
        for (const row of pendientes) {
          const id = Number(row.ID);
          if (!grupos.has(id)) grupos.set(id, []);
          grupos.get(id).push(row);
        }

        logger.info(`Conexiones a procesar: ${[...grupos.keys()].join(', ')}`);

        // 3-5. Recorrer cada conexión
        for (const [idConexion, documentos] of grupos) {
          await this._procesarConexion(idConexion, documentos, resumen);
        }
      }
    } catch (error) {
      logger.error(`Error general del proceso: ${error.message}`);
      resumen.error = error.message;
    } finally {
      await this._generarReporte(resumen);
      await closeAdminPool();
    }

    this._logResumen(resumen);
    return resumen;
  }

  /**
   * Procesa todas las guías de una conexión: abre el pool del ERP, carga la
   * configuración de la empresa y emite sus guías una por una.
   */
  async _procesarConexion(idConexion, documentos, resumen) {
    logger.info('');
    logger.info(`--- Conexión ${idConexion} (${documentos.length} guía(s)) ---`);

    const conexion = await adminRepository.getConexion(idConexion);
    if (!conexion) {
      logger.error(`Conexión ${idConexion} no existe en admin.Conexiones. Se omite.`);
      resumen.conexiones.push({ idConexion, ruc: null, error: 'Conexión no encontrada' });
      return;
    }

    const etiqueta = `${conexion.ruc} / ${conexion.NombreServer}.${conexion.NombreBD}`;
    const ficha = {
      idConexion,
      ruc: conexion.ruc,
      base: conexion.NombreBD,
      server: conexion.NombreServer,
      user: conexion.usuario,
      password: conexion.clave,
      empresa: null,
      error: null,
    };
    resumen.conexiones.push(ficha);

    // Todas las guías de la conexión deben pertenecer a la misma empresa
    const idEmpresa = String(documentos[0].idEmpresa || '').trim();

    let pool = null;
    try {
      logger.info(`Conectando a ${etiqueta} como ${conexion.usuario}...`);
      pool = await createErpPool({
        server: conexion.NombreServer,
        database: conexion.NombreBD,
        user: conexion.usuario,
        password: conexion.clave,
      });

      const empresa = await erpRepository.getEmpresa(pool, idEmpresa);
      if (!empresa) {
        throw new Error(`No se encontró la empresa ${idEmpresa} en v_empresas de ${conexion.NombreBD}`);
      }
      ficha.empresa = empresa.razonsocial;

      const oauth = await erpRepository.getCredencialesOAuth(pool, idEmpresa);
      const credenciales = {
        clientId: oauth.clientId,
        clientSecret: oauth.clientSecret,
        ruc: String(empresa.ruc || '').trim(),
        usuarioSol: String(empresa.usuariosol || '').trim(),
        claveSol: String(empresa.clavesol || '').trim(),
      };

      logger.info(
        `Empresa ${empresa.razonsocial} (RUC ${credenciales.ruc}) | ` +
        `certificado ${empresa.nomcertificadopfx} | ` +
        `client_id ${credenciales.clientId ? 'ok' : 'FALTA'} | ` +
        `client_secret ${credenciales.clientSecret ? 'ok' : 'FALTA'}`
      );

      if (!credenciales.clientId || !credenciales.clientSecret) {
        throw new Error(
          `Faltan credenciales OAuth de SUNAT en tablas_empresas (700013/700014) de ${conexion.NombreBD}`
        );
      }

      for (const documento of documentos) {
        await this._procesarGuia(pool, documento, empresa, credenciales, resumen, {
          idConexion,
          base: conexion.NombreBD,
          ruc: conexion.ruc,
          empresa: empresa.razonsocial,
        });
      }
    } catch (error) {
      logger.error(`Conexión ${idConexion} (${etiqueta}): ${error.message}`);
      ficha.error = error.message;
      resumen.conError += documentos.length;
    } finally {
      if (pool) {
        await closePool(pool);
        logger.info(`Conexión ${idConexion} cerrada.`);
      }
    }
  }

  /**
   * Emite una guía: lee el detalle en el ERP, mapea, firma, envía y registra
   * la respuesta. Los errores no detienen el proceso.
   *
   * Si la validación local falla (dato de la guía incompleto), se escribe solo
   * el código de error en `coderror_sunat`: el documento conserva su `estado`
   * para que el ERP lo corrija o lo anule y se vuelva a intentar.
   */
  async _procesarGuia(pool, fila, empresa, credenciales, resumen, contexto) {
    const idDocumento = String(fila.idDocumento || '').trim();
    const item = { ...contexto, idDocumento, documento: null, motivo: null, codError: null };

    try {
      const documento = await erpRepository.getDocumento(pool, idDocumento);
      if (!documento) {
        throw new Error('No se encontró el documento en documentos_sve');
      }

      item.documento = `${String(documento.serie_doc).trim()}-${String(documento.numero_doc).trim()}`;

      const rows = await erpRepository.getDetalleGuia(
        pool,
        documento.idempresa,
        documento.idoficina,
        documento.serie_doc,
        documento.numero_doc
      );
      if (!rows || rows.length === 0) {
        throw new Error('El procedimiento spMuestraComprobanteGuia no devolvió líneas');
      }

      const guia = guiaMapper.mapGuiaFromSp(rows, empresa);
      const resultado = await guiaRemisionService.emitir(pool, guia, empresa, credenciales, idDocumento);

      if (!resultado.success) {
        item.codError = String(resultado.numError || resultado.estado || '').trim() || null;
        item.motivo = resultado.descripcion || null;
      }

      resumen.procesadas++;
      if (resultado.success) {
        resumen.aceptadas++;
      } else if (resultado.ticket) {
        resumen.rechazadas++;
      } else {
        resumen.conError++;
      }
    } catch (error) {
      resumen.procesadas++;
      resumen.conError++;
      logger.error(`Documento ${idDocumento}: ${error.message}`);

      item.codError = error.codigo || null;
      item.motivo = error.message;

      if (error.codigo) {
        await this._registrarError(pool, idDocumento, error.codigo);
      }
    }

    resumen.detalles.push(item);
  }

  /** Escribe el código de error de la validación local sin tocar `estado`. */
  async _registrarError(pool, idDocumento, codigo) {
    try {
      await erpRepository.actualizarEnvio(pool, idDocumento, {
        respuestaSunat: 99,
        idSunat: '',
        codError: codigo,
      });
      logger.info(`Documento ${idDocumento}: código de error ${codigo} registrado en el ERP.`);
    } catch (dbError) {
      logger.error(`No se pudo registrar el error del documento ${idDocumento}: ${dbError.message}`);
    }
  }

  /**
   * Genera el reporte de guías pendientes con su motivo de fallo.
   *
   * El archivo se SOBREESCRIBE en cada ejecución (así solo contiene lo
   * pendiente del día). Además de lo fallido en esta corrida, incluye las
   * guías que ya tenían un error de días anteriores y que el ERP aún no
   * resolvió, para que no se pierdan de vista.
   */
  async _generarReporte(resumen) {
    const pendientes = resumen.detalles.filter((item) => item.codError);

    // Complementar con lo que ya estaba pendiente en cada ERP
    for (const conexion of resumen.conexiones) {
      if (conexion.error) continue;
      try {
        const pool = await createErpPool({
          server: conexion.server,
          database: conexion.base,
          user: conexion.user,
          password: conexion.password,
        });
        try {
          const filas = await erpRepository.getPendientesConError(pool);
          for (const fila of filas) {
            const idDocumento = String(fila.iddocumento).trim();
            if (pendientes.some((p) => p.idDocumento === idDocumento)) continue;

            pendientes.push({
              idConexion: conexion.idConexion,
              base: conexion.base,
              ruc: conexion.ruc,
              empresa: conexion.empresa,
              idDocumento,
              documento: `${String(fila.serie_doc).trim()}-${String(fila.numero_doc).trim()}`,
              fecha: _fecha(fila.fecha_doc),
              estado: String(fila.estado || '').trim(),
              codError: String(fila.coderror_sunat).trim(),
              motivo: descripcionError(fila.coderror_sunat),
            });
          }
        } finally {
          await closePool(pool);
        }
      } catch (error) {
        logger.error(`No se pudo leer los pendientes de ${conexion.base}: ${error.message}`);
      }
    }

    // Descripción completa para lo fallido en esta corrida
    for (const item of pendientes) {
      if (!item.motivo) item.motivo = descripcionError(item.codError);
    }

    const reporte = {
      generado: new Date().toISOString(),
      total: pendientes.length,
      conexiones: resumen.conexiones.length,
      porBase: pendientes.reduce((acc, item) => {
        acc[item.base] = (acc[item.base] || 0) + 1;
        return acc;
      }, {}),
      pendientes,
    };

    try {
      await fs.promises.mkdir(config.reporte.dir, { recursive: true });
      const ruta = path.join(config.reporte.dir, config.reporte.archivo);
      await fs.promises.writeFile(ruta, JSON.stringify(reporte, null, 2), 'utf8');
      logger.info(`Reporte de pendientes: ${ruta} (${pendientes.length} guía(s))`);
      resumen.reporte = ruta;
    } catch (error) {
      logger.error(`No se pudo escribir el reporte: ${error.message}`);
    }
  }

  _logResumen(resumen) {
    logger.info('');
    logger.info('=== Resumen del proceso ===');
    logger.info(`Guías pendientes (Estado = 1) : ${resumen.pendientes}`);
    logger.info(`Procesadas                    : ${resumen.procesadas}`);
    logger.info(`Aceptadas por SUNAT           : ${resumen.aceptadas}`);
    logger.info(`Rechazadas por SUNAT          : ${resumen.rechazadas}`);
    logger.info(`Con error                     : ${resumen.conError}`);
    logger.info('===============================');
  }
}

module.exports = new ProcesoService();