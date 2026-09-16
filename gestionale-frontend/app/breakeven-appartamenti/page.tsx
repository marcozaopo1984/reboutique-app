'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
  apartmentId?: string;
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

// Normalizza i type delle expenses per rendere il matching indipendente da
// maiuscole/minuscole, spazi, trattini e accenti.
// Esempi:
//   "Consumi"            -> "CONSUMI"
//   "imposte e tasse"    -> "IMPOSTE_E_TASSE"
//   "Volture Energia"    -> "VOLTURE_ENERGIA"
//   "booking-cost"       -> "BOOKING_COST"
const normalizeExpenseType = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const expenseAliases = (...values: string[]) => values.map(normalizeExpenseType);

const EXPENSE_TYPE_MAP: Record<string, string[]> = {
  Consumi: expenseAliases('CONSUMI', 'CONSUMO', 'UTILITIES'),
  Manutenzioni: expenseAliases('MANUTENZIONI', 'MANUTENZIONE'),
  'Imposte e Tasse': expenseAliases('IMPOSTE_E_TASSE', 'IMPOSTE E TASSE', 'TASSE', 'IMPOSTE'),
  Mobili: expenseAliases('MOBILI', 'FURNITURE'),
  Ristrutturazioni: expenseAliases('RISTRUTTURAZIONI', 'RISTRUTTURAZIONE', 'RENOVATION'),
  'Volture Energia': expenseAliases('VOLTURE_ENERGIA', 'VOLTURA_ENERGIA', 'VOLTURE ENERGIA', 'VOLTURA ENERGIA'),
  Agenzia: expenseAliases('AGENZIA', 'AGENCY'),
  Fideiussione: expenseAliases('FIDEIUSSIONE', 'GUARANTEE'),
  'Booking Cost': expenseAliases('BOOKING_COST', 'BOOKING COST'),
  'Deposito Versato': expenseAliases('DEPOSIT_REFUND', 'DEPOSIT_RETURN', 'DEPOSITO_VERSATO', 'DEPOSITO VERSATO'),
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

function BreakevenAppartamentiContent() {
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

  // Tutti i lease TENANT dell'appartamento, senza filtro di stato/attività rispetto ad asOf.
  // I lease passati, attivi, futuri/inattivi sono tutti inclusi.
  const tenantLeaseIdsByApartment = useMemo(() => {
    const map = new Map<string, Set<string>>();

    for (const l of leases) {
      if (String(l.type) !== 'TENANT') continue;

      const aptId = propertyToApartmentId.get(l.propertyId) ?? '';
      if (!aptId) continue;

      if (!map.has(aptId)) map.set(aptId, new Set<string>());
      map.get(aptId)!.add(l.id);
    }

    return map;
  }, [leases, propertyToApartmentId]);

  // Minima startDate calcolata su tutti i lease TENANT dell'appartamento,
  // senza limitarsi ai soli contratti attivi alla data asOf.
  const minStartByApartment = useMemo(() => {
    const m = new Map<string, string>();

    for (const [aptId, leaseIds] of tenantLeaseIdsByApartment.entries()) {
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
  }, [tenantLeaseIdsByApartment, leases]);

  const expensesByApartment = useMemo(() => {
    const m = new Map<string, Expense[]>();

    for (const e of expenses) {
      // Preferisce apartmentId se già presente sull'expense; altrimenti
      // riconduce propertyId all'appartamento padre tramite la mappa Properties.
      // In questo modo anche una spesa associata a ROOM/BED confluisce
      // correttamente nella riga dell'APARTMENT.
      const aptId =
        e.apartmentId ||
        propertyToApartmentId.get(e.propertyId) ||
        '';

      if (!aptId) continue;

      if (!m.has(aptId)) m.set(aptId, []);
      m.get(aptId)!.push(e);
    }

    return m;
  }, [expenses, propertyToApartmentId]);

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

    _leaseCount: number;
    _minStart: string;
  };

  const rows = useMemo<Row[]>(() => {
    if (!asOfDate) return [];

    const out: Row[] = [];
    const month = asOfMonth;

    for (const a of apartments) {
      const aptId = a.id;
      const label = propertyLabel.get(aptId) ?? aptId;

      const leaseIds = tenantLeaseIdsByApartment.get(aptId) ?? new Set<string>();
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

          const normalizedType = normalizeExpenseType(e.type);
          if (!types.includes(normalizedType)) continue;

          const amount = Number(e.amount ?? 0);
          if (!Number.isFinite(amount)) continue;

          s += amount;
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

        _leaseCount: leaseIds.size,
        _minStart: minStart || '',
      });
    }

    return out;
  }, [
    apartments,
    propertyLabel,
    tenantLeaseIdsByApartment,
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
      'tenantLeases',
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
        r._leaseCount,
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
    <div className="app-shell">
      <div className="max-w-[1400px] mx-auto py-8 px-4 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Breakeven Appartamenti</h1>
            <p className="page-subtitle">
              Vista per appartamento alla data selezionata. Somme da inizio di tutti i contratti TENANT fino alla data.
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

        {error && <div className="alert-error">{error}</div>}

        <div className="surface-card p-5 space-y-4">
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

        <div className="surface-card p-5">
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
            <>
              <div className="max-h-[72vh] overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-[1900px] w-full text-sm">
                  <thead className="sticky top-0 z-30 bg-slate-100 text-slate-700 shadow-sm">
                    <tr className="text-left border-b border-slate-200">
                      <th className="sticky left-0 z-40 min-w-[230px] bg-slate-100 px-3 py-3 whitespace-nowrap">Appartamento</th>
                      <th className="min-w-[105px] px-3 py-3 text-right whitespace-nowrap">Consumi</th>
                      <th className="min-w-[120px] px-3 py-3 text-right whitespace-nowrap">Manutenzioni</th>
                      <th className="min-w-[130px] px-3 py-3 text-right whitespace-nowrap">Imposte e Tasse</th>
                      <th className="min-w-[90px] px-3 py-3 text-right whitespace-nowrap">Mobili</th>
                      <th className="min-w-[135px] px-3 py-3 text-right whitespace-nowrap">Ristrutturazioni</th>
                      <th className="min-w-[125px] px-3 py-3 text-right whitespace-nowrap">Volture Energia</th>
                      <th className="min-w-[95px] px-3 py-3 text-right whitespace-nowrap">Agenzia</th>
                      <th className="min-w-[110px] px-3 py-3 text-right whitespace-nowrap">Fideiussione</th>
                      <th className="min-w-[110px] px-3 py-3 text-right whitespace-nowrap">Booking Cost</th>
                      <th className="min-w-[135px] px-3 py-3 text-right whitespace-nowrap">Deposito Versato</th>
                      <th className="min-w-[115px] px-3 py-3 text-right whitespace-nowrap">Canoni Attivi</th>
                      <th className="min-w-[110px] px-3 py-3 text-right whitespace-nowrap">Admin Attive</th>
                      <th className="min-w-[145px] px-3 py-3 text-right whitespace-nowrap">Deposito Percepito</th>
                      <th className="min-w-[155px] px-3 py-3 text-right whitespace-nowrap">Breakeven di Cassa</th>
                      <th className="min-w-[170px] px-3 py-3 text-right whitespace-nowrap">Breakeven Economico</th>
                      <th className="min-w-[175px] px-3 py-3 text-right whitespace-nowrap">Current Monthly Margin</th>
                    </tr>
                  </thead>

                <tbody>
                  {sorted.map((r) => {
                    const posGreen = (n: number) => (n >= 0 ? 'text-green-700' : 'text-red-700');

                    return (
                      <tr key={r.apartmentId} className="border-b border-slate-200 align-top hover:bg-slate-50/70">
                        <td className="sticky left-0 z-20 min-w-[230px] bg-white px-3 py-3">
                          <div className="font-medium whitespace-nowrap">{r.label}</div>
                          <div className="text-xs text-slate-400">
                            tenant leases: {r._leaseCount}
                            {r._minStart ? ` · from: ${r._minStart}` : ''}
                          </div>
                        </td>

                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(r.Consumi)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(r.Manutenzioni)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(r['Imposte e Tasse'])}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(r.Mobili)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(r.Ristrutturazioni)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(r['Volture Energia'])}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(r.Agenzia)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(r.Fideiussione)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(r['Booking Cost'])}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(r['Deposito Versato'])}</td>

                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(r['Canoni Attivi'])}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(r['Admin Attive'])}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(r['Deposito Percepito'])}</td>

                        <td className={`px-3 py-3 text-right whitespace-nowrap tabular-nums font-semibold ${posGreen(r['Breakeven di Cassa'])}`}>
                          {fmtMoney(r['Breakeven di Cassa'])}
                        </td>

                        <td className={`px-3 py-3 text-right whitespace-nowrap tabular-nums font-semibold ${posGreen(r['Breakeven Economico'])}`}>
                          {fmtMoney(r['Breakeven Economico'])}
                        </td>

                        <td className={`px-3 py-3 text-right whitespace-nowrap tabular-nums font-semibold ${posGreen(r['Current Monthly Margin'])}`}>
                          {fmtMoney(r['Current Monthly Margin'])}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>

              <div className="text-xs text-slate-400 mt-3">
                Nota: sono considerati tutti i contratti TENANT dell’appartamento, senza filtro sul loro stato rispetto ad asOf. Range somme: da
                min(startDate) di tutti i contratti TENANT dell’appartamento fino ad asOf.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BreakevenAppartamentiPage() {
  return (
    <Suspense fallback={<div className="app-shell p-6">Caricamento...</div>}>
      <BreakevenAppartamentiContent />
    </Suspense>
  );
}
