export class CreateLeaseDto {
  tenantId: string;
  propertyId: string;

  // Per compatibilità con building manager:
  buildingId?: string;    // opzionale

  startDate: string;       // ISO
  expectedEndDate: string; // ISO
  actualEndDate?: string;

  monthlyRent: number;
  billsIncluded?: boolean;

  depositAmount?: number;
  depositRefundedAmount?: number;
  depositReturnDate?: string;
  depositRefundPercent?: number;

  adminFee?: number;
  bookingCost?: number;
  bookingDate?: string;

  paymentDay?: number;
  nextPaymentDue?: string;

  sourceChannel?: string;    // Found through: Airbnb, Spotahome, etc.
  hasDuvet?: boolean;

  status?: 'INCOMING' | 'ACTIVE' | 'ENDED';
}
