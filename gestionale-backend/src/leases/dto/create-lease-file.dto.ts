import { IsNumber, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateLeaseFileDto {
  @IsString()
  fileName: string;

  @IsOptional()
  @IsString()
  storagePath?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  downloadUrl?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
