'use client';

import React, { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';

type Property = {
  id: string;
  title: string;
  description: string;
  city: string;
  price: number;
  operationType: 'RENT' | 'SALE';
};

export default function SearchPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [city, setCity] = useState('');
  const [operationType, setOperationType] = useState<'RENT' | 'SALE' | ''>('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (city) params.set('city', city);
      if (operationType) params.set('operationType', operationType);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);

      const query = params.toString();
      const data = await fetchWithAuth(
        `/public/properties${query ? `?${query}` : ''}`,
      );
      setProperties(data);
    } catch (err: any) {
      setError(err.message ?? 'Error loading properties');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // prima load senza filtri
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Trova casa</h1>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-sm">Città</label>
          <input
            className="border px-2 py-1 rounded"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm">Tipo</label>
          <select
            className="border px-2 py-1 rounded"
            value={operationType}
            onChange={(e) => setOperationType(e.target.value as any)}
          >
            <option value="">Tutti</option>
            <option value="RENT">Affitto</option>
            <option value="SALE">Vendita</option>
          </select>
        </div>
        <div>
          <label className="block text-sm">Prezzo min</label>
          <input
            type="number"
            className="border px-2 py-1 rounded"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm">Prezzo max</label>
          <input
            type="number"
            className="border px-2 py-1 rounded"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
        <button
          onClick={load}
          className="px-3 py-1 border rounded bg-blue-500 text-white"
          disabled={loading}
        >
          Cerca
        </button>
      </div>

      {error && <div className="text-red-500 text-sm">{error}</div>}
      {loading && <div>Caricamento...</div>}

      <div className="space-y-2">
        {properties.map((p) => (
          <div key={p.id} className="border rounded p-2">
            <div className="font-semibold">
              {p.title} – {p.city}
            </div>
            <div className="text-sm text-gray-600">
              {p.operationType === 'RENT' ? 'Affitto' : 'Vendita'} – {p.price} €
            </div>
            <div className="text-sm mt-1">{p.description}</div>
          </div>
        ))}
        {!loading && properties.length === 0 && (
          <div className="text-sm text-gray-500">
            Nessun immobile trovato con questi filtri.
          </div>
        )}
      </div>
    </div>
  );
}
