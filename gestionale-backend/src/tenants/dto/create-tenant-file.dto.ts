import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateTenantFileDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;          // es: contratto-2025-01.pdf

  @IsString()
  @IsNotEmpty()
  storagePath: string;       // es: tenants/<tenantId>/contratti/contratto-2025-01.pdf

  @IsOptional()
  @IsString()
  downloadUrl?: string;      // URL pubblico o firmato (se lo usi)

  @IsOptional()
  @IsString()
  mimeType?: string;         // es: application/pdf

  @IsOptional()
  @IsNumber()
  sizeBytes?: number;        // dimensione file in byte
}
