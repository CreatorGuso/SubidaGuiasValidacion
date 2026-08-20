const forge = require('node-forge');
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

class XmlSigner {
  constructor(certDir) {
    this.certDir = certDir;
  }

  /**
   * Firma un XML UBL con certificado PFX/P12
   * @param {string} xml - XML a firmar
   * @param {string} pfxFile - Nombre del archivo PFX
   * @param {string} password - Contraseña del PFX
   * @returns {string} XML firmado
   */
  signPfx(xml, pfxFile, password) {
    const pfxPath = join(this.certDir, pfxFile);
    if (!existsSync(pfxPath)) {
      throw new Error(`Certificado PFX no encontrado: ${pfxPath}`);
    }

    const pfxBuffer = readFileSync(pfxPath);
    const p12Asn1 = forge.asn1.fromDer(forge.util.binary.raw.encode(pfxBuffer));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    // Extraer clave privada y certificado
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
    const certBag = certBags[forge.pki.oids.certBag][0];

    if (!keyBag || !certBag) {
      throw new Error('No se pudo extraer clave privada o certificado del PFX');
    }

    const privateKey = keyBag.key;
    const certificate = certBag.cert;

    return this._signXml(xml, privateKey, certificate);
  }

  /**
   * Firma un XML con archivos PEM separados (cert + key)
   * @param {string} xml - XML a firmar
   * @param {string} certFile - Nombre del archivo .crt/.pem
   * @param {string} keyFile - Nombre del archivo .key
   * @returns {string} XML firmado
   */
  signPem(xml, certFile, keyFile) {
    const certPath = join(this.certDir, certFile);
    const keyPath = join(this.certDir, keyFile);

    if (!existsSync(certPath) || !existsSync(keyPath)) {
      throw new Error(`Certificados PEM no encontrados: ${certPath}, ${keyPath}`);
    }

    const certPem = readFileSync(certPath, 'utf8');
    const keyPem = readFileSync(keyPath, 'utf8');

    const certificate = forge.pki.certificateFromPem(certPem);
    const privateKey = forge.pki.privateKeyFromPem(keyPem);

    return this._signXml(xml, privateKey, certificate);
  }

  _signXml(xml, privateKey, certificate) {
    // Firma SHA-256 del contenido UBLExtensions
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const ublExtensions = doc.getElementsByTagNameNS('urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2', 'UBLExtensions')[0];

    if (!ublExtensions) {
      throw new Error('No se encontró UBLExtensions en el XML');
    }

    const canonicalized = this._canonicalize(ublExtensions);
    const md = forge.md.sha256.create();
    md.update(canonicalized);
    const digestValue = forge.util.encode64(md.digest().getBytes());

    // Crear SignedInfo
    const signedInfoXml = this._buildSignedInfo(digestValue);

    // Firmar SignedInfo
    const signedInfoMd = forge.md.sha256.create();
    signedInfoMd.update(signedInfoXml);
    const signatureValue = forge.util.encode64(
      privateKey.sign(signedInfoMd)
    );

    // Obtener certificado en base64
    const certBase64 = forge.util.encode64(
      forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes()
    );

    // Insertar firma en el XML
    const signatureXml = this._buildSignature(signedInfoXml, signatureValue, certBase64);

    // Reemplazar el placeholder de firma
    return xml.replace(
      /<ds:Signature Id="signatureMT">[\s\S]*?<\/ds:Signature>/,
      signatureXml
    );
  }

  _canonicalize(node) {
    // Canonicalización simplificada
    const serializer = new XMLSerializer();
    let xml = serializer.serializeToString(node);
    // Remover firmas previas y normalizar
    xml = xml.replace(/<ds:Signature[\s\S]*?<\/ds:Signature>/g, '');
    return xml;
  }

  _buildSignedInfo(digestValue) {
    return `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
      `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig#rsa-sha256"/>` +
      `<ds:Reference URI="#signatureMT">` +
        `<ds:Transforms>` +
          `<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
        `</ds:Transforms>` +
        `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
        `<ds:DigestValue>${digestValue}</ds:DigestValue>` +
      `</ds:Reference>` +
    `</ds:SignedInfo>`;
  }

  _buildSignature(signedInfo, signatureValue, certBase64) {
    return `<ds:Signature Id="signatureMT" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      signedInfo +
      `<ds:SignatureValue>${signatureValue}</ds:SignatureValue>` +
      `<ds:KeyInfo>` +
        `<ds:X509Data>` +
          `<ds:X509Certificate>${certBase64}</ds:X509Certificate>` +
        `</ds:X509Data>` +
      `</ds:KeyInfo>` +
    `</ds:Signature>`;
  }
}

module.exports = XmlSigner;
