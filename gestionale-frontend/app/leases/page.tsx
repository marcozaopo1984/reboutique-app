'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import EntityDocuments from '@/components/EntityDocuments';

type LeaseType = 'TENANT' | 'LANDLORD';

type Property = {
  id: string;
  code?: string;
  name?: string;
  type?: string;
};

type Tenant = {
  id: string;
  firstName?: string;
  lastName?: string;
};

type Landlord = {
  id: string;
  name?: string;
};

type Lease = {
  id: string;
  type: LeaseType;
  propertyId: string;
  tenantId?: string;
  landlordId?: string;

  startDate: any;
  endDate?: any;
  nextPaymentDue?: any;

  monthlyRentWithoutBills: number;
  monthlyRentWithBills?: number;
  billsIncludedAmount?: number;

  depositAmount?: number;
  adminFeeAmount?: number;
  otherFeesAmount?: number;

  dueDayOfMonth?: number;
  externalId?: string;
};

type CreateLeaseForm = {
  type: LeaseType;

  propertyId: string;
  tenantId: string; // sempre string per UI
  landlordId: string;

  startDate: string; // YYYY-MM-DD
  endDate: string; // '' oppure YYYY-MM-DD
  nextPaymentDue: string; // '' oppure YYYY-MM-DD

  monthlyRentWithoutBills: string; // required
  monthlyRentWithBills: string; // '' allowed
  billsIncludedAmount: string; // '' allowed

  depositAmount: string; // '' allowed
  adminFeeAmount: string; // '' allowed
  otherFeesAmount: string; // '' allowed

  dueDayOfMonth: string; // '' allowed => default 5
  externalId: string; // '' allowed
};

const toNum = (v?: string) => {
  const s = (v ?? '').trim();
  return s === '' ? undefined : Number(s);
};

