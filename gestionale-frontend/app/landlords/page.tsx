'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import EntityDocuments from '@/components/EntityDocuments';
import { Field, Input, Select } from '@/components/form/Field';

type Landlord = {
  id: string;

  firstName?: string;
  lastName?: string;

  email?: string;
  phone?: string;

  companyName?: string;
  vatNumber?: string;

  address?: string;
  notes?: string;
};

type CreateLandlordForm = {
  firstName: string;
  lastName: string;

  email: string;
  phone: string;

  companyName: string;
  vatNumber: string;

  address: string;
  notes: string;
};

const cleanStr = (s: string) => s.trim();

export default function LandlordsPage() {
  const [items, setItems] = useState<Landlord[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // quale landlord ha documenti aperti
  const [openDocsId, setOpenDocsId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateLandlordForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    vatNumber: '',
    address: '',
    notes: '',
  });

  const onChange = (key: keyof CreateLandlordForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const labelName = useMemo(() => {
    return (x: Landlord) => {
      const n = `${x.firstName ?? ''} ${x.lastName ?? ''}`.trim();
      if (n) return n;
      if (x.companyName) return x.companyName;
      return x.id;
    };
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/landlords');
      setItems(Array.isArray(res) ? res : []);
    } catch (e: any) {
      setError(e?.message ?? 'Errore caricamento landlords');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const resetForm = () => {
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      companyName: '',
      vatNumber: '',
      address: '',
      notes: '',
    });
  };

  const create = async () => {
    setError(null);

    // Se nel tuo DTO firstName/lastName sono required, lasciali required qui:
    if (!cleanStr(form.firstName)) return setError('First name obbligatorio');
    if (!cleanStr(form.lastName)) return setError('Last name obbligatorio');

    const body: any = {
      firstName: cleanStr(form.firstName),
      lastName: cleanStr(form.lastName),

      email: cleanStr(form.email) || undefined,
      phone: cleanStr(form.phone) || undefined,

      companyName: cleanStr(form.companyName) || undefined,
      vatNumber: cleanStr(form.vatNumber) || undefined,

      address: cleanStr(form.address) || undefined,
      notes: cleanStr(form.notes) || undefined,
    };

    setBusy(true);
    try {
      await fetchWithAuth('/landlords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      resetForm();
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore creazione landlord');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      await fetchWithAuth(`/landlords/${id}`, { method: 'DELETE' });
      setOpenDocsId((prev) => (prev === id ? null : prev));
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore eliminazione landlord');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Landlords</h1>
            <p className="text-sm text-slate-600">Gestisci proprietari / locatori.</p>
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
          <h2 className="font-medium">Nuovo landlord</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="First name" required>
              <Input
                value={form.firstName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('firstName', e.target.value)}
                placeholder="Mario"
                disabled={busy}
              />
            </Field>

            <Field label="Last name" required>
              <Input
                value={form.lastName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('lastName', e.target.value)}
                placeholder="Rossi"
                disabled={busy}
              />
            </Field>

            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('email', e.target.value)}
                placeholder="mario@..."
                disabled={busy}
              />
            </Field>

            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('phone', e.target.value)}
                placeholder="+39..."
                disabled={busy}
              />
            </Field>

            <Field label="Company name">
              <Input
                value={form.companyName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('companyName', e.target.value)}
                placeholder="Rossi Srl"
                disabled={busy}
              />
            </Field>

            <Field label="VAT number">
              <Input
                value={form.vatNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('vatNumber', e.target.value)}
                placeholder="IT..."
                disabled={busy}
              />
            </Field>

            <Field label="Address">
              <Input
                value={form.address}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('address', e.target.value)}
                placeholder="Via ..."
                disabled={busy}
              />
            </Field>

            <Field label="Notes">
              <Input
                value={form.notes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('notes', e.target.value)}
                placeholder="Note interne..."
                disabled={busy}
              />
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
            <div className="text-sm text-slate-500">Nessun landlord.</div>
          ) : (
            <div className="space-y-2">
              {items.map((x) => {
                const docsOpen = openDocsId === x.id;

                return (
                  <div key={x.id} className="border rounded-lg p-3">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {labelName(x)}
                          {x.companyName ? ` · ${x.companyName}` : ''}
                        </div>

                        <div className="text-sm text-slate-600">
                          {x.email ? x.email : ''}
                          {x.email && x.phone ? ' · ' : ''}
                          {x.phone ? x.phone : ''}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          {x.vatNumber ? `VAT: ${x.vatNumber}` : ''}
                          {x.vatNumber && x.address ? ' · ' : ''}
                          {x.address ? x.address : ''}
                        </div>

                        {x.notes && (
                          <div className="text-xs text-slate-500 mt-1">Note: {x.notes}</div>
                        )}

                        <div className="text-[11px] text-slate-400 mt-1">id: {x.id}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setOpenDocsId((prev) => (prev === x.id ? null : x.id))}
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
                          entityKind="landlords"
                          entityId={x.id}
                          label={`Documenti landlord (${labelName(x)})`}
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
