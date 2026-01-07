export class CreatePaymentDto {
  leaseId: string;
  tenantId: string;
  propertyId: string;

  buildingId?: string;

  dueDate: string;
  paidDate?: string;

  amount: number;
  currency?: string;

  kind: 'RENT' | 'BUILDING_FEE' | 'OTHER';

  status?: 'PLANNED' | 'PAID' | 'OVERDUE';
  notes?: string;
}
