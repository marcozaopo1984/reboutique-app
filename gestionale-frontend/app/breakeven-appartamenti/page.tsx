'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { fetchWithAuth } from '@/lib/apiClient';
import { Field, Input, Select } from '@/components/form/Field';

type LeaseType = 'TENANT' | 'LANDLORD' | string;

type Property = {
  id: string;
  code?: string;
  name?: string;
  type?: string;
  apartmentId?: string;
};

type Lease = {
  id: string;
  type: LeaseType;
  propertyId: string;
  tenantId?: string;
  startDate: any;
  endDate?: any;
};

type PaymentKind = 'RENT' | 'ADMIN_FEE' | 'DEPOSIT' | string;

type Payment = {
  id: string;
  leaseId?: string;
  tenantId: string;
  propertyId: string;
  apartmentId?: string;
  dueDate: any;
  amount: number;
  kind: PaymentKind;
  status?: string;
};

type Expense = {
  id: string;
  propertyId: string;
  costDate: any;
  amount: number;
  type: string;
  status?: string;
};

type SortKey = 'code' | 'breakevenCash' | 'breakevenEconomic' | 'monthlyMargin';
type SortDir = 'asc' | 'desc';

type Filters = {
  q: string;
  apartmentId: string;
};

const EXPENSE_TYPE_MAP: Record<string, string[]> = {
  Consumi: ['CONSUMI', 'CONSUMO', 'UTILITIES'],
  Manutenzioni: ['MANUTENZIONI', 'MANUTENZIONE'],
  'Imposte e Tasse': ['IMPOSTE_E_TASSE', 'TASSE', 'IMPOSTE'],
  Mobili: ['MOBILI', 'FURNITURE'],
  Ristrutturazioni: ['RISTRUTTURAZIONI', 'RISTRUTTURAZIONE', 'RENOVATION'],
  'Volture Energia': ['VOLTURE_ENERGIA', 'VOLTURA_ENERGIA'],
  Agenzia: ['AGENZIA', 'AGENCY'],
  Fideiussione: ['FIDEIUSSIONE', 'GUARANTEE'],
  'Booking Cost': ['BOOKING_COST'],
  'Deposito Versato': ['DEPOSIT_REFUND', 'DEPOSIT_RETURN', 'DEPOSITO_VERSATO'],
};

const PAYMENT_KIND_MAP = {
  'Canoni Attivi': ['RENT'],
  'Admin Attive': ['ADMIN_FEE'],
  'Deposito Percepito': ['DEPOSIT'],
} as const;

// helpers
const cleanStr = (s: string) => (s ?? '').trim();
const compareStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const pickSortKey = (v: string | null): SortKey => {
  if (v === 'code' || v === 'breakevenCash' || v === 'breakevenEconomic' || v === 'monthlyMargin') return v;
  return 'code';
};

const pickSortDir = (v: string | null): SortDir => {
  if (v === 'asc' || v === 'desc') return v;
  return 'asc';
};

const valueFromInputChange = (arg: unknown): string => {
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'number') return String(arg);
  if (arg && typeof arg === 'object' && 'target' in arg) {
    const t = (arg as any).target;
    if (t && typeof t.value !== 'undefined') return String(t.value ?? '');
  }
  return '';
};

// ---- date helpers robusti (string | Date | Firestore Timestamp) ----
const dateToYmd = (v: any): string => {
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

const ymdToUtcDate = (ymd: string): Date | null => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const todayYmdUtc = () => new Date().toISOString().slice(0, 10);
const monthFromYmd = (ymd: string) => (ymd && ymd.length >= 7 ? ymd.slice(0, 7) : '');
const isBetweenYmd = (d: string, a: string, b: string) => !!d && !!a && !!b && a <= d && d <= b;
const fmtMoney = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '0.00');

