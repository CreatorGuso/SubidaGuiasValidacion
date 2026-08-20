const { create } = require('xmlbuilder2');

class XmlBuilder {
  constructor() {
    this.ns = {
      'cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      'cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      'ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      'ds': 'http://www.w3.org/2000/09/xmldsig#',
      '': 'urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2',
    };
  }

  build(despatch) {
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('DespatchAdvice', { xmlns: this.ns[''] })
        .ele('ext:UBLExtensions')
          .ele('ext:UBLExtension')
            .ele('ext:ExtensionContent')
              .ele('ds:Signature', { Id: 'signatureMT' })
                // Se completa después con la firma
              .up()
            .up()
          .up()
        .up()
        .ele('ext:UBLExtensions')
        .ele('ext:UBLExtension')
          .ele('ext:ExtensionContent')
            .ele('sac:AdditionalInformation', { xmlns: 'sac' : 'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1' })
              .ele('sac:AdditionalProperty')
                .ele('cbc:Name').txt('1004').up()
                .ele('cbc:Value').txt(String(despatch.company.ruc)).up()
              .up()
            .up()
          .up()
        .up()
        .up()
      .up();

    this._addBasicComponents(root, despatch);
    this._addSignature(root, despatch.company);
    this._addSupplierParty(root, despatch.company);
    this._addDeliveryCustomerParty(root, despatch.destinatario);
    this._addShipment(root, despatch.envio);
    this._addDespatchLines(root, despatch.details);

    return root.end({ prettyPrint: true });
  }

  _addBasicComponents(root, despatch) {
    root.ele('cbc:UBLVersionID').txt('2.1').up()
      .ele('cbc:CustomizationID').txt('2.0').up()
      .ele('cbc:ID').txt(despatch.getIdentificador()).up()
      .ele('cbc:IssueDate').txt(this._formatDate(despatch.fechaEmision)).up()
      .ele('cbc:IssueTime').txt(this._formatTime(despatch.fechaEmision)).up()
      .ele('cbc:DespatchAdviceTypeCode').txt('09').up();

    if (despatch.observacion) {
      root.ele('cbc:Note').cdata(despatch.observacion).up();
    }

    // Documentos adicionales relacionados
    for (const doc of despatch.addDocs) {
      const addDoc = root.ele('cac:AdditionalDocumentReference');
      addDoc.ele('cbc:ID').txt(doc.nro).up();
      addDoc.ele('cbc:DocumentTypeCode').txt(doc.tipo).up();
      if (doc.tipoDesc) {
        addDoc.ele('cbc:DocumentType').txt(doc.tipoDesc).up();
      }
      if (doc.emisor) {
        const issuer = addDoc.ele('cac:IssuerParty');
        const partyId = issuer.ele('cac:PartyIdentification');
        partyId.ele('cbc:ID', { schemeID: '6' }).txt(doc.emisor).up();
      }
      addDoc.up();
    }
  }

  _addSignature(root, company) {
    const sig = root.ele('cac:Signature');
    sig.ele('cbc:ID').txt('signatureMT').up();

    const signatory = sig.ele('cac:SignatoryParty');
    const partyId = signatory.ele('cac:PartyIdentification');
    partyId.ele('cbc:ID', { schemeID: '6' }).txt(company.ruc).up();

    const partyName = signatory.ele('cac:PartyName');
    partyName.ele('cbc:Name').cdata(company.razonSocial).up();

    const attachment = sig.ele('cac:DigitalSignatureAttachment');
    const extRef = attachment.ele('cac:ExternalReference');
    extRef.ele('cbc:URI').txt('#signatureMT').up();
  }

  _addSupplierParty(root, company) {
    const party = root.ele('cac:DespatchSupplierParty').ele('cac:Party');
    const partyId = party.ele('cac:PartyIdentification');
    partyId.ele('cbc:ID', { schemeID: '6' }).txt(company.ruc).up();

    const partyName = party.ele('cac:PartyName');
    partyName.ele('cbc:Name').cdata(company.razonSocial).up();

    const taxScheme = party.ele('cac:PartyTaxScheme');
    taxScheme.ele('cbc:CompanyID', { schemeID: '6' }).txt(company.ruc).up();
    const ts = taxScheme.ele('cac:TaxScheme');
    ts.ele('cbc:ID').txt('PDT').up();
    ts.up();
    taxScheme.up();
    party.up();
  }

