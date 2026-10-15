/** Dates belong to the note, not to unrelated edits of the cashflow/lease. */
export function noteFields(notes: string | null | undefined, previous?: any, now = new Date()) {
  if (notes === undefined) return {};
  const text = typeof notes === 'string' ? notes.trim() : '';
  const oldText = typeof previous?.notes === 'string' ? previous.notes.trim() : '';
  if (text === oldText) return { notes: text };
  if (!text) return { notes: '', notesCreatedAt: null, notesUpdatedAt: null };
  return {
    notes: text,
    // Never invent an insertion date when editing an existing legacy note.
    notesCreatedAt: oldText ? previous?.notesCreatedAt ?? null : now,
    notesUpdatedAt: now,
  };
}

export function noteDateIso(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value?.toDate === 'function') date = value.toDate();
  else if (typeof (value?._seconds ?? value?.seconds) === 'number') {
    date = new Date((value._seconds ?? value.seconds) * 1000);
  } else if (typeof value === 'string') date = new Date(value);
  else return null;
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export type ContractNoteSource = 'contract' | 'payment' | 'expense';

export function contractNote(source: ContractNoteSource, id: string, data: any) {
  const text = typeof data?.notes === 'string' ? data.notes.trim() : '';
  if (!text) return null;
  return {
    id: `${source}:${id}`,
    source,
    sourceId: id,
    cashflowType: source === 'payment' ? String(data.kind || 'OTHER') :
      source === 'expense' ? String(data.type || 'OTHER') : null,
    text,
    insertedAt: noteDateIso(data.notesCreatedAt),
    updatedAt: noteDateIso(data.notesUpdatedAt),
    cashflowDate: source === 'payment' ? noteDateIso(data.dueDate) :
      source === 'expense' ? noteDateIso(data.costDate) : null,
    amount: source !== 'contract' && typeof data.amount === 'number' ? data.amount : null,
    currency: source === 'contract' ? null : data.currency || 'EUR',
    status: source === 'contract' ? null : data.status || 'PLANNED',
  };
}
