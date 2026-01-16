import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePaymentDto {
  @IsOptional() @IsString() leaseId?: string;
  @IsOptional() @IsString() tenantId?: string;
  @IsOptional() @IsString() propertyId?: string;
  @IsOptional() @IsString() buildingId?: string;

  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsDateString() paidDate?: string;

  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsString() currency?: string;

  @IsOptional() @IsIn(['RENT', 'BUILDING_FEE', 'OTHER'])
  kind?: 'RENT' | 'BUILDING_FEE' | 'OTHER';

  @IsOptional() @IsIn(['PLANNED', 'PAID', 'OVERDUE'])
  status?: 'PLANNED' | 'PAID' | 'OVERDUE';

  @IsOptional() @IsString() notes?: string;
}
