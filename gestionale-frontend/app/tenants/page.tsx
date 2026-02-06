'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import EntityDocuments from '@/components/EntityDocuments';
import { Field, Input, Select } from '@/components/form/Field';

type TenantStatus = 'CURRENT' | 'INCOMING' | 'PAST' | 'PENDING';
type Gender = 'M' | 'F' | 'OTHER';

type Tenant = {
  id: string;

  firstName?: string;
  lastName?: string;

  email?: string;
  phone?: string;

  birthday?: string; // YYYY-MM-DD
  nationality?: string;
  euCitizen?: boolean;
  gender?: Gender;

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
  gender: '' | Gender;

  address: string;
  taxCode: string;

  documentType: string;
  documentNumber: string;

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

  // docs
  const [openDocsId, setOpenDocsId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateTenantForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthday: '',
    nationality: '',
    euCitizen: '',
    gender: '',
    address: '',
    taxCode: '',
    documentType: '',
    documentNumber: '',
    school: '',
    status: 'CURRENT',
    notes: '',
  });

  const onChange = (key: keyof CreateTenantForm, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const fullName = useMemo(() => {
    return (t: Tenant) => `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim() || t.id;
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/tenants');
      setItems(Array.isArray(res) ? res : []);
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
      address: '',
      taxCode: '',
      documentType: '',
      documentNumber: '',
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

      address: cleanStr(form.address) || undefined,
      taxCode: cleanStr(form.taxCode) || undefined,

      documentType: cleanStr(form.documentType) || undefined,
      documentNumber: cleanStr(form.documentNumber) || undefined,

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
      setOpenDocsId((prev) => (prev === id ? null : prev));
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Errore eliminazione tenant');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Tenants</h1>
            <p className="text-sm text-slate-600">Gestisci inquilini e documenti.</p>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Nome" required>
              <Input
                value={form.firstName}
                onChange={(e: any) => onChange('firstName', e.target.value)}
                disabled={busy}
                placeholder="Mario"
              />
            </Field>

            <Field label="Cognome" required>
              <Input
                value={form.lastName}
                onChange={(e: any) => onChange('lastName', e.target.value)}
                disabled={busy}
                placeholder="Rossi"
              />
            </Field>

            <Field label="Stato" required>
              <Select
                value={form.status}
                onChange={(e: any) => onChange('status', e.target.value as TenantStatus)}
                disabled={busy}
              >
                <option value="CURRENT">CURRENT</option>
                <option value="INCOMING">INCOMING</option>
                <option value="PAST">PAST</option>
                <option value="PENDING">PENDING</option>
              </Select>
            </Field>

            <Field label="Email">
              <Input
                value={form.email}
                onChange={(e: any) => onChange('email', e.target.value)}
                disabled={busy}
                placeholder="mail@..."
              />
            </Field>

            <Field label="Telefono">
              <Input
                value={form.phone}
                onChange={(e: any) => onChange('phone', e.target.value)}
                disabled={busy}
                placeholder="+39..."
              />
            </Field>

            <Field label="Data di nascita">
              <Input
                type="date"
                value={form.birthday}
                onChange={(e: any) => onChange('birthday', e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field label="Nazionalità">
              <Input
                value={form.nationality}
                onChange={(e: any) => onChange('nationality', e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field label="Cittadino UE">
              <Select
                value={form.euCitizen}
                onChange={(e: any) => onChange('euCitizen', e.target.value)}
                disabled={busy}
              >
                <option value="">(non specificato)</option>
                <option value="yes">Sì</option>
                <option value="no">No</option>
              </Select>
            </Field>

            <Field label="Genere">
              <Select
                value={form.gender}
                onChange={(e: any) => onChange('gender', e.target.value as any)}
                disabled={busy}
              >
                <option value="">(non specificato)</option>
                <option value="M">M</option>
                <option value="F">F</option>
                <option value="OTHER">OTHER</option>
              </Select>
            </Field>

            <Field label="Scuola">
              <Input
                value={form.school}
                onChange={(e: any) => onChange('school', e.target.value)}
                disabled={busy}
                placeholder="IED, NABA..."
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

            <Field label="Codice fiscale">
              <Input
                value={form.taxCode}
                onChange={(e: any) => onChange('taxCode', e.target.value)}
                disabled={busy}
              />
            </Field>

            <Field label="Tipo documento">
              <Input
                value={form.documentType}
                onChange={(e: any) => onChange('documentType', e.target.value)}
                disabled={busy}
                placeholder="Carta identità, Passaporto..."
              />
            </Field>

            <Field label="Numero documento">
              <Input
                value={form.documentNumber}
                onChange={(e: any) => onChange('documentNumber', e.target.value)}
                disabled={busy}
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
                const docsOpen = openDocsId === t.id;

                return (
                  <div key={t.id} className="border rounded-lg p-3">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {fullName(t)}
                          {t.school ? <span className="text-xs text-slate-500"> · {t.school}</span> : null}
                        </div>

                        <div className="text-sm text-slate-600">
                          {t.email ? t.email : '-'}
                          {t.phone ? ` · ${t.phone}` : ''}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          status: {t.status ?? 'CURRENT'}
                          {t.nationality ? ` · ${t.nationality}` : ''}
                          {typeof t.euCitizen === 'boolean' ? ` · UE: ${t.euCitizen ? 'Sì' : 'No'}` : ''}
                          {t.birthday ? ` · nascita: ${t.birthday}` : ''}
                          {t.gender ? ` · gender: ${t.gender}` : ''}
                        </div>

                        {(t.documentType || t.documentNumber) && (
                          <div className="text-xs text-slate-500 mt-1">
                            doc: {t.documentType ?? '-'} {t.documentNumber ? `· ${t.documentNumber}` : ''}
                          </div>
                        )}

                        {t.taxCode && <div className="text-xs text-slate-500 mt-1">cf: {t.taxCode}</div>}
                        {t.address && <div className="text-xs text-slate-500 mt-1">addr: {t.address}</div>}
                        {t.notes && <div className="text-xs text-slate-500 mt-1">note: {t.notes}</div>}

                        <div className="text-[11px] text-slate-400 mt-1">id: {t.id}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setOpenDocsId((prev) => (prev === t.id ? null : t.id))}
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
                          label={`Documenti tenant (${fullName(t)})`}
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
