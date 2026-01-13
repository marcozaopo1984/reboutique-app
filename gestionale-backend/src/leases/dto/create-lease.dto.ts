import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum LeaseType {
  TENANT = 'TENANT',
  LANDLORD = 'LANDLORD',
}

export class CreateLeaseDto {
  @IsEnum(LeaseType)
  type: LeaseType;

  // sempre obbligatorio
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  // obbligatorio se type=TENANT
  @IsOptional()
  @IsString()
  tenantId?: string;

  // obbligatorio se type=LANDLORD (come da tua scelta Excel)
  @IsOptional()
  @IsString()
  landlordId?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  // opzionale: prima scadenza (se la usi da Excel "Next payment due")
  @IsOptional()
  @IsDateString()
  nextPaymentDue?: string;

  // import / extra
  @IsOptional()
  @IsString()
  externalId?: string;

  // economics
  // sempre presente (nel tuo modello: per TENANT è gross-bills; per LANDLORD è l’unico campo)
  @IsNumber()
  @Min(0)
  monthlyRentWithoutBills: number;

  // solo TENANT: opzionale (se vuoi salvarla per reporting)
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyRentWithBills?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  billsIncludedAmount?: number;

  // one-offs
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  adminFeeAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherFeesAmount?: number;

  // regola scadenze mensili (se non usi nextPaymentDue)
  @IsOptional()
  @IsNumber()
  @Min(1)
  dueDayOfMonth?: number; // es: 5 => ogni mese giorno 5
}
