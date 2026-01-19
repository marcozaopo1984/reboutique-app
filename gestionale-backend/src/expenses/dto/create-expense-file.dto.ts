import { IsNumber, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateExpenseFileDto {
  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  storagePath?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsUrl()
  downloadUrl?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  sizeBytes?: number;
}
