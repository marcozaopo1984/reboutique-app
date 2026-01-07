export class UpdateExpenseDto {
  propertyId?: string;
  type?: string;
  description?: string;

  amount?: number;
  currency?: string;

  costDate?: string;
  costMonth?: string;

  frequency?: 'ONCE' | 'MONTHLY' | 'YEARLY';

  scope?: 'BUILDING' | 'UNIT';
  allocationMode?: 'NONE' | 'PER_UNIT' | 'PER_M2' | 'PER_PERSON';

  notes?: string;
}
