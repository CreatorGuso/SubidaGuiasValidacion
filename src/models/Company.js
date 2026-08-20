class Company {
  constructor(data = {}) {
    this.ruc = data.ruc || '';
    this.razonSocial = data.razonSocial || '';
    this.nombreComercial = data.nombreComercial || '';
    this.direccion = data.direccion || '';
    this.ubigueo = data.ubigueo || '';
    this.departamento = data.departamento || '';
    this.provincia = data.provincia || '';
    this.distrito = data.distrito || '';
  }

  getDireccionCompleta() {
    return `${this.direccion}, ${this.distrito}, ${this.provincia}, ${this.departamento}`;
  }
}

module.exports = Company;
