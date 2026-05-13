import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export const LANDLORD_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type LandlordStatus = (typeof LANDLORD_STATUSES)[number];

function normalizeApartmentIds(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;

  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,;]+/)
      : value;

  if (!Array.isArray(rawValues)) return rawValues;

  return Array.from(
    new Set(
      rawValues
        .map((v) => (typeof v === 'string' ? v.trim() : v))
        .filter((v): v is string => typeof v === 'string' && v.length > 0),
    ),
  );
}

export class CreateLandlordDto {
  @IsString()
  name!: string;

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
  taxCode?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsIn(LANDLORD_STATUSES)
  status?: LandlordStatus;

  /**
   * Lista degli Apartment ID associati al landlord.
   * Deve contenere soltanto ID di property di tipo APARTMENT.
   * Il frontend invia un array, ma accettiamo anche testo separato da virgole,
   * punto e virgola o righe per robustezza.
   */
  @IsOptional()
  @Transform(({ value }) => normalizeApartmentIds(value))
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  apartmentIds?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
