'use client';

import Link from 'next/link';

export default function HolderDashboard() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Reboutique – Dashboard Holder</h1>

      <p className="mb-4 text-gray-600">
        Benvenuto nella tua area gestionale.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <Link
          href="/properties"
          className="border rounded-lg p-6 shadow hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold mb-2">Immobili</h2>
          <p>Gestisci la lista completa delle proprietà disponibili.</p>
        </Link>

        <Link
          href="/tenants"
          className="border rounded-lg p-6 shadow hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold mb-2">Inquilini</h2>
          <p>Vedi inquilini attuali, incoming e passati.</p>
        </Link>

        <Link
          href="/leases"
          className="border rounded-lg p-6 shadow hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold mb-2">Contratti</h2>
          <p>Crea e gestisci i contratti di locazione.</p>
        </Link>

        <Link
          href="/payments"
          className="border rounded-lg p-6 shadow hover:bg-gray-50"
        >
          <h2 className="text-xl font-semibold mb-2">Pagamenti</h2>
          <p>Monitora canoni, scadenze e pagamenti in ritardo.</p>
        </Link>
      </div>
    </div>
  );
}
