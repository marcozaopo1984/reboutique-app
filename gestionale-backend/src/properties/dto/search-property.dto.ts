import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class SearchPropertiesDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsNumberString()
  minPrice?: string;

  @IsOptional()
  @IsNumberString()
  maxPrice?: string;

  @IsOptional()
  @IsString()
  operationType?: 'RENT' | 'SALE';
}
