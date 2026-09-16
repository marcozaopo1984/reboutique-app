import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdatePriceAvailabilityOverrideDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  prices?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyUtilities?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deposit?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  adminFee?: number | null;
}
