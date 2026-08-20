class Driver {
  constructor(data = {}) {
    this.tipo = data.tipo || 'Principal';
    this.tipoDoc = data.tipoDoc || '1';
    this.nroDoc = data.nroDoc || '';
    this.nombres = data.nombres || '';
    this.apellidos = data.apellidos || '';
    this.licencia = data.licencia || '';
  }
}

module.exports = Driver;
