import { IsBoolean, IsOptional, IsString, IsIn } from 'class-validator';

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

  
}
