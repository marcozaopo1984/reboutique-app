'use client';

import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';

type Landlord = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  iban?: string;
  notes?: string;
  externalId?: string;
};

type CreateLandlordDto = Omit<Landlord, 'id'>;

export default function LandlordsPage() {
  const [items, setItems] = useState<Landlord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateLandlordDto>({
    name: '',
    email: '',
    phone: '',
    iban: '',
    notes: '',
    externalId: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await fetchWithAuth('/landlords')) as Landlord[];
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? 'Errore caricamento landlords');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onChange = (key: keyof CreateLandlordDto, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const create = async () => {
    setError(null);
    try {
      if (!form.name.trim()) {
        setError('Name obbligatorio');
        return;
      }
      await fetchWithAuth('/landlords', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          // pulizia campi vuoti
          email: form.email?.trim() || undefined,
          phone: form.phone?.trim() || undefined,
          iban: form.iban?.trim() || undefined,
          notes: form.notes?.trim() || undefined,
          externalId: form.externalId?.trim() || undefined,
        }),
      });
      setForm({ name: '', email: '', phone: '', iban: '', notes: '', externalId: '' });
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Errore creazione landlord');
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await fetchWithAuth(`/landlords/${id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Errore delete landlord');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Landlords</h1>
        </header>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <h2 className="font-medium">Nuovo landlord</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Name *"
              value={form.name}
              onChange={(e) => onChange('name', e.target.value)}
            />
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Email"
              value={form.email ?? ''}
              onChange={(e) => onChange('email', e.target.value)}
            />
            <input
              className="border rounded-md px-3 py-2"
              placeholder="Phone"
              value={form.phone ?? ''}
              onChange={(e) => onChange('phone', e.target.value)}
            />
            <input
              className="border rounded-md px-3 py-2"
              placeholder="IBAN"
              value={form.iban ?? ''}
              onChange={(e) => onChange('iban', e.target.value)}
            />
            <input
              className="border rounded-md px-3 py-2"
              placeholder="External ID (Excel)"
              value={form.externalId ?? ''}
              onChange={(e) => onChange('externalId', e.target.value)}
            />
            <input
              className="border rounded-md px-3 py-2 md:col-span-2"
              placeholder="Notes"
              value={form.notes ?? ''}
              onChange={(e) => onChange('notes', e.target.value)}
            />
          </div>

          <button onClick={create} className="border rounded-md px-4 py-2">
            Create
          </button>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-medium mb-3">Elenco</h2>

          {loading ? (
            <div>Caricamento...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-500">Nessun landlord.</div>
          ) : (
            <div className="space-y-2">
              {items.map((l) => (
                <div
                  key={l.id}
                  className="border rounded-lg p-3 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold">{l.name}</div>
                    <div className="text-sm text-slate-600">
                      {l.email ? `Email: ${l.email} · ` : ''}
                      {l.phone ? `Tel: ${l.phone} · ` : ''}
                      {l.iban ? `IBAN: ${l.iban}` : ''}
                    </div>
                    {l.externalId && (
                      <div className="text-xs text-slate-500 mt-1">
                        External ID: {l.externalId}
                      </div>
                    )}
                    {l.notes && <div className="text-sm mt-1">{l.notes}</div>}
                  </div>

                  <button
                    onClick={() => remove(l.id)}
                    className="border rounded-md px-3 py-2 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
