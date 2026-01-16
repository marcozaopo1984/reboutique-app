import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @IsOptional()
  @IsString()
  leaseId?: string;

  @IsString()
  tenantId: string;

  @IsString()
  propertyId: string;

  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsIn(['RENT', 'BUILDING_FEE', 'OTHER'])
  kind: 'RENT' | 'BUILDING_FEE' | 'OTHER';

  @IsOptional()
  @IsIn(['PLANNED', 'PAID', 'OVERDUE'])
  status?: 'PLANNED' | 'PAID' | 'OVERDUE';

  @IsOptional()
  @IsString()
  notes?: string;
}
