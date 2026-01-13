'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';

type LeaseType = 'TENANT' | 'LANDLORD';

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

type CreateLeaseDto = {
  type: LeaseType;
  propertyId: string;
  tenantId?: string;
  landlordId?: string;
  startDate: string;
  endDate?: string;
  nextPaymentDue?: string;
  monthlyRentWithoutBills: number;
  monthlyRentWithBills?: number;
  billsIncludedAmount?: number;
  depositAmount?: number;
  adminFeeAmount?: number;
  otherFeesAmount?: number;
  dueDayOfMonth?: number;
  externalId?: string;
};

export default function LeasesPage() {
  const [items, setItems] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateLeaseDto>({
    type: 'TENANT',
    propertyId: '',
    tenantId: '',
    landlordId: '',
    startDate: '',
    endDate: '',
    nextPaymentDue: '',
    monthlyRentWithoutBills: 0,
    monthlyRentWithBills: undefined,
    billsIncludedAmount: undefined,
    depositAmount: undefined,
    adminFeeAmount: undefined,
    otherFeesAmount: undefined,
    dueDayOfMonth: 5,
    externalId: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await fetchWithAuth('/leases')) as Lease[];
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? 'Errore caricamento leases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onChange = (key: keyof CreateLeaseDto, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const create = async () => {
    setError(null);
    try {
      if (!form.propertyId.trim()) return setError('propertyId obbligatorio');
      if (!form.startDate.trim()) return setError('startDate obbligatorio (YYYY-MM-DD)');
      if (form.type === 'TENANT' && !form.tenantId?.trim())
        return setError('tenantId obbligatorio per TENANT');
      if (form.type === 'LANDLORD' && !form.landlordId?.trim())
        return setError('landlordId obbligatorio per LANDLORD');

      const payload: any = {
        ...form,
        propertyId: form.propertyId.trim(),
        tenantId: form.type === 'TENANT' ? form.tenantId?.trim() : undefined,
        landlordId: form.type === 'LANDLORD' ? form.landlordId?.trim() : undefined,
        endDate: form.endDate?.trim() || undefined,
        nextPaymentDue: form.nextPaymentDue?.trim() || undefined,
        externalId: form.externalId?.trim() || undefined,
        dueDayOfMonth: form.dueDayOfMonth ?? 5,
      };

      // numeric cleanup
      const toNum = (v: any) => (v === '' || v === null || v === undefined ? undefined : Number(v));
      payload.monthlyRentWithoutBills = Number(form.monthlyRentWithoutBills);
      payload.monthlyRentWithBills = toNum(form.monthlyRentWithBills);
      payload.billsIncludedAmount = toNum(form.billsIncludedAmount);
      payload.depositAmount = toNum(form.depositAmount);
      payload.adminFeeAmount = toNum(form.adminFeeAmount);
      payload.otherFeesAmount = toNum(form.otherFeesAmount);
      payload.dueDayOfMonth = toNum(form.dueDayOfMonth) ?? 5;

      await fetchWithAuth('/leases', { method: 'POST', body: JSON.stringify(payload) });

      setForm((prev) => ({
        ...prev,
        propertyId: '',
        tenantId: '',
        landlordId: '',
        startDate: '',
        endDate: '',
        nextPaymentDue: '',
        externalId: '',
        monthlyRentWithoutBills: 0,
      }));

      await load();
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

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Leases</h1>
        </header>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <h2 className="font-medium">Nuovo lease</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              className="border rounded-md px-3 py-2"
              value={form.type}
              onChange={(e) => onChange('type', e.target.value as LeaseType)}
            >
              <option value="TENANT">TENANT (incasso)</option>
              <option value="LANDLORD">LANDLORD (spesa)</option>
            </select>

            <input
              className="border rounded-md px-3 py-2"
              placeholder="Property ID *"
              value={form.propertyId}
              onChange={(e) => onChange('propertyId', e.target.value)}
            />

            {form.type === 'TENANT' ? (
              <input
                className="border rounded-md px-3 py-2"
                placeholder="Tenant ID *"
                value={form.tenantId ?? ''}
                onChange={(e) => onChange('tenantId', e.target.value)}
              />
            ) : (
              <input
                className="border rounded-md px-3 py-2"
                placeholder="Landlord ID *"
                value={form.landlordId ?? ''}
                onChange={(e) => onChange('landlordId', e.target.value)}
              />
            )}

            <input
              className="border rounded-md px-3 py-2"
              placeholder="Start date (YYYY-MM-DD) *"
              value={form.startDate}
              onChange={(e) => onChange('startDate', e.target.value)}
            />

            <input
              className="border rounded-md px-3 py-2"
              placeholder="End date (YYYY-MM-DD)"
              value={form.endDate ?? ''}
              onChange={(e) => onChange('endDate', e.target.value)}
            />

            <input
              className="border rounded-md px-3 py-2"
              placeholder="Next payment due (YYYY-MM-DD)"
              value={form.nextPaymentDue ?? ''}
              onChange={(e) => onChange('nextPaymentDue', e.target.value)}
            />

            <input
              className="border rounded-md px-3 py-2"
              placeholder="Monthly rent (without bills) *"
              type="number"
              value={form.monthlyRentWithoutBills}
              onChange={(e) => onChange('monthlyRentWithoutBills', e.target.value)}
            />

            {form.type === 'TENANT' && (
              <>
                <input
                  className="border rounded-md px-3 py-2"
                  placeholder="Monthly rent (with bills)"
                  type="number"
                  value={form.monthlyRentWithBills ?? ''}
                  onChange={(e) => onChange('monthlyRentWithBills', e.target.value)}
                />
                <input
                  className="border rounded-md px-3 py-2"
                  placeholder="Bills included amount"
                  type="number"
                  value={form.billsIncludedAmount ?? ''}
                  onChange={(e) => onChange('billsIncludedAmount', e.target.value)}
                />
              </>
            )}

            <input
              className="border rounded-md px-3 py-2"
              placeholder="Due day of month (default 5)"
              type="number"
              value={form.dueDayOfMonth ?? 5}
              onChange={(e) => onChange('dueDayOfMonth', e.target.value)}
            />

            <input
              className="border rounded-md px-3 py-2"
              placeholder="External ID (Excel)"
              value={form.externalId ?? ''}
              onChange={(e) => onChange('externalId', e.target.value)}
            />
          </div>

          <button onClick={create} className="border rounded-md px-4 py-2">
            Create
          </button>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-medium mb-3">Elenco</h2>

          {loading ? (
            <div>Caricamento...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500">Nessun lease.</div>
          ) : (
            <div className="space-y-2">
              {items.map((l) => (
                <div key={l.id} className="border rounded-lg p-3 flex justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {l.type} · property {l.propertyId}
                    </div>
                    <div className="text-sm text-slate-600">
                      {l.type === 'TENANT'
                        ? `tenant: ${l.tenantId}`
                        : `landlord: ${l.landlordId}`}
                      {' · '}
                      rent net: {l.monthlyRentWithoutBills} €
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
