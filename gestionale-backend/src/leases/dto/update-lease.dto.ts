export class UpdateLeaseDto {
  tenantId?: string;
  propertyId?: string;
  buildingId?: string;

  startDate?: string;
  expectedEndDate?: string;
  actualEndDate?: string;

  monthlyRent?: number;
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

  sourceChannel?: string;
  hasDuvet?: boolean;

  status?: 'INCOMING' | 'ACTIVE' | 'ENDED';
}
