'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import { formatDateIT } from '@/lib/dateFormat';
import EntityDocuments from '@/components/EntityDocuments';
import { Field, Input, Select } from '@/components/form/Field';

type LeaseType = 'TENANT' | 'LANDLORD';

type Tenant = { id: string; firstName?: string; lastName?: string };
type Landlord = { id: string; firstName?: string; lastName?: string; name?: string };
type Property = { id: string; code?: string; name?: string; type?: 'APARTMENT' | 'ROOM' | 'BED' | string };

type Lease = {
  id: string;
  type: LeaseType;

  propertyId: string;
  tenantId?: string;
  landlordId?: string;

  bookingDate: any;
  startDate: any;
  endDate: any;
  nextPaymentDue?: any;

  monthlyRentWithBills: number;
  monthlyRentDiscounted?: boolean;
  monthlyRentWithoutBills?: number;
  billsIncludedAmount?: number;

  dueDayOfMonth?: number;

  depositAmount?: number;
  depositDiscounted?: boolean;
  depositDate?: any;
  depositDays?: number;
  depositReturnDate?: any;
  adminFeeAmount?: number;
  adminFeeDiscounted?: boolean;
  adminFeeDate?: any;

  bookingCostAmount?: number;
  bookingCostDate?: any;

  registrationTaxAmount?: number;
  registrationTaxDate?: any;

  notes?: string;
  poweredBy?: string;
  piumone?: string;
  foundThrough?: string;
};

type CreateLeaseForm = {
  type: LeaseType;

  propertyId: string;
  tenantId: string;
  landlordId: string;

  bookingDate: string;
  startDate: string;
  endDate: string;
  nextPaymentDue: string;

  monthlyRentWithBills: string;
  monthlyRentDiscounted: boolean;
  monthlyRentWithoutBills: string;
  billsIncludedAmount: string;

  dueDayOfMonth: string;

  depositAmount: string;
  depositDiscounted: boolean;
  depositDate: string;
  depositDays: string;
  depositReturnDate: string;
  adminFeeAmount: string;
  adminFeeDiscounted: boolean;
  adminFeeDate: string;

  bookingCostAmount: string;
  bookingCostDate: string;

  registrationTaxAmount: string;
  registrationTaxDate: string;

  notes: string;
  poweredBy: string;
  piumone: boolean;
  foundThrough: string;
};

const cleanStr = (s: string) => s.trim();
const toNum = (v: string) => {
  const s = cleanStr(v);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isNaN(n) ? undefined : n;
};

const toNumString = (v: any) => {
  if (v === undefined || v === null) return '';
  const n = Number(v);
  return Number.isNaN(n) ? '' : String(n);
};

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

const todayYmd = () => new Date().toISOString().slice(0, 10);
const discountedLabel = (flag?: boolean) => (flag ? ' [discounted]' : '');
const isPiumoneYes = (value: any) => String(value ?? '').trim().toLowerCase() === 'si' || value === true;

