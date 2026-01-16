import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString } from 'class-validator';
import {
  ExpenseAllocationMode,
  ExpenseFrequency,
  ExpenseScope,
  ExpenseStatus,
} from './create-expense.dto';

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsISO8601()
  costDate?: string;

  @IsOptional()
  @IsString()
  costMonth?: string;

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
