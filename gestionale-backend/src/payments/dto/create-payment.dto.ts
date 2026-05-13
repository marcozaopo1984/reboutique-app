import { IsBoolean, IsISO8601, IsNumber, IsOptional, IsString, IsIn } from 'class-validator';

export const PAYMENT_KINDS = [
  'RENT',
  'BUILDING_FEE',
  'OTHER',
  'ADMIN_FEE',
  'DEPOSIT',
  'DEPOSIT_RETURN_FROM_LANDLORD',
] as const;

export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_STATUSES = ['PLANNED', 'PAID', 'OVERDUE'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export class CreatePaymentDto {
  @IsOptional()
  @IsString()
  leaseId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  landlordId?: string;

  @IsString()
  propertyId!: string;

  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsISO8601()
  dueDate!: string;

  @IsOptional()
  @IsISO8601()
  paidDate?: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  discounted?: boolean;

  @IsIn(PAYMENT_KINDS)
  kind!: PaymentKind;

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  period?: string;
}
