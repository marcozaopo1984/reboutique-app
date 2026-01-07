// src/tenants/dto/create-tenant.dto.ts
export class CreateTenantDto {
  // Anagrafica base
  firstName: string;
  lastName: string;

  // Contatti
  email?: string;
  phone?: string;

  // Dati personali
  birthday?: string;          // ISO string "YYYY-MM-DD"
  nationality?: string;
  euCitizen?: boolean;
  gender?: 'M' | 'F' | 'OTHER';

  // Dati fiscali / documento
  address?: string;
  taxCode?: string;           // codice fiscale
  documentType?: string;      // es. "ID", "Passaport"
  documentNumber?: string;

  // Altro
  school?: string;            // IED, NABA, ecc.
  notes?: string;

  // Stato tenant rispetto al gestionale
  status?: 'CURRENT' | 'INCOMING' | 'PAST' | 'PENDING';
}
