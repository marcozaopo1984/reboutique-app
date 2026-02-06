import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PROPERTY_TYPES } from './create-property.dto';
import type { PropertyType } from './create-property.dto';

export class UpdatePropertyDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(PROPERTY_TYPES)
  type?: PropertyType;

  // legacy
  @IsOptional()
  @IsString()
  apartmentId?: string;

  // ✅ NEW
  @IsOptional()
  @IsString()
  apartmentLabel?: string;

  @IsOptional()
  @IsString()
  apartmentKey?: string;

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
