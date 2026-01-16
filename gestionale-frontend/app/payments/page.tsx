'use client';

import { useEffect, useState, FormEvent } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';

type Tenant = { id: string; firstName: string; lastName: string };
type Property = { id: string; code: string; name: string; type: string; buildingId?: string };
type Lease = { id: string; tenantId: string; propertyId: string };

type Payment = {
  id: string;
  tenantId: string;
  propertyId: string;
  leaseId?: string; // ✅ ora opzionale
  buildingId?: string;

  dueDate: string;
  paidDate?: string;
  amount: number;
  currency: string;

  kind: 'RENT' | 'BUILDING_FEE' | 'OTHER';
  status: 'PLANNED' | 'PAID' | 'OVERDUE';
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FORM
  const [manualMode, setManualMode] = useState(false);

  // Mode: lease
  const [leaseId, setLeaseId] = useState('');

  // Mode: manual
  const [manualTenantId, setManualTenantId] = useState('');
  const [manualPropertyId, setManualPropertyId] = useState('');

  // Common fields
  const [dueDate, setDueDate] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'RENT' | 'BUILDING_FEE' | 'OTHER'>('RENT');
  const [status, setStatus] = useState<'PLANNED' | 'PAID' | 'OVERDUE'>('PLANNED');

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

      setPayments(Array.isArray(paymentsRes) ? paymentsRes : []);
      setTenants(Array.isArray(tenantsRes) ? tenantsRes : []);
      setProperties(Array.isArray(propertiesRes) ? propertiesRes : []);
      setLeases(Array.isArray(leasesRes) ? leasesRes : []);
    } catch (err: any) {
      setError(err?.message ?? 'Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const resetForm = () => {
    setLeaseId('');
    setManualTenantId('');
    setManualPropertyId('');
    setDueDate('');
    setPaidDate('');
    setAmount('');
    setKind('RENT');
    setStatus('PLANNED');
    setManualMode(false);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Deriva tenantId/propertyId in base alla modalità
      const lease = !manualMode ? leases.find((l) => l.id === leaseId) : undefined;

      const derivedTenantId = manualMode ? manualTenantId : lease?.tenantId;
      const derivedPropertyId = manualMode ? manualPropertyId : lease?.propertyId;

      if (!derivedTenantId || !derivedPropertyId) {
        setError('Seleziona tenant e property (o un contratto valido).');
        return;
      }

      const prop = properties.find((p) => p.id === derivedPropertyId);

      const body: any = {
        // ✅ leaseId opzionale
        leaseId: manualMode ? undefined : leaseId || undefined,

        tenantId: derivedTenantId,
        propertyId: derivedPropertyId,
        buildingId: prop?.buildingId ?? undefined,

        dueDate,
        paidDate: paidDate || undefined,
        amount: Number(amount),
        currency: 'EUR',

        kind,
        status,
      };

      await fetchWithAuth('/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      resetForm();
      await loadAll();
    } catch (err: any) {
      setError(err?.message ?? 'Errore creazione pagamento');
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await fetchWithAuth(`/payments/${id}`, { method: 'DELETE' });
      await loadAll();
    } catch (err: any) {
      setError(err?.message ?? 'Errore eliminazione pagamento');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <h1 className="text-2xl font-semibold mb-6">Pagamenti</h1>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
          {error}
        </div>
      )}

      {/* FORM */}
      <form
        onSubmit={handleCreate}
        className="bg-white shadow p-4 rounded mb-6 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div className="md:col-span-2 flex items-center gap-3">
          <input
            id="manualMode"
            type="checkbox"
            checked={manualMode}
            onChange={(e) => {
              const v = e.target.checked;
              setManualMode(v);
              // reset campi dipendenti quando cambi modalità
              setLeaseId('');
              setManualTenantId('');
              setManualPropertyId('');
            }}
          />
          <label htmlFor="manualMode" className="text-sm text-slate-700">
            Inserimento manuale (senza contratto)
          </label>
        </div>

        {!manualMode ? (
          <select
            className="border rounded px-3 py-2"
            value={leaseId}
            onChange={(e) => setLeaseId(e.target.value)}
            required
          >
            <option value="">Seleziona Contratto</option>
            {leases.map((l) => {
              const t = tenants.find((t) => t.id === l.tenantId);
              const p = properties.find((p) => p.id === l.propertyId);
              return (
                <option key={l.id} value={l.id}>
                  {t?.firstName} {t?.lastName} – {p?.code}
                </option>
              );
            })}
          </select>
        ) : (
          <>
            <select
              className="border rounded px-3 py-2"
              value={manualTenantId}
              onChange={(e) => setManualTenantId(e.target.value)}
              required
            >
              <option value="">Seleziona Inquilino</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </select>

            <select
              className="border rounded px-3 py-2"
              value={manualPropertyId}
              onChange={(e) => setManualPropertyId(e.target.value)}
              required
            >
              <option value="">Seleziona Immobile</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} – {p.name}
                </option>
              ))}
            </select>
          </>
        )}

        <input
          type="date"
          className="border rounded px-3 py-2"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
        />

        <input
          type="date"
          className="border rounded px-3 py-2"
          value={paidDate}
          onChange={(e) => setPaidDate(e.target.value)}
        />

        <input
          type="number"
          placeholder="Importo (€)"
          className="border rounded px-3 py-2"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <select
          className="border rounded px-3 py-2"
          value={kind}
          onChange={(e) => setKind(e.target.value as any)}
        >
          <option value="RENT">Affitto</option>
          <option value="BUILDING_FEE">Quota condominiale</option>
          <option value="OTHER">Altro</option>
        </select>

        <select
          className="border rounded px-3 py-2"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
        >
          <option value="PLANNED">Da pagare</option>
          <option value="PAID">Pagato</option>
          <option value="OVERDUE">In ritardo</option>
        </select>

        <div className="md:col-span-2 flex items-center gap-3">
          <button className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-700">
            Crea Pagamento
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="border px-4 py-2 rounded hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </form>

      {/* LISTA */}
      <div className="bg-white p-4 rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Lista pagamenti</h2>
          <button
            onClick={loadAll}
            className="text-sm border rounded px-3 py-1 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p>Caricamento...</p>
        ) : payments.length === 0 ? (
          <p>Nessun pagamento presente.</p>
        ) : (
          <div className="space-y-3">
            {payments.map((p) => {
              const t = tenants.find((t) => t.id === p.tenantId);
              const prop = properties.find((pr) => pr.id === p.propertyId);
              const manualLabel = p.leaseId ? '' : ' – MANUALE';

              return (
                <div key={p.id} className="border rounded p-3 flex justify-between">
                  <div>
                    <div className="font-semibold">
                      {t?.firstName} {t?.lastName} → {prop?.code}
                    </div>
                    <div className="text-sm text-slate-600">
                      {p.amount} € – {p.kind}
                      {manualLabel}
                    </div>
                    <div className="text-xs text-slate-500">
                      Scadenza: {p.dueDate} — Stato: {p.status}
                      {p.paidDate ? ` — Pagato: ${p.paidDate}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-red-600 hover:underline text-sm"
                  >
                    Elimina
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
