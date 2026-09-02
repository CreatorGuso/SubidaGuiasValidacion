const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const C14N_INCLUSIVE = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const SIGNATURE_ID = 'signatureMT';

/**
 * Genera el bloque <ds:KeyInfo> con el certificado X.509
 */
class X509KeyInfo {
  constructor(certPem) {
    this.certPem = certPem;
  }

  getKey() {
    return Buffer.from(this.certPem);
  }

  getKeyInfo(_cert, prefix) {
    const p = prefix ? `${prefix}:` : '';
    const base64 = this.certPem
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/\s+/g, '');
    return `<${p}X509Data><${p}X509Certificate>${base64}</${p}X509Certificate></${p}X509Data>`;
  }
}

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
    const { privateKeyPem, certPem } = this._extraerCertificadoPfx(pfxFile, password);
    return this._signXml(xml, privateKeyPem, certPem);
  }

  /**
   * Firma un XML con archivos PEM separados (cert + key)
   */
  signPem(xml, certFile, keyFile) {
    const certPath = join(this.certDir, certFile);
    const keyPath = join(this.certDir, keyFile);

    if (!existsSync(certPath) || !existsSync(keyPath)) {
      throw new Error(`Certificados PEM no encontrados: ${certPath}, ${keyPath}`);
    }

    return this._signXml(xml, readFileSync(keyPath, 'utf8'), readFileSync(certPath, 'utf8'));
  }

  /**
   * Extrae clave privada y certificado de un archivo PFX/P12
   */
  _extraerCertificadoPfx(pfxFile, password) {
    const pfxPath = join(this.certDir, pfxFile);
    if (!existsSync(pfxPath)) {
      throw new Error(`Certificado PFX no encontrado: ${pfxPath}`);
    }

    const p12Asn1 = forge.asn1.fromDer(forge.util.binary.raw.encode(readFileSync(pfxPath)));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

    const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
    const certBag = (certBags[forge.pki.oids.certBag] || [])[0];

    if (!keyBag || !certBag) {
      throw new Error('No se pudo extraer clave privada o certificado del PFX');
    }

    return {
      privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
      certPem: forge.pki.certificateToPem(certBag.cert),
    };
  }

  /**
   * Firma enveloped (XML-DSig) según la normativa SUNAT:
   * - Canonicalización C14N inclusiva
   * - RSA-SHA256 / SHA-256
   * - Reference URI="" con transform enveloped-signature
   * - La firma se inserta en el primer ext:ExtensionContent
   */
  _signXml(xml, privateKeyPem, certPem) {
    const sig = new SignedXml(null, {
      canonicalizationAlgorithm: C14N_INCLUSIVE,
      signatureAlgorithm: RSA_SHA256,
    });
    sig.signingKey = privateKeyPem;
    sig.keyInfoProvider = new X509KeyInfo(certPem);

    // URI="" firma el documento completo.
    // Transform 1: enveloped-signature elimina la propia firma del digest
    // Transform 2: C14N inclusivo convierte el node-set a octetos (obligatorio
    // según el estándar XML-DSig cuando la salida del último transform es un nodo)
    sig.addReference(
      "//*[local-name()='DespatchAdvice']",
      [ENVELOPED, C14N_INCLUSIVE],
      SHA256,
      undefined,
      undefined,
      undefined,
      true
    );

    sig.computeSignature(xml, {
      prefix: 'ds',
      attrs: { Id: SIGNATURE_ID },
      location: {
        reference: "//*[local-name()='ExtensionContent']",
        action: 'append',
      },
    });

    return sig.getSignedXml();
  }

  /**
   * Verifica la firma de un XML firmado (útil para pruebas)
   * @returns {boolean} true si la firma es válida
   */
  verify(xml) {
    const { DOMParser } = require('@xmldom/xmldom');
    const { xpath } = require('xml-crypto');

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const node = xpath(
      doc,
      "//*[local-name()='Signature' and namespace-uri()='http://www.w3.org/2000/09/xmldsig#']"
    )[0];
    if (!node) {
      throw new Error('No se encontró ds:Signature en el XML');
    }

    // Clave pública desde el certificado incluido en el KeyInfo
    const match = xml.match(/X509Certificate>([^<]+)</);
    if (!match) {
      throw new Error('No se encontró certificado en el KeyInfo');
    }
    const certificate = forge.pki.certificateFromPem(
      `-----BEGIN CERTIFICATE-----${match[1]}-----END CERTIFICATE-----`
    );

    const sig = new SignedXml(null, {
      canonicalizationAlgorithm: C14N_INCLUSIVE,
      signatureAlgorithm: RSA_SHA256,
    });
    sig.loadSignature(node);
    sig.keyInfoProvider = {
      getKey: () => Buffer.from(forge.pki.publicKeyToPem(certificate.publicKey)),
    };
    return sig.checkSignature(xml);
  }
}

module.exports = XmlSigner;
