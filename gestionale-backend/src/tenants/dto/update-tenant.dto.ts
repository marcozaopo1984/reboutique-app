import { IsEmail, IsOptional, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateTenantDto } from './create-tenant.dto';

// src/tenants/dto/update-tenant.dto.ts
export class UpdateTenantDto extends PartialType(CreateTenantDto)  {

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
