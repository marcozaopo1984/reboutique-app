'use client';

import { useEffect, useState, FormEvent } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';

type TenantStatus = 'CURRENT' | 'INCOMING' | 'PAST' | 'PENDING';

type Tenant = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  birthday?: string;
  nationality?: string;
  euCitizen?: boolean;
  gender?: 'M' | 'F' | 'OTHER';
  address?: string;
  taxCode?: string;
  documentType?: string;
  documentNumber?: string;
  school?: string;
  notes?: string;
  status?: TenantStatus;
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [nationality, setNationality] = useState('');
  const [euCitizen, setEuCitizen] = useState<boolean | null>(null);
  const [gender, setGender] = useState<'M' | 'F' | 'OTHER' | ''>('');
  const [school, setSchool] = useState('');
  const [status, setStatus] = useState<TenantStatus>('CURRENT');
  const [notes, setNotes] = useState('');

  const loadTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await fetchWithAuth('/tenants')) as Tenant[];
      setTenants(data);
    } catch (err: any) {
      setError(err.message ?? 'Errore nel caricamento inquilini');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const body: any = {
        firstName,
        lastName,
        email: email || undefined,
        phone: phone || undefined,
        birthday: birthday || undefined,
        nationality: nationality || undefined,
        school: school || undefined,
        status,
        notes: notes || undefined,
      };

      if (euCitizen !== null) {
        body.euCitizen = euCitizen;
      }
      if (gender) {
        body.gender = gender;
      }

      await fetchWithAuth('/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // reset form
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setBirthday('');
      setNationality('');
      setSchool('');
      setStatus('CURRENT');
      setEuCitizen(null);
      setGender('');
      setNotes('');

      await loadTenants();
    } catch (err: any) {
      setError(err.message ?? 'Errore nella creazione tenant');
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await fetchWithAuth(`/tenants/${id}`, {
        method: 'DELETE',
      });
      await loadTenants();
    } catch (err: any) {
      setError(err.message ?? 'Errore nella cancellazione tenant');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <header className="flex flex-col gap-2 mb-4">
          <h1 className="text-2xl font-semibold">
            Inquilini – Reboutique (Holder)
          </h1>
          <p className="text-sm text-slate-600">
            Gestisci gli inquilini (current, incoming, past, pending).
          </p>
        </header>

        {/* FORM CREAZIONE TENANT */}
        <section className="bg-white shadow rounded-lg p-4 mb-6">
          <h2 className="text-lg font-medium mb-3">
            Crea nuovo inquilino
          </h2>
          <form
            onSubmit={handleCreate}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <input
              type="text"
              placeholder="Nome"
              className="border rounded px-3 py-2"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Cognome"
              className="border rounded px-3 py-2"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="Email"
              className="border rounded px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="text"
              placeholder="Telefono"
              className="border rounded px-3 py-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <div className="flex flex-col">
              <label className="text-sm mb-1">Data di nascita</label>
              <input
                type="date"
                className="border rounded px-3 py-2"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
            </div>
            <input
              type="text"
              placeholder="Nazionalità"
              className="border rounded px-3 py-2"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
            />

            <div className="flex flex-col">
              <label className="text-sm mb-1">Cittadino UE</label>
              <select
                className="border rounded px-3 py-2"
                value={euCitizen === null ? '' : euCitizen ? 'yes' : 'no'}
                onChange={(e) => {
                  if (e.target.value === '') setEuCitizen(null);
                  else setEuCitizen(e.target.value === 'yes');
                }}
              >
                <option value="">Non specificato</option>
                <option value="yes">Sì</option>
                <option value="no">No</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-sm mb-1">Genere</label>
              <select
                className="border rounded px-3 py-2"
                value={gender}
                onChange={(e) =>
                  setGender(e.target.value as 'M' | 'F' | 'OTHER' | '')
                }
              >
                <option value="">Non specificato</option>
                <option value="M">M</option>
                <option value="F">F</option>
                <option value="OTHER">Altro</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Scuola (IED, NABA, ...)"
              className="border rounded px-3 py-2"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
            />

            <div className="flex flex-col">
              <label className="text-sm mb-1">Stato</label>
              <select
                className="border rounded px-3 py-2"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as TenantStatus)
                }
              >
                <option value="CURRENT">Current</option>
                <option value="INCOMING">Incoming</option>
                <option value="PAST">Past</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>

            <textarea
              placeholder="Note"
              className="border rounded px-3 py-2 md:col-span-3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <div className="md:col-span-3">
              <button
                type="submit"
                className="px-4 py-2 rounded bg-slate-800 text-white hover:bg-slate-700"
              >
                Salva inquilino
              </button>
            </div>
          </form>

          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
        </section>

        {/* LISTA TENANTS */}
        <section className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-medium mb-3">
            Lista inquilini
          </h2>

          {loading ? (
            <p>Caricamento...</p>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nessun inquilino presente.
            </p>
          ) : (
            <div className="space-y-3">
              {tenants.map((t) => (
                <div
                  key={t.id}
                  className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-semibold">
                      {t.firstName} {t.lastName}{' '}
                      {t.school && (
                        <span className="text-xs text-slate-500">
                          · {t.school}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600">
                      {t.email && <span>{t.email}</span>}
                      {t.email && t.phone && <span> · </span>}
                      {t.phone && <span>{t.phone}</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Stato: {t.status ?? 'CURRENT'}{' '}
                      {t.nationality && `· ${t.nationality}`}{' '}
                      {typeof t.euCitizen === 'boolean' &&
                        `· UE: ${t.euCitizen ? 'Sì' : 'No'}`}
                    </div>
                    {t.notes && (
                      <div className="text-xs text-slate-500 mt-1">
                        Note: {t.notes}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 md:mt-0">
                    <button
                      onClick={() => handleDelete(t.id)}
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
