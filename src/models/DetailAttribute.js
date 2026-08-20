class DetailAttribute {
  constructor(data = {}) {
    this.code = data.code || '';
    this.name = data.name || '';
    this.value = data.value || null;
  }
}

module.exports = DetailAttribute;
