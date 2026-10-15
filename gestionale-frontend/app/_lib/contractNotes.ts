export type ContractNote = {
  id: string;
  source: 'contract' | 'payment' | 'expense';
  sourceId: string;
  cashflowType: string | null;
  text: string;
  insertedAt: string | null;
  updatedAt: string | null;
  cashflowDate: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
};

export type NoteFilters = { source: string; type: string; from: string; to: string; includeUndated: boolean };

export const noteSourceLabels = { contract: 'Contratto', payment: 'Pagamento', expense: 'Spesa' };

export const cashflowTypeLabels: Record<string, string> = {
  RENT: 'Canone', BUILDING_FEE: 'Quota condominiale', OTHER: 'Altro',
  ADMIN_FEE: 'Commissione amministrativa', DEPOSIT: 'Deposito',
  DEPOSIT_RETURN_FROM_LANDLORD: 'Rientro deposito dal proprietario',
  RENT_TO_LANDLORD: 'Canone al proprietario', DEPOSIT_TO_LANDLORD: 'Deposito al proprietario',
  ADMIN_FEE_TO_LANDLORD: 'Commissione al proprietario', BOOKING_COST: 'Costo prenotazione',
  REGISTRATION_TAX: 'Imposta di registrazione', DEPOSIT_REFUND: 'Restituzione deposito',
};

// Compare calendar days in the same time zone used by the date labels.
export function noteDay(iso: string | null): string {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return '';
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso));
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function filterContractNotes(notes: ContractNote[], filters: NoteFilters) {
  return notes.filter(note => {
    if (filters.source && note.source !== filters.source) return false;
    if (filters.type && `${note.source}:${note.cashflowType}` !== filters.type) return false;
    if (!filters.from && !filters.to) return true;
    const day = noteDay(note.insertedAt);
    if (!day) return filters.includeUndated;
    return (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to);
  });
}
