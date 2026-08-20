class AdditionalDoc {
  constructor(data = {}) {
    this.tipoDesc = data.tipoDesc || '';
    this.tipo = data.tipo || '';
    this.nro = data.nro || '';
    this.emisor = data.emisor || '';
  }
}

module.exports = AdditionalDoc;
