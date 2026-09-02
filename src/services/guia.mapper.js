/**
 * Mapea los datos de la BD (v_empresas + spmuestracomprobanteguia)
 * a los modelos de dominio para la Guía de Remisión
 */

const {
  Despatch,
  DespatchDetail,
  Shipment,
  Direction,
  Transportist,
  Driver,
  Vehicle,
  Company,
  Client,
} = require('../models');
const logger = require('../utils/logger');

function clean(value) {
  return value == null ? '' : String(value).trim();
}

// Normaliza placa para SUNAT (regla 2567): solo alfanumérico,
// 6 a 8 posiciones según Anexo N°12 campo 44 (sin espacios ni guiones)
function limpiarPlaca(value) {
  return clean(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

class GuiaMapper {
  /**
   * Mapea empresa desde v_empresas
   */
  mapEmpresa(row) {
    return new Company({
      ruc: row.ruc || row.tiporuc,
      razonSocial: row.razonsocial,
      nombreComercial: row.nombrecomercial,
      direccion: row.direccion,
      ubigueo: row.ubigeo,
      departamento: row.departamento,
      provincia: row.provincia,
      distrito: row.distrito,
    });
  }

  /**
   * Mapea la guía desde el resultado del SP spmuestracomprobanteguia.
   * Cada fila es un item; los datos de cabecera se repiten en todas.
   * @param {Array} rows - Filas del SP
   * @param {Object} empresa - Empresa emisora (v_empresas)
   */
  mapGuiaFromSp(rows, empresa) {
    if (!rows || rows.length === 0) {
      throw new Error('No se encontraron datos del documento');
    }

    const header = rows[0];
    const company = this.mapEmpresa(empresa);

    // Destinatario (cliente)
    const destinatario = new Client({
      tipoDoc: clean(header.tipocltSUNAT) || '1',
      numDoc: clean(header.nropersoneria),
      rznSocial: clean(header.nompersoneria),
      direccion: clean(header.dirSUNATpl) || clean(header.direccionpl),
    });

    // Transportista (transporte público): SUNAT exige RUC (regla 2485) y que el RUC
    // exista en su padrón (regla 3348). El ERP puede traer DNI (8 dígitos) o vacío.
    const nrotranportista = clean(header.nrotranportista);
    const esPublicoSolicitado = clean(header.tipomodalidad) === '01';
    const transportistaEsRucValido = /^\d{11}$/.test(nrotranportista);
    // Si piden transporte público (01) pero no hay transportista con RUC real,
    // la guía se emite como TRANSPORTE PRIVADO (02): SUNAT no acepta la GRE 01
    // con DNI (3348) ni sin transportista (3347), y en privado no se envía.
    const esPublico = esPublicoSolicitado && transportistaEsRucValido;
    if (esPublicoSolicitado && !transportistaEsRucValido) {
      logger.warn(
        `Modalidad pública (01) sin transportista con RUC válido ("${nrotranportista || 'vacío'}"): ` +
        'la guía se emitirá como TRANSPORTE PRIVADO (02)'
      );
    }
    const transportista = esPublico
      ? new Transportist({
          tipoDoc: '6',
          numDoc: nrotranportista,
          rznSocial: clean(header.transportista),
        })
      : null;

    // Modalidad efectiva de la GRE y detección de "vehículo menor".
    const modTraslado = esPublico ? '01' : '02';
    const placaVehiculo = limpiarPlaca(header.placavehiculo);
    // Licencia vacía o en ceros ("00000000"): el ERP lo usa como señal de que el
    // traslado se hace en un vehículo de categoría M1 (auto ≤ 8 asientos) sin
    // conductor declarado.
    const licenciaCruda = clean(header.nrochofer);
    const licenciaEsVaciaOCeros = licenciaCruda === '' || /^0+$/.test(licenciaCruda);
    // Categorías L (motos/mototaxis/triciclos, placas M/W/Z — D.S. 058-2003-MTC)
    // y M1 (autos, sin prefijo de placa identificable): en transporte privado
    // SUNAT permite NO consignar placa ni conductor usando la instrucción
    // especial `SUNAT_Envio_IndicadorTrasladoVehiculoM1L` (R-123-2022).
    const esTrasladoVehiculoMenor =
      modTraslado === '02' && (/^[MWZ]/.test(placaVehiculo) || licenciaEsVaciaOCeros);

    // Vehículo principal
    const vehiculo = new Vehicle({
      placa: placaVehiculo,
    });

    // Chofer: columna "chofer" viene como "NOMBRES/APELLIDOS".
    // Si el ERP no registró chofer (dnichofer vacío) pero cargó al portador como
    // "transportista" persona natural (DNI), se usa esa persona como conductor
    // principal (en privado SUNAT lo exige: regla 3357).
    // En traslado con vehículo categoría L/M1 no se consigna conductor: se manda
    // el indicador M1L y se omite chofer, licencia y placa (excepción vigente).
    let choferes = [];
    if (!esTrasladoVehiculoMenor) {
      let dnichofer = clean(header.dnichofer);
      let nombresChofer = '';
      let apellidosChofer = '';
      if (dnichofer) {
        const [nombres = '', apellidos = ''] = clean(header.chofer).split('/');
        nombresChofer = nombres.trim();
        apellidosChofer = apellidos.trim();
      } else if (/^\d{8}$/.test(nrotranportista)) {
        const quebrar = clean(header.transportista).split('/');
        dnichofer = nrotranportista;
        nombresChofer = quebrar.pop().trim();
        apellidosChofer = quebrar.join(' ').trim();
      }
      // Licencia de conducir: SUNAT exige formato válido (regla 2573): dato
      // alfanumérico de 9 a 10 caracteres (solo letras mayúsculas y números, no
      // solamente ceros). Además el N° debe existir en las bases del MTC
      // (observación 4412, no bloqueante). Un DNI (8 dígitos) o un placeholder
      // como "00000000" NUNCA pasará: usar el DNI como licencia garantiza el
      // rechazo 2573. Fail-fast: si el ERP no trae un brevete válido se aborta
      // antes de quemar el ticket ante SUNAT (misma política de los rechazos
      // 3360/2573): hay que corregir el dato de licencia en el ERP.
      let licenciaChofer = clean(header.nrochofer).toUpperCase();
      const licenciaValida =
        /^[A-Z0-9]{9,10}$/.test(licenciaChofer) && !/^0+$/.test(licenciaChofer);
      if (dnichofer && !licenciaValida) {
        logger.error(
          `Licencia de conducir inválida para DNI ${dnichofer} (valor del ERP: "${licenciaChofer || '(vacío)'}"). ` +
          'SUNAT exige alfanumérico de 9 a 10 caracteres (regla 2573). Corregir nrochofer con el N° de brevete real.'
        );
        throw new Error(
          `La licencia de conducir del conductor (DNI ${dnichofer}) no cumple el formato SUNAT: ` +
          `"${licenciaChofer || '(vacío)'}". Debe ser el N° de brevete real, alfanumérico de 9 a 10 ` +
          'caracteres (ej. "B12345678", solo mayúsculas y números). No se puede usar el DNI ni "00000000". ' +
          'Corregir el campo de licencia en el ERP y reenviar la guía.'
        );
      }
      if (dnichofer) {
        choferes.push(new Driver({
          tipoDoc: '1',
          nroDoc: dnichofer,
          nombres: nombresChofer,
          apellidos: apellidosChofer,
          licencia: licenciaChofer,
        }));
      }
    }

    // Punto de partida
    const partida = new Direction(
      clean(header.ubigeopp) || '150101',
      clean(header.dirSUNATpp) || clean(header.direccionpp),
      '0000',
      company.ruc
    );

    // Punto de llegada
    const llegada = new Direction(
      clean(header.ubigeopl) || '150101',
      clean(header.dirSUNATpl) || clean(header.direccionpl),
      '0000',
      destinatario.numDoc
    );

    // Datos del traslado
    const envio = new Shipment({
      codTraslado: clean(header.tipomotivo) || '01',
      desTraslado: clean(header.motivo) || 'VENTA',
      modTraslado,
      indicadores: esTrasladoVehiculoMenor
        ? ['SUNAT_Envio_IndicadorTrasladoVehiculoM1L']
        : [],
      fecTraslado: header.fechainicio || header.fechaemision,
      fecEntregaBienes: header.fechainicio || header.fechaemision,
      pesoTotal: Number(header.peso) || 0,
      undPesoTotal: 'KGM',
      numBultos: Number(header.nrobultos) || 0,
      transportista,
      vehiculo,
      choferes,
      partida,
      llegada,
    });

    // Items (una fila por item)
    const details = rows.map((row) => new DespatchDetail({
      codigo: clean(row.codigo),
      descripcion: clean(row.serviciobien),
      unidad: clean(row.um_sunat) || 'NIU',
      cantidad: Number(row.cantidad) || 0,
    }));

    return new Despatch({
      version: '2022',
      tipoDoc: clean(header.tipodoc) || '09',
      serie: clean(header.seriedoc),
      correlativo: clean(header.nrodoc),
      observacion: clean(header.observaciones) || ' ',
      fechaEmision: header.fechaemision,
      company,
      destinatario,
      envio,
      details,
      addDocs: [],
    });
  }
}

module.exports = new GuiaMapper();
