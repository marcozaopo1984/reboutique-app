'use client';

import { useEffect, useMemo, useState } from 'react';
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

  // ✅ NEW
  apartmentId?: string;

  // (se lo usi nel backend / payments schedule)
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

  // ✅ NEW
  apartmentId: string;

  // opzionale
  buildingId: string;
};

const cleanStr = (s: string) => s.trim();
const toNum = (v: string) => {
  const s = cleanStr(v);
  return s === '' ? undefined : Number(s);
};

export default function PropertiesPage() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // quale property ha documenti aperti
  const [openDocsPropertyId, setOpenDocsPropertyId] = useState<string | null>(null);

  const [form, setForm] = useState<CreatePropertyForm>({
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

  const onChange = (key: keyof CreatePropertyForm, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const apartments = useMemo(() => {
    // tutte le properties di tipo APARTMENT
    return items.filter((p) => p.type === 'APARTMENT');
  }, [items]);

  const apartmentLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of apartments) {
      const code = a.code ?? a.id;
      const name = a.name ? ` – ${a.name}` : '';
      m.set(a.id, `${code}${name}`);
    }
    return m;
  }, [apartments]);

  const propertyLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of items) {
      const code = p.code ?? p.id;
      const name = p.name ? ` – ${p.name}` : '';
      m.set(p.id, `${code}${name}`);
    }
    return m;
  }, [items]);

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
    setForm({
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
  };

  const create = async () => {
    setError(null);

    if (!cleanStr(form.code)) return setError('Codice obbligatorio');
    if (!cleanStr(form.name)) return setError('Nome obbligatorio');

    // ✅ per ROOM/BED apartmentId obbligatorio
    if ((form.type === 'ROOM' || form.type === 'BED') && !form.apartmentId) {
      return setError('Seleziona apartmentId (appartamento) per ROOM/BED');
    }

    const baseMonthlyRent = toNum(form.baseMonthlyRent);
    if (baseMonthlyRent !== undefined && Number.isNaN(baseMonthlyRent)) return setError('baseMonthlyRent non valido');

    const monthlyUtilities = toNum(form.monthlyUtilities);
    if (monthlyUtilities !== undefined && Number.isNaN(monthlyUtilities)) return setError('monthlyUtilities non valido');

    const depositMonths = toNum(form.depositMonths);
    if (depositMonths !== undefined && Number.isNaN(depositMonths)) return setError('depositMonths non valido');

    const body: any = {
      code: cleanStr(form.code),
      name: cleanStr(form.name),
      address: cleanStr(form.address) || undefined,

      type: form.type,

      baseMonthlyRent,
      monthlyUtilities,
      depositMonths,

      isPublished: !!form.isPublished,

      buildingId: cleanStr(form.buildingId) || undefined,

      // ✅ invia apartmentId solo se non APARTMENT
      apartmentId: form.type === 'APARTMENT' ? undefined : form.apartmentId || undefined,
    };

    setBusy(true);
    try {
      await fetchWithAuth('/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      resetForm();
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore creazione property');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      await fetchWithAuth(`/properties/${id}`, { method: 'DELETE' });
      setOpenDocsPropertyId((prev) => (prev === id ? null : prev));
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore eliminazione property');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Properties</h1>
            <p className="text-sm text-slate-600">
              Gestisci immobili. Per ROOM/BED imposta anche l’<b>apartmentId</b> (appartamento contabile).
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
          <h2 className="font-medium">Nuova property</h2>

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
                    // se diventa APARTMENT, non serve apartmentId
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

            {(form.type === 'ROOM' || form.type === 'BED') ? (
              <Field label="ApartmentId (contabile)" required>
                <Select
                  value={form.apartmentId}
                  onChange={(e: any) => onChange('apartmentId', e.target.value)}
                  disabled={busy}
                >
                  <option value="">Seleziona appartamento *</option>
                  {apartments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {apartmentLabel.get(a.id) ?? a.id}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="ApartmentId (contabile)">
                <div className="h-10 flex items-center text-sm text-slate-500">
                  (APARTMENT: apartmentId = id)
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
            <div className="text-sm text-slate-500">Nessuna property.</div>
          ) : (
            <div className="space-y-2">
              {items.map((p) => {
                const docsOpen = openDocsPropertyId === p.id;

                const title = `${p.code ?? p.id}${p.name ? ` – ${p.name}` : ''}`;
                const aptText =
                  p.type === 'APARTMENT'
                    ? 'APARTMENT (contabile)'
                    : p.apartmentId
                      ? `apartmentId: ${apartmentLabel.get(p.apartmentId) ?? p.apartmentId}`
                      : 'apartmentId: (mancante)';

                return (
                  <div key={p.id} className="border rounded-lg p-3">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{title}</div>

                        <div className="text-sm text-slate-600">
                          {p.type ?? '-'} · {p.isPublished ? 'Pubblicato' : 'Non pubblicato'}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          {p.address ? `📍 ${p.address} · ` : ''}
                          {aptText}
                          {p.buildingId ? ` · buildingId: ${p.buildingId}` : ''}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          base: {p.baseMonthlyRent ?? '-'} € · utenze: {p.monthlyUtilities ?? '-'} € · deposito:{' '}
                          {p.depositMonths ?? '-'} mesi
                        </div>

                        <div className="text-[11px] text-slate-400 mt-1">id: {p.id}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setOpenDocsPropertyId((prev) => (prev === p.id ? null : p.id))}
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
