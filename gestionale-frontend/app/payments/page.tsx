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
  leaseId: string;
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
  const [leaseId, setLeaseId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'RENT' | 'BUILDING_FEE' | 'OTHER'>('RENT');
  const [status, setStatus] = useState<'PLANNED' | 'PAID' | 'OVERDUE'>('PLANNED');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [paymentsRes, tenantsRes, propertiesRes, leasesRes] = await Promise.all([
        fetchWithAuth('/payments'),
        fetchWithAuth('/tenants'),
        fetchWithAuth('/properties'),
        fetchWithAuth('/leases'),
      ]);

      setPayments(paymentsRes);
      setTenants(tenantsRes);
      setProperties(propertiesRes);
      setLeases(leasesRes);
    } catch (err: any) {
      setError(err.message ?? 'Errore caricamento dati');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const lease = leases.find(l => l.id === leaseId);
      const prop = properties.find(p => p.id === lease?.propertyId);

      const body: any = {
        leaseId,
        tenantId: lease?.tenantId,
        propertyId: lease?.propertyId,
        buildingId: prop?.buildingId ?? null,

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

      setLeaseId('');
      setDueDate('');
      setPaidDate('');
      setAmount('');
      setKind('RENT');
      setStatus('PLANNED');

      await loadAll();
    } catch (err: any) {
      setError(err.message ?? 'Errore creazione pagamento');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetchWithAuth(`/payments/${id}`, { method: 'DELETE' });
      await loadAll();
    } catch (err: any) {
      setError(err.message ?? 'Errore eliminazione pagamento');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <h1 className="text-2xl font-semibold mb-6">Pagamenti</h1>

      {/* FORM */}
      <form onSubmit={handleCreate} className="bg-white shadow p-4 rounded mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <select
          className="border rounded px-3 py-2"
          value={leaseId}
          onChange={(e) => setLeaseId(e.target.value)}
          required
        >
          <option value="">Seleziona Contratto</option>
          {leases.map(l => {
            const t = tenants.find(t => t.id === l.tenantId);
            const p = properties.find(p => p.id === l.propertyId);
            return (
              <option key={l.id} value={l.id}>
                {t?.firstName} {t?.lastName} – {p?.code}
              </option>
            );
          })}
        </select>

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

        <div className="md:col-span-2">
          <button className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-700">
            Crea Pagamento
          </button>
        </div>
      </form>

      {/* LISTA */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg mb-3 font-medium">Lista pagamenti</h2>

        {loading ? (
          <p>Caricamento...</p>
        ) : payments.length === 0 ? (
          <p>Nessun pagamento presente.</p>
        ) : (
          <div className="space-y-3">
            {payments.map(p => {
              const t = tenants.find(t => t.id === p.tenantId);
              const prop = properties.find(pr => pr.id === p.propertyId);

              return (
                <div key={p.id} className="border rounded p-3 flex justify-between">
                  <div>
                    <div className="font-semibold">
                      {t?.firstName} {t?.lastName} → {prop?.code}
                    </div>
                    <div className="text-sm text-slate-600">
                      {p.amount} € – {p.kind}  
                    </div>
                    <div className="text-xs text-slate-500">
                      Scadenza: {p.dueDate} — Stato: {p.status}
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
