import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString } from 'class-validator';
import { LeaseType } from './create-lease.dto';

export class UpdateLeaseDto {
  @IsOptional()
  @IsEnum(LeaseType)
  type?: LeaseType;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  landlordId?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsISO8601()
  nextPaymentDue?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsNumber()
  monthlyRentWithoutBills?: number;

  @IsOptional()
  @IsNumber()
  monthlyRentWithBills?: number;

  @IsOptional()
  @IsNumber()
  billsIncludedAmount?: number;

  // --- CASHFLOWS EXTRA ---
  @IsOptional()
  @IsNumber()
  depositAmount?: number;

  @IsOptional()
  @IsNumber()
  adminFeeAmount?: number;

  @IsOptional()
  @IsNumber()
  otherFeesAmount?: number;

  @IsOptional()
  @IsNumber()
  bookingCostAmount?: number;

  @IsOptional()
  @IsISO8601()
  bookingCostDate?: string;

  @IsOptional()
  @IsNumber()
  registrationTaxAmount?: number;

  @IsOptional()
  @IsISO8601()
  registrationTaxDate?: string;

  @IsOptional()
  @IsNumber()
  dueDayOfMonth?: number;
}
