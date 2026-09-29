export type EntityKind = 'tenants' | 'properties' | 'landlords' | 'leases' | 'payments' | 'expenses';
export type DetailField = { key: string; label: string; format?: 'date' | 'money' | 'url'; optional?: boolean };

export const detailTitles: Record<EntityKind, string> = {
  "tenants": "Dettagli inquilino",
  "properties": "Dettagli immobile",
  "landlords": "Dettagli proprietario",
  "leases": "Dettagli contratto",
  "payments": "Dettagli pagamento",
  "expenses": "Dettagli spesa"
};

export const detailFields: Record<EntityKind, DetailField[]> = {
  "tenants": [
    {
      "key": "id",
      "label": "ID"
    },
    {
      "key": "firstName",
      "label": "Nome"
    },
    {
      "key": "lastName",
      "label": "Cognome"
    },
    {
      "key": "email",
      "label": "Email"
    },
    {
      "key": "phone",
      "label": "Telefono"
    },
    {
      "key": "birthday",
      "label": "Data di nascita",
      "format": "date"
    },
    {
      "key": "nationality",
      "label": "Nazionalità"
    },
    {
      "key": "euCitizen",
      "label": "Cittadino UE"
    },
    {
      "key": "gender",
      "label": "Genere"
    },
    {
      "key": "address",
      "label": "Indirizzo"
    },
    {
      "key": "taxCode",
      "label": "Codice fiscale"
    },
    {
      "key": "documentType",
      "label": "Tipo documento"
    },
    {
      "key": "documentNumber",
      "label": "Numero documento"
    },
    {
      "key": "school",
      "label": "Scuola / università"
    },
    {
      "key": "notes",
      "label": "Note"
    },
    {
      "key": "status",
      "label": "Stato registrato"
    }
  ],
  "properties": [
    {
      "key": "id",
      "label": "ID"
    },
    {
      "key": "code",
      "label": "Codice"
    },
    {
      "key": "name",
      "label": "Nome"
    },
    {
      "key": "address",
      "label": "Indirizzo"
    },
    {
      "key": "type",
      "label": "Tipo"
    },
    {
      "key": "baseMonthlyRent",
      "label": "Canone mensile base",
      "format": "money"
    },
    {
      "key": "monthlyUtilities",
      "label": "Utenze mensili",
      "format": "money"
    },
    {
      "key": "depositMonths",
      "label": "Mensilità deposito"
    },
    {
      "key": "adminFeePortali",
      "label": "Commissione portali",
      "format": "money"
    },
    {
      "key": "airbnbPrice",
      "label": "Prezzo Airbnb",
      "format": "money"
    },
    {
      "key": "balcony",
      "label": "Balcone"
    },
    {
      "key": "dryer",
      "label": "Asciugatrice"
    },
    {
      "key": "bed",
      "label": "Letto"
    },
    {
      "key": "ac",
      "label": "Aria condizionata"
    },
    {
      "key": "heating",
      "label": "Riscaldamento"
    },
    {
      "key": "roomSizeSqm",
      "label": "Superficie stanza (m²)"
    },
    {
      "key": "linkSito",
      "label": "Sito web",
      "format": "url"
    },
    {
      "key": "airbnb",
      "label": "Airbnb",
      "format": "url"
    },
    {
      "key": "spotahome",
      "label": "Spotahome",
      "format": "url"
    },
    {
      "key": "studentCom",
      "label": "Student.com",
      "format": "url"
    },
    {
      "key": "inlife",
      "label": "Inlife",
      "format": "url"
    },
    {
      "key": "roomlala",
      "label": "Roomlala",
      "format": "url"
    },
    {
      "key": "studentville",
      "label": "Studentville",
      "format": "url"
    },
    {
      "key": "spacest",
      "label": "Spacest",
      "format": "url"
    },
    {
      "key": "housinganywhere",
      "label": "HousingAnywhere",
      "format": "url"
    },
    {
      "key": "erasmusplay",
      "label": "Erasmus Play",
      "format": "url"
    },
    {
      "key": "isPublished",
      "label": "Pubblicato"
    },
    {
      "key": "apartmentId",
      "label": "Appartamento"
    },
    {
      "key": "buildingId",
      "label": "Edificio"
    }
  ],
  "landlords": [
    {
      "key": "id",
      "label": "ID"
    },
    {
      "key": "name",
      "label": "Nome"
    },
    {
      "key": "email",
      "label": "Email"
    },
    {
      "key": "phone",
      "label": "Telefono"
    },
    {
      "key": "taxCode",
      "label": "Codice fiscale"
    },
    {
      "key": "vatNumber",
      "label": "Partita IVA"
    },
    {
      "key": "address",
      "label": "Indirizzo"
    },
    {
      "key": "notes",
      "label": "Note"
    },
    {
      "key": "status",
      "label": "Stato registrato"
    },
    {
      "key": "apartmentIds",
      "label": "Appartamenti associati"
    }
  ],
  "leases": [
    {
      "key": "id",
      "label": "ID"
    },
    {
      "key": "type",
      "label": "Tipo"
    },
    {
      "key": "propertyId",
      "label": "Immobile"
    },
    {
      "key": "tenantId",
      "label": "Inquilino"
    },
    {
      "key": "landlordId",
      "label": "Proprietario"
    },
    {
      "key": "bookingDate",
      "label": "Data prenotazione",
      "format": "date"
    },
    {
      "key": "startDate",
      "label": "Data inizio",
      "format": "date"
    },
    {
      "key": "endDate",
      "label": "Data fine",
      "format": "date"
    },
    {
      "key": "nextPaymentDue",
      "label": "Prossima scadenza",
      "format": "date"
    },
    {
      "key": "monthlyRentWithBills",
      "label": "Canone mensile incluse utenze",
      "format": "money"
    },
    {
      "key": "monthlyRentDiscounted",
      "label": "Canone scontato"
    },
    {
      "key": "monthlyRentWithoutBills",
      "label": "Canone mensile escluse utenze",
      "format": "money"
    },
    {
      "key": "billsIncludedAmount",
      "label": "Importo utenze incluse",
      "format": "money"
    },
    {
      "key": "dueDayOfMonth",
      "label": "Giorno di scadenza mensile"
    },
    {
      "key": "depositAmount",
      "label": "Deposito",
      "format": "money"
    },
    {
      "key": "depositDiscounted",
      "label": "Deposito scontato"
    },
    {
      "key": "depositDate",
      "label": "Data deposito",
      "format": "date"
    },
    {
      "key": "depositDays",
      "label": "Giorni per restituzione deposito"
    },
    {
      "key": "depositReturnDate",
      "label": "Data restituzione deposito",
      "format": "date"
    },
    {
      "key": "adminFeeAmount",
      "label": "Commissione amministrativa",
      "format": "money"
    },
    {
      "key": "adminFeeDiscounted",
      "label": "Commissione amministrativa scontata"
    },
    {
      "key": "adminFeeDate",
      "label": "Data commissione amministrativa",
      "format": "date"
    },
    {
      "key": "bookingCostAmount",
      "label": "Costo prenotazione",
      "format": "money"
    },
    {
      "key": "bookingCostDate",
      "label": "Data costo prenotazione",
      "format": "date"
    },
    {
      "key": "registrationTaxAmount",
      "label": "Imposta di registrazione",
      "format": "money"
    },
    {
      "key": "registrationTaxDate",
      "label": "Data imposta di registrazione",
      "format": "date"
    },
    {
      "key": "notes",
      "label": "Note"
    },
    {
      "key": "poweredBy",
      "label": "Powered by"
    },
    {
      "key": "piumone",
      "label": "Piumone"
    },
    {
      "key": "foundThrough",
      "label": "Canale di provenienza"
    }
  ],
  "payments": [
    {
      "key": "id",
      "label": "ID"
    },
    {
      "key": "tenantId",
      "label": "Inquilino"
    },
    {
      "key": "landlordId",
      "label": "Proprietario"
    },
    {
      "key": "propertyId",
      "label": "Immobile"
    },
    {
      "key": "leaseId",
      "label": "Contratto"
    },
    {
      "key": "buildingId",
      "label": "Edificio"
    },
    {
      "key": "dueDate",
      "label": "Data scadenza",
      "format": "date"
    },
    {
      "key": "paidDate",
      "label": "Data pagamento",
      "format": "date"
    },
    {
      "key": "amount",
      "label": "Importo",
      "format": "money"
    },
    {
      "key": "currency",
      "label": "Valuta"
    },
    {
      "key": "kind",
      "label": "Tipologia"
    },
    {
      "key": "status",
      "label": "Stato registrato"
    },
    {
      "key": "_effectiveStatus",
      "label": "Stato effettivo (lista)",
      "optional": true
    },
    {
      "key": "_actorName",
      "label": "Soggetto associato",
      "optional": true
    },
    {
      "key": "notes",
      "label": "Note"
    }
  ],
  "expenses": [
    {
      "key": "id",
      "label": "ID"
    },
    {
      "key": "propertyId",
      "label": "Immobile"
    },
    {
      "key": "type",
      "label": "Tipo"
    },
    {
      "key": "description",
      "label": "Descrizione"
    },
    {
      "key": "amount",
      "label": "Importo",
      "format": "money"
    },
    {
      "key": "currency",
      "label": "Valuta"
    },
    {
      "key": "costDate",
      "label": "Data costo",
      "format": "date"
    },
    {
      "key": "costMonth",
      "label": "Mese di competenza"
    },
    {
      "key": "frequency",
      "label": "Frequenza"
    },
    {
      "key": "scope",
      "label": "Ambito"
    },
    {
      "key": "allocationMode",
      "label": "Criterio di ripartizione"
    },
    {
      "key": "status",
      "label": "Stato registrato"
    },
    {
      "key": "paidDate",
      "label": "Data pagamento",
      "format": "date"
    },
    {
      "key": "notes",
      "label": "Note"
    },
    {
      "key": "leaseId",
      "label": "Contratto"
    },
    {
      "key": "tenantId",
      "label": "Inquilino"
    },
    {
      "key": "landlordId",
      "label": "Proprietario"
    },
    {
      "key": "_effectiveStatus",
      "label": "Stato effettivo (lista)",
      "optional": true
    },
    {
      "key": "_actorName",
      "label": "Soggetto associato",
      "optional": true
    }
  ]
};