// ---- CSV helpers ----
const escapeCsv = (v: unknown) => {
  const s = String(v ?? '');
  // quote if contains comma, quote, newline
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export default function BreakevenAppartamentiPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const didInitFromUrl = useRef(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [asOf, setAsOf] = useState<string>(todayYmdUtc());

  const [filters, setFilters] = useState<Filters>({ q: '', apartmentId: '' });
  const [sortKey, setSortKey] = useState<SortKey>('code');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // ---- init from URL (once) ----
  useEffect(() => {
    if (didInitFromUrl.current) return;

    const asOfUrl = searchParams.get('asOf');
    const q = searchParams.get('q') ?? '';
    const apartmentId = searchParams.get('apartmentId') ?? '';

    const sk = pickSortKey(searchParams.get('sortKey'));
    const sd = pickSortDir(searchParams.get('sortDir'));

    if (asOfUrl && /^\d{4}-\d{2}-\d{2}$/.test(asOfUrl)) setAsOf(asOfUrl);

    setFilters({ q, apartmentId });
    setSortKey(sk);
    setSortDir(sd);

    didInitFromUrl.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- push state to URL ----
  useEffect(() => {
    if (!didInitFromUrl.current) return;

    const sp = new URLSearchParams();
    sp.set('asOf', asOf);

    if (cleanStr(filters.q)) sp.set('q', cleanStr(filters.q));
    if (filters.apartmentId) sp.set('apartmentId', filters.apartmentId);

    sp.set('sortKey', sortKey);
    sp.set('sortDir', sortDir);

    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [asOf, filters, sortKey, sortDir, router, pathname]);

  // ---- shareable URL ----
  const shareUrl = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('asOf', asOf);

    if (cleanStr(filters.q)) sp.set('q', cleanStr(filters.q));
    if (filters.apartmentId) sp.set('apartmentId', filters.apartmentId);

    sp.set('sortKey', sortKey);
    sp.set('sortDir', sortDir);

    const qs = sp.toString();
    if (typeof window === 'undefined') return '';
    const base = window.location.origin;
    return qs ? `${base}${pathname}?${qs}` : `${base}${pathname}`;
  }, [asOf, filters, sortKey, sortDir, pathname]);

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

  const clearFilters = () => setFilters({ q: '', apartmentId: '' });

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [propsRes, leasesRes, paymentsRes, expensesRes] = await Promise.all([
        fetchWithAuth('/properties'),
        fetchWithAuth('/leases'),
        fetchWithAuth('/payments'),
        fetchWithAuth('/expenses'),
      ]);

      setProperties(Array.isArray(propsRes) ? propsRes : []);
      setLeases(Array.isArray(leasesRes) ? leasesRes : []);
      setPayments(Array.isArray(paymentsRes) ? paymentsRes : []);
      setExpenses(Array.isArray(expensesRes) ? expensesRes : []);
    } catch (e: any) {
      setError(e?.message ?? 'Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const apartments = useMemo(() => properties.filter((p) => p.type === 'APARTMENT'), [properties]);

  const propertyLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) {
      const code = p.code ?? p.id;
      const name = p.name ? ` – ${p.name}` : '';
      m.set(p.id, `${code}${name}`);
    }
    return m;
  }, [properties]);

  const propertyToApartmentId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) {
      if (p.type === 'APARTMENT') m.set(p.id, p.id);
      else if (p.apartmentId) m.set(p.id, p.apartmentId);
    }
    return m;
  }, [properties]);

  const asOfDate = useMemo(() => ymdToUtcDate(asOf), [asOf]);
  const asOfMonth = useMemo(() => monthFromYmd(asOf), [asOf]);

  const activeTenantLeaseIdsByApartment = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!asOfDate) return map;

    for (const l of leases) {
      if (String(l.type) !== 'TENANT') continue;

      const start = dateToYmd(l.startDate);
      const end = dateToYmd(l.endDate);
      if (!start) continue;

      const isActive = end ? isBetweenYmd(asOf, start, end) : start <= asOf;
      if (!isActive) continue;

      const aptId = propertyToApartmentId.get(l.propertyId) ?? '';
      if (!aptId) continue;

      if (!map.has(aptId)) map.set(aptId, new Set<string>());
      map.get(aptId)!.add(l.id);
    }
    return map;
  }, [leases, propertyToApartmentId, asOfDate, asOf]);

  const minStartByApartment = useMemo(() => {
    const m = new Map<string, string>();
    for (const [aptId, leaseIds] of activeTenantLeaseIdsByApartment.entries()) {
      let min: string | null = null;
      for (const lid of leaseIds) {
        const l = leases.find((x) => x.id === lid);
        if (!l) continue;
        const s = dateToYmd(l.startDate);
        if (!s) continue;
        if (min === null || s < min) min = s;
      }
      if (min) m.set(aptId, min);
    }
    return m;
  }, [activeTenantLeaseIdsByApartment, leases]);

  const expensesByApartment = useMemo(() => {
    const m = new Map<string, Expense[]>();
    for (const e of expenses) {
      const aptId = e.propertyId;
      if (!aptId) continue;
      if (!m.has(aptId)) m.set(aptId, []);
      m.get(aptId)!.push(e);
    }
    return m;
  }, [expenses]);

  const paymentsByApartment = useMemo(() => {
    const m = new Map<string, Payment[]>();

    for (const p of payments) {
      if (!p.leaseId) continue;

      const aptId = p.apartmentId || propertyToApartmentId.get(p.propertyId) || '';
      if (!aptId) continue;

      if (!m.has(aptId)) m.set(aptId, []);
      m.get(aptId)!.push(p);
    }
    return m;
  }, [payments, propertyToApartmentId]);

  type Row = {
    apartmentId: string;
    label: string;

    Consumi: number;
    Manutenzioni: number;
    'Imposte e Tasse': number;
    Mobili: number;
    Ristrutturazioni: number;
    'Volture Energia': number;
    Agenzia: number;
    Fideiussione: number;
    'Booking Cost': number;
    'Deposito Versato': number;

    'Canoni Attivi': number;
    'Admin Attive': number;
    'Deposito Percepito': number;

    'Breakeven di Cassa': number;
    'Breakeven Economico': number;
    'Current Monthly Margin': number;

    _activeLeaseCount: number;
    _minStart: string;
  };

  const rows = useMemo<Row[]>(() => {
    if (!asOfDate) return [];

    const out: Row[] = [];
    const month = asOfMonth;

    for (const a of apartments) {
      const aptId = a.id;
      const label = propertyLabel.get(aptId) ?? aptId;

      const leaseIds = activeTenantLeaseIdsByApartment.get(aptId) ?? new Set<string>();
      const minStart = minStartByApartment.get(aptId) ?? '';

      const fromYmd = minStart || asOf;
      const toYmdLocal = asOf;

      const expList = expensesByApartment.get(aptId) ?? [];
      const payList = paymentsByApartment.get(aptId) ?? [];

      const sumExpenses = (types: string[], monthOnly: boolean) => {
        let s = 0;
        for (const e of expList) {
          const d = dateToYmd(e.costDate);
          if (!d) continue;

          if (monthOnly) {
            if (monthFromYmd(d) !== month) continue;
          } else {
            if (!isBetweenYmd(d, fromYmd, toYmdLocal)) continue;
          }

          if (!types.includes(String(e.type ?? ''))) continue;
          s += Number(e.amount ?? 0);
        }
        return s;
      };

      const sumPayments = (kinds: string[], monthOnly: boolean) => {
        let s = 0;
        for (const p of payList) {
          if (!p.leaseId || !leaseIds.has(p.leaseId)) continue;

          const d = dateToYmd(p.dueDate);
          if (!d) continue;

          if (monthOnly) {
            if (monthFromYmd(d) !== month) continue;
          } else {
            if (!isBetweenYmd(d, fromYmd, toYmdLocal)) continue;
          }

          if (!kinds.includes(String(p.kind ?? ''))) continue;
          s += Number(p.amount ?? 0);
        }
        return s;
      };

      const Consumi = sumExpenses(EXPENSE_TYPE_MAP.Consumi, false);
      const Manutenzioni = sumExpenses(EXPENSE_TYPE_MAP.Manutenzioni, false);
      const ImposteTasse = sumExpenses(EXPENSE_TYPE_MAP['Imposte e Tasse'], false);
      const Mobili = sumExpenses(EXPENSE_TYPE_MAP.Mobili, false);
      const Ristrutturazioni = sumExpenses(EXPENSE_TYPE_MAP.Ristrutturazioni, false);
      const VoltureEnergia = sumExpenses(EXPENSE_TYPE_MAP['Volture Energia'], false);
      const Agenzia = sumExpenses(EXPENSE_TYPE_MAP.Agenzia, false);
      const Fideiussione = sumExpenses(EXPENSE_TYPE_MAP.Fideiussione, false);
      const BookingCost = sumExpenses(EXPENSE_TYPE_MAP['Booking Cost'], false);
      const DepositoVersato = sumExpenses(EXPENSE_TYPE_MAP['Deposito Versato'], false);

      const CanoniAttivi = sumPayments([...PAYMENT_KIND_MAP['Canoni Attivi']], false);
      const AdminAttive = sumPayments([...PAYMENT_KIND_MAP['Admin Attive']], false);
      const DepositoPercepito = sumPayments([...PAYMENT_KIND_MAP['Deposito Percepito']], false);

      const costsCash =
        Consumi +
        Manutenzioni +
        ImposteTasse +
        Mobili +
        Ristrutturazioni +
        VoltureEnergia +
        Agenzia +
        Fideiussione +
        BookingCost;

      const costsEconomic = costsCash + DepositoVersato;
      const revenues = CanoniAttivi + AdminAttive + DepositoPercepito;

      const breakevenCash = revenues - costsCash;
      const breakevenEconomic = revenues - costsEconomic;

      const mConsumi = sumExpenses(EXPENSE_TYPE_MAP.Consumi, true);
      const mManut = sumExpenses(EXPENSE_TYPE_MAP.Manutenzioni, true);
      const mImp = sumExpenses(EXPENSE_TYPE_MAP['Imposte e Tasse'], true);
      const mMob = sumExpenses(EXPENSE_TYPE_MAP.Mobili, true);
      const mRist = sumExpenses(EXPENSE_TYPE_MAP.Ristrutturazioni, true);
      const mVolt = sumExpenses(EXPENSE_TYPE_MAP['Volture Energia'], true);
      const mAgen = sumExpenses(EXPENSE_TYPE_MAP.Agenzia, true);
      const mFid = sumExpenses(EXPENSE_TYPE_MAP.Fideiussione, true);
      const mBook = sumExpenses(EXPENSE_TYPE_MAP['Booking Cost'], true);

      const mCostsCash = mConsumi + mManut + mImp + mMob + mRist + mVolt + mAgen + mFid + mBook;

      const mCanoni = sumPayments([...PAYMENT_KIND_MAP['Canoni Attivi']], true);
      const mAdmin = sumPayments([...PAYMENT_KIND_MAP['Admin Attive']], true);
      const mDep = sumPayments([...PAYMENT_KIND_MAP['Deposito Percepito']], true);

      const monthlyMargin = mCanoni + mAdmin + mDep - mCostsCash;

      out.push({
        apartmentId: aptId,
        label,

        Consumi,
        Manutenzioni,
        'Imposte e Tasse': ImposteTasse,
        Mobili,
        Ristrutturazioni,
        'Volture Energia': VoltureEnergia,
        Agenzia,
        Fideiussione,
        'Booking Cost': BookingCost,
        'Deposito Versato': DepositoVersato,

        'Canoni Attivi': CanoniAttivi,
        'Admin Attive': AdminAttive,
        'Deposito Percepito': DepositoPercepito,

        'Breakeven di Cassa': breakevenCash,
        'Breakeven Economico': breakevenEconomic,
        'Current Monthly Margin': monthlyMargin,

        _activeLeaseCount: leaseIds.size,
        _minStart: minStart || '',
      });
    }

    return out;
  }, [
    apartments,
    propertyLabel,
    activeTenantLeaseIdsByApartment,
    minStartByApartment,
    expensesByApartment,
    paymentsByApartment,
    asOfDate,
    asOf,
    asOfMonth,
  ]);

  const filtered = useMemo(() => {
    const q = cleanStr(filters.q).toLowerCase();
    return rows.filter((r) => {
      if (filters.apartmentId && r.apartmentId !== filters.apartmentId) return false;
      if (q) {
        const hay = [r.apartmentId, r.label].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const arr = [...filtered];

    arr.sort((a, b) => {
      if (sortKey === 'code') return compareStr(a.label, b.label) * dir;
      if (sortKey === 'breakevenCash') return (a['Breakeven di Cassa'] - b['Breakeven di Cassa']) * dir;
      if (sortKey === 'breakevenEconomic') return (a['Breakeven Economico'] - b['Breakeven Economico']) * dir;
      return (a['Current Monthly Margin'] - b['Current Monthly Margin']) * dir;
    });

    return arr;
  }, [filtered, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const totals = {
      costsCash: 0,
      costsEconomic: 0,
      revenues: 0,
      breakevenCash: 0,
      breakevenEconomic: 0,
      monthlyMargin: 0,
    };

    for (const r of filtered) {
      const costsCash =
        r.Consumi +
        r.Manutenzioni +
        r['Imposte e Tasse'] +
        r.Mobili +
        r.Ristrutturazioni +
        r['Volture Energia'] +
        r.Agenzia +
        r.Fideiussione +
        r['Booking Cost'];

      const costsEconomic = costsCash + r['Deposito Versato'];
      const revenues = r['Canoni Attivi'] + r['Admin Attive'] + r['Deposito Percepito'];

      totals.costsCash += costsCash;
      totals.costsEconomic += costsEconomic;
      totals.revenues += revenues;
      totals.breakevenCash += r['Breakeven di Cassa'];
      totals.breakevenEconomic += r['Breakeven Economico'];
      totals.monthlyMargin += r['Current Monthly Margin'];
    }

    return { count: filtered.length, totals };
  }, [filtered]);

  // ✅ Export CSV (rispetta filtri + ordinamento)
  const exportCsv = () => {
    const headers = [
      'asOf',
      'apartmentId',
      'label',
      'activeLeases',
      'fromMinStart',
      'Consumi',
      'Manutenzioni',
      'Imposte e Tasse',
      'Mobili',
      'Ristrutturazioni',
      'Volture Energia',
      'Agenzia',
      'Fideiussione',
      'Booking Cost',
      'Deposito Versato',
      'Canoni Attivi',
      'Admin Attive',
      'Deposito Percepito',
      'Breakeven di Cassa',
      'Breakeven Economico',
      'Current Monthly Margin',
    ];

    const lines = [headers.map(escapeCsv).join(',')];

    for (const r of sorted) {
      const row = [
        asOf,
        r.apartmentId,
        r.label,
        r._activeLeaseCount,
        r._minStart,
        r.Consumi,
        r.Manutenzioni,
        r['Imposte e Tasse'],
        r.Mobili,
        r.Ristrutturazioni,
        r['Volture Energia'],
        r.Agenzia,
        r.Fideiussione,
        r['Booking Cost'],
        r['Deposito Versato'],
        r['Canoni Attivi'],
        r['Admin Attive'],
        r['Deposito Percepito'],
        r['Breakeven di Cassa'],
        r['Breakeven Economico'],
        r['Current Monthly Margin'],
      ];

      lines.push(row.map(escapeCsv).join(','));
    }

    const filename = `breakeven-appartamenti_${asOf}.csv`;
    downloadCsv(filename, lines.join('\n'));
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-[1400px] mx-auto py-8 px-4 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Breakeven Appartamenti</h1>
            <p className="text-sm text-slate-600">
              Vista per appartamento alla data selezionata. Somme da inizio contratti TENANT attivi fino alla data.
            </p>
          </div>

          <button
            onClick={loadAll}
            disabled={busy}
            className="text-sm border rounded px-3 py-2 hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </header>

        {error && <div className="mb-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">{error}</div>}

        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-600">Riepilogo (filtri applicati)</div>
              <div className="text-lg font-semibold">
                {kpis.count} appartamenti · Breakeven cash: {fmtMoney(kpis.totals.breakevenCash)} €
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Costi cash: {fmtMoney(kpis.totals.costsCash)} € · Costi economici: {fmtMoney(kpis.totals.costsEconomic)} € · Ricavi:{' '}
                {fmtMoney(kpis.totals.revenues)} € · Breakeven econ: {fmtMoney(kpis.totals.breakevenEconomic)} € · Monthly margin:{' '}
                {fmtMoney(kpis.totals.monthlyMargin)} €
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportCsv}
                disabled={busy || loading || sorted.length === 0}
                className="text-sm border rounded px-3 py-2 hover:bg-slate-50 disabled:opacity-50"
                title={sorted.length === 0 ? 'Nessun dato da esportare con i filtri correnti' : 'Esporta CSV'}
              >
                Export CSV
              </button>

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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Data (as of)" required>
              <Input
                type="date"
                value={asOf}
                onChange={(arg: unknown) => setAsOf(valueFromInputChange(arg) || todayYmdUtc())}
                disabled={busy}
              />
            </Field>

            <Field label="Search">
              <Input
                value={filters.q}
                onChange={(arg: unknown) => setFilters((p) => ({ ...p, q: valueFromInputChange(arg) }))}
                placeholder="cerca per codice/nome..."
                disabled={busy}
              />
            </Field>

            <Field label="Apartment">
              <Select
                value={filters.apartmentId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters((p) => ({ ...p, apartmentId: e.target.value }))}
                disabled={busy}
              >
                <option value="">(all)</option>
                {apartments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {propertyLabel.get(a.id) ?? a.id}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Sort">
              <div className="flex gap-2">
                <Select
                  value={sortKey}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortKey(e.target.value as SortKey)}
                  disabled={busy}
                >
                  <option value="code">Apartment</option>
                  <option value="breakevenCash">Breakeven cash</option>
                  <option value="breakevenEconomic">Breakeven econ</option>
                  <option value="monthlyMargin">Monthly margin</option>
                </Select>

                <Select
                  value={sortDir}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortDir(e.target.value as SortDir)}
                  disabled={busy}
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </Select>
              </div>
            </Field>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-medium">Elenco</h2>
            <div className="text-xs text-slate-500">
              Mostrati: {sorted.length} / {rows.length}
            </div>
          </div>

          {loading ? (
            <div>Caricamento...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-slate-500">Nessuna property di tipo APARTMENT trovata.</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-slate-500">Nessun risultato con i filtri correnti.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[1400px] w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-2 pr-3">Appartamento</th>
                    <th className="py-2 pr-3">Consumi</th>
                    <th className="py-2 pr-3">Manutenzioni</th>
                    <th className="py-2 pr-3">Imposte e Tasse</th>
                    <th className="py-2 pr-3">Mobili</th>
                    <th className="py-2 pr-3">Ristrutturazioni</th>
                    <th className="py-2 pr-3">Volture Energia</th>
                    <th className="py-2 pr-3">Agenzia</th>
                    <th className="py-2 pr-3">Fideiussione</th>
                    <th className="py-2 pr-3">Booking Cost</th>
                    <th className="py-2 pr-3">Deposito Versato</th>
                    <th className="py-2 pr-3">Canoni Attivi</th>
                    <th className="py-2 pr-3">Admin Attive</th>
                    <th className="py-2 pr-3">Deposito Percepito</th>
                    <th className="py-2 pr-3">Breakeven di Cassa</th>
                    <th className="py-2 pr-3">Breakeven Economico</th>
                    <th className="py-2 pr-3">Current Monthly Margin</th>
                  </tr>
                </thead>

                <tbody>
                  {sorted.map((r) => {
                    const posGreen = (n: number) => (n >= 0 ? 'text-green-700' : 'text-red-700');

                    return (
                      <tr key={r.apartmentId} className="border-b align-top">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{r.label}</div>
                          <div className="text-xs text-slate-400">
                            active leases: {r._activeLeaseCount}
                            {r._minStart ? ` · from: ${r._minStart}` : ''}
                          </div>
                        </td>

                        <td className="py-2 pr-3">{fmtMoney(r.Consumi)}</td>
                        <td className="py-2 pr-3">{fmtMoney(r.Manutenzioni)}</td>
                        <td className="py-2 pr-3">{fmtMoney(r['Imposte e Tasse'])}</td>
                        <td className="py-2 pr-3">{fmtMoney(r.Mobili)}</td>
                        <td className="py-2 pr-3">{fmtMoney(r.Ristrutturazioni)}</td>
                        <td className="py-2 pr-3">{fmtMoney(r['Volture Energia'])}</td>
                        <td className="py-2 pr-3">{fmtMoney(r.Agenzia)}</td>
                        <td className="py-2 pr-3">{fmtMoney(r.Fideiussione)}</td>
                        <td className="py-2 pr-3">{fmtMoney(r['Booking Cost'])}</td>
                        <td className="py-2 pr-3">{fmtMoney(r['Deposito Versato'])}</td>

                        <td className="py-2 pr-3">{fmtMoney(r['Canoni Attivi'])}</td>
                        <td className="py-2 pr-3">{fmtMoney(r['Admin Attive'])}</td>
                        <td className="py-2 pr-3">{fmtMoney(r['Deposito Percepito'])}</td>

                        <td className={`py-2 pr-3 font-semibold ${posGreen(r['Breakeven di Cassa'])}`}>
                          {fmtMoney(r['Breakeven di Cassa'])}
                        </td>

                        <td className={`py-2 pr-3 font-semibold ${posGreen(r['Breakeven Economico'])}`}>
                          {fmtMoney(r['Breakeven Economico'])}
                        </td>

                        <td className={`py-2 pr-3 font-semibold ${posGreen(r['Current Monthly Margin'])}`}>
                          {fmtMoney(r['Current Monthly Margin'])}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="text-xs text-slate-400 mt-3">
                Nota: “attivo” = TENANT con startDate ≤ asOf ≤ endDate (se endDate manca, contratto aperto). Range somme: da
                min(startDate) dei contratti attivi dell’appartamento fino ad asOf.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}