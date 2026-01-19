'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import EntityDocuments from '@/components/EntityDocuments';
import { Field, Input, Select } from '@/components/form/Field';

type Property = { id: string; code?: string; name?: string; type?: string };

type ExpenseFrequency = 'ONCE' | 'MONTHLY' | 'YEARLY';
type ExpenseScope = 'BUILDING' | 'UNIT';
type ExpenseAllocationMode = 'NONE' | 'PER_UNIT' | 'PER_M2' | 'PER_PERSON';
type ExpenseStatus = 'PLANNED' | 'PAID' | 'OVERDUE';

type Expense = {
  id: string;

  propertyId: string;
  type: string;
  description?: string;

  amount: number;
  currency?: string;

  costDate: string; // "YYYY-MM-DD"
  costMonth?: string;

  frequency?: ExpenseFrequency;

  scope?: ExpenseScope;
  allocationMode?: ExpenseAllocationMode;

  status?: ExpenseStatus;
  paidDate?: string;

  notes?: string;

  leaseId?: string;
};

type CreateExpenseForm = {
  propertyId: string;
  type: string;
  description: string;

  amount: string;
  currency: string;

  costDate: string;  // YYYY-MM-DD
  costMonth: string; // '' oppure YYYY-MM

  frequency: '' | ExpenseFrequency;

  scope: '' | ExpenseScope;
  allocationMode: '' | ExpenseAllocationMode;

  status: ExpenseStatus;
  paidDate: string; // '' oppure YYYY-MM-DD

  notes: string;
};

const cleanStr = (s: string) => s.trim();
const toNum = (v: string) => {
  const s = cleanStr(v);
  return s === '' ? undefined : Number(s);
};

// YYYY-MM from YYYY-MM-DD
const monthFromDate = (d: string) => (d && d.length >= 7 ? d.slice(0, 7) : '');

