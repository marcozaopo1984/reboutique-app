import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsUrl,
} from 'class-validator';

export class CreateTenantFileDto {
  @IsString()
  @IsNotEmpty()
  fileName: string; // es: contratto-2025-01.pdf

  @IsOptional()
  @IsString()
  storagePath?: string; // es: holders/<holderId>/tenants/<tenantId>/files/contratto-2025-01.pdf

  @IsOptional()
  @IsString()
  path?: string; // fallback compatibilità

  @IsOptional()
  @IsUrl()
  downloadUrl?: string; // URL pubblico o firmato

  @IsOptional()
  @IsString()
  mimeType?: string; // es: application/pdf

  @IsOptional()
  @IsNumber()
  sizeBytes?: number; // dimensione file in byte

  @IsOptional()
  @IsString()
  notes?: string;
}