const addDaysYmd = (ymd: string, days: number) => {
  if (!ymd) return '';
  const d = new Date(ymd + 'T00:00:00.000Z');
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const isYmdValid = (ymd: string) => {
  if (!ymd) return false;
  const d = new Date(ymd + 'T00:00:00.000Z');
  return !Number.isNaN(d.getTime());
};

const ymdLessThan = (a: string, b: string) => {
  if (!isYmdValid(a) || !isYmdValid(b)) return false;
  return new Date(a + 'T00:00:00.000Z').getTime() < new Date(b + 'T00:00:00.000Z').getTime();
};

const computeDepositReturnDate = (endDate: string, depositDays: string) => {
  const days = depositDays.trim() === '' ? 0 : toNum(depositDays);
  if (!endDate || days === undefined) return '';
  return addDaysYmd(endDate, days);
};

const maybeSyncDepositReturnDate = (
  prev: CreateLeaseForm,
  patch: Partial<Pick<CreateLeaseForm, 'endDate' | 'depositDays' | 'depositReturnDate' | 'type'>>,
) => {
  const nextType = patch.type ?? prev.type;
  const nextEndDate = patch.endDate ?? prev.endDate;
  const nextDepositDays = patch.depositDays ?? prev.depositDays;
  const prevDefault = computeDepositReturnDate(prev.endDate, prev.depositDays);
  const shouldAutoUpdate = !prev.depositReturnDate || prev.depositReturnDate === prevDefault;

  if (nextType !== 'TENANT' || !shouldAutoUpdate) return patch;

  return {
    ...patch,
    depositDays: nextDepositDays,
    depositReturnDate: computeDepositReturnDate(nextEndDate, nextDepositDays),
  };
};

const syncUpfrontDatesFromStart = (
  prev: CreateLeaseForm,
  newStartDate: string,
): Pick<CreateLeaseForm, 'startDate' | 'depositDate' | 'adminFeeDate' | 'bookingCostDate' | 'registrationTaxDate'> => ({
  startDate: newStartDate,
  depositDate: !prev.depositDate || prev.depositDate === prev.startDate ? newStartDate : prev.depositDate,
  adminFeeDate:
    prev.type === 'LANDLORD' && (!prev.adminFeeDate || prev.adminFeeDate === prev.startDate)
      ? newStartDate
      : prev.adminFeeDate,
  bookingCostDate: !prev.bookingCostDate || prev.bookingCostDate === prev.startDate ? newStartDate : prev.bookingCostDate,
  registrationTaxDate:
    !prev.registrationTaxDate || prev.registrationTaxDate === prev.startDate
      ? newStartDate
      : prev.registrationTaxDate,
});

const emptyForm = (): CreateLeaseForm => {
  const today = todayYmd();
  return {
    type: 'TENANT',
    propertyId: '',
    tenantId: '',
    landlordId: '',
    bookingDate: today,
    startDate: '',
    endDate: '',
    nextPaymentDue: '',
    monthlyRentWithBills: '',
    monthlyRentDiscounted: false,
    monthlyRentWithoutBills: '',
    billsIncludedAmount: '',
    dueDayOfMonth: '',
    depositAmount: '',
    depositDiscounted: false,
    depositDate: '',
    depositDays: '',
    depositReturnDate: '',
    adminFeeAmount: '',
    adminFeeDiscounted: false,
    adminFeeDate: '',
    bookingCostAmount: '',
    bookingCostDate: '',
    registrationTaxAmount: '',
    registrationTaxDate: '',
    notes: '',
    poweredBy: '',
    piumone: false,
    foundThrough: '',
  };
};

const leaseToForm = (x: Lease): CreateLeaseForm => {
  const booking = toYmd(x.bookingDate) || todayYmd();
  const start = toYmd(x.startDate);
  return {
    type: x.type ?? 'TENANT',
    propertyId: x.propertyId ?? '',
    tenantId: x.tenantId ?? '',
    landlordId: x.landlordId ?? '',
    bookingDate: booking,
    startDate: start,
    endDate: toYmd(x.endDate),
    nextPaymentDue: toYmd(x.nextPaymentDue),
    monthlyRentWithBills: toNumString(x.monthlyRentWithBills),
    monthlyRentDiscounted: Boolean(x.monthlyRentDiscounted),
    monthlyRentWithoutBills: toNumString(x.monthlyRentWithoutBills),
    billsIncludedAmount: toNumString(x.billsIncludedAmount),
    dueDayOfMonth: toNumString(x.dueDayOfMonth),
    depositAmount: toNumString(x.depositAmount),
    depositDiscounted: Boolean(x.depositDiscounted),
    depositDate: toYmd(x.depositDate) || start,
    depositDays: toNumString(x.depositDays),
    depositReturnDate:
      toYmd(x.depositReturnDate) ||
      (x.type === 'TENANT' ? computeDepositReturnDate(toYmd(x.endDate), toNumString(x.depositDays)) : ''),
    adminFeeAmount: toNumString(x.adminFeeAmount),
    adminFeeDiscounted: Boolean(x.adminFeeDiscounted),
    adminFeeDate: toYmd(x.adminFeeDate) || (x.type === 'LANDLORD' ? start : ''),
    bookingCostAmount: toNumString(x.bookingCostAmount),
    bookingCostDate: toYmd(x.bookingCostDate) || start,
    registrationTaxAmount: toNumString(x.registrationTaxAmount),
    registrationTaxDate: toYmd(x.registrationTaxDate) || start,
    notes: x.notes ?? '',
    poweredBy: x.poweredBy ?? '',
    piumone: isPiumoneYes(x.piumone),
    foundThrough: x.foundThrough ?? '',
  };
};

export default function LeasesPage() {
  const [items, setItems] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openDocsLeaseId, setOpenDocsLeaseId] = useState<string | null>(null);
  const [editingLeaseId, setEditingLeaseId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateLeaseForm>(emptyForm());
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  const onChange = <K extends keyof CreateLeaseForm>(key: K, value: CreateLeaseForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const tenantLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tenants) {
      const n = `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim();
      m.set(t.id, n || t.id);
    }
    return m;
  }, [tenants]);

  const landlordLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of landlords) {
      const n = (l.name ?? `${l.firstName ?? ''} ${l.lastName ?? ''}`.trim()).trim();
      m.set(l.id, n || l.id);
    }
    return m;
  }, [landlords]);

  const propertyLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) {
      const code = p.code ? p.code : p.id;
      const name = p.name ? ` – ${p.name}` : '';
      m.set(p.id, `${code}${name}`);
    }
    return m;
  }, [properties]);

  const propertiesApartments = useMemo(
    () => properties.filter((p) => p.type === 'APARTMENT'),
    [properties],
  );

  const filteredItems = useMemo(() => {
    const q = cleanStr(searchQuery).toLowerCase();
    if (!q) return items;

    return items.filter((x) =>
      [
        x.id,
        x.type,
        x.propertyId,
        propertyLabel.get(x.propertyId),
        x.tenantId,
        x.tenantId ? tenantLabel.get(x.tenantId) : '',
        x.landlordId,
        x.landlordId ? landlordLabel.get(x.landlordId) : '',
        toYmd(x.bookingDate),
        toYmd(x.startDate),
        toYmd(x.endDate),
        x.monthlyRentWithBills,
        x.monthlyRentWithoutBills,
        x.billsIncludedAmount,
        x.depositAmount,
        x.depositDays,
        toYmd(x.depositReturnDate),
        x.adminFeeAmount,
        x.registrationTaxAmount,
        x.poweredBy,
        x.piumone,
        x.foundThrough,
        x.notes,
      ].some((value) => String(value ?? '').toLowerCase().includes(q)),
    );
  }, [items, landlordLabel, propertyLabel, searchQuery, tenantLabel]);

  const tabClass = (tab: 'list' | 'create') =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition ${
      activeTab === tab
        ? 'bg-slate-900 text-white shadow-sm'
        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
    }`;

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [leasesRes, tenantsRes, landlordsRes, propsRes] = await Promise.all([
        fetchWithAuth('/leases'),
        fetchWithAuth('/tenants'),
        fetchWithAuth('/landlords'),
        fetchWithAuth('/properties'),
      ]);

      setItems(Array.isArray(leasesRes) ? leasesRes : []);
      setTenants(Array.isArray(tenantsRes) ? tenantsRes : []);
      setLandlords(Array.isArray(landlordsRes) ? landlordsRes : []);
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
    setEditingLeaseId(null);
    setForm(emptyForm());
  };

  const validateForm = (): string | null => {
    if (!form.propertyId) return 'Seleziona una property';
    if (!form.startDate) return 'Seleziona startDate';
    if (!form.endDate) return 'Seleziona endDate (obbligatoria)';
    if (ymdLessThan(form.endDate, form.startDate)) return 'endDate deve essere >= startDate';

    const gross = toNum(form.monthlyRentWithBills);
    if (gross === undefined) return 'Canone mensile bills included obbligatorio (numero)';

    const depositDays = toNum(form.depositDays);
    if (form.type === 'TENANT' && form.depositDays && (depositDays === undefined || depositDays < 0)) {
      return 'Deposit days deve essere un numero maggiore o uguale a 0';
    }

    if (form.type === 'TENANT' && !form.tenantId) return 'Seleziona tenant';
    if (form.type === 'LANDLORD' && !form.landlordId) return 'Seleziona landlord';

    if (form.type === 'LANDLORD') {
      const p = properties.find((x) => x.id === form.propertyId);
      if (p?.type && p.type !== 'APARTMENT') return 'Per LANDLORD seleziona una property di tipo APARTMENT';
    }

    return null;
  };

  const buildBody = () => {
    const gross = toNum(form.monthlyRentWithBills)!;

    return {
      type: form.type,
      propertyId: form.propertyId,

      tenantId: form.type === 'TENANT' ? form.tenantId : undefined,
      landlordId: form.type === 'LANDLORD' ? form.landlordId : undefined,

      bookingDate: cleanStr(form.bookingDate) || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      nextPaymentDue: cleanStr(form.nextPaymentDue) || undefined,

      monthlyRentWithBills: gross,
      monthlyRentDiscounted: form.monthlyRentDiscounted,
      monthlyRentWithoutBills: toNum(form.monthlyRentWithoutBills),
      billsIncludedAmount: toNum(form.billsIncludedAmount),

      dueDayOfMonth: toNum(form.dueDayOfMonth),

      depositAmount: toNum(form.depositAmount),
      depositDiscounted: form.depositDiscounted,
      depositDate: cleanStr(form.depositDate) || undefined,
      depositDays:
        form.type === 'TENANT'
          ? form.depositDays.trim() === ''
            ? null
            : toNum(form.depositDays)
          : undefined,
      depositReturnDate: form.type === 'TENANT' ? cleanStr(form.depositReturnDate) || undefined : undefined,
      adminFeeAmount: toNum(form.adminFeeAmount),
      adminFeeDiscounted: form.adminFeeDiscounted,
      adminFeeDate: cleanStr(form.adminFeeDate) || undefined,

      bookingCostAmount: toNum(form.bookingCostAmount),
      bookingCostDate: cleanStr(form.bookingCostDate) || undefined,

      registrationTaxAmount: toNum(form.registrationTaxAmount),
      registrationTaxDate: cleanStr(form.registrationTaxDate) || undefined,

      notes: cleanStr(form.notes) || undefined,
      poweredBy: cleanStr(form.poweredBy) || undefined,
      piumone: form.piumone ? 'si' : undefined,
      foundThrough: cleanStr(form.foundThrough) || undefined,
    };
  };

  const saveLease = async () => {
    setError(null);

    const err = validateForm();
    if (err) return setError(err);

    const body = buildBody();

    setBusy(true);
    try {
      await fetchWithAuth(editingLeaseId ? `/leases/${editingLeaseId}` : '/leases', {
        method: editingLeaseId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      resetForm();
      await loadAll();
      setActiveTab('list');
    } catch (e: any) {
      setError(e?.message ?? (editingLeaseId ? 'Errore aggiornamento lease' : 'Errore creazione lease'));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (lease: Lease) => {
    setError(null);
    setEditingLeaseId(lease.id);
    setForm(leaseToForm(lease));
    setActiveTab('create');

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const remove = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      await fetchWithAuth(`/leases/${id}`, { method: 'DELETE' });
      setOpenDocsLeaseId((prev) => (prev === id ? null : prev));
      if (editingLeaseId === id) {
        resetForm();
      }
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore eliminazione lease');
    } finally {
      setBusy(false);
    }
  };

  const generateSchedule = async (id: string) => {
    setError(null);
    setBusy(true);

    try {
      await fetchWithAuth(`/leases/${id}/generate-schedule`, { method: 'POST' });
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore generate schedule');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="app-container space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Leases</h1>
            <p className="page-subtitle">
              Contratti TENANT (property granulare) e LANDLORD (tipicamente APARTMENT). Generate schedule crea i cashflow.
            </p>
          </div>

          <button
            onClick={loadAll}
            disabled={busy}
            className="btn-secondary text-sm"
          >
            Refresh
          </button>
        </header>

        {error && (
          <div className="alert-error">
            {error}
          </div>
        )}

        <div className="surface-card p-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveTab('list')} className={tabClass('list')}>
            Lista Leases
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setActiveTab('create');
            }}
            className={tabClass('create')}
          >
            Create Lease
          </button>
        </div>

        {activeTab === 'create' && (
        <div className="surface-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">
              {editingLeaseId ? 'Modifica contratto' : 'Nuovo contratto'}
            </h2>

            {editingLeaseId && (
              <div className="text-xs text-slate-500">ID in modifica: {editingLeaseId}</div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Type" required>
              <Select
                value={form.type}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  const v = e.target.value as LeaseType;
                  setForm((prev) => ({
                    ...prev,
                    ...maybeSyncDepositReturnDate(prev, {
                      type: v,
                      depositDays: prev.depositDays,
                    }),
                    tenantId: '',
                    landlordId: '',
                    propertyId:
                      v === 'LANDLORD'
                        ? properties.find((p) => p.id === prev.propertyId)?.type === 'APARTMENT'
                          ? prev.propertyId
                          : ''
                        : prev.propertyId,
                  }));
                }}
                disabled={busy}
              >
                <option value="TENANT">TENANT</option>
                <option value="LANDLORD">LANDLORD</option>
              </Select>
            </Field>

            {form.type === 'TENANT' ? (
              <Field label="Tenant" required>
                <Select
                  value={form.tenantId}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange('tenantId', e.target.value)}
                  disabled={busy}
                >
                  <option value="">Seleziona tenant *</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {tenantLabel.get(t.id) ?? t.id}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Landlord" required>
                <Select
                  value={form.landlordId}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange('landlordId', e.target.value)}
                  disabled={busy}
                >
                  <option value="">Seleziona landlord *</option>
                  {landlords.map((l) => (
                    <option key={l.id} value={l.id}>
                      {landlordLabel.get(l.id) ?? l.id}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label="Property" required>
              <Select
                value={form.propertyId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange('propertyId', e.target.value)}
                disabled={busy}
              >
                <option value="">
                  {form.type === 'LANDLORD' ? 'Seleziona APARTMENT *' : 'Seleziona property *'}
                </option>

                {(form.type === 'LANDLORD' ? propertiesApartments : properties).map((p) => (
                  <option key={p.id} value={p.id}>
                    {propertyLabel.get(p.id) ?? p.id}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Booking date">
              <Input
                type="date"
                value={form.bookingDate}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('bookingDate', e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field label="Start date" required>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const v = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    ...syncUpfrontDatesFromStart(prev, v),
                    endDate: prev.endDate && ymdLessThan(prev.endDate, v) ? '' : prev.endDate,
                  }));
                }}
                disabled={busy}
              />
            </Field>

            <Field label="End date" required>
              <Input
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const v = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    ...maybeSyncDepositReturnDate(prev, { endDate: v }),
                  }));
                }}
                disabled={busy}
              />
            </Field>

            <Field label="Next payment due">
              <Input
                type="date"
                value={form.nextPaymentDue}
                min={form.startDate || undefined}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('nextPaymentDue', e.target.value)}
                disabled={busy}
              />
              <p className="mt-1 text-xs text-slate-500">
                Campo informativo: non modifica il piano canoni, che usa Due day of month oppure la Start date.
              </p>
            </Field>

            <Field label="Canone mensile bills included" required>
              <Input
                type="number"
                value={form.monthlyRentWithBills}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('monthlyRentWithBills', e.target.value)}
                placeholder="1200"
                disabled={busy}
              />
            </Field>

            <Field label="Canone mensile senza bills">
              <Input
                type="number"
                value={form.monthlyRentWithoutBills}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('monthlyRentWithoutBills', e.target.value)}
                placeholder="1100"
                disabled={busy}
              />
            </Field>

            <Field label="Bills included amount">
              <Input
                type="number"
                value={form.billsIncludedAmount}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('billsIncludedAmount', e.target.value)}
                placeholder="100"
                disabled={busy}
              />
            </Field>

            <Field label="Due day of month">
              <Input
                type="number"
                min="1"
                max="28"
                value={form.dueDayOfMonth}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('dueDayOfMonth', e.target.value)}
                placeholder="Vuoto = ricorrenza dalla Start date"
                disabled={busy}
              />
              <p className="mt-1 text-xs text-slate-500">
                Se valorizzato, il primo canone cade alla prima ricorrenza utile e include il pro-rata dalla Start date.
              </p>
            </Field>

            <Field label="Canone discounted">
              <label className="flex items-center gap-2 text-sm text-slate-700 border rounded-md px-3 py-2 bg-white">
                <input
                  type="checkbox"
                  checked={form.monthlyRentDiscounted}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('monthlyRentDiscounted', e.target.checked)}
                  disabled={busy}
                />
                Discounted
              </label>
            </Field>

            <div className="md:col-span-3 border-t pt-3 mt-1">
              <div className="text-sm font-medium mb-2">Cashflow extra</div>
              <p className="text-xs text-slate-500 mb-3">Se le date extra sono vuote, il default è la Start date del contratto.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Deposit amount">
                  <Input
                    type="number"
                    value={form.depositAmount}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('depositAmount', e.target.value)}
                    placeholder="2200"
                    disabled={busy}
                  />
                </Field>

                <Field label="Deposit date">
                  <Input
                    type="date"
                    value={form.depositDate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('depositDate', e.target.value)}
                    disabled={busy}
                  />
                </Field>

                <Field label="Deposit discounted">
                  <label className="flex items-center gap-2 text-sm text-slate-700 border rounded-md px-3 py-2 bg-white">
                    <input
                      type="checkbox"
                      checked={form.depositDiscounted}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('depositDiscounted', e.target.checked)}
                      disabled={busy}
                    />
                    Discounted
                  </label>
                </Field>

                {form.type === 'TENANT' && (
                  <>
                    <Field label="Deposit days">
                      <Input
                        type="number"
                        min="0"
                        value={form.depositDays}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          const v = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            ...maybeSyncDepositReturnDate(prev, { depositDays: v }),
                          }));
                        }}
                        placeholder="Vuoto = restituzione alla end date"
                        disabled={busy}
                      />
                    </Field>

                    <Field label="Deposit return date">
                      <Input
                        type="date"
                        value={form.depositReturnDate}
                        min={form.endDate || undefined}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('depositReturnDate', e.target.value)}
                        disabled={busy}
                      />
                    </Field>

                    <div className="text-xs text-slate-500 flex items-end pb-2">
                      Se vuoto: deposit return date = end date. Se valorizzato: end date + deposit days.
                    </div>
                  </>
                )}

                <Field label="Admin fee amount">
                  <Input
                    type="number"
                    value={form.adminFeeAmount}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('adminFeeAmount', e.target.value)}
                    placeholder="200"
                    disabled={busy}
                  />
                </Field>

                <Field label="Admin fee date">
                  <div className="space-y-1">
                    <Input
                      type="date"
                      value={form.adminFeeDate}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('adminFeeDate', e.target.value)}
                      disabled={busy}
                    />
                    <div className="text-xs text-slate-500">
                      {form.type === 'TENANT'
                        ? 'Se vuota: booking date; se assente anche la booking date: start date.'
                        : 'Se vuota: start date.'}
                    </div>
                  </div>
                </Field>

                <Field label="Admin fee discounted">
                  <label className="flex items-center gap-2 text-sm text-slate-700 border rounded-md px-3 py-2 bg-white">
                    <input
                      type="checkbox"
                      checked={form.adminFeeDiscounted}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('adminFeeDiscounted', e.target.checked)}
                      disabled={busy}
                    />
                    Discounted
                  </label>
                </Field>

                <Field label="Booking cost amount">
                  <Input
                    type="number"
                    value={form.bookingCostAmount}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('bookingCostAmount', e.target.value)}
                    placeholder="150"
                    disabled={busy}
                  />
                </Field>

                <Field label="Booking cost date">
                  <Input
                    type="date"
                    value={form.bookingCostDate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('bookingCostDate', e.target.value)}
                    disabled={busy}
                  />
                </Field>

                <div className="hidden md:block" />

                <Field label="Registration tax amount">
                  <Input
                    type="number"
                    value={form.registrationTaxAmount}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('registrationTaxAmount', e.target.value)}
                    placeholder="67"
                    disabled={busy}
                  />
                </Field>

                <Field label="Registration tax date">
                  <Input
                    type="date"
                    value={form.registrationTaxDate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('registrationTaxDate', e.target.value)}
                    disabled={busy}
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Powered by">
              <Input
                value={form.poweredBy}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('poweredBy', e.target.value)}
                placeholder="Es. Milano Home / Portale / Partner"
                disabled={busy}
              />
            </Field>

            <Field label="Found through">
              <Input
                value={form.foundThrough}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('foundThrough', e.target.value)}
                placeholder="Es. Airbnb / Spotahome / referral"
                disabled={busy}
              />
            </Field>

            <Field label="Piumone">
              <label className="flex items-center gap-2 text-sm text-slate-700 border rounded-md px-3 py-2 bg-white">
                <input
                  type="checkbox"
                  checked={form.piumone}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('piumone', e.target.checked)}
                  disabled={busy}
                />
                Sì
              </label>
            </Field>
          </div>

          <div className="md:col-span-3">
            <Field label="Note contratto">
              <textarea
                value={form.notes}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange('notes', e.target.value)}
                placeholder="Commenti o note libere sul contratto"
                disabled={busy}
                rows={4}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={saveLease}
              disabled={busy}
              className="btn-primary"
            >
              {busy ? 'Salvataggio...' : editingLeaseId ? 'Aggiorna' : 'Create'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={busy}
              className="btn-secondary"
            >
              {editingLeaseId ? 'Annulla modifica' : 'Reset'}
            </button>
          </div>
        </div>
        )}

        {activeTab === 'list' && (
          <>
            <div className="surface-card p-5 space-y-3">
              <Field label="Ricerca">
                <Input
                  value={searchQuery}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  placeholder="Cerca per property, tenant, landlord, date, importi, id..."
                  disabled={busy}
                />
              </Field>
            </div>

        <div className="surface-card p-5">
          <h2 className="font-medium mb-3">Elenco</h2>

          {loading ? (
            <div>Caricamento...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500">Nessun contratto.</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-sm text-slate-500">Nessun contratto corrisponde alla ricerca.</div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((x) => {
                const docsOpen = openDocsLeaseId === x.id;
                const isEditingThis = editingLeaseId === x.id;

                const propText = propertyLabel.get(x.propertyId) ?? x.propertyId;
                const tenantText = x.tenantId ? tenantLabel.get(x.tenantId) ?? x.tenantId : '';
                const landlordText = x.landlordId ? landlordLabel.get(x.landlordId) ?? x.landlordId : '';

                const booking = toYmd(x.bookingDate);
                const start = toYmd(x.startDate);
                const end = toYmd(x.endDate);
                const nextDue = toYmd(x.nextPaymentDue);

                const depositDate = toYmd(x.depositDate) || start;
                const adminFeeDate = toYmd(x.adminFeeDate) || (x.type === 'TENANT' ? booking : '') || start;
                const bookingCostDate = toYmd(x.bookingCostDate) || start;
                const registrationTaxDate = toYmd(x.registrationTaxDate) || start;
                const depositDays = toNumString(x.depositDays);
                const depositRefundDate =
                  toYmd(x.depositReturnDate) ||
                  (x.type === 'TENANT' && end ? computeDepositReturnDate(end, depositDays) : '');

                return (
                  <div
                    key={x.id}
                    className={`border rounded-lg p-3 ${isEditingThis ? 'border-slate-800 bg-slate-50' : ''}`}
                  >
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {x.type} · {propText}
                          {x.type === 'TENANT' && tenantText ? ` · tenant: ${tenantText}` : ''}
                          {x.type === 'LANDLORD' && landlordText ? ` · landlord: ${landlordText}` : ''}
                          {isEditingThis ? (
                            <span className="text-xs text-blue-600 ml-2">[in modifica]</span>
                          ) : null}
                        </div>

                        <div className="text-sm text-slate-600">
                          canone bills included: {x.monthlyRentWithBills ?? '-'} €{discountedLabel(x.monthlyRentDiscounted)}
                          {x.monthlyRentWithoutBills !== undefined ? ` · senza bills: ${x.monthlyRentWithoutBills} €` : ''}
                          {x.billsIncludedAmount !== undefined ? ` · bills: ${x.billsIncludedAmount} €` : ''}
                          {x.dueDayOfMonth ? ` · dueDay: ${x.dueDayOfMonth}` : ''}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          booking: {booking ? formatDateIT(booking) : '-'} · start: {start ? formatDateIT(start) : '-'}
                          {end ? ` · end: ${formatDateIT(end)}` : ' · end: (missing)'}
                          {nextDue ? ` · nextDue: ${formatDateIT(nextDue)}` : ''}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          {x.depositAmount
                            ? `deposit: ${x.depositAmount} € (${depositDate ? formatDateIT(depositDate) : 'n/a'})${discountedLabel(x.depositDiscounted)}`
                            : 'deposit: -'}
                          {x.type === 'TENANT' && x.depositAmount && depositRefundDate
                            ? ` · refund: ${formatDateIT(depositRefundDate)} (${depositDays || '0'} giorni)`
                            : ''}
                          {x.adminFeeAmount ? ` · adminFee: ${x.adminFeeAmount} € (${adminFeeDate ? formatDateIT(adminFeeDate) : 'n/a'})${discountedLabel(x.adminFeeDiscounted)}` : ''}
                          {x.bookingCostAmount
                            ? ` · bookingCost: ${x.bookingCostAmount} € (${bookingCostDate ? formatDateIT(bookingCostDate) : 'n/a'})`
                            : ''}
                          {x.registrationTaxAmount
                            ? ` · regTax: ${x.registrationTaxAmount} € (${registrationTaxDate ? formatDateIT(registrationTaxDate) : 'n/a'})`
                            : ''}
                        </div>

                        {(x.poweredBy || x.foundThrough || isPiumoneYes(x.piumone)) ? (
                          <div className="text-xs text-slate-600 mt-1">
                            {x.poweredBy ? `Powered by: ${x.poweredBy}` : ''}
                            {x.foundThrough ? `${x.poweredBy ? ' · ' : ''}Found through: ${x.foundThrough}` : ''}
                            {isPiumoneYes(x.piumone) ? `${x.poweredBy || x.foundThrough ? ' · ' : ''}Piumone: sì` : ''}
                          </div>
                        ) : null}

                        {x.notes ? (
                          <div className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
                            Note: {x.notes}
                          </div>
                        ) : null}

                        <div className="text-[11px] text-slate-400 mt-1">id: {x.id}</div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button
                          onClick={() => startEdit(x)}
                          disabled={busy}
                          className="btn-secondary text-sm"
                        >
                          Modifica
                        </button>

                        <button
                          onClick={() => generateSchedule(x.id)}
                          className="btn-secondary text-sm"
                          disabled={busy}
                        >
                          Generate schedule
                        </button>

                        <button
                          onClick={() => setOpenDocsLeaseId((prev) => (prev === x.id ? null : x.id))}
                          className="btn-secondary text-sm"
                          disabled={busy}
                        >
                          {docsOpen ? 'Chiudi documenti' : 'Documenti'}
                        </button>

                        <button
                          onClick={() => remove(x.id)}
                          disabled={busy}
                          className="text-link-danger disabled:opacity-50"
                        >
                          Elimina
                        </button>
                      </div>
                    </div>

                    {docsOpen && (
                      <div className="mt-3">
                        <EntityDocuments
                          entityKind="leases"
                          entityId={x.id}
                          label={`Documenti contratto (${x.type} · ${propText})`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
