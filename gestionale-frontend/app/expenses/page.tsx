'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { fetchWithAuth } from '@/lib/apiClient';
import EntityDocuments from '@/components/EntityDocuments';
import { Field, Input, Select } from '@/components/form/Field';

type Property = { id: string; code?: string; name?: string; type?: string };

type ExpenseFrequency = 'ONCE' | 'MONTHLY' | 'YEARLY' | string;
type ExpenseScope = 'BUILDING' | 'UNIT' | string;
type ExpenseAllocationMode = 'NONE' | 'PER_UNIT' | 'PER_M2' | 'PER_PERSON' | string;
type ExpenseStatus = 'PLANNED' | 'PAID' | 'OVERDUE' | string;

type Expense = {
  id: string;

  propertyId: string;
  type: string;
  description?: string;

  amount: number;
  currency?: string;

  costDate: any; // "YYYY-MM-DD" | Timestamp | Date
  costMonth?: string;

  frequency?: ExpenseFrequency;

  scope?: ExpenseScope;
  allocationMode?: ExpenseAllocationMode;

  status?: ExpenseStatus;
  paidDate?: any; // string | Timestamp | Date

  notes?: string;

  leaseId?: string;
};

type CreateExpenseForm = {
  propertyId: string;
  type: string;
  description: string;

  amount: string;
  currency: string;

  costDate: string; // YYYY-MM-DD
  costMonth: string; // '' oppure YYYY-MM

  frequency: '' | ExpenseFrequency;

  scope: '' | ExpenseScope;
  allocationMode: '' | ExpenseAllocationMode;

  status: ExpenseStatus;
  paidDate: string; // '' oppure YYYY-MM-DD

  notes: string;
};

type SortKey = 'costDate' | 'amount' | 'status';
type SortDir = 'asc' | 'desc';

type Filters = {
  q: string;
  propertyId: string;
  type: string; // expense.type
  scope: string;
  frequency: string;
  status: string; // effective
  month: string; // YYYY-MM
  onlyOverdueComputed: boolean;
};

const cleanStr = (s: string) => (s ?? '').trim();
const toNum = (v: string) => {
  const s = cleanStr(v);
  return s === '' ? undefined : Number(s);
};

// ---- date helpers robusti (string | Date | Firestore Timestamp) ----
const toYmd = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v.length >= 10 ? v.slice(0, 10) : v;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  if (typeof v === 'object' && typeof v._seconds === 'number') {
    const d = new Date(v._seconds * 1000);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  if (typeof v === 'object' && typeof v.toDate === 'function') {
    const d = v.toDate();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return '';
};

const monthFromYmd = (ymd: string) => (ymd && ymd.length >= 7 ? ymd.slice(0, 7) : '');
const todayYmdUtc = () => new Date().toISOString().slice(0, 10);
const compareStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ---- querystring helpers ----
const parseBool = (v: string | null) => v === '1' || v === 'true';

const pickSortKey = (v: string | null): SortKey => {
  if (v === 'amount' || v === 'status' || v === 'costDate') return v;
  return 'costDate';
};

const pickSortDir = (v: string | null): SortDir => {
  if (v === 'asc' || v === 'desc') return v;
  return 'desc';
};

/**
 * ✅ Robust: l'Input custom a volte chiama onChange con:
 * - event (React.ChangeEvent<HTMLInputElement>)
 * - direttamente la stringa (value)
 * Qui normalizziamo SEMPRE a string.
 */
const valueFromInputChange = (arg: unknown): string => {
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'number') return String(arg);
  if (arg && typeof arg === 'object' && 'target' in arg) {
    const t = (arg as any).target;
    if (t && typeof t.value !== 'undefined') return String(t.value ?? '');
  }
  return '';
};

// YYYY-MM from YYYY-MM-DD
const monthFromDate = (d: string) => (d && d.length >= 7 ? d.slice(0, 7) : '');

