'use client';

import { useEffect, useState, FormEvent } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';

type Property = {
  id: string;
  code: string;
  name: string;
  address?: string;
  type: 'APARTMENT' | 'ROOM' | 'BED';
  baseMonthlyRent?: number;
  monthlyUtilities?: number;
  depositMonths?: number;
  isPublished?: boolean;
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<'APARTMENT' | 'ROOM' | 'BED'>('ROOM');
  const [baseMonthlyRent, setBaseMonthlyRent] = useState('');
  const [monthlyUtilities, setMonthlyUtilities] = useState('');
  const [depositMonths, setDepositMonths] = useState('');
  const [isPublished, setIsPublished] = useState(true);

  const loadProperties = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await fetchWithAuth('/properties')) as Property[];
      setProperties(data);
    } catch (err: any) {
      setError(err.message ?? 'Errore nel caricamento immobili');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProperties();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const body = {
        code,
        name,
        address: address || undefined,
        type,
        baseMonthlyRent: baseMonthlyRent
          ? Number(baseMonthlyRent)
          : undefined,
        monthlyUtilities: monthlyUtilities
          ? Number(monthlyUtilities)
          : undefined,
        depositMonths: depositMonths
          ? Number(depositMonths)
          : undefined,
        isPublished,
      };

      await fetchWithAuth('/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // reset form
      setCode('');
      setName('');
      setAddress('');
      setBaseMonthlyRent('');
      setMonthlyUtilities('');
      setDepositMonths('');
      setIsPublished(true);

      await loadProperties();
    } catch (err: any) {
      setError(err.message ?? 'Errore nella creazione immobile');
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await fetchWithAuth(`/properties/${id}`, {
        method: 'DELETE',
      });
      await loadProperties();
    } catch (err: any) {
      setError(err.message ?? 'Errore nella cancellazione immobile');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <header className="flex flex-col gap-2 mb-4">
          <h1 className="text-2xl font-semibold">
            Immobili – Reboutique (Holder)
          </h1>
          <p className="text-sm text-slate-600">
            Gestisci la lista delle proprietà.
          </p>
        </header>

        <section className="bg-white shadow rounded-lg p-4 mb-6">
          <h2 className="text-lg font-medium mb-3">
            Crea nuovo immobile
          </h2>
          <form
            onSubmit={handleCreate}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <input
              type="text"
              placeholder="Codice (es. Cerva-3A)"
              className="border rounded px-3 py-2"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Nome immobile"
              className="border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Indirizzo"
              className="border rounded px-3 py-2 md:col-span-2"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />

            <div className="flex flex-col">
              <label className="text-sm mb-1">Tipo</label>
              <select
                className="border rounded px-3 py-2"
                value={type}
                onChange={(e) =>
                  setType(e.target.value as 'APARTMENT' | 'ROOM' | 'BED')
                }
              >
                <option value="APARTMENT">Appartamento</option>
                <option value="ROOM">Stanza</option>
                <option value="BED">Posto letto</option>
              </select>
            </div>

            <input
              type="number"
              min="0"
              step="1"
              placeholder="Canone mensile base (€)"
              className="border rounded px-3 py-2"
              value={baseMonthlyRent}
              onChange={(e) => setBaseMonthlyRent(e.target.value)}
            />
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Utenze mensili (€)"
              className="border rounded px-3 py-2"
              value={monthlyUtilities}
              onChange={(e) => setMonthlyUtilities(e.target.value)}
            />
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Deposito (mesi)"
              className="border rounded px-3 py-2"
              value={depositMonths}
              onChange={(e) => setDepositMonths(e.target.value)}
            />

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              <span className="text-sm">Pubblicato (visibile ai tenants)</span>
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="px-4 py-2 rounded bg-slate-800 text-white hover:bg-slate-700"
              >
                Salva immobile
              </button>
            </div>
          </form>

          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
        </section>

        <section className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-medium mb-3">
            Lista immobili
          </h2>
          {loading ? (
            <p>Caricamento...</p>
          ) : properties.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nessun immobile presente.
            </p>
          ) : (
            <div className="space-y-3">
              {properties.map((p) => (
                <div
                  key={p.id}
                  className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-semibold">
                      {p.code} – {p.name}
                    </div>
                    <div className="text-sm text-slate-600">
                      {p.address}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Tipo: {p.type} · Canone base:{' '}
                      {p.baseMonthlyRent ?? '-'} € · Utenze:{' '}
                      {p.monthlyUtilities ?? '-'} € · Deposito:{' '}
                      {p.depositMonths ?? '-'} mesi
                    </div>
                    <div className="text-xs mt-1">
                      Stato:{' '}
                      {p.isPublished ? 'Pubblicato' : 'Non pubblicato'}
                    </div>
                  </div>
                  <div className="mt-2 md:mt-0">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
