'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import EntityDocuments from '@/components/EntityDocuments';
import { Field, Input, Select } from '@/components/form/Field';

type PropertyType = 'APARTMENT' | 'ROOM' | 'BED';

type Property = {
  id: string;
  code?: string;
  name?: string;
  address?: string;
  type?: PropertyType;

  baseMonthlyRent?: number;
  monthlyUtilities?: number;
  depositMonths?: number;

  isPublished?: boolean;

  apartmentId?: string;
  buildingId?: string;
};

type CreatePropertyForm = {
  code: string;
  name: string;
  address: string;

  type: PropertyType;

  baseMonthlyRent: string;
  monthlyUtilities: string;
  depositMonths: string;

  isPublished: boolean;

  apartmentId: string;
  buildingId: string;
};

const cleanStr = (s: string) => s.trim();

const toNum = (v: string) => {
  const s = cleanStr(v);
  return s === '' ? undefined : Number(s);
};

const numToString = (v: number | undefined) =>
  v === undefined || v === null ? '' : String(v);

const emptyForm = (): CreatePropertyForm => ({
  code: '',
  name: '',
  address: '',
  type: 'ROOM',

  baseMonthlyRent: '',
  monthlyUtilities: '',
  depositMonths: '',

  isPublished: true,

  apartmentId: '',
  buildingId: '',
});

const propertyToForm = (p: Property): CreatePropertyForm => ({
  code: p.code ?? '',
  name: p.name ?? '',
  address: p.address ?? '',
  type: p.type ?? 'ROOM',

  baseMonthlyRent: numToString(p.baseMonthlyRent),
  monthlyUtilities: numToString(p.monthlyUtilities),
  depositMonths: numToString(p.depositMonths),

  isPublished: typeof p.isPublished === 'boolean' ? p.isPublished : true,

  apartmentId: p.apartmentId ?? '',
  buildingId: p.buildingId ?? '',
});

