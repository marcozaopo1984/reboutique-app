import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export enum ExpenseFrequency {
  ONCE = 'ONCE',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum ExpenseScope {
  BUILDING = 'BUILDING',
  UNIT = 'UNIT',
}

export enum ExpenseAllocationMode {
  NONE = 'NONE',
  PER_UNIT = 'PER_UNIT',
  PER_M2 = 'PER_M2',
  PER_PERSON = 'PER_PERSON',
}

export enum ExpenseStatus {
  PLANNED = 'PLANNED',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

export class CreateExpenseDto {
  @IsString()
  propertyId: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  // Nel frontend usi input type="date" => "YYYY-MM-DD"
  // IsISO8601 accetta anche date-only, quindi ok.
  @IsISO8601()
  costDate: string;

  @IsOptional()
  @IsString()
  costMonth?: string; // es: "2026-01"

  @IsOptional()
  @IsEnum(ExpenseFrequency)
  frequency?: ExpenseFrequency;

  @IsOptional()
  @IsEnum(ExpenseScope)
  scope?: ExpenseScope;

  @IsOptional()
  @IsEnum(ExpenseAllocationMode)
  allocationMode?: ExpenseAllocationMode;

  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @IsOptional()
  @IsISO8601()
  paidDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
