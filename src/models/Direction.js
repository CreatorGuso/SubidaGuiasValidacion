class Direction {
  constructor(ubigueo, direccion, codLocal, ruc) {
    this.ubigueo = ubigueo || '';
    this.direccion = direccion || '';
    this.codLocal = codLocal || '0000';
    this.ruc = ruc || '';
  }
}

module.exports = Direction;
