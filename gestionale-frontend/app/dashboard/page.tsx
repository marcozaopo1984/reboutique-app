'use client';

import Link from 'next/link';

const cards = [
  {
    href: '/properties',
    title: 'Immobili',
    description: 'Gestisci la lista completa delle proprietà disponibili e il mapping appartamenti / stanze.',
  },
  {
    href: '/tenants',
    title: 'Inquilini',
    description: 'Vedi inquilini attuali, incoming e passati con documenti e informazioni anagrafiche.',
  },
  {
    href: '/leases',
    title: 'Contratti',
    description: 'Crea e aggiorna i contratti di locazione, con schedule e costi accessori.',
  },
  {
    href: '/payments',
    title: 'Pagamenti',
    description: 'Monitora canoni, incassi, depositi e scadenze con vista Cassa e stato dei pagamenti.',
  },
  {
    href: '/expenses',
    title: 'Spese',
    description: 'Registra costi, rimborsi, spese ricorrenti e movimenti passivi legati ai contratti.',
  },
  {
    href: '/landlords',
    title: 'Proprietari',
    description: 'Gestisci anagrafiche proprietari, documenti e dati amministrativi.',
  },
  {
    href: '/breakeven-appartamenti',
    title: 'Breakeven Appartamenti',
    description: 'Riepilogo costi e ricavi per appartamento con margine mensile e punto di pareggio.',
  },
  {
    href: '/report-investitori',
    title: 'Report Investitori',
    description: 'Report IN / OUT in modalità Cassa o Competenza e redditività per appartamento.',
  },
];

export default function HolderDashboard() {
  return (
    <div className="app-shell">
      <div className="app-container space-y-6">
        <div className="surface-card p-6 md:p-7">
          <div className="max-w-3xl">
            <h1 className="page-title">Reboutique · Dashboard Holder</h1>
            <p className="page-subtitle">
              Accesso rapido alle viste principali del gestionale. Ogni modulo mantiene lo stesso stile operativo per inserimento, controllo e reportistica.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {cards.map((card) => (
            <Link key={card.href} href={card.href} className="dashboard-card">
              <h2 className="text-lg font-semibold text-slate-900">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
              <div className="mt-4 text-sm font-semibold text-slate-800">Apri vista →</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
