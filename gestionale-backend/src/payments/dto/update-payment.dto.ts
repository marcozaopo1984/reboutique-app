import { IsBoolean, IsISO8601, IsNumber, IsOptional, IsString, IsIn } from 'class-validator';
import { PAYMENT_KINDS } from './create-payment.dto';
import type { PaymentKind, PaymentStatus } from './create-payment.dto';

const PAYMENT_STATUSES = ['PLANNED', 'PAID', 'OVERDUE'] as const;

export class UpdatePaymentDto {
  @IsOptional()
  @IsString()
  leaseId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  landlordId?: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsISO8601()
  paidDate?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  discounted?: boolean;

  @IsOptional()
  @IsIn(PAYMENT_KINDS)
  kind?: PaymentKind;

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  period?: string;
}
