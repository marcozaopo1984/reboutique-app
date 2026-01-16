'use client';

import { useEffect, useState, FormEvent } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';

type Property = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type ExpenseStatus = 'PLANNED' | 'PAID' | 'OVERDUE';

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

  // ✅ nuovi campi
  status?: ExpenseStatus;
  paidDate?: string;

  notes?: string;
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

  // ✅ nuovi stati form
  const [status, setStatus] = useState<ExpenseStatus>('PLANNED');
  const [paidDate, setPaidDate] = useState(''); // opzionale

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [props, exps] = await Promise.all([
        fetchWithAuth('/properties'),
        fetchWithAuth('/expenses'),
      ]);

      setProperties(Array.isArray(props) ? props : []);
      setExpenses(Array.isArray(exps) ? exps : []);
    } catch (err: any) {
      setError(err?.message ?? 'Errore caricamento spese');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // se l'utente mette status=PAID e paidDate vuota, la settiamo automaticamente a oggi al submit
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const resetForm = () => {
    setPropertyId('');
    setType('');
    setDescription('');
    setAmount('');
    setCostDate('');
    setScope('UNIT');
    setStatus('PLANNED');
    setPaidDate('');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const body: any = {
        propertyId,
        type,
        description: description || undefined,
        amount: Number(amount),
        currency: 'EUR',
        costDate,
        scope,

        // ✅ nuovi campi
        status,
        paidDate: status === 'PAID' ? (paidDate || todayISO()) : undefined,
      };

      await fetchWithAuth('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err?.message ?? 'Errore creazione spesa');
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await fetchWithAuth(`/expenses/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (err: any) {
      setError(err?.message ?? 'Errore eliminazione spesa');
    }
  };

  const setExpenseStatus = async (id: string, newStatus: ExpenseStatus) => {
    setError(null);
    try {
      const body =
        newStatus === 'PAID'
          ? { status: 'PAID', paidDate: todayISO() }
          : { status: newStatus, paidDate: undefined };

      await fetchWithAuth(`/expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      await loadData();
    } catch (err: any) {
      setError(err?.message ?? 'Errore aggiornamento status');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <h1 className="text-2xl font-semibold mb-6">Spese (Expenses)</h1>

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
        <select
          className="border rounded px-3 py-2"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          required
        >
          <option value="">Seleziona proprietà</option>
          {properties.map((p) => (
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
          onChange={(e) => setType(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Descrizione"
          className="border rounded px-3 py-2 md:col-span-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          type="number"
          placeholder="Importo (€)"
          className="border rounded px-3 py-2"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <input
          type="date"
          className="border rounded px-3 py-2"
          value={costDate}
          onChange={(e) => setCostDate(e.target.value)}
          required
        />

        <select
          className="border rounded px-3 py-2"
          value={scope}
          onChange={(e) => setScope(e.target.value as any)}
        >
          <option value="UNIT">Unità</option>
          <option value="BUILDING">Edificio</option>
        </select>

        {/* ✅ nuovo select status */}
        <select
          className="border rounded px-3 py-2"
          value={status}
          onChange={(e) => {
            const v = e.target.value as ExpenseStatus;
            setStatus(v);
            if (v !== 'PAID') setPaidDate('');
          }}
        >
          <option value="PLANNED">Da pagare</option>
          <option value="PAID">Pagata</option>
          <option value="OVERDUE">In ritardo</option>
        </select>

        {/* ✅ paidDate solo se PAID */}
        {status === 'PAID' ? (
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            placeholder="Data pagamento"
          />
        ) : (
          <div className="hidden md:block" />
        )}

        <div className="md:col-span-2 flex items-center gap-3">
          <button className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-700">
            Crea Spesa
          </button>
          <button
            type="button"
            className="border px-4 py-2 rounded hover:bg-slate-50"
            onClick={resetForm}
          >
            Reset
          </button>
        </div>
      </form>

      {/* LISTA */}
      <div className="bg-white p-4 rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Lista spese</h2>
          <button
            onClick={loadData}
            className="text-sm border rounded px-3 py-1 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p>Caricamento...</p>
        ) : expenses.length === 0 ? (
          <p>Nessuna spesa presente.</p>
        ) : (
          <div className="space-y-3">
            {expenses.map((exp) => {
              const prop = properties.find((p) => p.id === exp.propertyId);
              const expStatus = exp.status ?? 'PLANNED';

              return (
                <div key={exp.id} className="border rounded p-3 flex justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {exp.type} – {exp.amount} €
                    </div>
                    <div className="text-sm text-slate-600">
                      {prop?.code} ({prop?.type}) · {exp.costDate}
                    </div>
                    <div className="text-xs text-slate-500">
                      Scope: {exp.scope || 'UNIT'} — Stato: {expStatus}
                      {exp.paidDate ? ` — Pagata: ${exp.paidDate}` : ''}
                    </div>
                    {exp.description && (
                      <div className="text-xs text-slate-500 mt-1">
                        {exp.description}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      {expStatus !== 'PAID' && (
                        <button
                          className="text-sm border rounded px-3 py-1 hover:bg-slate-50"
                          onClick={() => setExpenseStatus(exp.id, 'PAID')}
                        >
                          Segna PAID
                        </button>
                      )}
                      {expStatus !== 'PLANNED' && (
                        <button
                          className="text-sm border rounded px-3 py-1 hover:bg-slate-50"
                          onClick={() => setExpenseStatus(exp.id, 'PLANNED')}
                        >
                          Segna PLANNED
                        </button>
                      )}
                    </div>

                    <button
                      className="text-red-600 hover:underline text-sm"
                      onClick={() => handleDelete(exp.id)}
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
