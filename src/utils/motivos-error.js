/**
 * Descripciones de los códigos de error de SUNAT para las GRE.
 * Se usan cuando el detalle de la guía no viene de la corrida en curso
 * (por ejemplo, documentos que fallaron en días anteriores).
 */
const DESCRIPCIONES = {
  '0306': 'El XML no cumple con el formato establecido (estructura UBL incorrecta)',
  '1037': 'El dato del emisor/destinatario no cumple con la estructura 2022',
  '2017': 'El RUC del emisor no existe en el padrón de contribuyentes',
  '2027': 'El RUC del emisor no está activo',
  '2108': 'Presentación fuera de fecha o con fecha/hora posterior a la de la consulta',
  '2335': 'El documento electrónico ya fue aceptado anteriormente',
  '2567': 'El número de placa no cumple el formato (6 a 8 alfanuméricos, sin guion)',
  '2569': 'Documento de identidad del conductor: dato inconsistente o inexistente',
  '2573': 'Número de licencia de conducir con formato inválido (9 a 10 alfanuméricos)',
  '3347': 'En transporte público no se consignó el transportista',
  '3348': 'El número de RUC del transportista no existe en el padrón',
  '3354': 'En transporte público no se debe consignar vehículo ni conductor',
  '3357': 'Falta el conductor principal en transporte privado',
  '3360': 'Falta el dato del conductor en transporte privado',
  '3388': 'El indicador no cumple con el formato establecido',
  '3409': 'El código de establecimiento anexo no corresponde a un RUC válido',
  '3411': 'El RUC del punto de partida/llegada es igual al RUC del remitente',
  '3617': 'No se ingresó la fecha de entrega de bienes al transportista',
  '3618': 'La fecha de entrega de bienes al transportista es anterior a la fecha de emisión',
  '3619': 'La fecha de entrega de bienes al transportista tiene un formato inválido',
  '4045': 'El valor de la modalidad de traslado no pertenece al catálogo 18',
  '4412': 'Observación: el número de licencia no existe en las bases del MTC',
};

/**
 * @param {string|null|undefined} codigo - coderror_sunat
 * @returns {string} Descripción del error, o el propio código si no se conoce
 */
function descripcionError(codigo) {
  const cod = String(codigo || '').trim();
  if (!cod) return '';
  return DESCRIPCIONES[cod] || `Error SUNAT ${cod}`;
}

module.exports = { DESCRIPCIONES, descripcionError };