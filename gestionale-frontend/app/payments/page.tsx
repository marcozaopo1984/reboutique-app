'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import EntityDocuments from '@/components/EntityDocuments';
import { Field, Input, Select } from '@/components/form/Field';

type Tenant = { id: string; firstName?: string; lastName?: string };
type Property = { id: string; code?: string; name?: string; type?: string; buildingId?: string };
type Lease = { id: string; tenantId?: string; propertyId?: string };

type PaymentKind = 'RENT' | 'BUILDING_FEE' | 'OTHER';
type PaymentStatus = 'PLANNED' | 'PAID' | 'OVERDUE';

type Payment = {
  id: string;
  tenantId: string;
  propertyId: string;
  leaseId?: string;
  buildingId?: string;

  dueDate: string;
  paidDate?: string;

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

const cleanStr = (s: string) => s.trim();
const toNum = (v: string) => {
  const s = cleanStr(v);
  return s === '' ? undefined : Number(s);
};

export default function PaymentsPage() {
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

  const onChange = (key: keyof CreatePaymentForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value } as CreatePaymentForm));
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
      paidDate: form.paidDate.trim() || undefined,

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

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Payments</h1>
            <p className="text-sm text-slate-600">
              Gestisci pagamenti (manuali o collegati ai contratti).
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

            <Field label="Due date" required>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('dueDate', e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field label="Paid date">
              <Input
                type="date"
                value={form.paidDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('paidDate', e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field label="Importo (€)" required>
              <Input
                type="number"
                value={form.amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('amount', e.target.value)}
                placeholder="1000"
                disabled={busy}
              />
            </Field>

            <Field label="Kind" required>
              <Select
                value={form.kind}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  onChange('kind', e.target.value as PaymentKind)
                }
                disabled={busy}
              >
                <option value="RENT">Affitto</option>
                <option value="BUILDING_FEE">Quota condominiale</option>
                <option value="OTHER">Altro</option>
              </Select>
            </Field>

            <Field label="Status" required>
              <Select
                value={form.status}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  onChange('status', e.target.value as PaymentStatus)
                }
                disabled={busy}
              >
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
          <h2 className="font-medium mb-3">Elenco</h2>

          {loading ? (
            <div>Caricamento...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500">Nessun pagamento.</div>
          ) : (
            <div className="space-y-2">
              {items.map((p) => {
                const docsOpen = openDocsPaymentId === p.id;

                const tName = tenantLabel.get(p.tenantId) ?? p.tenantId;
                const propText = propertyLabel.get(p.propertyId) ?? p.propertyId;

                const manualLabel = p.leaseId ? '' : ' · MANUALE';

                return (
                  <div key={p.id} className="border rounded-lg p-3">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {tName} → {propText}
                        </div>
                        <div className="text-sm text-slate-600">
                          {p.amount} € · {p.kind} · {p.status}
                          {manualLabel}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Due: {p.dueDate}
                          {p.paidDate ? ` · Paid: ${p.paidDate}` : ''}
                          {p.leaseId ? ` · leaseId: ${p.leaseId}` : ''}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">id: {p.id}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setOpenDocsPaymentId((prev) => (prev === p.id ? null : p.id))
                          }
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
