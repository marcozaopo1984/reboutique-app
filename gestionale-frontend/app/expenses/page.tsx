'use client';

import { useEffect, useState, FormEvent } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';

type Property = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type Expense = {
  id: string;
  propertyId: string;
  type: string;
  description?: string;
  amount: number;
  currency: string;
  costDate: string;
  costMonth?: string;
  frequency?: string;
  scope?: string;
  allocationMode?: string;
};

export default function ExpensesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FORM state
  const [propertyId, setPropertyId] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [costDate, setCostDate] = useState('');
  const [scope, setScope] = useState<'BUILDING' | 'UNIT'>('UNIT');

  const loadData = async () => {
    try {
      const [props, exps] = await Promise.all([
        fetchWithAuth('/properties'),
        fetchWithAuth('/expenses'),
      ]);

      setProperties(props);
      setExpenses(exps);
    } catch (err: any) {
      setError(err.message ?? 'Errore caricamento spese');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const body = {
        propertyId,
        type,
        description: description || undefined,
        amount: Number(amount),
        currency: 'EUR',
        costDate,
        scope,
      };

      await fetchWithAuth('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // reset
      setPropertyId('');
      setType('');
      setDescription('');
      setAmount('');
      setCostDate('');
      setScope('UNIT');

      await loadData();
    } catch (err: any) {
      setError(err.message ?? 'Errore creazione spesa');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetchWithAuth(`/expenses/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (err: any) {
      setError(err.message ?? 'Errore eliminazione spesa');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <h1 className="text-2xl font-semibold mb-6">Spese (Expenses)</h1>

      {/* FORM */}
      <form
        onSubmit={handleCreate}
        className="bg-white shadow p-4 rounded mb-6 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <select
          className="border rounded px-3 py-2"
          value={propertyId}
          onChange={e => setPropertyId(e.target.value)}
          required
        >
          <option value="">Seleziona proprietà</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>
              {p.code} – {p.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Tipologia spesa"
          className="border rounded px-3 py-2"
          value={type}
          onChange={e => setType(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Descrizione"
          className="border rounded px-3 py-2 md:col-span-2"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        <input
          type="number"
          placeholder="Importo (€)"
          className="border rounded px-3 py-2"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          required
        />

        <input
          type="date"
          className="border rounded px-3 py-2"
          value={costDate}
          onChange={e => setCostDate(e.target.value)}
          required
        />

        <select
          className="border rounded px-3 py-2"
          value={scope}
          onChange={e => setScope(e.target.value as any)}
        >
          <option value="UNIT">Unità</option>
          <option value="BUILDING">Edificio</option>
        </select>

        <div className="md:col-span-2">
          <button className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-700">
            Crea Spesa
          </button>
        </div>
      </form>

      {/* LISTA */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg mb-3 font-medium">Lista spese</h2>

        {loading ? (
          <p>Caricamento...</p>
        ) : expenses.length === 0 ? (
          <p>Nessuna spesa presente.</p>
        ) : (
          <div className="space-y-3">
            {expenses.map(exp => {
              const prop = properties.find(p => p.id === exp.propertyId);

              return (
                <div key={exp.id} className="border rounded p-3 flex justify-between">
                  <div>
                    <div className="font-semibold">
                      {exp.type} – {exp.amount} €
                    </div>
                    <div className="text-sm text-slate-600">
                      {prop?.code} ({prop?.type}) · {exp.costDate}
                    </div>
                    <div className="text-xs text-slate-500">
                      Scope: {exp.scope || 'UNIT'}
                    </div>
                    {exp.description && (
                      <div className="text-xs text-slate-500 mt-1">
                        {exp.description}
                      </div>
                    )}
                  </div>

                  <button
                    className="text-red-600 hover:underline text-sm"
                    onClick={() => handleDelete(exp.id)}
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
