import { IsISO8601, IsNumber, IsOptional, IsString, IsIn } from 'class-validator';

export const PAYMENT_KINDS = [
  'RENT',
  'BUILDING_FEE',
  'OTHER',
  'ADMIN_FEE',
  'DEPOSIT',
] as const;

export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_STATUSES = ['PLANNED', 'PAID', 'OVERDUE'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export class CreatePaymentDto {
  @IsOptional()
  @IsString()
  leaseId?: string;

  @IsString()
  tenantId!: string;

  @IsString()
  propertyId!: string;

  // ✅ NEW: chiave contabile (APARTMENT)
  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsISO8601()
  dueDate!: string; // "YYYY-MM-DD"

  @IsOptional()
  @IsISO8601()
  paidDate?: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  // ✅ include ADMIN_FEE e DEPOSIT
  @IsIn(PAYMENT_KINDS)
  kind!: PaymentKind;

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: PaymentStatus;

  // opzionale
  @IsOptional()
  @IsString()
  period?: string; // es "2026-02"
}
