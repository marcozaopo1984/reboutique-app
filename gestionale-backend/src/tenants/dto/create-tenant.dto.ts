// src/tenants/dto/create-tenant.dto.ts
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';

export class CreateTenantDto {
  // Anagrafica base
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  // Contatti
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  // Dati personali
  @IsOptional()
  @IsDateString() // accetta "YYYY-MM-DD"
  birthday?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsBoolean()
  euCitizen?: boolean;

  @IsOptional()
  @IsEnum(['M', 'F', 'OTHER'] as const)
  gender?: 'M' | 'F' | 'OTHER';

  // Dati fiscali / documento
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  taxCode?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  // Altro
  @IsOptional()
  @IsString()
  school?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Stato tenant rispetto al gestionale
  @IsOptional()
  @IsEnum(['CURRENT', 'INCOMING', 'PAST', 'PENDING'] as const)
  status?: 'CURRENT' | 'INCOMING' | 'PAST' | 'PENDING';
}
