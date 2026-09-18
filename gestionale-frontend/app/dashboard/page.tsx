'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

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
    href: '/prezzi-e-disponibilita',
    title: 'Prezzi e disponibilità',
    description: 'Vista listino e disponibilità con filtri date, depositi, admin fee e dati portali per property.',
  },
  {
    href: '/report-investitori',
    title: 'Report Investitori',
    description: 'Report IN / OUT in modalità Cassa o Competenza e redditività per appartamento.',
  },
];

export default function HolderDashboard() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="app-shell">
      <div className="fixed right-5 top-5 z-50" ref={menuRef}>
        <button
          type="button"
          aria-label="Apri menu dashboard"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-5 w-5"
          >
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
            >
              <div className="text-sm font-semibold text-slate-900">Impostazioni</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                Account, password e gestione utenze.
              </div>
            </Link>
          </div>
        )}
      </div>

      <div className="app-container space-y-6">
        <div className="surface-card p-6 md:p-7">
          <div className="max-w-3xl pr-14">
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
