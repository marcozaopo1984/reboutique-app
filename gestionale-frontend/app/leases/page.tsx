'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
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

  startDate: any;
  endDate: any; // ✅ ora trattiamola come obbligatoria anche in list
  nextPaymentDue?: any;

  monthlyRentWithoutBills: number;
  monthlyRentWithBills?: number;
  billsIncludedAmount?: number;

  dueDayOfMonth?: number;

  depositAmount?: number;
  adminFeeAmount?: number;

  bookingCostAmount?: number;
  bookingCostDate?: any;

  registrationTaxAmount?: number;
  registrationTaxDate?: any;
};

type CreateLeaseForm = {
  type: LeaseType;

  propertyId: string;
  tenantId: string;
  landlordId: string;

  startDate: string;
  endDate: string; // ✅ REQUIRED
  nextPaymentDue: string;

  monthlyRentWithoutBills: string;
  monthlyRentWithBills: string;
  billsIncludedAmount: string;

  dueDayOfMonth: string;

  depositAmount: string;
  adminFeeAmount: string;

  bookingCostAmount: string;
  bookingCostDate: string;

  registrationTaxAmount: string;
  registrationTaxDate: string;
};

const cleanStr = (s: string) => s.trim();
const toNum = (v: string) => {
  const s = cleanStr(v);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isNaN(n) ? undefined : n;
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

export default function LeasesPage() {
  const [items, setItems] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openDocsLeaseId, setOpenDocsLeaseId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateLeaseForm>({
    type: 'TENANT',
    propertyId: '',
    tenantId: '',
    landlordId: '',
    startDate: '',
    endDate: '',
    nextPaymentDue: '',
    monthlyRentWithoutBills: '',
    monthlyRentWithBills: '',
    billsIncludedAmount: '',
    dueDayOfMonth: '',
    depositAmount: '',
    adminFeeAmount: '',
    bookingCostAmount: '',
    bookingCostDate: '',
    registrationTaxAmount: '',
    registrationTaxDate: '',
  });

  const onChange = (key: keyof CreateLeaseForm, value: string) => {
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
    setForm({
      type: 'TENANT',
      propertyId: '',
      tenantId: '',
      landlordId: '',
      startDate: '',
      endDate: '',
      nextPaymentDue: '',
      monthlyRentWithoutBills: '',
      monthlyRentWithBills: '',
      billsIncludedAmount: '',
      dueDayOfMonth: '',
      depositAmount: '',
      adminFeeAmount: '',
      bookingCostAmount: '',
      bookingCostDate: '',
      registrationTaxAmount: '',
      registrationTaxDate: '',
    });
  };

  const validateForm = (): string | null => {
    if (!form.propertyId) return 'Seleziona una property';
    if (!form.startDate) return 'Seleziona startDate';
    if (!form.endDate) return 'Seleziona endDate (obbligatoria)';
    if (ymdLessThan(form.endDate, form.startDate)) return 'endDate deve essere >= startDate';

    const net = toNum(form.monthlyRentWithoutBills);
    if (net === undefined) return 'monthlyRentWithoutBills obbligatorio (numero)';

    if (form.type === 'TENANT' && !form.tenantId) return 'Seleziona tenant';
    if (form.type === 'LANDLORD' && !form.landlordId) return 'Seleziona landlord';

    if (form.type === 'LANDLORD') {
      const p = properties.find((x) => x.id === form.propertyId);
      if (p?.type && p.type !== 'APARTMENT') return 'Per LANDLORD seleziona una property di tipo APARTMENT';
    }

    return null;
  };

  const create = async () => {
    setError(null);

    const err = validateForm();
    if (err) return setError(err);

    const net = toNum(form.monthlyRentWithoutBills)!;

    const body: any = {
      type: form.type,
      propertyId: form.propertyId,

      tenantId: form.type === 'TENANT' ? form.tenantId : undefined,
      landlordId: form.type === 'LANDLORD' ? form.landlordId : undefined,

      startDate: form.startDate,
      endDate: form.endDate, // ✅ required
      nextPaymentDue: cleanStr(form.nextPaymentDue) || undefined,

      monthlyRentWithoutBills: net,
      monthlyRentWithBills: toNum(form.monthlyRentWithBills),
      billsIncludedAmount: toNum(form.billsIncludedAmount),

      dueDayOfMonth: toNum(form.dueDayOfMonth),

      depositAmount: toNum(form.depositAmount),
      adminFeeAmount: toNum(form.adminFeeAmount),

      bookingCostAmount: toNum(form.bookingCostAmount),
      bookingCostDate: cleanStr(form.bookingCostDate) || undefined,

      registrationTaxAmount: toNum(form.registrationTaxAmount),
      registrationTaxDate: cleanStr(form.registrationTaxDate) || undefined,
    };

    setBusy(true);
    try {
      await fetchWithAuth('/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      resetForm();
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore creazione lease');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      await fetchWithAuth(`/leases/${id}`, { method: 'DELETE' });
      setOpenDocsLeaseId((prev) => (prev === id ? null : prev));
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
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Leases</h1>
            <p className="text-sm text-slate-600">
              Contratti TENANT (property granulare) e LANDLORD (tipicamente APARTMENT). Generate schedule crea i cashflow.
            </p>
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

        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <h2 className="font-medium">Nuovo contratto</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Type" required>
              <Select
                value={form.type}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  const v = e.target.value as LeaseType;
                  setForm((prev) => ({
                    ...prev,
                    type: v,
                    tenantId: '',
                    landlordId: '',
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

            <Field label="Start date" required>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const v = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    startDate: v,
                    // se nextPaymentDue è vuoto, lo auto-setto per comodità
                    nextPaymentDue: prev.nextPaymentDue || v,
                    // se endDate è valorizzata ma diventa < start, la resetto
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
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('endDate', e.target.value)}
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
            </Field>

            <Field label="monthlyRentWithoutBills (net)" required>
              <Input
                type="number"
                value={form.monthlyRentWithoutBills}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('monthlyRentWithoutBills', e.target.value)}
                placeholder="1100"
                disabled={busy}
              />
            </Field>

            <Field label="monthlyRentWithBills (gross)">
              <Input
                type="number"
                value={form.monthlyRentWithBills}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('monthlyRentWithBills', e.target.value)}
                placeholder="1200"
                disabled={busy}
              />
            </Field>

            <Field label="billsIncludedAmount">
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
                placeholder="5"
                disabled={busy}
              />
            </Field>

            <div className="md:col-span-3 border-t pt-3 mt-1">
              <div className="text-sm font-medium mb-2">Cashflow extra (TENANT)</div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Deposit amount">
                  <Input
                    type="number"
                    value={form.depositAmount}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('depositAmount', e.target.value)}
                    placeholder="2200"
                    disabled={busy || form.type !== 'TENANT'}
                  />
                </Field>

                <Field label="Admin fee amount">
                  <Input
                    type="number"
                    value={form.adminFeeAmount}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('adminFeeAmount', e.target.value)}
                    placeholder="200"
                    disabled={busy || form.type !== 'TENANT'}
                  />
                </Field>

                <div className="hidden md:block" />

                <Field label="Booking cost amount">
                  <Input
                    type="number"
                    value={form.bookingCostAmount}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('bookingCostAmount', e.target.value)}
                    placeholder="150"
                    disabled={busy || form.type !== 'TENANT'}
                  />
                </Field>

                <Field label="Booking cost date">
                  <Input
                    type="date"
                    value={form.bookingCostDate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('bookingCostDate', e.target.value)}
                    disabled={busy || form.type !== 'TENANT'}
                  />
                </Field>

                <div className="hidden md:block" />

                <Field label="Registration tax amount">
                  <Input
                    type="number"
                    value={form.registrationTaxAmount}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('registrationTaxAmount', e.target.value)}
                    placeholder="67"
                    disabled={busy || form.type !== 'TENANT'}
                  />
                </Field>

                <Field label="Registration tax date">
                  <Input
                    type="date"
                    value={form.registrationTaxDate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('registrationTaxDate', e.target.value)}
                    disabled={busy || form.type !== 'TENANT'}
                  />
                </Field>
              </div>

              {form.type !== 'TENANT' && (
                <div className="text-xs text-slate-500 mt-2">
                  (Per ora questi campi hanno senso solo per TENANT, quindi sono disabilitati per LANDLORD.)
                </div>
              )}
            </div>
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

        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-medium mb-3">Elenco</h2>

          {loading ? (
            <div>Caricamento...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500">Nessun contratto.</div>
          ) : (
            <div className="space-y-2">
              {items.map((x) => {
                const docsOpen = openDocsLeaseId === x.id;

                const propText = propertyLabel.get(x.propertyId) ?? x.propertyId;
                const tenantText = x.tenantId ? tenantLabel.get(x.tenantId) ?? x.tenantId : '';
                const landlordText = x.landlordId ? landlordLabel.get(x.landlordId) ?? x.landlordId : '';

                const start = toYmd(x.startDate);
                const end = toYmd(x.endDate);
                const nextDue = toYmd(x.nextPaymentDue);

                const depositRefundDate = end ? addDaysYmd(end, 60) : '';

                return (
                  <div key={x.id} className="border rounded-lg p-3">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {x.type} · {propText}
                          {x.type === 'TENANT' && tenantText ? ` · tenant: ${tenantText}` : ''}
                          {x.type === 'LANDLORD' && landlordText ? ` · landlord: ${landlordText}` : ''}
                        </div>

                        <div className="text-sm text-slate-600">
                          net: {x.monthlyRentWithoutBills ?? '-'} €
                          {x.monthlyRentWithBills !== undefined ? ` · gross: ${x.monthlyRentWithBills} €` : ''}
                          {x.billsIncludedAmount !== undefined ? ` · bills: ${x.billsIncludedAmount} €` : ''}
                          {x.dueDayOfMonth ? ` · dueDay: ${x.dueDayOfMonth}` : ''}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          start: {start || '-'}
                          {end ? ` · end: ${end}` : ' · end: (missing)'}
                          {nextDue ? ` · nextDue: ${nextDue}` : ''}
                        </div>

                        {x.type === 'TENANT' && (
                          <div className="text-xs text-slate-500 mt-1">
                            {x.depositAmount
                              ? `deposit: ${x.depositAmount} € (refund: ${depositRefundDate || 'n/a'})`
                              : 'deposit: -'}
                            {x.adminFeeAmount ? ` · adminFee: ${x.adminFeeAmount} €` : ''}
                            {x.bookingCostAmount
                              ? ` · bookingCost: ${x.bookingCostAmount} € (${toYmd(x.bookingCostDate) || start || 'start'})`
                              : ''}
                            {x.registrationTaxAmount
                              ? ` · regTax: ${x.registrationTaxAmount} € (${toYmd(x.registrationTaxDate) || start || 'start'})`
                              : ''}
                          </div>
                        )}

                        <div className="text-[11px] text-slate-400 mt-1">id: {x.id}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => generateSchedule(x.id)}
                          className="border rounded-md px-3 py-2 text-sm"
                          disabled={busy}
                        >
                          Generate schedule
                        </button>

                        <button
                          onClick={() => setOpenDocsLeaseId((prev) => (prev === x.id ? null : x.id))}
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
      </div>
    </div>
  );
}
