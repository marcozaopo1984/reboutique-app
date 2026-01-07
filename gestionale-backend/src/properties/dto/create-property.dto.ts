// src/properties/dto/create-property.dto.ts
export class CreatePropertyDto {
  code: string;
  name: string;
  address?: string;

  type: 'BUILDING' |'APARTMENT' | 'ROOM' | 'BED';
  apartment?: string;
  room?: string;

  beds?: number;
  roomSizeM2?: number;

  hasBalcony?: boolean;
  hasDryer?: boolean;
  hasAC?: boolean;
  hasHeating?: boolean;

  baseMonthlyRent?: number;
  monthlyUtilities?: number;
  depositMonths?: number;

  buildingId?: string;  
  floor?: string;       
  unitNumber?: string;  

  websiteUrl?: string;
  airbnbUrl?: string;
  spotahomeUrl?: string;

  isPublished?: boolean;
}
