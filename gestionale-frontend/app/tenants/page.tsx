'use client';

import { useEffect, useState, FormEvent } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebaseClient';
import { fetchWithAuth } from '../../lib/apiClient';
import { useRouter } from 'next/navigation';

interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();

  // stati del form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      setUserEmail(user.email ?? user.uid);

      try {
        const data = await fetchWithAuth('/tenants');
        setTenants(data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message ?? 'Error fetching tenants');
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const handleCreateTenant = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setFormError('First name e Last name sono obbligatori');
      return;
    }

    setSaving(true);
    try {
      const body = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      };

      const created: Tenant = await fetchWithAuth('/tenants', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      // aggiungo il nuovo tenant alla lista
      setTenants((prev) => [...prev, created]);

      // pulisco il form
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
    } catch (err: any) {
      setFormError(err.message ?? 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4">Loading tenants...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <p className="text-sm mb-2">
        Logged as: <strong>{userEmail}</strong>
      </p>
      <h1 className="text-2xl font-semibold mb-4">Tenants</h1>

      {/* FORM CREAZIONE */}
      <div className="mb-6 border rounded-md p-4 bg-slate-50">
        <h2 className="text-lg font-semibold mb-3">Add new tenant</h2>
        <form onSubmit={handleCreateTenant} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm mb-1">First name *</label>
            <input
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Last name *</label>
            <input
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Phone</label>
            <input
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="md:col-span-4 flex justify-end mt-1">
            <button
              type="submit"
              disabled={saving}
              className="border rounded-md px-4 py-1 text-sm disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save tenant'}
            </button>
          </div>
        </form>
        {formError && (
          <p className="text-red-500 text-sm mt-2">{formError}</p>
        )}
      </div>

      {/* TABELLA LISTA */}
      {tenants.length === 0 ? (
        <p>No tenants found.</p>
      ) : (
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="border px-2 py-1 text-left">Name</th>
              <th className="border px-2 py-1 text-left">Email</th>
              <th className="border px-2 py-1 text-left">Phone</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td className="border px-2 py-1">
                  {t.firstName} {t.lastName}
                </td>
                <td className="border px-2 py-1">{t.email ?? '-'}</td>
                <td className="border px-2 py-1">{t.phone ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
