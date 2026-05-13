import { IsBoolean, IsIn, IsOptional, IsString, IsNumber } from 'class-validator';
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


  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  baseMonthlyRent?: number;

  @IsOptional()
  @IsNumber()
  monthlyUtilities?: number;

  @IsOptional()
  @IsNumber()
  depositMonths?: number;

  @IsOptional()
  @IsNumber()
  adminFeePortali?: number;

  @IsOptional()
  @IsBoolean()
  balcony?: boolean;

  @IsOptional()
  @IsBoolean()
  dryer?: boolean;

  /**
   * Dimensione letto. Esempio: "160cm x 200cm".
   */
  @IsOptional()
  @IsString()
  bed?: string;

  @IsOptional()
  @IsString()
  ac?: string;

  @IsOptional()
  @IsString()
  heating?: string;

  /**
   * Dimensione stanza in metri quadrati.
   */
  @IsOptional()
  @IsNumber()
  roomSizeSqm?: number;

  @IsOptional()
  @IsString()
  linkSito?: string;

  @IsOptional()
  @IsString()
  airbnb?: string;

  /**
   * Reference alfanumerico della piattaforma Spotahome.
   */
  @IsOptional()
  @IsString()
  spotahome?: string;

  /**
   * Reference alfanumerico della piattaforma student.com.
   */
  @IsOptional()
  @IsString()
  studentCom?: string;

  @IsOptional()
  @IsString()
  inlife?: string;

  @IsOptional()
  @IsString()
  roomlala?: string;

  @IsOptional()
  @IsString()
  studentville?: string;

  @IsOptional()
  @IsString()
  spacest?: string;

  @IsOptional()
  @IsString()
  housinganywhere?: string;

  @IsOptional()
  @IsString()
  erasmusplay?: string;

}

