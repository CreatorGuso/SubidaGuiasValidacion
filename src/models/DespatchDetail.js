class DespatchDetail {
  constructor(data = {}) {
    this.codigo = data.codigo || '';
    this.descripcion = data.descripcion || '';
    this.unidad = data.unidad || 'H87';
    this.cantidad = data.cantidad || 0;
    this.codProdSunat = data.codProdSunat || '';
    this.atributos = data.atributos || [];
  }
}

module.exports = DespatchDetail;
