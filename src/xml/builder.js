const { create } = require('xmlbuilder2');

class XmlBuilder {
  constructor() {
    // Declaraciones de namespaces para el elemento raíz
    this.ns = {
      xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2',
      'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
      'xmlns:sac': 'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1',
    };
  }

  build(despatch) {
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('DespatchAdvice', this.ns)
        .ele('ext:UBLExtensions')
          .ele('ext:UBLExtension')
            .ele('ext:ExtensionContent')
            .up()
          .up()
          .ele('ext:UBLExtension')
            .ele('ext:ExtensionContent')
              .ele('sac:AdditionalInformation', {
                'xmlns:sac': 'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1',
              })
                .ele('sac:AdditionalProperty')
                  .ele('cbc:Name').txt('1004').up()
                  .ele('cbc:Value').txt(String(despatch.company.ruc)).up()
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
      root.ele('cbc:Note').dat(despatch.observacion).up();
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
    partyName.ele('cbc:Name').dat(company.razonSocial).up();

    const attachment = sig.ele('cac:DigitalSignatureAttachment');
    const extRef = attachment.ele('cac:ExternalReference');
    extRef.ele('cbc:URI').txt('#signatureMT').up();
  }

  _addSupplierParty(root, company) {
    const party = root.ele('cac:DespatchSupplierParty').ele('cac:Party');
    party.ele('cac:PartyIdentification')
      .ele('cbc:ID', {
        schemeID: '6',
        schemeName: 'Documento de Identidad',
        schemeAgencyName: 'PE:SUNAT',
        schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06',
      }).txt(company.ruc).up()
      .up();

    const legal = party.ele('cac:PartyLegalEntity');
    legal.ele('cbc:RegistrationName').dat(company.razonSocial).up();
    legal.up();
    party.up();
  }

  _addDeliveryCustomerParty(root, client) {
    if (!client) return;
    const party = root.ele('cac:DeliveryCustomerParty').ele('cac:Party');
    party.ele('cac:PartyIdentification')
      .ele('cbc:ID', {
        schemeID: client.tipoDoc,
        schemeName: 'Documento de Identidad',
        schemeAgencyName: 'PE:SUNAT',
        schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06',
      }).txt(client.numDoc).up()
      .up();

    const legal = party.ele('cac:PartyLegalEntity');
    if (client.rznSocial) {
      legal.ele('cbc:RegistrationName').dat(client.rznSocial).up();
    }
    legal.up();
    party.up();
  }

  _addShipment(root, shipment) {
    const ship = root.ele('cac:Shipment');

    ship.ele('cbc:ID').txt('SUNAT_Envio').up();
    ship.ele('cbc:HandlingCode', {
      listAgencyName: 'PE:SUNAT',
      listName: 'Motivo de traslado',
      listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo20',
    }).txt(shipment.codTraslado).up();

    if (shipment.desTraslado) {
      ship.ele('cbc:HandlingInstructions').txt(shipment.desTraslado).up();
    }

    // Sustento de peso (si hay diferencia)
    if (shipment.sustentoPeso) {
      ship.ele('cbc:Information').txt(shipment.sustentoPeso).up();
    }

    ship.ele('cbc:GrossWeightMeasure', { unitCode: shipment.undPesoTotal })
      .txt(String(shipment.pesoTotal)).up();

    // Peso neto items
    if (shipment.pesoItems != null) {
      ship.ele('cbc:NetWeightMeasure', { unitCode: 'KGM' })
        .txt(String(shipment.pesoItems)).up();
    }

    if (Number(shipment.numBultos) > 0) {
      ship.ele('cbc:TotalTransportHandlingUnitQuantity')
        .txt(String(shipment.numBultos)).up();
    }

    // Indicadores
    for (const ind of shipment.indicadores || []) {
      ship.ele('cbc:SpecialInstructions').txt(ind).up();
    }

    // Etapa de transporte (modalidad, tránsito, transportista y choferes)
    const stage = ship.ele('cac:ShipmentStage');
    stage.ele('cbc:TransportModeCode', {
      listName: 'Modalidad de traslado',
      listAgencyName: 'PE:SUNAT',
      listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo18',
    }).txt(shipment.modTraslado).up();

    // Período de tránsito
    if (shipment.fecTraslado) {
      const transit = stage.ele('cac:TransitPeriod');
      transit.ele('cbc:StartDate').txt(this._formatDate(shipment.fecTraslado)).up();
      transit.up();
    }

    // Transportista: solo transporte público (regla 3347)
    if (shipment.modTraslado === '01' && shipment.transportista) {
      this._addCarrierParty(stage, shipment.transportista);
    }

    // Fecha de entrega de bienes al transportista: obligatoria SOLO en
    // transporte público (reglas 3617/3618/3619 vigentes desde 01-06-2026).
    if (shipment.modTraslado === '01' && shipment.fecEntregaBienes) {
      const loadingEvent = stage.ele('cac:LoadingTransportEvent');
      loadingEvent.ele('cbc:OccurrenceDate').txt(this._formatDate(shipment.fecEntregaBienes)).up();
      loadingEvent.up();
    }

    // Choferes: SOLO en transporte privado (regla 3354, en público van con el
    // transportista). Con el indicador M1L (vehículo menor categoría L/M1) tampoco.
    if (shipment.modTraslado !== '01' && !this._esVehiculoMenor(shipment)) {
      for (const chofer of shipment.choferes || []) {
        const driver = stage.ele('cac:DriverPerson');
        driver.ele('cbc:ID', {
          schemeID: chofer.tipoDoc,
          schemeName: 'Documento de Identidad',
          schemeAgencyName: 'PE:SUNAT',
          schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06',
        }).txt(chofer.nroDoc).up();
        if (chofer.nombres) {
          driver.ele('cbc:FirstName').txt(chofer.nombres).up();
        }
        if (chofer.apellidos) {
          driver.ele('cbc:FamilyName').txt(chofer.apellidos).up();
        }
        driver.ele('cbc:JobTitle').txt(chofer.tipo).up();

        const idDoc = driver.ele('cac:IdentityDocumentReference');
        idDoc.ele('cbc:ID').txt(chofer.licencia).up();
        idDoc.up();

        driver.up();
      }
    }
    stage.up();

    // Entrega: llegada (DeliveryAddress) + partida (Despatch/DespatchAddress)
    const delivery = ship.ele('cac:Delivery');
    this._addAddress(delivery, 'cac:DeliveryAddress', shipment.llegada);
    if (shipment.partida) {
      const despatch = delivery.ele('cac:Despatch');
      this._addAddress(despatch, 'cac:DespatchAddress', shipment.partida);
      despatch.up();
    }
    delivery.up();

    // TransportHandlingUnit (precintos y vehículo con remolques)
    this._addTransportHandlingUnits(ship, shipment);

    // Puerto / Aeropuerto
    this._addPortLocation(ship, shipment.puerto, shipment.aeropuerto);

    ship.up();
  }

