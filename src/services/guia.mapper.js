/**
 * Mapea los datos de la BD (v_empresas + documentos_sve)
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
  Puerto,
  Company,
  Client,
} = require('../models');

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
   * Mapea datos del envío desde el resultado del stored procedure
   * @param {Array} rows - Resultado de sppyomuestradocumentos
   * @param {Object} empresa - Empresa emisora
   */
  mapGuiaFromSp(rows, empresa) {
    if (!rows || rows.length === 0) {
      throw new Error('No se encontraron datos del documento');
    }

    const header = rows[0];

    // Mapear empresa emisora
    const company = this.mapEmpresa(empresa);

    // Mapear destinatario (cliente)
    const destinatario = new Client({
      tipoDoc: header.cliente_tipodoc || '6',
      numDoc: header.cliente_numdoc || header.identificacion || '',
      rznSocial: header.cliente_razon || header.cliente_nombre || '',
      direccion: header.cliente_direccion || '',
    });

    // Mapear transportista
    const transportista = new Transportist({
      tipoDoc: '6',
      numDoc: empresa.ruc,
      rznSocial: empresa.razonsocial,
      nroMtc: header.transp_nromtc || '',
    });

    // Mapear vehículo
    const vehiculo = new Vehicle({
      placa: header.vehiculo_placa || '',
      nroCirculacion: header.vehiculo_nrocirculacion || '',
    });

    // Mapear chofer
    const choferes = [];
    if (header.chofer_nrodoc) {
      choferes.push(new Driver({
        tipo: 'Principal',
        tipoDoc: header.chofer_tipodoc || '1',
        nroDoc: header.chofer_nrodoc,
        nombres: header.chofer_nombres || '',
        apellidos: header.chofer_apellidos || '',
        licencia: header.chofer_licencia || '',
      }));
    }

    // Dirección partida
    const partida = new Direction(
      header.partida_ubigeo || empresa.ubigeo || '150101',
      header.partida_direccion || empresa.direccion || '',
      header.partida_codlocal || '0000',
      empresa.ruc
    );

    // Dirección llegada
    const llegada = new Direction(
      header.llegada_ubigeo || '150101',
      header.llegada_direccion || header.cliente_direccion || '',
      header.llegada_codlocal || '0000',
      header.cliente_numdoc || ''
    );

    // Envío
    const envio = new Shipment({
      codTraslado: header.motivo_traslado || '01',
      desTraslado: header.motivo_traslado_desc || 'Venta',
      modTraslado: header.modalidad_traslado || '01',
      fecTraslado: header.fecha_traslado || header.fecha_doc,
      pesoTotal: header.peso_total || 0,
      undPesoTotal: header.unidad_peso || 'KGM',
      numBultos: header.num_bultos || 1,
      transportista,
      vehiculo,
      choferes,
      partida,
      llegada,
    });

    // Items
    const details = rows.map((row, idx) => new DespatchDetail({
      codigo: row.item_codigo || String(idx + 1),
      descripcion: row.item_descripcion || row.descripcion || '',
      unidad: row.item_unidad || 'H87',
      cantidad: row.item_cantidad || row.cantidad || 1,
      codProdSunat: row.item_codprod || '',
    }));

    // Construir guía
    const guia = new Despatch({
      version: '2022',
      tipoDoc: '09',
      serie: header.serie_doc || 'T001',
      correlativo: String(header.numero_doc || '').padStart(8, '0'),
      observacion: header.observacion || ' ',
      fechaEmision: header.fecha_doc,
      company,
      destinatario,
      envio,
      details,
      addDocs: [],
    });

    return guia;
  }
}

module.exports = new GuiaMapper();
