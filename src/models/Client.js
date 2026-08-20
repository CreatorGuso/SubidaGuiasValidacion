class Client {
  constructor(data = {}) {
    this.tipoDoc = data.tipoDoc || '6';
    this.numDoc = data.numDoc || '';
    this.rznSocial = data.rznSocial || '';
    this.direccion = data.direccion || '';
  }
}

module.exports = Client;