  _addCarrierParty(parent, transportist) {
    if (!transportist) return;
    const carrier = parent.ele('cac:CarrierParty');
    carrier.ele('cac:PartyIdentification')
      .ele('cbc:ID', { schemeID: transportist.tipoDoc })
      .txt(transportist.numDoc).up()
      .up();

    const legal = carrier.ele('cac:PartyLegalEntity');
    if (transportist.rznSocial) {
      legal.ele('cbc:RegistrationName').dat(transportist.rznSocial).up();
    }
    if (transportist.nroMtc) {
      legal.ele('cbc:CompanyID').txt(transportist.nroMtc).up();
    }
    legal.up();
    carrier.up();
  }

  _addAddress(parent, tag, direction) {
    if (!direction) return;
    const addr = parent.ele(tag);
    addr.ele('cbc:ID', { schemeAgencyName: 'PE:INEI', schemeName: 'Ubigeos' })
      .txt(direction.ubigueo).up();

    // Establecimiento anexo: listID exige RUC válido de 11 dígitos (regla 3409).
    // Con DNI u otro documento se omite el nodo.
    if (direction.codLocal && /^\d{11}$/.test(direction.ruc || '')) {
      addr.ele('cbc:AddressTypeCode', { listID: direction.ruc })
        .txt(direction.codLocal).up();
    }

    const line = addr.ele('cac:AddressLine');
    line.ele('cbc:Line').txt(direction.direccion).up();
    line.up();
    addr.up();
  }

  // Vehículo menor categoría L/M1: SUNAT permite omitir placa y conductor en
  // transporte privado si se envía el indicador especial (R-123-2022/SUNAT).
  _esVehiculoMenor(shipment) {
    return (shipment.indicadores || []).includes('SUNAT_Envio_IndicadorTrasladoVehiculoM1L');
  }

