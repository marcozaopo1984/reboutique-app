export class CreateExpenseDto {
  propertyId: string;     // può essere BUILDING o UNIT
  type: string;           // es. "Pulizie", "Manutenzione"
  description?: string;   // es. "Pulizia scale marzo"

  amount: number;
  currency?: string;

  costDate: string;       // ISO date
  costMonth?: string;     // "YYYY-MM" (opzionale)

  frequency?: 'ONCE' | 'MONTHLY' | 'YEARLY';

  // Estensione Building Manager
  scope?: 'BUILDING' | 'UNIT'; 
  allocationMode?: 'NONE' | 'PER_UNIT' | 'PER_M2' | 'PER_PERSON';

  notes?: string;
}