  _addDeliveryCustomerParty(root, client) {
    if (!client) return;
    const party = root.ele('cac:DeliveryCustomerParty').ele('cac:Party');
    const partyId = party.ele('cac:PartyIdentification');
    partyId.ele('cbc:ID', { schemeID: client.tipoDoc }).txt(client.numDoc).up();

    const partyName = party.ele('cac:PartyName');
    partyName.ele('cbc:Name').cdata(client.rznSocial).up();

    const taxScheme = party.ele('cac:PartyTaxScheme');
    taxScheme.ele('cbc:CompanyID', { schemeID: client.tipoDoc }).txt(client.numDoc).up();
    const ts = taxScheme.ele('cac:TaxScheme');
    ts.ele('cbc:ID').txt('PDT').up();
    ts.up();
    taxScheme.up();
    party.up();
  }

  _addShipment(root, shipment) {
    const ship = root.ele('cac:Shipment');

    ship.ele('cbc:ID').txt('SUNAT_Envio').up();
    ship.ele('cbc:HandlingCode').txt(shipment.codTraslado).up();
    ship.ele('cbc:HandlingInstructions').txt(shipment.desTraslado).up();
    ship.ele('cbc:GrossWeightMeasure', { unitCode: shipment.undPesoTotal })
      .txt(String(shipment.pesoTotal)).up();
    ship.ele('cbc:TotalTransportHandlingUnitQuantity')
      .txt(String(shipment.numBultos)).up();
    ship.ele('cbc:TransportModeCode').txt(shipment.modTraslado).up();

    // Indicadores
    for (const ind of shipment.indicadores) {
      ship.ele('cbc:SpecialInstructions').txt(ind).up();
    }

    // Sustento de peso (si hay diferencia)
    if (shipment.sustentoPeso) {
      ship.ele('cbc:Information').txt(shipment.sustentoPeso).up();
    }

    // Peso neto items
    if (shipment.pesoItems != null) {
      ship.ele('cbc:NetWeightMeasure', { unitCode: shipment.undPesoTotal })
        .txt(String(shipment.pesoItems)).up();
    }

    // Período de tránsito
    const transit = ship.ele('cac:TransitPeriod');
    transit.ele('cbc:StartDate').txt(this._formatDate(shipment.fecTraslado)).up();
    transit.up();

    // Transportista
    this._addCarrierParty(ship, shipment.transportista);

    // Punto de partida
    this._addDespatchAddress(ship, shipment.partida);

    // Punto de llegada
    this._addDeliveryAddress(ship, shipment.llegada);

    // TransportHandlingUnit (vehículos, contenedores, choferes)
    this._addTransportHandlingUnit(ship, shipment);

    // Puerto / Aeropuerto
    this._addPortLocation(ship, shipment.puerto, shipment.aeropuerto);

    ship.up();
  }

  _addCarrierParty(parent, transportist) {
    if (!transportist) return;
    const carrier = parent.ele('cac:CarrierParty');
    const party = carrier.ele('cac:Party');

    const partyId = party.ele('cac:PartyIdentification');
    partyId.ele('cbc:ID', { schemeID: transportist.tipoDoc }).txt(transportist.numDoc).up();

    const partyName = party.ele('cac:PartyName');
    partyName.ele('cbc:Name').cdata(transportist.rznSocial).up();

    const taxScheme = party.ele('cac:PartyTaxScheme');
    taxScheme.ele('cbc:CompanyID', { schemeID: transportist.tipoDoc }).txt(transportist.numDoc).up();
    const ts = taxScheme.ele('cac:TaxScheme');
    ts.ele('cbc:ID').txt('PDT').up();
    ts.up();
    taxScheme.up();
    party.up();

    // Número MTC
    if (transportist.nroMtc) {
      carrier.ele('cbc:CompanyID').txt(transportist.nroMtc).up();
    }

    carrier.up();
  }

  _addDespatchAddress(parent, direction) {
    if (!direction) return;
    const despatch = parent.ele('cac:Despatch');
    const addr = despatch.ele('cac:DespatchAddress');
    addr.ele('cbc:ID', { schemeName: 'Ubigeos' }).txt(direction.ubigueo).up();

    const line = addr.ele('cac:AddressLine');
    line.ele('cbc:Line').txt(direction.direccion).up();
    line.up();

    addr.ele('cbc:AddressTypeCode', { listID: direction.ruc })
      .txt(direction.codLocal || '0000').up();
    addr.up();
    despatch.up();
  }

