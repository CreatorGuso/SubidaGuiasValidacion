class Transportist {
  constructor(data = {}) {
    this.tipoDoc = data.tipoDoc || '6';
    this.numDoc = data.numDoc || '';
    this.rznSocial = data.rznSocial || '';
    this.nroMtc = data.nroMtc || '';
  }
}

module.exports = Transportist;
