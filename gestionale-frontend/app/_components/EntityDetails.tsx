'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { detailFields, detailTitles } from './entityDetailFields';
import type { EntityKind, DetailField } from './entityDetailFields';

// Keep list state mounted while details are displayed.
export function useEntityDetails<T extends { id: string }>() {
  const [selected, setSelected] = useState<T | null>(null);
  const origin = useRef<{ y: number; element: HTMLElement | null }>({ y: 0, element: null });
  const open = (item: T, element?: HTMLElement) => {
    origin.current = { y: window.scrollY, element: element ?? (document.activeElement as HTMLElement | null) };
    setSelected(item);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const close = () => {
    setSelected(null);
    requestAnimationFrame(() => {
      origin.current.element?.focus({ preventScroll: true });
      window.scrollTo({ top: origin.current.y, behavior: 'instant' });
    });
  };
  const cardProps = (item: T, disabled: boolean) => ({
    onClick: (event: MouseEvent<HTMLDivElement>) => {
      if (disabled || !(event.target instanceof Element)) return;
      if (event.target.closest('button, a, input, select, textarea, label, [role="button"], [data-detail-ignore]')) return;
      if (window.getSelection()?.toString()) return;
      open(item, event.currentTarget.querySelector<HTMLButtonElement>('[data-detail-open]') ?? undefined);
    },
  });
  return { selected, open, close, clear: () => setSelected(null), cardProps };
}

export function formatDetailValue(value: unknown, field: DetailField, currency = 'EUR'): string {
  if (value === undefined || value === null || value === '') return '—';
  if (field.format === 'date') {
    let date: string | undefined;
    if (typeof value === 'string') date = value.slice(0, 10);
    else if (value instanceof Date && !Number.isNaN(value.getTime())) date = value.toISOString().slice(0, 10);
    else if (typeof value === 'object') {
      const timestamp = value as { _seconds?: number; seconds?: number; toDate?: () => Date };
      const seconds = timestamp._seconds ?? timestamp.seconds;
      const d = typeof timestamp.toDate === 'function' ? timestamp.toDate() :
        typeof seconds === 'number' ? new Date(seconds * 1000) : undefined;
      if (d && !Number.isNaN(d.getTime())) date = d.toISOString().slice(0, 10);
    }
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date.split('-').reverse().join('/');
    return typeof value === 'string' ? value : '—';
  }
  if (typeof value === 'boolean') return value ? 'Sì' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : '—';
  if (field.format === 'money') {
    const amount = Number(value);
    if (Number.isFinite(amount)) {
      try { return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount); }
      catch { return `${amount.toLocaleString('it-IT')} ${currency}`; }
    }
  }
  return String(value);
}

export default function EntityDetails({ kind, item, labels = {}, onClose, onEdit, busy }: {
  kind: EntityKind;
  item: object & { id: string };
  labels?: Record<string, Map<string, string>>;
  onClose: () => void;
  onEdit: () => void;
  busy: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  const record = item as Record<string, unknown>;
  return (
    <section className="app-container space-y-6" aria-labelledby="entity-details-title">
      <div className="surface-card p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 id="entity-details-title" ref={heading} tabIndex={-1} className="page-title">{detailTitles[kind]}</h1>
            <p className="page-subtitle">Visualizzazione in sola lettura</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">← Torna alla lista</button>
            <button type="button" onClick={onEdit} disabled={busy} className="btn-primary">Modifica</button>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {detailFields[kind].filter(field => !field.optional || record[field.key] != null).map(field => {
            const raw = record[field.key];
            const label = typeof raw === 'string' ? labels[field.key]?.get(raw) : undefined;
            const value = label && label !== raw ? `${label} (${raw})` :
              formatDetailValue(raw, field, typeof record.currency === 'string' && record.currency ? record.currency : 'EUR');
            const link = field.format === 'url' && typeof raw === 'string' && /^https?:\/\//i.test(raw.trim());
            return (
              <div key={field.key} className={field.key === 'notes' || field.key === 'description' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                <dt className="text-sm font-semibold text-slate-500">{field.label}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">
                  {link ? <a className="underline text-blue-700" href={String(raw).trim()} target="_blank" rel="noopener noreferrer">{value}</a> : value}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