export default function LeasesPage() {
  const [items, setItems] = useState<Lease[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [landlords, setLandlords] = useState<Landlord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // quale lease ha documenti aperti
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

    depositAmount: '',
    adminFeeAmount: '',
    otherFeesAmount: '',

    dueDayOfMonth: '5',
    externalId: '',
  });

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [leasesRes, propsRes, tenantsRes, landlordsRes] = await Promise.all([
        fetchWithAuth('/leases'),
        fetchWithAuth('/properties'),
        fetchWithAuth('/tenants'),
        fetchWithAuth('/landlords'),
      ]);

      setItems(Array.isArray(leasesRes) ? leasesRes : []);
      setProperties(Array.isArray(propsRes) ? propsRes : []);
      setTenants(Array.isArray(tenantsRes) ? tenantsRes : []);
      setLandlords(Array.isArray(landlordsRes) ? landlordsRes : []);
    } catch (e: any) {
      setError(e?.message ?? 'Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const onChange = (key: keyof CreateLeaseForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // label helpers
  const propertyLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) {
      const code = p.code ? p.code : p.id;
      const name = p.name ? ` – ${p.name}` : '';
      m.set(p.id, `${code}${name}`);
    }
    return m;
  }, [properties]);

  const tenantLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tenants) {
      const name = `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim();
      m.set(t.id, name || t.id);
    }
    return m;
  }, [tenants]);

  const landlordLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of landlords) {
      m.set(l.id, l.name || l.id);
    }
    return m;
  }, [landlords]);

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
      depositAmount: '',
      adminFeeAmount: '',
      otherFeesAmount: '',
      dueDayOfMonth: '5',
      externalId: '',
    });
  };

  const create = async () => {
    setError(null);

    // validazioni base
    if (!form.propertyId) return setError('Seleziona una proprietà');
    if (!form.startDate) return setError('Seleziona startDate');
    if (!form.monthlyRentWithoutBills.trim())
      return setError('Inserisci monthlyRentWithoutBills');

    if (form.type === 'TENANT' && !form.tenantId) return setError('Seleziona un tenant');
    if (form.type === 'LANDLORD' && !form.landlordId) return setError('Seleziona un landlord');

    const net = Number(form.monthlyRentWithoutBills);
    if (Number.isNaN(net)) return setError('monthlyRentWithoutBills non è un numero valido');

    const payload: any = {
      type: form.type,
      propertyId: form.propertyId,
      tenantId: form.type === 'TENANT' ? form.tenantId : undefined,
      landlordId: form.type === 'LANDLORD' ? form.landlordId : undefined,

      // date: se vuote -> undefined (così non fallisce IsDateString)
      startDate: form.startDate,
      endDate: form.endDate.trim() || undefined,
      nextPaymentDue: form.nextPaymentDue.trim() || undefined,

      monthlyRentWithoutBills: net,
      monthlyRentWithBills: toNum(form.monthlyRentWithBills),
      billsIncludedAmount: toNum(form.billsIncludedAmount),

      depositAmount: toNum(form.depositAmount),
      adminFeeAmount: toNum(form.adminFeeAmount),
      otherFeesAmount: toNum(form.otherFeesAmount),

      dueDayOfMonth: toNum(form.dueDayOfMonth) ?? 5,
      externalId: form.externalId.trim() || undefined,
    };

    try {
      await fetchWithAuth('/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      resetForm();
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore creazione lease');
    }
  };

  const generate = async (id: string) => {
    setError(null);
    try {
      await fetchWithAuth(`/leases/${id}/generate-schedule`, { method: 'POST' });
      alert('Schedule generated ✅');
    } catch (e: any) {
      setError(e?.message ?? 'Errore generate schedule');
    }
  };

  // ✅ FIX #1: delete lease
  const removeLease = async (id: string) => {
    setError(null);

    const ok = confirm(
      'Vuoi eliminare questo contratto?\n\nNota: la cancellazione rimuove SOLO il lease (non i pagamenti/spese già generati).'
    );
    if (!ok) return;

    try {
      await fetchWithAuth(`/leases/${id}`, { method: 'DELETE' });

      // se stavi visualizzando documenti di questo lease, chiudi
      setOpenDocsLeaseId((prev) => (prev === id ? null : prev));

      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore delete lease');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Leases</h1>
          <button onClick={loadAll} className="text-sm border rounded px-3 py-1 hover:bg-slate-50">
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
          <h2 className="font-medium">Nuovo lease</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              className="border rounded-md px-3 py-2"
              value={form.type}
              onChange={(e) => {
                const v = e.target.value as LeaseType;
                // cambio tipo => reset selezione controparte
                setForm((prev) => ({
                  ...prev,
                  type: v,
                  tenantId: v === 'TENANT' ? prev.tenantId : '',
                  landlordId: v === 'LANDLORD' ? prev.landlordId : '',
                }));
              }}
            >
              <option value="TENANT">TENANT (incasso)</option>
              <option value="LANDLORD">LANDLORD (spesa)</option>
            </select>

            {/* property dropdown */}
            <select
              className="border rounded-md px-3 py-2"
              value={form.propertyId}
              onChange={(e) => onChange('propertyId', e.target.value)}
            >
              <option value="">Seleziona proprietà *</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {propertyLabel.get(p.id) ?? p.id}
                </option>
              ))}
            </select>

            {/* tenant/landlord dropdown */}
            {form.type === 'TENANT' ? (
              <select
                className="border rounded-md px-3 py-2"
                value={form.tenantId}
                onChange={(e) => onChange('tenantId', e.target.value)}
              >
                <option value="">Seleziona inquilino *</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {tenantLabel.get(t.id) ?? t.id}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="border rounded-md px-3 py-2"
                value={form.landlordId}
                onChange={(e) => onChange('landlordId', e.target.value)}
              >
                <option value="">Seleziona proprietario *</option>
                {landlords.map((l) => (
                  <option key={l.id} value={l.id}>
                    {landlordLabel.get(l.id) ?? l.id}
                  </option>
                ))}
              </select>
            )}

            {/* date pickers */}
            <div className="flex flex-col">
              <label className="text-xs text-slate-600 mb-1">Start date *</label>
              <input
                className="border rounded-md px-3 py-2"
                type="date"
                value={form.startDate}
                onChange={(e) => onChange('startDate', e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-slate-600 mb-1">End date</label>
              <input
                className="border rounded-md px-3 py-2"
                type="date"
                value={form.endDate}
                onChange={(e) => onChange('endDate', e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-slate-600 mb-1">Next payment due</label>
              <input
                className="border rounded-md px-3 py-2"
                type="date"
                value={form.nextPaymentDue}
                onChange={(e) => onChange('nextPaymentDue', e.target.value)}
              />
            </div>

            {/* numbers kept as strings */}
            <div className="flex flex-col">
              <label className="text-xs text-slate-600 mb-1">Monthly rent (without bills) *</label>
              <input
                className="border rounded-md px-3 py-2"
                type="number"
                value={form.monthlyRentWithoutBills}
                onChange={(e) => onChange('monthlyRentWithoutBills', e.target.value)}
              />
            </div>

            {form.type === 'TENANT' && (
              <>
                <div className="flex flex-col">
                  <label className="text-xs text-slate-600 mb-1">Monthly rent (with bills)</label>
                  <input
                    className="border rounded-md px-3 py-2"
                    type="number"
                    value={form.monthlyRentWithBills}
                    onChange={(e) => onChange('monthlyRentWithBills', e.target.value)}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs text-slate-600 mb-1">Bills included amount</label>
                  <input
                    className="border rounded-md px-3 py-2"
                    type="number"
                    value={form.billsIncludedAmount}
                    onChange={(e) => onChange('billsIncludedAmount', e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="flex flex-col">
              <label className="text-xs text-slate-600 mb-1">Deposit amount</label>
              <input
                className="border rounded-md px-3 py-2"
                type="number"
                value={form.depositAmount}
                onChange={(e) => onChange('depositAmount', e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-slate-600 mb-1">Admin fee amount</label>
              <input
                className="border rounded-md px-3 py-2"
                type="number"
                value={form.adminFeeAmount}
                onChange={(e) => onChange('adminFeeAmount', e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-slate-600 mb-1">Other fees amount</label>
              <input
                className="border rounded-md px-3 py-2"
                type="number"
                value={form.otherFeesAmount}
                onChange={(e) => onChange('otherFeesAmount', e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-slate-600 mb-1">Due day of month (default 5)</label>
              <input
                className="border rounded-md px-3 py-2"
                type="number"
                value={form.dueDayOfMonth}
                onChange={(e) => onChange('dueDayOfMonth', e.target.value)}
              />
            </div>

            <div className="flex flex-col md:col-span-2">
              <label className="text-xs text-slate-600 mb-1">External ID (Excel)</label>
              <input
                className="border rounded-md px-3 py-2"
                value={form.externalId}
                onChange={(e) => onChange('externalId', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={create}
              className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-700"
            >
              Create
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="border px-4 py-2 rounded hover:bg-slate-50"
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
            <div className="text-sm text-slate-500">Nessun lease.</div>
          ) : (
            <div className="space-y-2">
              {items.map((l) => {
                const docsOpen = openDocsLeaseId === l.id;
                const propText = propertyLabel.get(l.propertyId) ?? l.propertyId;

                const counterparty =
                  l.type === 'TENANT'
                    ? `tenant: ${tenantLabel.get(l.tenantId ?? '') ?? l.tenantId ?? '-'}`
                    : `landlord: ${landlordLabel.get(l.landlordId ?? '') ?? l.landlordId ?? '-'}`;

                return (
                  <div key={l.id} className="border rounded-lg p-3">
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {l.type} · {propText}
                        </div>
                        <div className="text-sm text-slate-600">
                          {counterparty} · rent net: {l.monthlyRentWithoutBills} €
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          start: {String(l.startDate)} {l.endDate ? `· end: ${String(l.endDate)}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => generate(l.id)}
                          className="border rounded-md px-3 py-2 text-sm"
                        >
                          Generate schedule
                        </button>

                        <button
                          onClick={() => setOpenDocsLeaseId((prev) => (prev === l.id ? null : l.id))}
                          className="border rounded-md px-3 py-2 text-sm"
                        >
                          {docsOpen ? 'Chiudi documenti' : 'Documenti'}
                        </button>

                        {/* ✅ FIX #1: delete */}
                        <button
                          onClick={() => removeLease(l.id)}
                          className="border rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                        >
                          Elimina
                        </button>
                      </div>
                    </div>

                    {docsOpen && (
                      <div className="mt-3">
                        <EntityDocuments
                          entityKind="leases"
                          entityId={l.id}
                          label={`Documenti contratto (${l.type} · ${propText})`}
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
