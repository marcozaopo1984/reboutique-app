'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import { cashflowTypeLabels, filterContractNotes, noteSourceLabels } from '../_lib/contractNotes';
import type { ContractNote, NoteFilters } from '../_lib/contractNotes';

const emptyFilters: NoteFilters = { source: '', type: '', from: '', to: '', includeUndated: false };
const inputClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
const dateLabel = (iso: string) => new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short',
}).format(new Date(iso));
const typeLabel = (value: string) => cashflowTypeLabels[value] ? `${cashflowTypeLabels[value]} (${value})` : value;

function money(note: ContractNote) {
  if (note.amount === null) return '';
  try { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: note.currency || 'EUR' }).format(note.amount); }
  catch { return `${note.amount} ${note.currency || 'EUR'}`; }
}

export default function ContractNotes({ leaseId }: { leaseId: string }) {
  const [notes, setNotes] = useState<ContractNote[]>([]);
  const [filters, setFilters] = useState<NoteFilters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const result = await fetchWithAuth(`/leases/${encodeURIComponent(leaseId)}/notes`) as { notes: ContractNote[] };
        if (!cancelled) setNotes(result.notes);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Impossibile caricare le note del contratto.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leaseId, refresh]);

  const types = useMemo(() => {
    const options = new Map<string, string>();
    for (const note of notes) {
      if (!note.cashflowType || (filters.source && filters.source !== note.source)) continue;
      options.set(`${note.source}:${note.cashflowType}`, `${noteSourceLabels[note.source]} · ${typeLabel(note.cashflowType)}`);
    }
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'));
  }, [notes, filters.source]);
  const invalidRange = !!filters.from && !!filters.to && filters.from > filters.to;
  const visible = useMemo(() => filterContractNotes(notes, filters), [notes, filters]);
  const undatedCount = notes.filter(note => !note.insertedAt).length;

  return (
    <section className="mt-8 border-t border-slate-200 pt-6" aria-labelledby="contract-notes-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="contract-notes-title" className="text-lg font-semibold">Note del contratto e dei cashflow</h2>
        <button type="button" className="btn-secondary text-sm" onClick={() => setRefresh(value => value + 1)} disabled={loading}>
          Aggiorna note
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Note dirette del contratto e note dei pagamenti e delle spese collegati, anche già pagati.
        Le note dei cashflow si aggiornano modificando il pagamento o la spesa di origine.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">Origine
          <select className={inputClass} value={filters.source} onChange={e => setFilters(f => ({ ...f, source: e.target.value, type: '' }))}>
            <option value="">Tutte</option>
            <option value="contract">Contratto</option><option value="payment">Pagamenti</option><option value="expense">Spese</option>
          </select>
        </label>
        <label className="text-sm font-medium">Tipo di cashflow
          <select className={inputClass} value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
            <option value="">Tutti</option>
            {types.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Inserita dal
          <input type="date" className={inputClass} value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
        </label>
        <label className="text-sm font-medium">Inserita fino al
          <input type="date" className={inputClass} value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={filters.includeUndated} onChange={e => setFilters(f => ({ ...f, includeUndated: e.target.checked }))} />
          Includi anche le note senza data quando filtri per periodo
        </label>
        <button type="button" className="btn-secondary text-sm" onClick={() => setFilters({ ...emptyFilters })}>Azzera filtri note</button>
      </div>
      {invalidRange && <p role="alert" className="mt-3 text-sm text-red-700">La data iniziale deve precedere o coincidere con quella finale.</p>}
      {loading ? <p className="mt-4 text-sm" role="status">Caricamento note...</p> : error ? (
        <p role="alert" className="alert-error mt-4">{error} Usa “Aggiorna note” per riprovare.</p>
      ) : (
        <>
          {undatedCount > 0 && <p className="mt-3 text-xs text-slate-600">
            {undatedCount} note non hanno una data di inserimento registrata. Le note preesistenti restano consultabili;
            la data del cashflow non viene usata come data della nota. Le date sono mostrate nel fuso orario italiano.
          </p>}
          <p className="mt-4 text-sm text-slate-500" role="status">Note mostrate: {invalidRange ? 0 : visible.length} / {notes.length}</p>
          {!invalidRange && visible.length === 0 && <p className="mt-3 text-sm">{notes.length ? 'Nessuna nota corrisponde ai filtri.' : 'Nessuna nota per questo contratto e i suoi cashflow.'}</p>}
          {!invalidRange && <div className="mt-3 space-y-3">
            {visible.map(note => (
              <article key={note.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-amber-950">
                    {noteSourceLabels[note.source]}{note.cashflowType ? ` · ${typeLabel(note.cashflowType)}` : ' · Note dirette'}
                  </h3>
                  {note.source !== 'contract' && (
                    <Link className="text-sm font-medium text-blue-700 underline" href={`/${note.source === 'payment' ? 'payments' : 'expenses'}?${new URLSearchParams({ q: note.sourceId, includePaid: '1' }).toString()}`}>
                      {note.source === 'payment' ? 'Apri pagamento' : 'Apri spesa'}
                    </Link>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Inserimento: {note.insertedAt ? dateLabel(note.insertedAt) : 'data non disponibile'}
                  {note.updatedAt && note.updatedAt !== note.insertedAt ? ` · Ultima modifica: ${dateLabel(note.updatedAt)}` : ''}
                </p>
                {note.source !== 'contract' && <p className="mt-1 text-xs text-slate-600">
                  {money(note)}{note.status ? ` · ${note.status}` : ''}
                  {note.cashflowDate ? ` · Data cashflow: ${dateLabel(note.cashflowDate).split(',')[0]}` : ''}
                  {` · ID: ${note.sourceId}`}
                </p>}
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-900">{note.text}</p>
              </article>
            ))}
          </div>}
        </>
      )}
    </section>
  );
}
