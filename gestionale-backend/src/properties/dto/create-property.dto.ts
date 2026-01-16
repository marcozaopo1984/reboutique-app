// src/properties/dto/create-property.dto.ts

import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  apartment?: string;

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  beds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  roomSizeM2?: number;

  @IsOptional()
  @IsBoolean()
  hasBalcony?: boolean;

  @IsOptional()
  @IsBoolean()
  hasDryer?: boolean;

  @IsOptional()
  @IsBoolean()
  hasAC?: boolean;

  @IsOptional()
  @IsBoolean()
  hasHeating?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseMonthlyRent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyUtilities?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24)
  depositMonths?: number;

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsInt()
  @Min(-10)
  @Max(200)
  floor?: number;

  @IsOptional()
  @IsString()
  unitNumber?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  websiteUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  airbnbUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  spotahomeUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
