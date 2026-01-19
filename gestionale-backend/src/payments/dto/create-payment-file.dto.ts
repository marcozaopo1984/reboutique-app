import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePaymentFileDto {
  @IsOptional()
  @IsString()
  fileName?: string;

  // path su Firebase Storage: holders/{holderId}/payments/{paymentId}/files/...
  @IsOptional()
  @IsString()
  storagePath?: string;

  // supporto retrocompatibile (se in FE mandi "path")
  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  downloadUrl?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  sizeBytes?: number;
}
