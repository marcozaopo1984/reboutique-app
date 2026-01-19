import { IsNumber, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateLandlordFileDto {
  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  storagePath?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  downloadUrl?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  sizeBytes?: number;
}
