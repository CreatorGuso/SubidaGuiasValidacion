class Shipment {
  constructor(data = {}) {
    this.codTraslado = data.codTraslado || '01';
    this.desTraslado = data.desTraslado || '';
    this.modTraslado = data.modTraslado || '01';
    this.fecTraslado = data.fecTraslado || null;
    this.fecEntregaBienes = data.fecEntregaBienes || null;
    this.pesoTotal = data.pesoTotal || 0;
    this.undPesoTotal = data.undPesoTotal || 'KGM';
    this.numBultos = data.numBultos || 0;
    this.pesoItems = data.pesoItems || null;
    this.sustentoPeso = data.sustentoPeso || null;
    this.indicadores = data.indicadores || [];
    this.contenedores = data.contenedores || [];
    this.transportista = data.transportista || null;
    this.vehiculo = data.vehiculo || null;
    this.choferes = data.choferes || [];
    this.partida = data.partida || null;
    this.llegada = data.llegada || null;
    this.puerto = data.puerto || null;
    this.aeropuerto = data.aeropuerto || null;
  }
}

module.exports = Shipment;