export default function ExpensesPage() {
  const [items, setItems] = useState<Expense[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // quale expense ha documenti aperti
  const [openDocsExpenseId, setOpenDocsExpenseId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateExpenseForm>({
    propertyId: '',
    type: '',
    description: '',
    amount: '',
    currency: 'EUR',
    costDate: '',
    costMonth: '',
    frequency: '',
    scope: '',
    allocationMode: '',
    status: 'PLANNED',
    paidDate: '',
    notes: '',
  });

  const onChange = (key: keyof CreateExpenseForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const propertyLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) {
      const code = p.code ? p.code : p.id;
      const name = p.name ? ` – ${p.name}` : '';
      m.set(p.id, `${code}${name}`);
    }
    return m;
  }, [properties]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [expensesRes, propsRes] = await Promise.all([
        fetchWithAuth('/expenses'),
        fetchWithAuth('/properties'),
      ]);

      setItems(Array.isArray(expensesRes) ? expensesRes : []);
      setProperties(Array.isArray(propsRes) ? propsRes : []);
    } catch (e: any) {
      setError(e?.message ?? 'Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const resetForm = () => {
    setForm({
      propertyId: '',
      type: '',
      description: '',
      amount: '',
      currency: 'EUR',
      costDate: '',
      costMonth: '',
      frequency: '',
      scope: '',
      allocationMode: '',
      status: 'PLANNED',
      paidDate: '',
      notes: '',
    });
  };

  const create = async () => {
    setError(null);

    if (!form.propertyId) return setError('Seleziona una property');
    if (!cleanStr(form.type)) return setError('Type obbligatorio');
    if (!form.costDate) return setError('Seleziona costDate');

    const amountNum = toNum(form.amount);
    if (amountNum === undefined || Number.isNaN(amountNum)) return setError('Importo non valido');

    const costMonth = cleanStr(form.costMonth) || monthFromDate(form.costDate) || undefined;

    const body: any = {
      propertyId: form.propertyId,
      type: cleanStr(form.type),
      description: cleanStr(form.description) || undefined,

      amount: amountNum,
      currency: cleanStr(form.currency) || 'EUR',

      costDate: form.costDate,
      costMonth,

      frequency: form.frequency || undefined,
      scope: form.scope || undefined,
      allocationMode: form.allocationMode || undefined,

      status: form.status || 'PLANNED',
      paidDate: form.paidDate.trim() || undefined,

      notes: cleanStr(form.notes) || undefined,
    };

    setBusy(true);
    try {
      await fetchWithAuth('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      resetForm();
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore creazione spesa');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      await fetchWithAuth(`/expenses/${id}`, { method: 'DELETE' });
      setOpenDocsExpenseId((prev) => (prev === id ? null : prev));
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore eliminazione spesa');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Expenses</h1>
            <p className="text-sm text-slate-600">Gestisci spese (unità / building).</p>
          </div>

          <button
            onClick={loadAll}
            disabled={busy}
            className="text-sm border rounded px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </header>

        {error && (
          <div className="mb-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
            {error}
          </div>
        )}

        {/* CREATE FORM */}
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <h2 className="font-medium">Nuova spesa</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Immobile" required>
              <Select
                value={form.propertyId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange('propertyId', e.target.value)}
                disabled={busy}
              >
                <option value="">Seleziona immobile *</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {propertyLabel.get(p.id) ?? p.id}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Type" required>
              <Input
                value={form.type}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('type', e.target.value)}
                placeholder="Es: CONDOMINIO, BOLLETTA, MANUTENZIONE..."
                disabled={busy}
              />
            </Field>

            <Field label="Cost date" required>
              <Input
                type="date"
                value={form.costDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const v = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    costDate: v,
                    costMonth: prev.costMonth || monthFromDate(v),
                  }));
                }}
                disabled={busy}
              />
            </Field>

            <Field label="Cost month (YYYY-MM)">
              <Input
                value={form.costMonth}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('costMonth', e.target.value)}
                placeholder="YYYY-MM (auto)"
                disabled={busy}
              />
            </Field>

            <Field label="Importo" required>
              <Input
                type="number"
                value={form.amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('amount', e.target.value)}
                placeholder="100"
                disabled={busy}
              />
            </Field>

            <Field label="Currency">
              <Input
                value={form.currency}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('currency', e.target.value)}
                placeholder="EUR"
                disabled={busy}
              />
            </Field>

            <Field label="Frequency">
              <Select
                value={form.frequency}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  onChange('frequency', e.target.value as '' | ExpenseFrequency)
                }
                disabled={busy}
              >
                <option value="">(none)</option>
                <option value="ONCE">ONCE</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="YEARLY">YEARLY</option>
              </Select>
            </Field>

            <Field label="Scope">
              <Select
                value={form.scope}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  onChange('scope', e.target.value as '' | ExpenseScope)
                }
                disabled={busy}
              >
                <option value="">(none)</option>
                <option value="UNIT">UNIT</option>
                <option value="BUILDING">BUILDING</option>
              </Select>
            </Field>

            <Field label="Allocation mode">
              <Select
                value={form.allocationMode}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  onChange('allocationMode', e.target.value as '' | ExpenseAllocationMode)
                }
                disabled={busy}
              >
                <option value="">(none)</option>
                <option value="NONE">NONE</option>
                <option value="PER_UNIT">PER_UNIT</option>
                <option value="PER_M2">PER_M2</option>
                <option value="PER_PERSON">PER_PERSON</option>
              </Select>
            </Field>

            <Field label="Status" required>
              <Select
                value={form.status}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  onChange('status', e.target.value as ExpenseStatus)
                }
                disabled={busy}
              >
                <option value="PLANNED">PLANNED</option>
                <option value="PAID">PAID</option>
                <option value="OVERDUE">OVERDUE</option>
              </Select>
            </Field>

            <Field label="Paid date">
              <Input
                type="date"
                value={form.paidDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('paidDate', e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field label="Description">
              <Input
                value={form.description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('description', e.target.value)}
                placeholder="Breve descrizione..."
                disabled={busy}
              />
            </Field>

            <Field label="Notes">
              <Input
                value={form.notes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('notes', e.target.value)}
                placeholder="Note interne..."
                disabled={busy}
              />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={create}
              disabled={busy}
              className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-700 disabled:opacity-50"
            >
              {busy ? 'Salvataggio...' : 'Create'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={busy}
              className="border px-4 py-2 rounded hover:bg-slate-50 disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </div>

        {/* LIST */}
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-medium mb-3">Elenco</h2>

          {loading ? (
            <div>Caricamento...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500">Nessuna spesa.</div>
          ) : (
            <div className="space-y-2">
              {items.map((x) => {
                const docsOpen = openDocsExpenseId === x.id;
                const propText = propertyLabel.get(x.propertyId) ?? x.propertyId;

                return (
                  <div key={x.id} className="border rounded-lg p-3">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {propText} · {x.type}
                        </div>

                        <div className="text-sm text-slate-600">
                          {x.amount} {x.currency ?? 'EUR'} · {x.status ?? 'PLANNED'}
                          {x.frequency ? ` · ${x.frequency}` : ''}
                          {x.scope ? ` · ${x.scope}` : ''}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          Cost date: {x.costDate}
                          {x.paidDate ? ` · Paid: ${x.paidDate}` : ''}
                          {x.costMonth ? ` · Month: ${x.costMonth}` : ''}
                        </div>

                        {x.description && (
                          <div className="text-xs text-slate-500 mt-1">Desc: {x.description}</div>
                        )}
                        {x.notes && (
                          <div className="text-xs text-slate-500 mt-1">Note: {x.notes}</div>
                        )}

                        <div className="text-[11px] text-slate-400 mt-1">id: {x.id}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setOpenDocsExpenseId((prev) => (prev === x.id ? null : x.id))}
                          className="border rounded-md px-3 py-2 text-sm"
                          disabled={busy}
                        >
                          {docsOpen ? 'Chiudi documenti' : 'Documenti'}
                        </button>

                        <button
                          onClick={() => remove(x.id)}
                          disabled={busy}
                          className="text-sm text-red-600 hover:underline disabled:opacity-50"
                        >
                          Elimina
                        </button>
                      </div>
                    </div>

                    {docsOpen && (
                      <div className="mt-3">
                        <EntityDocuments
                          entityKind="expenses"
                          entityId={x.id}
                          label={`Documenti spesa (${propText} · ${x.type})`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
