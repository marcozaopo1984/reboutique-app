'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import EntityDocuments from '@/components/EntityDocuments';
import { Field, Input, Select } from '@/components/form/Field';

type TenantStatus = 'CURRENT' | 'INCOMING' | 'PAST' | 'PENDING';
type TenantGender = 'M' | 'F' | 'OTHER';

type Tenant = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  birthday?: string;
  nationality?: string;
  euCitizen?: boolean;
  gender?: TenantGender;
  address?: string;
  taxCode?: string;
  documentType?: string;
  documentNumber?: string;
  school?: string;
  notes?: string;
  status?: TenantStatus;
};

type CreateTenantForm = {
  firstName: string;
  lastName: string;

  email: string;
  phone: string;

  birthday: string;
  nationality: string;

  euCitizen: '' | 'yes' | 'no';
  gender: '' | TenantGender;

  school: string;
  status: TenantStatus;

  notes: string;
};

const cleanStr = (s: string) => s.trim();

export default function TenantsPage() {
  const [items, setItems] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // quale tenant ha documenti aperti
  const [openDocsTenantId, setOpenDocsTenantId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateTenantForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthday: '',
    nationality: '',
    euCitizen: '',
    gender: '',
    school: '',
    status: 'CURRENT',
    notes: '',
  });

  const onChange = (key: keyof CreateTenantForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const tenantLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of items) {
      const n = `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim();
      m.set(t.id, n || t.id);
    }
    return m;
  }, [items]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/tenants');
      setItems(Array.isArray(res) ? (res as Tenant[]) : []);
    } catch (e: any) {
      setError(e?.message ?? 'Errore caricamento tenants');
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
      birthday: '',
      nationality: '',
      euCitizen: '',
      gender: '',
      school: '',
      status: 'CURRENT',
      notes: '',
    });
  };

  const create = async () => {
    setError(null);

    if (!cleanStr(form.firstName)) return setError('Nome obbligatorio');
    if (!cleanStr(form.lastName)) return setError('Cognome obbligatorio');

    const body: any = {
      firstName: cleanStr(form.firstName),
      lastName: cleanStr(form.lastName),

      email: cleanStr(form.email) || undefined,
      phone: cleanStr(form.phone) || undefined,

      birthday: form.birthday || undefined,
      nationality: cleanStr(form.nationality) || undefined,

      school: cleanStr(form.school) || undefined,
      status: form.status,

      notes: cleanStr(form.notes) || undefined,
    };

    if (form.euCitizen === 'yes') body.euCitizen = true;
    if (form.euCitizen === 'no') body.euCitizen = false;

    if (form.gender) body.gender = form.gender;

    setBusy(true);
    try {
      await fetchWithAuth('/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      resetForm();
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore creazione tenant');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      await fetchWithAuth(`/tenants/${id}`, { method: 'DELETE' });
      setOpenDocsTenantId((prev) => (prev === id ? null : prev));
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore eliminazione tenant');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Tenants</h1>
            <p className="text-sm text-slate-600">Gestisci anagrafica inquilini e documenti.</p>
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
          <h2 className="font-medium">Nuovo tenant</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Nome" required>
              <Input
                value={form.firstName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('firstName', e.target.value)}
                disabled={busy}
                placeholder="Marco"
              />
            </Field>

            <Field label="Cognome" required>
              <Input
                value={form.lastName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('lastName', e.target.value)}
                disabled={busy}
                placeholder="Rossi"
              />
            </Field>

            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('email', e.target.value)}
                disabled={busy}
                placeholder="marco@email.com"
              />
            </Field>

            <Field label="Telefono">
              <Input
                value={form.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('phone', e.target.value)}
                disabled={busy}
                placeholder="+39..."
              />
            </Field>

            <Field label="Data di nascita">
              <Input
                type="date"
                value={form.birthday}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('birthday', e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field label="Nazionalità">
              <Input
                value={form.nationality}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('nationality', e.target.value)}
                disabled={busy}
                placeholder="IT"
              />
            </Field>

            <Field label="Cittadino UE">
              <Select
                value={form.euCitizen}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange('euCitizen', e.target.value)}
                disabled={busy}
              >
                <option value="">Non specificato</option>
                <option value="yes">Sì</option>
                <option value="no">No</option>
              </Select>
            </Field>

            <Field label="Genere">
              <Select
                value={form.gender}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange('gender', e.target.value)}
                disabled={busy}
              >
                <option value="">Non specificato</option>
                <option value="M">M</option>
                <option value="F">F</option>
                <option value="OTHER">Altro</option>
              </Select>
            </Field>

            <Field label="Scuola">
              <Input
                value={form.school}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('school', e.target.value)}
                disabled={busy}
                placeholder="IED / NABA / ..."
              />
            </Field>

            <Field label="Stato" required>
              <Select
                value={form.status}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange('status', e.target.value)}
                disabled={busy}
              >
                <option value="CURRENT">CURRENT</option>
                <option value="INCOMING">INCOMING</option>
                <option value="PAST">PAST</option>
                <option value="PENDING">PENDING</option>
              </Select>
            </Field>

            <div className="md:col-span-2">
              <Field label="Note">
                <Input
                  value={form.notes}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('notes', e.target.value)}
                  disabled={busy}
                  placeholder="Note interne..."
                />
              </Field>
            </div>
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
            <div className="text-sm text-slate-500">Nessun tenant.</div>
          ) : (
            <div className="space-y-2">
              {items.map((t) => {
                const docsOpen = openDocsTenantId === t.id;
                const name = `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim() || t.id;

                return (
                  <div key={t.id} className="border rounded-lg p-3">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{name}</div>

                        <div className="text-sm text-slate-600">
                          {(t.email ? t.email : '')}
                          {t.email && t.phone ? ' · ' : ''}
                          {(t.phone ? t.phone : '')}
                          {t.school ? ` · ${t.school}` : ''}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          Status: {t.status ?? 'CURRENT'}
                          {t.nationality ? ` · ${t.nationality}` : ''}
                          {typeof t.euCitizen === 'boolean' ? ` · UE: ${t.euCitizen ? 'Sì' : 'No'}` : ''}
                          {t.birthday ? ` · Nascita: ${t.birthday}` : ''}
                          {t.gender ? ` · Genere: ${t.gender}` : ''}
                        </div>

                        {t.notes && <div className="text-xs text-slate-500 mt-1">Note: {t.notes}</div>}

                        <div className="text-[11px] text-slate-400 mt-1">id: {t.id}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setOpenDocsTenantId((prev) => (prev === t.id ? null : t.id))}
                          className="border rounded-md px-3 py-2 text-sm"
                          disabled={busy}
                        >
                          {docsOpen ? 'Chiudi documenti' : 'Documenti'}
                        </button>

                        <button
                          onClick={() => remove(t.id)}
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
                          entityKind="tenants"
                          entityId={t.id}
                          label={`Documenti tenant (${tenantLabel.get(t.id) ?? t.id})`}
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
