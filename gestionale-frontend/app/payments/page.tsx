'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { fetchWithAuth } from '@/lib/apiClient';
import EntityDocuments from '@/components/EntityDocuments';
import { Field, Input, Select } from '@/components/form/Field';

type Tenant = { id: string; firstName?: string; lastName?: string };
type Property = { id: string; code?: string; name?: string; type?: string; buildingId?: string };
type Lease = { id: string; tenantId?: string; propertyId?: string };

type PaymentKind = 'RENT' | 'BUILDING_FEE' | 'OTHER' | string;
type PaymentStatus = 'PLANNED' | 'PAID' | 'OVERDUE' | string;

type Payment = {
  id: string;
  tenantId: string;
  propertyId: string;
  leaseId?: string;
  buildingId?: string;

  dueDate: any; // string | Timestamp | Date
  paidDate?: any;

  amount: number;
  currency: string;

  kind: PaymentKind;
  status: PaymentStatus;
};

type CreatePaymentForm = {
  manualMode: boolean;

  leaseId: string; // usato se !manualMode
  tenantId: string; // usato se manualMode
  propertyId: string; // usato se manualMode

  dueDate: string; // YYYY-MM-DD
  paidDate: string; // '' oppure YYYY-MM-DD

  amount: string; // required
  kind: PaymentKind;
  status: PaymentStatus;
};

type SortKey = 'dueDate' | 'amount' | 'status';
type SortDir = 'asc' | 'desc';

