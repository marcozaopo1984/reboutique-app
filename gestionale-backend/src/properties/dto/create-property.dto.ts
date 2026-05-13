import { IsBoolean, IsOptional, IsString, IsIn, IsNumber } from 'class-validator';

export const PROPERTY_TYPES = ['APARTMENT', 'ROOM', 'BED'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export class CreatePropertyDto {
  // campi già presenti nel tuo progetto (lasciati volutamente “larghi”)
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  /**
   * opzionale: APARTMENT | ROOM | BED
   * (lo manteniamo ma non obblighiamo)
   */
  @IsOptional()
  @IsIn(PROPERTY_TYPES)
  type?: PropertyType;

  /**
   * (legacy) se ROOM/BED: collega ad un APARTMENT (propertyId dell'appartamento)
   * (se non lo usi più, può rimanere opzionale)
   */
  @IsOptional()
  @IsString()
  apartmentId?: string;

  /**
   * ✅ NEW: “appartamento” come attributo testuale (ux)
   * Esempio: "Argentina 4"
   */
  @IsOptional()
  @IsString()
  apartmentLabel?: string;

  /**
   * ✅ NEW: chiave contabile stabile/normalizzata (per P&L)
   * Esempio: "argentina_4"
   */
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