  _addTransportHandlingUnits(parent, shipment) {
    // Precintos / contenedores
    (shipment.contenedores || []).forEach((sello, i) => {
      const thu = parent.ele('cac:TransportHandlingUnit');
      const pkg = thu.ele('cac:Package');
      pkg.ele('cbc:ID').txt(String(i + 1)).up();
      pkg.ele('cbc:TraceID').txt(sello).up();
      pkg.up();
      thu.up();
    });

    // Vehículo principal (TransportEquipment): SOLO en transporte privado.
    // En público (regla 3354) no se consigna: pertenece al transportista.
    // Con el indicador M1L se omite también (excepción vehículo menor).
    if (shipment.modTraslado === '01' || this._esVehiculoMenor(shipment) || !shipment.vehiculo) return;
    const vehiculo = shipment.vehiculo;

    const thu = parent.ele('cac:TransportHandlingUnit');
    const equip = thu.ele('cac:TransportEquipment');
    equip.ele('cbc:ID').txt(vehiculo.placa).up();

    if (vehiculo.nroCirculacion) {
      const means = equip.ele('cac:ApplicableTransportMeans');
      means.ele('cbc:RegistrationNationalityID')
        .txt(vehiculo.nroCirculacion).up();
      means.up();
    }

    // Vehículos secundarios (remolques)
    for (const sec of vehiculo.secundarios || []) {
      const attached = equip.ele('cac:AttachedTransportEquipment');
      attached.ele('cbc:ID').txt(sec.placa).up();

      if (sec.nroCirculacion) {
        const secMeans = attached.ele('cac:ApplicableTransportMeans');
        secMeans.ele('cbc:RegistrationNationalityID')
          .txt(sec.nroCirculacion).up();
        secMeans.up();
      }

      if (sec.nroAutorizacion) {
        const docRef = attached.ele('cac:ShipmentDocumentReference');
        docRef.ele('cbc:ID', {
          schemeID: sec.codEmisor || '',
          schemeName: 'Entidad Autorizadora',
          schemeAgencyName: 'PE:SUNAT',
        }).txt(sec.nroAutorizacion).up();
        docRef.up();
      }

      attached.up();
    }

    if (vehiculo.nroAutorizacion) {
      const docRef = equip.ele('cac:ShipmentDocumentReference');
      docRef.ele('cbc:ID', {
        schemeID: vehiculo.codEmisor || '',
        schemeName: 'Entidad Autorizadora',
        schemeAgencyName: 'PE:SUNAT',
      }).txt(vehiculo.nroAutorizacion).up();
      docRef.up();
    }

    equip.up();
    thu.up();
  }

  _addPortLocation(parent, puerto, aeropuerto) {
    const port = puerto || aeropuerto;
    if (!port) return;

    const locationCode = puerto ? '1' : '2';
    const schemeName = puerto ? 'Puertos' : 'Aeropuertos';
    const schemeURI = puerto
      ? 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo63'
      : 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo64';

    const loc = parent.ele('cac:FirstArrivalPortLocation');
    loc.ele('cbc:ID', {
      schemeAgencyName: 'PE:SUNAT',
      schemeName,
      schemeURI,
    }).txt(port.codigo).up();
    loc.ele('cbc:LocationTypeCode').txt(locationCode).up();
    loc.ele('cbc:Name').txt(port.nombre).up();
    loc.up();
  }

  _addDespatchLines(root, details) {
    for (let i = 0; i < details.length; i++) {
      const item = details[i];
      const line = root.ele('cac:DespatchLine');

      line.ele('cbc:ID').txt(String(i + 1)).up();
      line.ele('cbc:DeliveredQuantity', { unitCode: item.unidad })
        .txt(String(item.cantidad)).up();

      const orderRef = line.ele('cac:OrderLineReference');
      orderRef.ele('cbc:LineID').txt(String(i + 1)).up();
      orderRef.up();

      const itemNode = line.ele('cac:Item');

      if (item.descripcion) {
        itemNode.ele('cbc:Description').dat(item.descripcion).up();
      }

      const sellersId = itemNode.ele('cac:SellersItemIdentification');
      sellersId.ele('cbc:ID').txt(item.codigo).up();
      sellersId.up();

      if (item.codProdSunat) {
        const cls = itemNode.ele('cac:CommodityClassification');
        cls.ele('cbc:ItemClassificationCode', {
          listID: 'UNSPSC',
          listAgencyName: 'GS1 US',
          listName: 'Item Classification',
        }).txt(item.codProdSunat).up();
        cls.up();
      }

      // Atributos adicionales
      for (const attr of item.atributos) {
        const prop = itemNode.ele('cac:AdditionalItemProperty');
        prop.ele('cbc:Name').txt(attr.name).up();
        prop.ele('cbc:NameCode').txt(attr.code).up();
        if (attr.value) {
          prop.ele('cbc:Value').txt(attr.value).up();
        }
        prop.up();
      }

      itemNode.up();
      line.up();
    }
  }

  // mssql (tedious) devuelve los datetime "naive" como instantes UTC,
  // por lo que los campos getUTC* reproducen el valor original de la BD.
  _formatDate(date) {
    if (!date) return '';
    if (typeof date === 'string') {
      return date.slice(0, 10);
    }
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  _formatTime(date) {
    if (!date) return '';
    if (typeof date === 'string') {
      const t = date.match(/T(\d{2}:\d{2}:\d{2})/);
      if (t) return t[1];
      return date.slice(11, 19) || '00:00:00';
    }
    const d = new Date(date);
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const mins = String(d.getUTCMinutes()).padStart(2, '0');
    const secs = String(d.getUTCSeconds()).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
  }
}

module.exports = XmlBuilder;
