'use client';

import { useEffect, useState, FormEvent } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';

type Lease = {
  id: string;
  tenantId: string;
  propertyId: string;
  buildingId?: string;

  startDate: string;
  expectedEndDate: string;
  actualEndDate?: string;

  monthlyRent: number;
  billsIncluded?: boolean;

  status: 'INCOMING' | 'ACTIVE' | 'ENDED';
};

type Tenant = { id: string; firstName: string; lastName: string };
type Property = { id: string; code: string; name: string; type: string; buildingId?: string };

export default function LeasesPage() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FORM STATE
  const [tenantId, setTenantId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [billsIncluded, setBillsIncluded] = useState(false);
  const [status, setStatus] = useState<'INCOMING' | 'ACTIVE' | 'ENDED'>('ACTIVE');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [leasesRes, tenantsRes, propertiesRes] = await Promise.all([
        fetchWithAuth('/leases'),
        fetchWithAuth('/tenants'),
        fetchWithAuth('/properties'),
      ]);

      setLeases(leasesRes);
      setTenants(tenantsRes);
      setProperties(propertiesRes);
    } catch (err: any) {
      setError(err.message ?? 'Errore nel caricamento');
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
      const prop = properties.find(p => p.id === propertyId);
      const body = {
        tenantId,
        propertyId,
        buildingId: prop?.buildingId ?? null,
        startDate,
        expectedEndDate,
        monthlyRent: Number(monthlyRent),
        billsIncluded,
        status,
      };

      await fetchWithAuth('/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      setTenantId('');
      setPropertyId('');
      setStartDate('');
      setExpectedEndDate('');
      setMonthlyRent('');
      setBillsIncluded(false);
      setStatus('ACTIVE');

      await loadAll();
    } catch (err: any) {
      setError(err.message ?? 'Errore creazione contratto');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetchWithAuth(`/leases/${id}`, { method: 'DELETE' });
      await loadAll();
    } catch (err: any) {
      setError(err.message ?? 'Errore eliminazione contratto');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <h1 className="text-2xl font-semibold mb-6">Contratti (Leases)</h1>

      {/* FORM */}
      <form onSubmit={handleCreate} className="bg-white shadow p-4 rounded mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <select
          className="border rounded px-3 py-2"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          required
        >
          <option value="">Seleziona Inquilino</option>
          {tenants.map(t => (
            <option key={t.id} value={t.id}>
              {t.firstName} {t.lastName}
            </option>
          ))}
        </select>

        <select
          className="border rounded px-3 py-2"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          required
        >
          <option value="">Seleziona Proprietà</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>
              {p.code} – {p.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          className="border rounded px-3 py-2"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />

        <input
          type="date"
          className="border rounded px-3 py-2"
          value={expectedEndDate}
          onChange={(e) => setExpectedEndDate(e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Canone mensile (€)"
          className="border rounded px-3 py-2"
          value={monthlyRent}
          onChange={(e) => setMonthlyRent(e.target.value)}
          required
        />

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={billsIncluded} onChange={(e) => setBillsIncluded(e.target.checked)} />
          Bollette incluse
        </label>

        <select
          className="border rounded px-3 py-2"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
        >
          <option value="INCOMING">Incoming</option>
          <option value="ACTIVE">Active</option>
          <option value="ENDED">Ended</option>
        </select>

        <div className="md:col-span-2">
          <button className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-700">
            Crea Contratto
          </button>
        </div>
      </form>

      {/* LISTA */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg mb-3 font-medium">Lista contratti</h2>

        {loading ? (
          <p>Caricamento...</p>
        ) : leases.length === 0 ? (
          <p>Nessun contratto disponibile.</p>
        ) : (
          <div className="space-y-3">
            {leases.map(l => {
              const t = tenants.find(t => t.id === l.tenantId);
              const p = properties.find(p => p.id === l.propertyId);

              return (
                <div key={l.id} className="border rounded p-3 flex justify-between">
                  <div>
                    <div className="font-semibold">
                      {t?.firstName} {t?.lastName} → {p?.code}
                    </div>
                    <div className="text-sm text-slate-600">
                      {l.startDate} → {l.expectedEndDate} ({l.status})
                    </div>
                    <div className="text-xs text-slate-500">
                      Canone: {l.monthlyRent} € {l.billsIncluded && '(bollette incluse)'}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(l.id)}
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