const fmtStatus = (s: string) => {
  if (s === 'PLANNED') return 'PLANNED';
  if (s === 'PAID') return 'PAID';
  if (s === 'OVERDUE') return 'OVERDUE';
  return s;
};

export default function ExpensesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const didInitFromUrl = useRef(false);

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

  // ✅ filtri + sort (stile payments)
  const [filters, setFilters] = useState<Filters>({
    q: '',
    propertyId: '',
    type: '',
    scope: '',
    frequency: '',
    status: '',
    month: '',
    onlyOverdueComputed: false,
  });

  const [sortKey, setSortKey] = useState<SortKey>('costDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const onChange = (key: keyof CreateExpenseForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleInput =
    (key: keyof CreateExpenseForm) =>
    (arg: unknown) => {
      onChange(key, valueFromInputChange(arg));
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

  // ---- init from URL (once) ----
  useEffect(() => {
    if (didInitFromUrl.current) return;

    const q = searchParams.get('q') ?? '';
    const propertyId = searchParams.get('propertyId') ?? '';
    const type = searchParams.get('type') ?? '';
    const scope = searchParams.get('scope') ?? '';
    const frequency = searchParams.get('frequency') ?? '';
    const status = searchParams.get('status') ?? '';
    const month = searchParams.get('month') ?? '';
    const onlyOverdueComputed = parseBool(searchParams.get('onlyOverdueComputed'));

    const sk = pickSortKey(searchParams.get('sortKey'));
    const sd = pickSortDir(searchParams.get('sortDir'));

    setFilters({
      q,
      propertyId,
      type,
      scope,
      frequency,
      status,
      month,
      onlyOverdueComputed,
    });
    setSortKey(sk);
    setSortDir(sd);

    didInitFromUrl.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- build current shareable URL ----
  const shareUrl = useMemo(() => {
    const sp = new URLSearchParams();

    if (cleanStr(filters.q)) sp.set('q', cleanStr(filters.q));
    if (filters.propertyId) sp.set('propertyId', filters.propertyId);
    if (filters.type) sp.set('type', filters.type);
    if (filters.scope) sp.set('scope', filters.scope);
    if (filters.frequency) sp.set('frequency', filters.frequency);
    if (filters.status) sp.set('status', filters.status);
    if (filters.month) sp.set('month', filters.month);

    if (filters.onlyOverdueComputed) sp.set('onlyOverdueComputed', '1');

    sp.set('sortKey', sortKey);
    sp.set('sortDir', sortDir);

    const qs = sp.toString();
    if (typeof window === 'undefined') return '';
    const base = window.location.origin;
    return qs ? `${base}${pathname}?${qs}` : `${base}${pathname}`;
  }, [filters, sortKey, sortDir, pathname]);

  const copyLink = async () => {
    const url = shareUrl;
    if (!url) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return;
      }
      throw new Error('Clipboard API not available');
    } catch {
      window.prompt('Copia questo link:', url);
    }
  };

  // ---- push state to URL ----
  useEffect(() => {
    if (!didInitFromUrl.current) return;

    const sp = new URLSearchParams();

    if (cleanStr(filters.q)) sp.set('q', cleanStr(filters.q));
    if (filters.propertyId) sp.set('propertyId', filters.propertyId);
    if (filters.type) sp.set('type', filters.type);
    if (filters.scope) sp.set('scope', filters.scope);
    if (filters.frequency) sp.set('frequency', filters.frequency);
    if (filters.status) sp.set('status', filters.status);
    if (filters.month) sp.set('month', filters.month);

    if (filters.onlyOverdueComputed) sp.set('onlyOverdueComputed', '1');

    sp.set('sortKey', sortKey);
    sp.set('sortDir', sortDir);

    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [filters, sortKey, sortDir, router, pathname]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [expensesRes, propsRes] = await Promise.all([fetchWithAuth('/expenses'), fetchWithAuth('/properties')]);

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
      paidDate: cleanStr(form.paidDate) || undefined,

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

  // -------------------------
  // Derived / computed UI fields (effectiveStatus + month)
  // -------------------------
  const enriched = useMemo(() => {
    const today = todayYmdUtc();
    return items.map((x) => {
      const cost = toYmd(x.costDate);
      const paid = toYmd(x.paidDate);
      const month = x.costMonth || monthFromYmd(cost);

      // overdue computed: se PLANNED (o vuoto) e costDate < today e non paid
      const overdueComputed = ((x.status ?? 'PLANNED') === 'PLANNED') && !!cost && cost < today && !paid;

      const effectiveStatus: ExpenseStatus = overdueComputed ? 'OVERDUE' : (x.status ?? 'PLANNED');

      return {
        ...x,
        _costYmd: cost,
        _paidYmd: paid,
        _month: month,
        _overdueComputed: overdueComputed,
        _effectiveStatus: effectiveStatus,
      };
    });
  }, [items]);

  const availableTypes = useMemo(() => {
    const s = new Set<string>();
    for (const e of items) if (cleanStr(e.type)) s.add(cleanStr(e.type));
    return Array.from(s).sort(compareStr);
  }, [items]);

  const availableScopes = useMemo(() => {
    const s = new Set<string>();
    for (const e of items) if (e.scope) s.add(String(e.scope));
    s.add('UNIT');
    s.add('BUILDING');
    return Array.from(s).sort(compareStr);
  }, [items]);

  const availableFrequencies = useMemo(() => {
    const s = new Set<string>();
    for (const e of items) if (e.frequency) s.add(String(e.frequency));
    s.add('ONCE');
    s.add('MONTHLY');
    s.add('YEARLY');
    return Array.from(s).sort(compareStr);
  }, [items]);

  const availableStatuses = useMemo(() => {
    const s = new Set<string>();
    for (const e of items) s.add(String(e.status ?? 'PLANNED'));
    s.add('OVERDUE');
    s.add('PLANNED');
    s.add('PAID');
    return Array.from(s).sort(compareStr);
  }, [items]);

  const filtered = useMemo(() => {
    const q = cleanStr(filters.q).toLowerCase();
    return enriched.filter((x: any) => {
      if (filters.propertyId && x.propertyId !== filters.propertyId) return false;
      if (filters.type && String(x.type ?? '') !== filters.type) return false;
      if (filters.scope && String(x.scope ?? '') !== filters.scope) return false;
      if (filters.frequency && String(x.frequency ?? '') !== filters.frequency) return false;
      if (filters.status && String(x._effectiveStatus ?? '') !== filters.status) return false;
      if (filters.month && x._month !== filters.month) return false;
      if (filters.onlyOverdueComputed && !x._overdueComputed) return false;

      if (q) {
        const propText = (propertyLabel.get(x.propertyId) ?? x.propertyId).toLowerCase();
        const hay = [
          x.id,
          x.propertyId,
          propText,
          x.type ?? '',
          x.description ?? '',
          x.notes ?? '',
          x.scope ?? '',
          x.frequency ?? '',
          x.status ?? '',
          x._effectiveStatus ?? '',
          x._costYmd ?? '',
          x._paidYmd ?? '',
          x.leaseId ?? '',
        ]
          .join(' ')
          .toLowerCase();

        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [enriched, filters, propertyLabel]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      if (sortKey === 'costDate') return compareStr(a._costYmd ?? '', b._costYmd ?? '') * dir;
      if (sortKey === 'amount') return (Number(a.amount ?? 0) - Number(b.amount ?? 0)) * dir;
      const as = String(a._effectiveStatus ?? a.status ?? '');
      const bs = String(b._effectiveStatus ?? b.status ?? '');
      return compareStr(as, bs) * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const totals = { ALL: 0, PLANNED: 0, PAID: 0, OVERDUE: 0 };
    for (const x of filtered as any[]) {
      const amt = Number(x.amount ?? 0);
      totals.ALL += amt;
      const st = String(x._effectiveStatus ?? x.status ?? 'PLANNED');
      if (st === 'PAID') totals.PAID += amt;
      else if (st === 'OVERDUE') totals.OVERDUE += amt;
      else totals.PLANNED += amt;
    }
    return { count: filtered.length, totals };
  }, [filtered]);

  const clearFilters = () => {
    setFilters({
      q: '',
      propertyId: '',
      type: '',
      scope: '',
      frequency: '',
      status: '',
      month: '',
      onlyOverdueComputed: false,
    });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
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

        {error && <div className="mb-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">{error}</div>}

        {/* FILTERS + KPI (stile payments) */}
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-600">Riepilogo (filtri applicati)</div>
              <div className="text-lg font-semibold">
                {kpis.count} items · Totale: {kpis.totals.ALL.toFixed(2)} €
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Planned: {kpis.totals.PLANNED.toFixed(2)} € · Paid: {kpis.totals.PAID.toFixed(2)} € · Overdue:{' '}
                {kpis.totals.OVERDUE.toFixed(2)} €
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyLink}
                disabled={busy || !shareUrl}
                className="text-sm border rounded px-3 py-2 hover:bg-slate-50 disabled:opacity-50"
                title={shareUrl || ''}
              >
                Copy link
              </button>

              <button
                onClick={clearFilters}
                disabled={busy}
                className="text-sm border rounded px-3 py-2 hover:bg-slate-50 disabled:opacity-50"
              >
                Clear filters
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Search">
              <Input
                value={filters.q}
                onChange={(arg: unknown) => setFilters((p) => ({ ...p, q: valueFromInputChange(arg) }))}
                placeholder="property, type, status, scope, id, notes..."
                disabled={busy}
              />
            </Field>

            <Field label="Property">
              <Select
                value={filters.propertyId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFilters((p) => ({ ...p, propertyId: e.target.value }))
                }
                disabled={busy}
              >
                <option value="">(all)</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {propertyLabel.get(p.id) ?? p.id}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Type">
              <Select
                value={filters.type}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters((p) => ({ ...p, type: e.target.value }))}
                disabled={busy}
              >
                <option value="">(all)</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Scope">
              <Select
                value={filters.scope}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters((p) => ({ ...p, scope: e.target.value }))}
                disabled={busy}
              >
                <option value="">(all)</option>
                {availableScopes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Frequency">
              <Select
                value={filters.frequency}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFilters((p) => ({ ...p, frequency: e.target.value }))
                }
                disabled={busy}
              >
                <option value="">(all)</option>
                {availableFrequencies.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Status (effective)">
              <Select
                value={filters.status}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters((p) => ({ ...p, status: e.target.value }))}
                disabled={busy}
              >
                <option value="">(all)</option>
                {availableStatuses.map((s) => (
                  <option key={s} value={s}>
                    {fmtStatus(s)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Month (YYYY-MM)">
              <Input
                value={filters.month}
                onChange={(arg: unknown) => setFilters((p) => ({ ...p, month: valueFromInputChange(arg) }))}
                placeholder="2026-02"
                disabled={busy}
              />
            </Field>

            <Field label="Toggles">
              <div className="flex flex-col gap-2 py-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={filters.onlyOverdueComputed}
                    onChange={(e) => setFilters((p) => ({ ...p, onlyOverdueComputed: e.target.checked }))}
                    disabled={busy}
                  />
                  Solo overdue (computed)
                </label>
              </div>
            </Field>

            <Field label="Sort">
              <div className="flex gap-2">
                <Select
                  value={sortKey}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortKey(e.target.value as SortKey)}
                  disabled={busy}
                >
                  <option value="costDate">Cost date</option>
                  <option value="amount">Amount</option>
                  <option value="status">Status</option>
                </Select>
                <Select
                  value={sortDir}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortDir(e.target.value as SortDir)}
                  disabled={busy}
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </Select>
              </div>
            </Field>
          </div>
        </div>

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
                onChange={handleInput('type')}
                placeholder="Es: CONDOMINIO, BOLLETTA, MANUTENZIONE..."
                disabled={busy}
              />
            </Field>

            <Field label="Cost date" required>
              <Input
                type="date"
                value={form.costDate}
                onChange={(arg: unknown) => {
                  const v = valueFromInputChange(arg);
                  setForm((prev) => ({
                    ...prev,
                    costDate: v,
                    costMonth: cleanStr(prev.costMonth) ? prev.costMonth : monthFromDate(v),
                  }));
                }}
                disabled={busy}
              />
            </Field>

            <Field label="Cost month (YYYY-MM)">
              <Input value={form.costMonth} onChange={handleInput('costMonth')} placeholder="YYYY-MM (auto)" disabled={busy} />
            </Field>

            <Field label="Importo" required>
              <Input type="number" value={form.amount} onChange={handleInput('amount')} placeholder="100" disabled={busy} />
            </Field>

            <Field label="Currency">
              <Input value={form.currency} onChange={handleInput('currency')} placeholder="EUR" disabled={busy} />
            </Field>

            <Field label="Frequency">
              <Select
                value={form.frequency}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange('frequency', e.target.value)}
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
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange('scope', e.target.value)}
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
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange('allocationMode', e.target.value)}
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
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange('status', e.target.value)}
                disabled={busy}
              >
                <option value="PLANNED">PLANNED</option>
                <option value="PAID">PAID</option>
                <option value="OVERDUE">OVERDUE</option>
              </Select>
            </Field>

            <Field label="Paid date">
              <Input type="date" value={form.paidDate} onChange={handleInput('paidDate')} disabled={busy} />
            </Field>

            <Field label="Description">
              <Input value={form.description} onChange={handleInput('description')} placeholder="Breve descrizione..." disabled={busy} />
            </Field>

            <Field label="Notes">
              <Input value={form.notes} onChange={handleInput('notes')} placeholder="Note interne..." disabled={busy} />
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
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-medium">Elenco</h2>
            <div className="text-xs text-slate-500">Mostrati: {sorted.length} / {items.length}</div>
          </div>

          {loading ? (
            <div>Caricamento...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500">Nessuna spesa.</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-slate-500">Nessun risultato con i filtri correnti.</div>
          ) : (
            <div className="space-y-2">
              {sorted.map((x: any) => {
                const docsOpen = openDocsExpenseId === x.id;
                const propText = propertyLabel.get(x.propertyId) ?? x.propertyId;

                const cost = x._costYmd || '-';
                const paid = x._paidYmd || '';

                const effectiveStatus = x._effectiveStatus ?? x.status ?? 'PLANNED';
                const statusPill =
                  effectiveStatus === 'PAID'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : effectiveStatus === 'OVERDUE'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200';

                return (
                  <div key={x.id} className="border rounded-lg p-3">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {propText} · {x.type}
                        </div>

                        <div className="text-sm text-slate-600 flex flex-wrap items-center gap-2">
                          <span>
                            {Number(x.amount ?? 0).toFixed(2)} {x.currency ?? 'EUR'}
                            {x.scope ? ` · ${x.scope}` : ''}
                            {x.frequency ? ` · ${x.frequency}` : ''}
                          </span>

                          <span className={`text-xs border rounded-full px-2 py-0.5 ${statusPill}`}>
                            {fmtStatus(effectiveStatus)}
                            {x._overdueComputed ? ' (computed)' : ''}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          Cost date: {cost}
                          {paid ? ` · Paid: ${paid}` : ''}
                          {x._month ? ` · Month: ${x._month}` : ''}
                          {x.leaseId ? ` · leaseId: ${x.leaseId}` : ''}
                        </div>

                        {x.description && <div className="text-xs text-slate-500 mt-1">Desc: {x.description}</div>}
                        {x.notes && <div className="text-xs text-slate-500 mt-1">Note: {x.notes}</div>}

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
                        <EntityDocuments entityKind="expenses" entityId={x.id} label={`Documenti spesa (${propText} · ${x.type})`} />
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
