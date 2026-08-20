/**
 * Catálogos de SUNAT
 */

const CATALOGOS = {
  // Cat. 06 - Tipo de documento de identidad
  identityDocs: {
    '0': 'DNI',
    '1': 'DNI',
    '4': 'Carnet de Extranjería',
    '6': 'RUC',
    '7': 'Pasaporte',
    'A': 'Cédula Diplomática',
  },

  // Cat. 18 - Modalidad de traslado
  transferModes: {
    '01': 'Transporte privado',
    '02': 'Transporte público',
  },

  // Cat. 20 - Motivo de traslado
  transferReasons: {
    '01': 'Venta',
    '02': 'Compra',
    '03': 'Venta con entrega a tercero',
    '04': 'Traslado entre almacenes de la misma empresa',
    '05': 'Importación',
    '06': 'Exportación',
    '07': 'Otros transportes',
    '08': 'Traslado para prison o comiso',
    '09': 'Devolución',
    '10': 'Recolección de bienes muebles destruidos o averiados',
    '11': 'Reconocimiento médico fuera del local',
    '13': 'Traslado entre establecimientos de comercio itinerante',
    '14': 'Venta sujeta a confirmación del pedido',
    '15': 'Traslado de bienes para transformación',
    '16': 'Traslado vehículo usado',
  },

  // Cat. 01 - Tipo de documento
  documentTypes: {
    '01': 'Factura',
    '03': 'Boleta',
    '07': 'Nota de Crédito',
    '08': 'Nota de Débito',
    '09': 'Guía de Remisión',
  },

  // Unidades de medida UN/ECE Rec 20
  unitCodes: {
    'KGM': 'Kilogramo',
    'TNE': 'Tonelada métrica',
    'M': 'Metro',
    'LTR': 'Litro',
    'H87': 'Unidad',
    'BX': 'Caja',
    'BG': 'Bolsa',
    'CS': 'Estuche',
    'PL': 'Pallet',
    'ZZ': 'Mutualmente acordado',
  },

  // Indicadores especiales
  indicators: {
    transbordo: 'SUNAT_Envio_IndicadorTransbordoProgramado',
    vehiculoM1L: 'SUNAT_Envio_IndicadorTrasladoVehiculoM1L',
    retornoEnvaseVacio: 'SUNAT_Envio_IndicadorRetornoVehiculoEnvaseVacio',
    retornoVehiculoVacio: 'SUNAT_Envio_IndicadorRetornoVehiculoVacio',
    trasladoTotalDAM: 'SUNAT_Envio_IndicadorTrasladoTotalDAMoDS',
    vehiculoConductores: 'SUNAT_Envio_IndicadorVehiculoConductoresTransp',
  },
};

module.exports = CATALOGOS;
