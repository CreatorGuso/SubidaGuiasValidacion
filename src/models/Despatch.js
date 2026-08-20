class Despatch {
  constructor(data = {}) {
    this.version = data.version || '2022';
    this.tipoDoc = data.tipoDoc || '09';
    this.serie = data.serie || '';
    this.correlativo = data.correlativo || '';
    this.observacion = data.observacion || '';
    this.fechaEmision = data.fechaEmision || null;
    this.company = data.company || null;
    this.destinatario = data.destinatario || null;
    this.tercero = data.tercero || null;
    this.comprador = data.comprador || null;
    this.envio = data.envio || null;
    this.addDocs = data.addDocs || [];
    this.details = data.details || [];
  }

  getNombreArchivo() {
    if (!this.company) return '';
    return `${this.company.ruc}-${this.tipoDoc}-${this.serie}-${this.correlativo}`;
  }

  getIdentificador() {
    return `${this.serie}-${this.correlativo}`;
  }
}

module.exports = Despatch;
