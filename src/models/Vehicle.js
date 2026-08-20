class Vehicle {
  constructor(data = {}) {
    this.placa = data.placa || '';
    this.nroCirculacion = data.nroCirculacion || '';
    this.codEmisor = data.codEmisor || null;
    this.nroAutorizacion = data.nroAutorizacion || null;
    this.secundarios = data.secundarios || [];
  }
}

module.exports = Vehicle;
