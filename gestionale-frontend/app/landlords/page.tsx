'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import EntityDocuments from '@/components/EntityDocuments';
import { Field, Input, Select } from '@/components/form/Field';

type Landlord = {
  id: string;

  name?: string;

  email?: string;
  phone?: string;

  taxCode?: string;
  vatNumber?: string;

  address?: string;
  notes?: string;

  status?: 'ACTIVE' | 'INACTIVE';
};

type CreateLandlordForm = {
  name: string;

  email: string;
  phone: string;

  taxCode: string;
  vatNumber: string;

  address: string;
  notes: string;

  status: 'ACTIVE' | 'INACTIVE';
};

const cleanStr = (s: string) => s.trim();

const emptyForm = (): CreateLandlordForm => ({
  name: '',
  email: '',
  phone: '',
  taxCode: '',
  vatNumber: '',
  address: '',
  notes: '',
  status: 'ACTIVE',
});

const landlordToForm = (l: Landlord): CreateLandlordForm => ({
  name: l.name ?? '',
  email: l.email ?? '',
  phone: l.phone ?? '',
  taxCode: l.taxCode ?? '',
  vatNumber: l.vatNumber ?? '',
  address: l.address ?? '',
  notes: l.notes ?? '',
  status: l.status ?? 'ACTIVE',
});

export default function LandlordsPage() {
  const [items, setItems] = useState<Landlord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openDocsId, setOpenDocsId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateLandlordForm>(emptyForm());

  const onChange = (key: keyof CreateLandlordForm, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const label = useMemo(() => {
    return (l: Landlord) => (l.name?.trim() ? l.name.trim() : l.id);
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
    setForm(emptyForm());
    setEditingId(null);
  };

  const buildPayload = () => {
    if (!cleanStr(form.name)) {
      throw new Error('Nome obbligatorio');
    }

    return {
      name: cleanStr(form.name),

      email: cleanStr(form.email) || undefined,
      phone: cleanStr(form.phone) || undefined,

      taxCode: cleanStr(form.taxCode) || undefined,
      vatNumber: cleanStr(form.vatNumber) || undefined,

      address: cleanStr(form.address) || undefined,
      notes: cleanStr(form.notes) || undefined,

      status: form.status || 'ACTIVE',
    };
  };

  const save = async () => {
    setError(null);

    let body: any;
    try {
      body = buildPayload();
    } catch (e: any) {
      setError(e?.message ?? 'Dati non validi');
      return;
    }

    setBusy(true);
    try {
      if (editingId) {
        await fetchWithAuth(`/landlords/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetchWithAuth('/landlords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      resetForm();
      await loadAll();
    } catch (e: any) {
      setError(
        e?.message ??
          (editingId ? 'Errore aggiornamento landlord' : 'Errore creazione landlord'),
      );
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (l: Landlord) => {
    setError(null);
    setEditingId(l.id);
    setForm(landlordToForm(l));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      await fetchWithAuth(`/landlords/${id}`, { method: 'DELETE' });
      setOpenDocsId((prev) => (prev === id ? null : prev));
      if (editingId === id) resetForm();
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore eliminazione landlord');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="app-container space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Landlords</h1>
            <p className="page-subtitle">Gestisci proprietari e documenti.</p>
          </div>

          <button
            onClick={loadAll}
            disabled={busy}
            className="btn-secondary text-sm"
          >
            Refresh
          </button>
        </header>

        {error && (
          <div className="alert-error">
            {error}
          </div>
        )}

        <div className="surface-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">
              {editingId ? 'Modifica landlord' : 'Nuovo landlord'}
            </h2>

            {editingId && (
              <div className="text-xs text-slate-500">ID in modifica: {editingId}</div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Nome" required>
              <Input
                value={form.name}
                onChange={(e: any) => onChange('name', e.target.value)}
                disabled={busy}
                placeholder="Ragione sociale / Nome"
              />
            </Field>

            <Field label="Status" required>
              <Select
                value={form.status}
                onChange={(e: any) => onChange('status', e.target.value)}
                disabled={busy}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </Select>
            </Field>

            <div className="hidden md:block" />

            <Field label="Email">
              <Input
                value={form.email}
                onChange={(e: any) => onChange('email', e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field label="Telefono">
              <Input
                value={form.phone}
                onChange={(e: any) => onChange('phone', e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field label="Codice fiscale">
              <Input
                value={form.taxCode}
                onChange={(e: any) => onChange('taxCode', e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field label="P.IVA">
              <Input
                value={form.vatNumber}
                onChange={(e: any) => onChange('vatNumber', e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field label="Indirizzo" className="md:col-span-2">
              <Input
                value={form.address}
                onChange={(e: any) => onChange('address', e.target.value)}
                disabled={busy}
                placeholder="Via..."
              />
            </Field>

            <Field label="Note" className="md:col-span-3">
              <Input
                value={form.notes}
                onChange={(e: any) => onChange('notes', e.target.value)}
                disabled={busy}
                placeholder="Note interne..."
              />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={busy}
              className="btn-primary"
            >
              {busy ? 'Salvataggio...' : editingId ? 'Aggiorna' : 'Create'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={busy}
              className="btn-secondary"
            >
              {editingId ? 'Annulla modifica' : 'Reset'}
            </button>
          </div>
        </div>

        <div className="surface-card p-5">
          <h2 className="font-medium mb-3">Elenco</h2>

          {loading ? (
            <div>Caricamento...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500">Nessun landlord.</div>
          ) : (
            <div className="space-y-2">
              {items.map((l) => {
                const docsOpen = openDocsId === l.id;
                const isEditingThis = editingId === l.id;

                return (
                  <div
                    key={l.id}
                    className={`border rounded-lg p-3 ${isEditingThis ? 'border-slate-800 bg-slate-50' : ''}`}
                  >
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {label(l)}
                          {isEditingThis ? (
                            <span className="text-xs text-blue-600 ml-2">[in modifica]</span>
                          ) : null}
                        </div>

                        <div className="text-sm text-slate-600">
                          {l.email ? l.email : '-'}
                          {l.phone ? ` · ${l.phone}` : ''}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          status: {l.status ?? 'ACTIVE'}
                          {l.taxCode ? ` · cf: ${l.taxCode}` : ''}
                          {l.vatNumber ? ` · piva: ${l.vatNumber}` : ''}
                        </div>

                        {l.address && <div className="text-xs text-slate-500 mt-1">addr: {l.address}</div>}
                        {l.notes && <div className="text-xs text-slate-500 mt-1">note: {l.notes}</div>}

                        <div className="text-[11px] text-slate-400 mt-1">id: {l.id}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(l)}
                          disabled={busy}
                          className="btn-secondary text-sm"
                        >
                          Modifica
                        </button>

                        <button
                          onClick={() => setOpenDocsId((prev) => (prev === l.id ? null : l.id))}
                          className="btn-secondary text-sm"
                          disabled={busy}
                        >
                          {docsOpen ? 'Chiudi documenti' : 'Documenti'}
                        </button>

                        <button
                          onClick={() => remove(l.id)}
                          disabled={busy}
                          className="text-link-danger disabled:opacity-50"
                        >
                          Elimina
                        </button>
                      </div>
                    </div>

                    {docsOpen && (
                      <div className="mt-3">
                        <EntityDocuments
                          entityKind="landlords"
                          entityId={l.id}
                          label={`Documenti landlord (${label(l)})`}
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
