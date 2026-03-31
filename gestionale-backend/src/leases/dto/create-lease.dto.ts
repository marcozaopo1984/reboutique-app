import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString } from 'class-validator';

export enum LeaseType {
  TENANT = 'TENANT',
  LANDLORD = 'LANDLORD',
}

export class CreateLeaseDto {
  @IsEnum(LeaseType)
  type!: LeaseType;

  @IsString()
  propertyId!: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  landlordId?: string;

  @IsOptional()
  @IsISO8601()
  bookingDate?: string;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsOptional()
  @IsISO8601()
  nextPaymentDue?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsNumber()
  monthlyRentWithoutBills!: number;

  @IsOptional()
  @IsNumber()
  monthlyRentWithBills?: number;

  @IsOptional()
  @IsNumber()
  billsIncludedAmount?: number;

  @IsOptional()
  @IsNumber()
  depositAmount?: number;

  @IsOptional()
  @IsISO8601()
  depositDate?: string;

  @IsOptional()
  @IsNumber()
  adminFeeAmount?: number;

  @IsOptional()
  @IsISO8601()
  adminFeeDate?: string;

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
