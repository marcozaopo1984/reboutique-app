import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateLandlordDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  externalId?: string; // id Excel

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
