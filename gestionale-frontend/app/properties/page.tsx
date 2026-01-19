'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import EntityDocuments from '@/components/EntityDocuments';
import { Field, Input, Select } from '@/components/form/Field';

type PropertyType = 'APARTMENT' | 'ROOM' | 'BED';

type Property = {
  id: string;

  code: string;
  name: string;

  address?: string;
  type: PropertyType;

  apartment?: string;
  room?: string;

  beds?: number;
  roomSizeM2?: number;

  hasBalcony?: boolean;
  hasDryer?: boolean;
  hasAC?: boolean;
  hasHeating?: boolean;

  baseMonthlyRent?: number;
  monthlyUtilities?: number;
  depositMonths?: number;

  buildingId?: string;
  floor?: number;
  unitNumber?: string;

  websiteUrl?: string;
  airbnbUrl?: string;
  spotahomeUrl?: string;

  isPublished?: boolean;
};

type CreatePropertyForm = {
  code: string;
  name: string;
  address: string;
  type: PropertyType;

  apartment: string;
  room: string;

  beds: string;
  roomSizeM2: string;

  hasBalcony: boolean;
  hasDryer: boolean;
  hasAC: boolean;
  hasHeating: boolean;

  baseMonthlyRent: string;
  monthlyUtilities: string;
  depositMonths: string;

  buildingId: string;
  floor: string;
  unitNumber: string;

  websiteUrl: string;
  airbnbUrl: string;
  spotahomeUrl: string;

  isPublished: boolean;
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

  const [openDocsPropertyId, setOpenDocsPropertyId] = useState<string | null>(null);

  const [form, setForm] = useState<CreatePropertyForm>({
    code: '',
    name: '',
    address: '',
    type: 'ROOM',

    apartment: '',
    room: '',

    beds: '',
    roomSizeM2: '',

    hasBalcony: false,
    hasDryer: false,
    hasAC: false,
    hasHeating: false,

    baseMonthlyRent: '',
    monthlyUtilities: '',
    depositMonths: '',

    buildingId: '',
    floor: '',
    unitNumber: '',

    websiteUrl: '',
    airbnbUrl: '',
    spotahomeUrl: '',

    isPublished: true,
  });

  const onChange = (key: keyof CreatePropertyForm, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const propertyLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of items) {
      m.set(p.id, `${p.code} – ${p.name}`);
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

      apartment: '',
      room: '',

      beds: '',
      roomSizeM2: '',

      hasBalcony: false,
      hasDryer: false,
      hasAC: false,
      hasHeating: false,

      baseMonthlyRent: '',
      monthlyUtilities: '',
      depositMonths: '',

      buildingId: '',
      floor: '',
      unitNumber: '',

      websiteUrl: '',
      airbnbUrl: '',
      spotahomeUrl: '',

      isPublished: true,
    });
  };

  const create = async () => {
    setError(null);

    if (!cleanStr(form.code)) return setError('Code obbligatorio');
    if (!cleanStr(form.name)) return setError('Name obbligatorio');
    if (!form.type) return setError('Type obbligatorio');

    const body: any = {
      code: cleanStr(form.code),
      name: cleanStr(form.name),
      address: cleanStr(form.address) || undefined,
      type: form.type,

      apartment: cleanStr(form.apartment) || undefined,
      room: cleanStr(form.room) || undefined,

      beds: toNum(form.beds),
      roomSizeM2: toNum(form.roomSizeM2),

      hasBalcony: form.hasBalcony || undefined,
      hasDryer: form.hasDryer || undefined,
      hasAC: form.hasAC || undefined,
      hasHeating: form.hasHeating || undefined,

      baseMonthlyRent: toNum(form.baseMonthlyRent),
      monthlyUtilities: toNum(form.monthlyUtilities),
      depositMonths: toNum(form.depositMonths),

      buildingId: cleanStr(form.buildingId) || undefined,
      floor: toNum(form.floor),
      unitNumber: cleanStr(form.unitNumber) || undefined,

      websiteUrl: cleanStr(form.websiteUrl) || undefined,
      airbnbUrl: cleanStr(form.airbnbUrl) || undefined,
      spotahomeUrl: cleanStr(form.spotahomeUrl) || undefined,

      isPublished: !!form.isPublished,
    };

    // evita NaN
    for (const k of ['beds', 'roomSizeM2', 'baseMonthlyRent', 'monthlyUtilities', 'depositMonths', 'floor'] as const) {
      if (body[k] !== undefined && Number.isNaN(body[k])) return setError(`Valore numerico non valido: ${k}`);
    }

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
            <p className="text-sm text-slate-600">Gestisci immobili e documenti.</p>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Code" required>
              <Input
                value={form.code}
                onChange={(e: any) => onChange('code', e.target.value)}
                placeholder="Es: Cerva-3A"
                disabled={busy}
              />
            </Field>

            <Field label="Name" required>
              <Input
                value={form.name}
                onChange={(e: any) => onChange('name', e.target.value)}
                placeholder="Es: Cerva Stanza 3A"
                disabled={busy}
              />
            </Field>

            <Field label="Type" required>
              <Select
                value={form.type}
                onChange={(e: any) => onChange('type', e.target.value as PropertyType)}
                disabled={busy}
              >
                <option value="APARTMENT">APARTMENT</option>
                <option value="ROOM">ROOM</option>
                <option value="BED">BED</option>
              </Select>
            </Field>

            <Field label="Address">
              <Input
                value={form.address}
                onChange={(e: any) => onChange('address', e.target.value)}
                placeholder="Via..., Milano"
                disabled={busy}
              />
            </Field>

            <Field label="Apartment">
              <Input
                value={form.apartment}
                onChange={(e: any) => onChange('apartment', e.target.value)}
                placeholder="Es: 3"
                disabled={busy}
              />
            </Field>

            <Field label="Room">
              <Input
                value={form.room}
                onChange={(e: any) => onChange('room', e.target.value)}
                placeholder="Es: A"
                disabled={busy}
              />
            </Field>

            <Field label="Beds">
              <Input
                type="number"
                value={form.beds}
                onChange={(e: any) => onChange('beds', e.target.value)}
                placeholder="0"
                disabled={busy}
              />
            </Field>

            <Field label="Room size (m²)">
              <Input
                type="number"
                value={form.roomSizeM2}
                onChange={(e: any) => onChange('roomSizeM2', e.target.value)}
                placeholder="12"
                disabled={busy}
              />
            </Field>

            <Field label="BuildingId">
              <Input
                value={form.buildingId}
                onChange={(e: any) => onChange('buildingId', e.target.value)}
                placeholder="(opzionale)"
                disabled={busy}
              />
            </Field>

            <Field label="Floor">
              <Input
                type="number"
                value={form.floor}
                onChange={(e: any) => onChange('floor', e.target.value)}
                placeholder="0"
                disabled={busy}
              />
            </Field>

            <Field label="Unit number">
              <Input
                value={form.unitNumber}
                onChange={(e: any) => onChange('unitNumber', e.target.value)}
                placeholder="Es: 3A"
                disabled={busy}
              />
            </Field>

            <Field label="Base monthly rent (€)">
              <Input
                type="number"
                value={form.baseMonthlyRent}
                onChange={(e: any) => onChange('baseMonthlyRent', e.target.value)}
                placeholder="1000"
                disabled={busy}
              />
            </Field>

            <Field label="Monthly utilities (€)">
              <Input
                type="number"
                value={form.monthlyUtilities}
                onChange={(e: any) => onChange('monthlyUtilities', e.target.value)}
                placeholder="150"
                disabled={busy}
              />
            </Field>

            <Field label="Deposit months">
              <Input
                type="number"
                value={form.depositMonths}
                onChange={(e: any) => onChange('depositMonths', e.target.value)}
                placeholder="2"
                disabled={busy}
              />
            </Field>

            {/* CHECKBOXES */}
            <Field label="Amenities">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.hasBalcony}
                    onChange={(e) => onChange('hasBalcony', e.target.checked)}
                    disabled={busy}
                  />
                  Balcony
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.hasDryer}
                    onChange={(e) => onChange('hasDryer', e.target.checked)}
                    disabled={busy}
                  />
                  Dryer
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.hasAC}
                    onChange={(e) => onChange('hasAC', e.target.checked)}
                    disabled={busy}
                  />
                  AC
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.hasHeating}
                    onChange={(e) => onChange('hasHeating', e.target.checked)}
                    disabled={busy}
                  />
                  Heating
                </label>
              </div>
            </Field>

            <Field label="Published">
              <label className="flex items-center gap-2 h-10">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => onChange('isPublished', e.target.checked)}
                  disabled={busy}
                />
                <span className="text-sm text-slate-700">Visibile ai tenants</span>
              </label>
            </Field>

            <Field label="Website URL">
              <Input
                value={form.websiteUrl}
                onChange={(e: any) => onChange('websiteUrl', e.target.value)}
                placeholder="https://..."
                disabled={busy}
              />
            </Field>

            <Field label="Airbnb URL">
              <Input
                value={form.airbnbUrl}
                onChange={(e: any) => onChange('airbnbUrl', e.target.value)}
                placeholder="https://..."
                disabled={busy}
              />
            </Field>

            <Field label="Spotahome URL">
              <Input
                value={form.spotahomeUrl}
                onChange={(e: any) => onChange('spotahomeUrl', e.target.value)}
                placeholder="https://..."
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
            <div className="text-sm text-slate-500">Nessuna property.</div>
          ) : (
            <div className="space-y-2">
              {items.map((p) => {
                const docsOpen = openDocsPropertyId === p.id;

                return (
                  <div key={p.id} className="border rounded-lg p-3">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {p.code} – {p.name}
                        </div>

                        <div className="text-sm text-slate-600">
                          {p.type}
                          {p.address ? ` · ${p.address}` : ''}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          Rent: {p.baseMonthlyRent ?? '-'} € · Utilities: {p.monthlyUtilities ?? '-'} € · Deposit: {p.depositMonths ?? '-'} mesi
                          {typeof p.isPublished === 'boolean' ? ` · ${p.isPublished ? 'Pubblicato' : 'Non pubblicato'}` : ''}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          {p.apartment ? `Apt: ${p.apartment}` : ''}
                          {p.apartment && p.room ? ' · ' : ''}
                          {p.room ? `Room: ${p.room}` : ''}
                          {(p.apartment || p.room) && p.unitNumber ? ' · ' : ''}
                          {p.unitNumber ? `Unit: ${p.unitNumber}` : ''}
                          {(p.apartment || p.room || p.unitNumber) && (p.floor !== undefined) ? ' · ' : ''}
                          {p.floor !== undefined ? `Floor: ${p.floor}` : ''}
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
                          label={`Documenti property (${propertyLabel.get(p.id) ?? p.id})`}
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