type Filters = {
  q: string;
  tenantId: string;
  propertyId: string;
  leaseId: string;
  kind: string;
  status: string;
  month: string; // YYYY-MM
  onlyManual: boolean;
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

const fmtKind = (k: string) => {
  if (k === 'RENT') return 'Affitto';
  if (k === 'BUILDING_FEE') return 'Quota condominiale';
  if (k === 'OTHER') return 'Altro';
  return k;
};

const fmtStatus = (s: string) => {
  if (s === 'PLANNED') return 'Da pagare';
  if (s === 'PAID') return 'Pagato';
  if (s === 'OVERDUE') return 'In ritardo';
  return s;
};

// ---- querystring helpers ----
const parseBool = (v: string | null) => v === '1' || v === 'true';

const pickSortKey = (v: string | null): SortKey => {
  if (v === 'amount' || v === 'status' || v === 'dueDate') return v;
  return 'dueDate';
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

export default function PaymentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const didInitFromUrl = useRef(false);

  const [items, setItems] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // quale payment ha documenti aperti
  const [openDocsPaymentId, setOpenDocsPaymentId] = useState<string | null>(null);

  const [form, setForm] = useState<CreatePaymentForm>({
    manualMode: false,
    leaseId: '',
    tenantId: '',
    propertyId: '',
    dueDate: '',
    paidDate: '',
    amount: '',
    kind: 'RENT',
    status: 'PLANNED',
  });

  // ✅ filtri + sort
  const [filters, setFilters] = useState<Filters>({
    q: '',
    tenantId: '',
    propertyId: '',
    leaseId: '',
    kind: '',
    status: '',
    month: '',
    onlyManual: false,
    onlyOverdueComputed: false,
  });

  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ---- init from URL (once) ----
  useEffect(() => {
    if (didInitFromUrl.current) return;

    const q = searchParams.get('q') ?? '';
    const tenantId = searchParams.get('tenantId') ?? '';
    const propertyId = searchParams.get('propertyId') ?? '';
    const leaseId = searchParams.get('leaseId') ?? '';
    const kind = searchParams.get('kind') ?? '';
    const status = searchParams.get('status') ?? '';
    const month = searchParams.get('month') ?? '';
    const onlyManual = parseBool(searchParams.get('onlyManual'));
    const onlyOverdueComputed = parseBool(searchParams.get('onlyOverdueComputed'));

    const sk = pickSortKey(searchParams.get('sortKey'));
    const sd = pickSortDir(searchParams.get('sortDir'));

    setFilters({
      q,
      tenantId,
      propertyId,
      leaseId,
      kind,
      status,
      month,
      onlyManual,
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
    if (filters.tenantId) sp.set('tenantId', filters.tenantId);
    if (filters.propertyId) sp.set('propertyId', filters.propertyId);
    if (filters.leaseId) sp.set('leaseId', filters.leaseId);
    if (filters.kind) sp.set('kind', filters.kind);
    if (filters.status) sp.set('status', filters.status);
    if (filters.month) sp.set('month', filters.month);

    if (filters.onlyManual) sp.set('onlyManual', '1');
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
    if (filters.tenantId) sp.set('tenantId', filters.tenantId);
    if (filters.propertyId) sp.set('propertyId', filters.propertyId);
    if (filters.leaseId) sp.set('leaseId', filters.leaseId);
    if (filters.kind) sp.set('kind', filters.kind);
    if (filters.status) sp.set('status', filters.status);
    if (filters.month) sp.set('month', filters.month);

    if (filters.onlyManual) sp.set('onlyManual', '1');
    if (filters.onlyOverdueComputed) sp.set('onlyOverdueComputed', '1');

    sp.set('sortKey', sortKey);
    sp.set('sortDir', sortDir);

    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [filters, sortKey, sortDir, router, pathname]);

  // ---- form helpers robusti per Input ----
  const onChange = (key: keyof CreatePaymentForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value } as CreatePaymentForm));
  };

  const handleInput =
    (key: keyof CreatePaymentForm) =>
    (arg: unknown) => {
      onChange(key, valueFromInputChange(arg));
    };

  const tenantLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tenants) {
      const n = `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim();
      m.set(t.id, n || t.id);
    }
    return m;
  }, [tenants]);

  const propertyLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) {
      const code = p.code ? p.code : p.id;
      const name = p.name ? ` – ${p.name}` : '';
      m.set(p.id, `${code}${name}`);
    }
    return m;
  }, [properties]);

  const leaseLabel = useMemo(() => {
    // label: tenant -> property (leaseId)
    const m = new Map<string, string>();
    for (const l of leases) {
      const t = l.tenantId ? tenantLabel.get(l.tenantId) ?? l.tenantId : '(tenant?)';
      const p = l.propertyId ? propertyLabel.get(l.propertyId) ?? l.propertyId : '(property?)';
      m.set(l.id, `${t} → ${p}`);
    }
    return m;
  }, [leases, tenantLabel, propertyLabel]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [paymentsRes, tenantsRes, propertiesRes, leasesRes] = await Promise.all([
        fetchWithAuth('/payments'),
        fetchWithAuth('/tenants'),
        fetchWithAuth('/properties'),
        fetchWithAuth('/leases'),
      ]);

      setItems(Array.isArray(paymentsRes) ? paymentsRes : []);
      setTenants(Array.isArray(tenantsRes) ? tenantsRes : []);
      setProperties(Array.isArray(propertiesRes) ? propertiesRes : []);
      setLeases(Array.isArray(leasesRes) ? leasesRes : []);
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
      manualMode: false,
      leaseId: '',
      tenantId: '',
      propertyId: '',
      dueDate: '',
      paidDate: '',
      amount: '',
      kind: 'RENT',
      status: 'PLANNED',
    });
  };

  const create = async () => {
    setError(null);

    if (!cleanStr(form.amount)) return setError('Importo obbligatorio');
    const amountNum = toNum(form.amount);
    if (amountNum === undefined || Number.isNaN(amountNum)) return setError('Importo non valido');

    if (!form.dueDate) return setError('Seleziona dueDate');

    let derivedTenantId = form.tenantId;
    let derivedPropertyId = form.propertyId;

    if (!form.manualMode) {
      if (!form.leaseId) return setError('Seleziona un contratto');
      const lease = leases.find((l) => l.id === form.leaseId);
      if (!lease?.tenantId || !lease?.propertyId) {
        return setError('Contratto non valido (tenant/property mancanti)');
      }
      derivedTenantId = lease.tenantId;
      derivedPropertyId = lease.propertyId;
    } else {
      if (!derivedTenantId) return setError('Seleziona un tenant');
      if (!derivedPropertyId) return setError('Seleziona una property');
    }

    const prop = properties.find((p) => p.id === derivedPropertyId);

    const body: any = {
      leaseId: form.manualMode ? undefined : form.leaseId || undefined,
      tenantId: derivedTenantId,
      propertyId: derivedPropertyId,
      buildingId: prop?.buildingId ?? undefined,

      dueDate: form.dueDate,
      paidDate: cleanStr(form.paidDate) || undefined,

      amount: amountNum,
      currency: 'EUR',

      kind: form.kind,
      status: form.status,
    };

    setBusy(true);
    try {
      await fetchWithAuth('/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      resetForm();
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore creazione pagamento');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      await fetchWithAuth(`/payments/${id}`, { method: 'DELETE' });
      setOpenDocsPaymentId((prev) => (prev === id ? null : prev));
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore eliminazione pagamento');
    } finally {
      setBusy(false);
    }
  };

  // -------------------------
  // Derived / computed UI fields
  // -------------------------
  const enriched = useMemo(() => {
    const today = todayYmdUtc();
    return items.map((p) => {
      const due = toYmd(p.dueDate);
      const paid = toYmd(p.paidDate);
      const isManual = !p.leaseId;
      const overdueComputed = (p.status === 'PLANNED' || !p.status) && !!due && due < today && !paid;

      const effectiveStatus: PaymentStatus = overdueComputed ? 'OVERDUE' : (p.status ?? 'PLANNED');

      return {
        ...p,
        _dueYmd: due,
        _paidYmd: paid,
        _month: monthFromYmd(due),
        _isManual: isManual,
        _overdueComputed: overdueComputed,
        _effectiveStatus: effectiveStatus,
      };
    });
  }, [items]);

  const availableKinds = useMemo(() => {
    const s = new Set<string>();
    for (const p of items) s.add(p.kind ?? 'OTHER');
    return Array.from(s).sort(compareStr);
  }, [items]);

  const availableStatuses = useMemo(() => {
    const s = new Set<string>();
    for (const p of items) s.add(p.status ?? 'PLANNED');
    s.add('OVERDUE');
    s.add('PLANNED');
    s.add('PAID');
    return Array.from(s).sort(compareStr);
  }, [items]);

  const filtered = useMemo(() => {
    const q = cleanStr(filters.q).toLowerCase();
    return enriched.filter((p: any) => {
      if (filters.tenantId && p.tenantId !== filters.tenantId) return false;
      if (filters.propertyId && p.propertyId !== filters.propertyId) return false;
      if (filters.leaseId && (p.leaseId ?? '') !== filters.leaseId) return false;
      if (filters.kind && (p.kind ?? '') !== filters.kind) return false;
      if (filters.status && (p._effectiveStatus ?? '') !== filters.status) return false;
      if (filters.month && p._month !== filters.month) return false;
      if (filters.onlyManual && !p._isManual) return false;
      if (filters.onlyOverdueComputed && !p._overdueComputed) return false;

      if (q) {
        const tName = (tenantLabel.get(p.tenantId) ?? p.tenantId).toLowerCase();
        const propText = (propertyLabel.get(p.propertyId) ?? p.propertyId).toLowerCase();
        const hay = [
          p.id,
          p.tenantId,
          p.propertyId,
          p.leaseId ?? '',
          tName,
          propText,
          p.kind ?? '',
          p.status ?? '',
          p._dueYmd ?? '',
          p._paidYmd ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, filters, tenantLabel, propertyLabel]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      if (sortKey === 'dueDate') return compareStr(a._dueYmd ?? '', b._dueYmd ?? '') * dir;
      if (sortKey === 'amount') return (Number(a.amount ?? 0) - Number(b.amount ?? 0)) * dir;
      const as = String(a._effectiveStatus ?? a.status ?? '');
      const bs = String(b._effectiveStatus ?? b.status ?? '');
      return compareStr(as, bs) * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const totals = { ALL: 0, PLANNED: 0, PAID: 0, OVERDUE: 0 };
    for (const p of filtered as any[]) {
      const amt = Number(p.amount ?? 0);
      totals.ALL += amt;
      const st = String(p._effectiveStatus ?? p.status ?? 'PLANNED');
      if (st === 'PAID') totals.PAID += amt;
      else if (st === 'OVERDUE') totals.OVERDUE += amt;
      else totals.PLANNED += amt;
    }
    return { count: filtered.length, totals };
  }, [filtered]);

  const clearFilters = () => {
    setFilters({
      q: '',
      tenantId: '',
      propertyId: '',
      leaseId: '',
      kind: '',
      status: '',
      month: '',
      onlyManual: false,
      onlyOverdueComputed: false,
    });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Payments</h1>
            <p className="text-sm text-slate-600">Gestisci pagamenti (manuali o collegati ai contratti).</p>
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

        {/* FILTERS + KPI */}
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
                placeholder="tenant, immobile, leaseId, kind, status, id..."
                disabled={busy}
              />
            </Field>

            <Field label="Tenant">
              <Select
                value={filters.tenantId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters((p) => ({ ...p, tenantId: e.target.value }))}
                disabled={busy}
              >
                <option value="">(all)</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {tenantLabel.get(t.id) ?? t.id}
                  </option>
                ))}
              </Select>
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

            <Field label="Lease">
              <Select
                value={filters.leaseId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters((p) => ({ ...p, leaseId: e.target.value }))}
                disabled={busy}
              >
                <option value="">(all)</option>
                {leases.map((l) => (
                  <option key={l.id} value={l.id}>
                    {leaseLabel.get(l.id) ?? l.id}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Kind">
              <Select
                value={filters.kind}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters((p) => ({ ...p, kind: e.target.value }))}
                disabled={busy}
              >
                <option value="">(all)</option>
                {availableKinds.map((k) => (
                  <option key={k} value={k}>
                    {fmtKind(k)}
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
                    checked={filters.onlyManual}
                    onChange={(e) => setFilters((p) => ({ ...p, onlyManual: e.target.checked }))}
                    disabled={busy}
                  />
                  Solo manuali
                </label>

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
                <Select value={sortKey} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortKey(e.target.value as SortKey)} disabled={busy}>
                  <option value="dueDate">Due date</option>
                  <option value="amount">Amount</option>
                  <option value="status">Status</option>
                </Select>
                <Select value={sortDir} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortDir(e.target.value as SortDir)} disabled={busy}>
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </Select>
              </div>
            </Field>
          </div>
        </div>

        {/* CREATE FORM */}
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <h2 className="font-medium">Nuovo pagamento</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Modalità">
              <label className="flex items-center gap-2 h-10">
                <input
                  type="checkbox"
                  checked={form.manualMode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const v = e.target.checked;
                    setForm((prev) => ({
                      ...prev,
                      manualMode: v,
                      leaseId: '',
                      tenantId: '',
                      propertyId: '',
                    }));
                  }}
                  disabled={busy}
                />
                <span className="text-sm text-slate-700">Inserimento manuale (senza contratto)</span>
              </label>
            </Field>

            <div className="hidden md:block" />

            {!form.manualMode ? (
              <Field label="Contratto" required>
                <Select
                  value={form.leaseId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange('leaseId', e.target.value)}
                  disabled={busy}
                >
                  <option value="">Seleziona contratto *</option>
                  {leases.map((l) => (
                    <option key={l.id} value={l.id}>
                      {leaseLabel.get(l.id) ?? l.id}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <>
                <Field label="Inquilino" required>
                  <Select
                    value={form.tenantId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange('tenantId', e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Seleziona inquilino *</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {tenantLabel.get(t.id) ?? t.id}
                      </option>
                    ))}
                  </Select>
                </Field>

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
              </>
            )}

            {/* ✅ QUI NON PASSI PIU' un ChangeEvent tipizzato: è robusto */}
            <Field label="Due date" required>
              <Input type="date" value={form.dueDate} onChange={handleInput('dueDate')} disabled={busy} />
            </Field>

            <Field label="Paid date">
              <Input type="date" value={form.paidDate} onChange={handleInput('paidDate')} disabled={busy} />
            </Field>

            <Field label="Importo (€)" required>
              <Input type="number" value={form.amount} onChange={handleInput('amount')} placeholder="1000" disabled={busy} />
            </Field>

            <Field label="Kind" required>
              <Select value={form.kind} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange('kind', e.target.value)} disabled={busy}>
                <option value="RENT">Affitto</option>
                <option value="BUILDING_FEE">Quota condominiale</option>
                <option value="OTHER">Altro</option>
              </Select>
            </Field>

            <Field label="Status" required>
              <Select value={form.status} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange('status', e.target.value)} disabled={busy}>
                <option value="PLANNED">Da pagare</option>
                <option value="PAID">Pagato</option>
                <option value="OVERDUE">In ritardo</option>
              </Select>
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
            <div className="text-xs text-slate-500">
              Mostrati: {sorted.length} / {items.length}
            </div>
          </div>

          {loading ? (
            <div>Caricamento...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500">Nessun pagamento.</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-slate-500">Nessun risultato con i filtri correnti.</div>
          ) : (
            <div className="space-y-2">
              {sorted.map((p: any) => {
                const docsOpen = openDocsPaymentId === p.id;

                const tName = tenantLabel.get(p.tenantId) ?? p.tenantId;
                const propText = propertyLabel.get(p.propertyId) ?? p.propertyId;

                const manualLabel = p.leaseId ? '' : ' · MANUALE';

                const due = p._dueYmd || '-';
                const paid = p._paidYmd || '';

                const effectiveStatus = p._effectiveStatus ?? p.status ?? 'PLANNED';
                const statusPill =
                  effectiveStatus === 'PAID'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : effectiveStatus === 'OVERDUE'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200';

                return (
                  <div key={p.id} className="border rounded-lg p-3">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {tName} → {propText}
                        </div>

                        <div className="text-sm text-slate-600 flex flex-wrap items-center gap-2">
                          <span>
                            {Number(p.amount ?? 0).toFixed(2)} € · {fmtKind(p.kind ?? 'OTHER')}
                            {manualLabel}
                          </span>

                          <span className={`text-xs border rounded-full px-2 py-0.5 ${statusPill}`}>
                            {fmtStatus(effectiveStatus)}
                            {p._overdueComputed ? ' (computed)' : ''}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          Due: {due}
                          {paid ? ` · Paid: ${paid}` : ''}
                          {p.leaseId ? ` · leaseId: ${p.leaseId}` : ''}
                        </div>

                        <div className="text-[11px] text-slate-400 mt-1">id: {p.id}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setOpenDocsPaymentId((prev) => (prev === p.id ? null : p.id))}
                          className="border rounded-md px-3 py-2 text-sm"
                          disabled={busy}
                        >
                          {docsOpen ? 'Chiudi documenti' : 'Documenti'}
                        </button>

                        <button
                          onClick={() => remove(p.id)}
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
                          entityKind="payments"
                          entityId={p.id}
                          label={`Documenti pagamento (${tName} → ${propText})`}
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
