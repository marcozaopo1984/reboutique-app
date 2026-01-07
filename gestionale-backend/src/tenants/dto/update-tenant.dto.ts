import { IsEmail, IsOptional, IsString } from 'class-validator';

// src/tenants/dto/update-tenant.dto.ts
export class UpdateTenantDto {

  firstName?: string;
  
  lastName?: string;
  
  email?: string;
  
  phone?: string;

  birthday?: string;
  nationality?: string;
  euCitizen?: boolean;
  gender?: 'M' | 'F' | 'OTHER';

  address?: string;
  taxCode?: string;
  documentType?: string;
  documentNumber?: string;

  school?: string;
  notes?: string;

  status?: 'CURRENT' | 'INCOMING' | 'PAST' | 'PENDING';
}
