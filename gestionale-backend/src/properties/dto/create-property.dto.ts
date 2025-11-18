import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  city: string;

  @IsNumber()
  price: number;

  @IsString()
  operationType: 'RENT' | 'SALE';

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