export default function PropertiesPage() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openDocsPropertyId, setOpenDocsPropertyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<CreatePropertyForm>(emptyForm());

  const onChange = (key: keyof CreatePropertyForm, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/properties');
      setItems(Array.isArray(res) ? res : []);
    } catch (e: any) {
      setError(e?.message ?? 'Errore caricamento properties');
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
    const baseMonthlyRent = toNum(form.baseMonthlyRent);
    if (baseMonthlyRent !== undefined && Number.isNaN(baseMonthlyRent)) {
      throw new Error('baseMonthlyRent non valido');
    }

    const monthlyUtilities = toNum(form.monthlyUtilities);
    if (monthlyUtilities !== undefined && Number.isNaN(monthlyUtilities)) {
      throw new Error('monthlyUtilities non valido');
    }

    const depositMonths = toNum(form.depositMonths);
    if (depositMonths !== undefined && Number.isNaN(depositMonths)) {
      throw new Error('depositMonths non valido');
    }

    if (!cleanStr(form.code)) throw new Error('Codice obbligatorio');
    if (!cleanStr(form.name)) throw new Error('Nome obbligatorio');

    if ((form.type === 'ROOM' || form.type === 'BED') && !cleanStr(form.apartmentId)) {
      throw new Error('Inserisci Apartment ID per ROOM/BED');
    }

    return {
      code: cleanStr(form.code),
      name: cleanStr(form.name),
      address: cleanStr(form.address) || undefined,

      type: form.type,

      baseMonthlyRent,
      monthlyUtilities,
      depositMonths,

      isPublished: !!form.isPublished,

      buildingId: cleanStr(form.buildingId) || undefined,
      apartmentId:
        form.type === 'APARTMENT' ? undefined : cleanStr(form.apartmentId) || undefined,
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
        await fetchWithAuth(`/properties/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetchWithAuth('/properties', {
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
          (editingId ? 'Errore aggiornamento property' : 'Errore creazione property'),
      );
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p: Property) => {
    setError(null);
    setEditingId(p.id);
    setForm(propertyToForm(p));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      await fetchWithAuth(`/properties/${id}`, { method: 'DELETE' });
      setOpenDocsPropertyId((prev) => (prev === id ? null : prev));
      if (editingId === id) resetForm();
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore eliminazione property');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="app-container space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Properties</h1>
            <p className="page-subtitle">
              Gestisci immobili. Per ROOM/BED imposta anche l’<b>Apartment ID</b>{' '}
              come stringa libera digitata a mano.
            </p>
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
              {editingId ? 'Modifica property' : 'Nuova property'}
            </h2>

            {editingId && (
              <div className="text-xs text-slate-500">ID in modifica: {editingId}</div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Codice" required>
              <Input
                value={form.code}
                onChange={(e: any) => onChange('code', e.target.value)}
                placeholder="Es. Beatrice-30-R1"
                disabled={busy}
              />
            </Field>

            <Field label="Nome" required>
              <Input
                value={form.name}
                onChange={(e: any) => onChange('name', e.target.value)}
                placeholder="Es. Room 1"
                disabled={busy}
              />
            </Field>

            <Field label="Indirizzo">
              <Input
                value={form.address}
                onChange={(e: any) => onChange('address', e.target.value)}
                placeholder="Via..."
                disabled={busy}
              />
            </Field>

            <Field label="BuildingId (opzionale)">
              <Input
                value={form.buildingId}
                onChange={(e: any) => onChange('buildingId', e.target.value)}
                placeholder="buildingId..."
                disabled={busy}
              />
            </Field>

            <Field label="Type" required>
              <Select
                value={form.type}
                onChange={(e: any) => {
                  const v = e.target.value as PropertyType;
                  setForm((prev) => ({
                    ...prev,
                    type: v,
                    apartmentId: v === 'APARTMENT' ? '' : prev.apartmentId,
                  }));
                }}
                disabled={busy}
              >
                <option value="APARTMENT">APARTMENT</option>
                <option value="ROOM">ROOM</option>
                <option value="BED">BED</option>
              </Select>
            </Field>

            {form.type === 'ROOM' || form.type === 'BED' ? (
              <Field label="Apartment ID" required>
                <Input
                  value={form.apartmentId}
                  onChange={(e: any) => onChange('apartmentId', e.target.value)}
                  placeholder="Es. Argentina 4"
                  disabled={busy}
                />
              </Field>
            ) : (
              <Field label="Apartment ID">
                <div className="h-10 flex items-center text-sm text-slate-500">
                  (APARTMENT: non richiesto)
                </div>
              </Field>
            )}

            <Field label="Canone base (€)">
              <Input
                type="number"
                value={form.baseMonthlyRent}
                onChange={(e: any) => onChange('baseMonthlyRent', e.target.value)}
                placeholder="1000"
                disabled={busy}
              />
            </Field>

            <Field label="Utenze mensili (€)">
              <Input
                type="number"
                value={form.monthlyUtilities}
                onChange={(e: any) => onChange('monthlyUtilities', e.target.value)}
                placeholder="100"
                disabled={busy}
              />
            </Field>

            <Field label="Deposito (mesi)">
              <Input
                type="number"
                value={form.depositMonths}
                onChange={(e: any) => onChange('depositMonths', e.target.value)}
                placeholder="2"
                disabled={busy}
              />
            </Field>

            <Field label="Pubblicato (visibile ai tenants)">
              <label className="flex items-center gap-2 h-10">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => onChange('isPublished', e.target.checked)}
                  disabled={busy}
                />
                <span className="text-sm text-slate-700">
                  {form.isPublished ? 'Sì' : 'No'}
                </span>
              </label>
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
            <div className="text-sm text-slate-500">Nessuna property.</div>
          ) : (
            <div className="space-y-2">
              {items.map((p) => {
                const docsOpen = openDocsPropertyId === p.id;
                const isEditingThis = editingId === p.id;

                const title = `${p.code ?? p.id}${p.name ? ` – ${p.name}` : ''}`;
                const aptText =
                  p.type === 'APARTMENT'
                    ? 'APARTMENT'
                    : p.apartmentId
                      ? `Apartment ID: ${p.apartmentId}`
                      : 'Apartment ID: (mancante)';

                return (
                  <div
                    key={p.id}
                    className={`border rounded-lg p-3 ${isEditingThis ? 'border-slate-800 bg-slate-50' : ''}`}
                  >
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {title}
                          {isEditingThis ? (
                            <span className="text-xs text-blue-600 ml-2">[in modifica]</span>
                          ) : null}
                        </div>

                        <div className="text-sm text-slate-600">
                          {p.type ?? '-'} · {p.isPublished ? 'Pubblicato' : 'Non pubblicato'}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          {p.address ? `📍 ${p.address} · ` : ''}
                          {aptText}
                          {p.buildingId ? ` · buildingId: ${p.buildingId}` : ''}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          base: {p.baseMonthlyRent ?? '-'} € · utenze: {p.monthlyUtilities ?? '-'} € ·
                          deposito: {p.depositMonths ?? '-'} mesi
                        </div>

                        <div className="text-[11px] text-slate-400 mt-1">id: {p.id}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(p)}
                          disabled={busy}
                          className="btn-secondary text-sm"
                        >
                          Modifica
                        </button>

                        <button
                          onClick={() =>
                            setOpenDocsPropertyId((prev) => (prev === p.id ? null : p.id))
                          }
                          className="btn-secondary text-sm"
                          disabled={busy}
                        >
                          {docsOpen ? 'Chiudi documenti' : 'Documenti'}
                        </button>

                        <button
                          onClick={() => remove(p.id)}
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
                          entityKind="properties"
                          entityId={p.id}
                          label={`Documenti property (${title})`}
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