  _addDeliveryAddress(parent, direction) {
    if (!direction) return;
    const delivery = parent.ele('cac:Delivery');
    const addr = delivery.ele('cac:DeliveryAddress');
    addr.ele('cbc:ID', { schemeName: 'Ubigeos' }).txt(direction.ubigueo).up();

    const line = addr.ele('cac:AddressLine');
    line.ele('cbc:Line').txt(direction.direccion).up();
    line.up();

    addr.ele('cbc:AddressTypeCode', { listID: direction.ruc })
      .txt(direction.codLocal || '0000').up();
    addr.up();
    delivery.up();
  }

  _addTransportHandlingUnit(parent, shipment) {
    const thu = parent.ele('cac:TransportHandlingUnit');

    // Vehículos secundarios
    if (shipment.vehiculo && shipment.vehiculo.secundarios) {
      for (const sec of shipment.vehiculo.secundarios) {
        const attached = thu.ele('cac:AttachedTransportEquipment');
        const equip = attached.ele('cac:TransportEquipment');
        equip.ele('cbc:ID').txt(sec.placa).up();
        equip.up();
        attached.up();
      }
    }

    // Sellos de contenedor
    for (const sello of shipment.contenedores) {
      const pkg = thu.ele('cac:Package');
      pkg.ele('cbc:TraceID').txt(sello).up();
      pkg.up();
    }

    thu.up();

    // Vehículo principal (ApplicableTransportMeans)
    if (shipment.vehiculo) {
      const means = parent.ele('cac:ApplicableTransportMeans');
      means.ele('cbc:RegistrationNationalityID')
        .txt(shipment.vehiculo.placa).up();
      means.up();
    }

    // Choferes
    for (const chofer of shipment.choferes) {
      const driver = parent.ele('cac:DriverPerson');
      driver.ele('cbc:ID', { schemeID: chofer.tipoDoc }).txt(chofer.nroDoc).up();
      driver.ele('cbc:FirstName').txt(chofer.nombres).up();
      driver.ele('cbc:FamilyName').txt(chofer.apellidos).up();
      driver.ele('cbc:JobTitle').txt(chofer.tipo).up();

      const idDoc = driver.ele('cac:IdentityDocumentReference');
      idDoc.ele('cbc:ID').txt(chofer.licencia).up();
      idDoc.up();

      driver.up();
    }
  }

  _addPortLocation(parent, puerto, aeropuerto) {
    const port = puerto || aeropuerto;
    if (!port) return;

    const locationCode = puerto ? '1' : '2';
    const schemeName = puerto ? 'Puertos' : 'Aeropuertos';

    const loc = parent.ele('cac:FirstArrivalPortLocation');
    loc.ele('cbc:ID', { schemeName }).txt(port.codigo).up();
    loc.ele('cbc:Name').txt(port.nombre).up();
    loc.ele('cbc:LocationTypeCode').txt(locationCode).up();
    loc.up();
  }

  _addDespatchLines(root, details) {
    for (let i = 0; i < details.length; i++) {
      const item = details[i];
      const line = root.ele('cac:DespatchLine');

      line.ele('cbc:ID').txt(String(i + 1)).up();
      line.ele('cbc:DeliveredQuantity', { unitCode: item.unidad })
        .txt(String(item.cantidad)).up();
      line.ele('cbc:Description').cdata(item.descripcion).up();

      const itemNode = line.ele('cac:Item');
      const sellersId = itemNode.ele('cac:SellersItemIdentification');
      sellersId.ele('cbc:ID').txt(item.codigo).up();
      sellersId.up();

      if (item.codProdSunat) {
        const cls = itemNode.ele('cac:CommodityClassification');
        cls.ele('cbc:ItemClassificationCode').txt(item.codProdSunat).up();
        cls.up();
      }

      // Atributos adicionales
      for (const attr of item.atributos) {
        const prop = itemNode.ele('cac:AdditionalItemProperty');
        prop.ele('cbc:NameCode').txt(attr.code).up();
        prop.ele('cbc:Name').txt(attr.name).up();
        if (attr.value) {
          prop.ele('cbc:Value').txt(attr.value).up();
        }
        prop.up();
      }

      itemNode.up();

      const orderRef = line.ele('cac:OrderLineReference');
      orderRef.ele('cbc:LineID').txt(String(i + 1)).up();
      orderRef.up();

      line.up();
    }
  }

  _formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  _formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
  }
}

module.exports = XmlBuilder;
