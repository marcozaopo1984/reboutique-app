'use client';

import { useMemo, useState } from 'react';

// Reset to the first page as soon as filtering, sorting, or refreshed data changes
// the list, without an effect that would first render a stale page.
export function usePaginatedItems<T>(items: T[], pageSize = 50) {
  const [selection, setSelection] = useState({ items, page: 1 });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = selection.items === items ? Math.min(selection.page, pageCount) : 1;
  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return {
    pageItems,
    page,
    pageCount,
    total: items.length,
    pageSize,
    onPageChange: (nextPage: number) =>
      setSelection({ items, page: Math.max(1, Math.min(nextPage, pageCount)) }),
  };
}

type Props = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export default function ListPagination({ page, pageCount, total, pageSize, onPageChange }: Props) {
  if (total <= pageSize) return null;

  return (
    <nav aria-label="Pagine elenco" className="my-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span aria-live="polite" className="text-slate-500">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} di {total} · Pagina {page} di {pageCount}
      </span>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
          Precedente
        </button>
        <button type="button" className="btn-secondary" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>
          Successiva
        </button>
      </div>
    </nav>
  );
}
