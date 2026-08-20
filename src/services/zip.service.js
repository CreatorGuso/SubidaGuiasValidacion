const JSZip = require('jszip');
const forge = require('node-forge');

class ZipService {
  /**
   * Comprime un XML a ZIP con SHA-256
   * @param {string} xml - Contenido XML
   * @param {string} nombreArchivo - Nombre del archivo XML dentro del ZIP
   * @returns {Promise<{ zip: Buffer, hash: string }>}
   */
  async compress(xml, nombreArchivo) {
    const zip = new JSZip();
    zip.file(`${nombreArchivo}.xml`, xml);

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // Calcular SHA-256 del ZIP
    const md = forge.md.sha256.create();
    md.update(forge.util.binary.raw.encode(zipBuffer));
    const hash = forge.util.encode64(md.digest().getBytes());

    return { zip: zipBuffer, hash };
  }

  /**
   * Descomprime un ZIP de respuesta CDR
   * @param {Buffer} zipBuffer
   * @returns {Promise<Object>} { nombre, contenido }
   */
  async decompress(zipBuffer) {
    const zip = await JSZip.loadAsync(zipBuffer);
    const files = [];

    for (const [nombre, file] of Object.entries(zip.files)) {
      if (!file.dir) {
        const contenido = await file.async('string');
        files.push({ nombre, contenido });
      }
    }

    return files;
  }
}

module.exports = ZipService;
