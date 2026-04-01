'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import { formatDateIT } from '@/lib/dateFormat';
import { Field, Input, Select } from '@/components/form/Field';

type Mode = 'CASSA' | 'COMPETENZA';

type LeaseType = 'TENANT' | 'LANDLORD' | string;

type Property = {
  id: string;
  code?: string;
  name?: string;
  type?: string;
  apartmentId?: string;
};

type Lease = {
  id: string;
  type?: LeaseType;
  propertyId?: string;
  tenantId?: string;
  landlordId?: string;
  bookingDate?: any;
  startDate?: any;
  endDate?: any;
  depositDate?: any;
  adminFeeDate?: any;
  bookingCostDate?: any;
  registrationTaxDate?: any;
};

type Payment = {
  id: string;
  leaseId?: string;
  tenantId?: string;
  landlordId?: string;
  propertyId?: string;
  apartmentId?: string;
  dueDate?: any;
  paidDate?: any;
  amount?: number;
  kind?: string;
  status?: string;
};

type Expense = {
  id: string;
  leaseId?: string;
  tenantId?: string;
  landlordId?: string;
  propertyId?: string;
  costDate?: any;
  paidDate?: any;
  amount?: number;
  type?: string;
  status?: string;
};

type SummaryRowKey =
  | 'inquilini'
  | 'deposits'
  | 'adminFee'
  | 'bookingCost'
  | 'registrationTax'
  | 'bookingReceived'
  | 'totCanoni'
  | 'occupancy';

type SummaryRow = {
  key: SummaryRowKey;
  label: string;
  kind: 'count' | 'money' | 'percent' | 'blankable';
};

const SUMMARY_ROWS: SummaryRow[] = [
  { key: 'inquilini', label: 'Inquilini', kind: 'count' },
  { key: 'deposits', label: 'Deposits', kind: 'money' },
  { key: 'adminFee', label: 'Admin Fee', kind: 'money' },
  { key: 'bookingCost', label: 'Booking Cost', kind: 'blankable' },
  { key: 'registrationTax', label: 'Imposta di Registro', kind: 'blankable' },
  { key: 'bookingReceived', label: 'Booking Received', kind: 'count' },
  { key: 'totCanoni', label: 'Tot Canoni', kind: 'money' },
  { key: 'occupancy', label: 'Occupancy', kind: 'percent' },
];

const compareStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const todayYmdUtc = () => new Date().toISOString().slice(0, 10);

const toYmd = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v.length >= 10 ? v.slice(0, 10) : v;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  if (typeof v === 'object' && typeof v._seconds === 'number') {
    const d = new Date(v._seconds * 1000);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  if (typeof v === 'object' && typeof v.toDate === 'function') {
    const d = v.toDate();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return '';
};

const ymdToUtcDate = (ymd: string): Date | null => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const addDays = (date: Date, days: number) => {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const diffDays = (start: Date, end: Date) => {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / 86400000));
};

const overlapDays = (startA: Date, endA: Date, startB: Date, endB: Date) => {
  const start = new Date(Math.max(startA.getTime(), startB.getTime()));
  const end = new Date(Math.min(endA.getTime(), endB.getTime()));
  return diffDays(start, end);
};

const inRange = (ymd: string, from: string, to: string) => !!ymd && !!from && !!to && from <= ymd && ymd <= to;
const isPaid = (status?: string) => String(status ?? '').toUpperCase() === 'PAID';
const safeAmount = (n: any) => {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v : 0;
};

const paymentDateForMode = (p: Payment, mode: Mode) =>
  mode === 'CASSA' ? toYmd(p.paidDate) : toYmd(p.dueDate);

const expenseDateForMode = (e: Expense, mode: Mode) =>
  mode === 'CASSA' ? toYmd(e.paidDate) : toYmd(e.costDate);

const fmtMoney = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '—';
  return `${n.toFixed(2)} €`;
};

const fmtCount = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '—';
  return String(Math.round(n));
};

const fmtPct = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '—';
  return `${(n * 100).toFixed(1)}%`;
};

const fmtProfitability = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
};

const modeLabel = (mode: Mode) => (mode === 'CASSA' ? 'Cassa' : 'Competenza');

function getCycleBounds(currentDate: Date, orderedDates: Date[], index: number, leaseStart?: Date | null, leaseEnd?: Date | null) {
  const prev = index > 0 ? orderedDates[index - 1] : null;
  const next = index < orderedDates.length - 1 ? orderedDates[index + 1] : null;

  if (prev && prev.getTime() < currentDate.getTime()) {
    return { start: prev, end: currentDate };
  }

  if (leaseStart && leaseStart.getTime() < currentDate.getTime()) {
    return { start: leaseStart, end: currentDate };
  }

  if (next && currentDate.getTime() < next.getTime()) {
    return { start: currentDate, end: next };
  }

  if (leaseEnd && currentDate.getTime() < leaseEnd.getTime()) {
    return { start: currentDate, end: leaseEnd };
  }

  return { start: currentDate, end: addDays(currentDate, 1) };
}

export default function ReportInvestitoriPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState(todayYmdUtc().slice(0, 8) + '01');
  const [dateTo, setDateTo] = useState(todayYmdUtc());

  const [table1InMode, setTable1InMode] = useState<Mode>('CASSA');
  const [table1OutMode, setTable1OutMode] = useState<Mode>('COMPETENZA');
  const [table2ActiveMode, setTable2ActiveMode] = useState<Mode>('CASSA');
  const [table2PassiveMode, setTable2PassiveMode] = useState<Mode>('COMPETENZA');

  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [propertiesRes, leasesRes, paymentsRes, expensesRes] = await Promise.all([
        fetchWithAuth('/properties'),
        fetchWithAuth('/leases'),
        fetchWithAuth('/payments'),
        fetchWithAuth('/expenses'),
      ]);

      setProperties(Array.isArray(propertiesRes) ? propertiesRes : []);
      setLeases(Array.isArray(leasesRes) ? leasesRes : []);
      setPayments(Array.isArray(paymentsRes) ? paymentsRes : []);
      setExpenses(Array.isArray(expensesRes) ? expensesRes : []);
    } catch (e: any) {
      setError(e?.message ?? 'Errore caricamento report investitori');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const propertyLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) {
      const code = p.code ?? p.id;
      const name = p.name ? ` – ${p.name}` : '';
      m.set(p.id, `${code}${name}`);
    }
    return m;
  }, [properties]);

  const propertyToApartmentId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of properties) {
      if (p.type === 'APARTMENT') m.set(p.id, p.id);
      else if (p.apartmentId) m.set(p.id, p.apartmentId);
    }
    return m;
  }, [properties]);

  const apartmentIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of properties) {
      if (p.type === 'APARTMENT') set.add(p.id);
      if (p.apartmentId) set.add(p.apartmentId);
    }
    return Array.from(set).sort(compareStr);
  }, [properties]);

  const leaseById = useMemo(() => {
    const m = new Map<string, Lease>();
    for (const l of leases) m.set(l.id, l);
    return m;
  }, [leases]);

  const resolveApartmentIdFromPropertyId = (propertyId?: string) => {
    if (!propertyId) return '';
    return propertyToApartmentId.get(propertyId) ?? '';
  };

  const resolvePaymentApartmentId = (p: Payment) => {
    return p.apartmentId || resolveApartmentIdFromPropertyId(p.propertyId);
  };

  const resolveExpenseApartmentId = (e: Expense) => {
    const direct = resolveApartmentIdFromPropertyId(e.propertyId);
    if (direct) return direct;
    return e.propertyId ?? '';
  };

  const allTenantRentPaymentsByLease = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const p of payments) {
      if (!p.leaseId || p.kind !== 'RENT') continue;
      const lease = leaseById.get(p.leaseId);
      if (!lease || lease.type !== 'TENANT') continue;
      if (!map.has(p.leaseId)) map.set(p.leaseId, []);
      map.get(p.leaseId)!.push(p);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => compareStr(toYmd(a.dueDate), toYmd(b.dueDate)));
    }
    return map;
  }, [payments, leaseById]);

  const allLandlordRentExpensesByLease = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of expenses) {
      if (!e.leaseId || e.type !== 'RENT_TO_LANDLORD') continue;
      const lease = leaseById.get(e.leaseId);
      if (!lease || lease.type !== 'LANDLORD') continue;
      if (!map.has(e.leaseId)) map.set(e.leaseId, []);
      map.get(e.leaseId)!.push(e);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => compareStr(toYmd(a.costDate), toYmd(b.costDate)));
    }
    return map;
  }, [expenses, leaseById]);

  const rangeDates = useMemo(() => {
    const start = ymdToUtcDate(dateFrom);
    const end = ymdToUtcDate(dateTo);
    if (!start || !end || end.getTime() < start.getTime()) return null;
    return { start, end, endExclusive: addDays(end, 1) };
  }, [dateFrom, dateTo]);

  const totalUnitsCount = useMemo(() => properties.length || 0, [properties]);

  const sumPayments = (predicate: (p: Payment) => boolean, mode: Mode) =>
    payments.reduce((acc, p) => {
      if (!predicate(p)) return acc;
      if (mode === 'CASSA' && (!isPaid(p.status) || !toYmd(p.paidDate))) return acc;
      return acc + safeAmount(p.amount);
    }, 0);

  const sumExpenses = (predicate: (e: Expense) => boolean, mode: Mode) =>
    expenses.reduce((acc, e) => {
      if (!predicate(e)) return acc;
      if (mode === 'CASSA' && (!isPaid(e.status) || !toYmd(e.paidDate))) return acc;
      return acc + safeAmount(e.amount);
    }, 0);

  const computeRentTotalByMode = ({
    mode,
    side,
    apartmentId,
  }: {
    mode: Mode;
    side: 'IN' | 'OUT';
    apartmentId?: string;
  }) => {
    if (!rangeDates) return 0;

    if (mode === 'CASSA') {
      if (side === 'IN') {
        return payments.reduce((total, p) => {
          if (p.kind !== 'RENT') return total;
          const lease = p.leaseId ? leaseById.get(p.leaseId) : undefined;
          if (!lease || lease.type !== 'TENANT') return total;
          if (!isPaid(p.status)) return total;
          const paidYmd = toYmd(p.paidDate);
          if (!inRange(paidYmd, dateFrom, dateTo)) return total;
          if (apartmentId && resolvePaymentApartmentId(p) !== apartmentId) return total;
          return total + safeAmount(p.amount);
        }, 0);
      }

      return expenses.reduce((total, e) => {
        if (e.type !== 'RENT_TO_LANDLORD') return total;
        const lease = e.leaseId ? leaseById.get(e.leaseId) : undefined;
        if (!lease || lease.type !== 'LANDLORD') return total;
        if (!isPaid(e.status)) return total;
        const paidYmd = toYmd(e.paidDate);
        if (!inRange(paidYmd, dateFrom, dateTo)) return total;
        if (apartmentId && resolveExpenseApartmentId(e) !== apartmentId) return total;
        return total + safeAmount(e.amount);
      }, 0);
    }

    const reportStart = rangeDates.start;
    const reportEndExclusive = rangeDates.endExclusive;

    if (side === 'IN') {
      let total = 0;
      for (const [leaseId, leasePayments] of allTenantRentPaymentsByLease.entries()) {
        const lease = leaseById.get(leaseId);
        if (!lease) continue;
        const leaseStart = ymdToUtcDate(toYmd(lease.startDate));
        const leaseEnd = ymdToUtcDate(toYmd(lease.endDate));

        for (let i = 0; i < leasePayments.length; i += 1) {
          const p = leasePayments[i];
          const dueYmd = toYmd(p.dueDate);
          if (!inRange(dueYmd, dateFrom, dateTo)) continue;
          if (apartmentId && resolvePaymentApartmentId(p) !== apartmentId) continue;

          const dueDate = ymdToUtcDate(dueYmd);
          if (!dueDate) continue;

          const orderedDates = leasePayments
            .map((x) => ymdToUtcDate(toYmd(x.dueDate)))
            .filter((x): x is Date => !!x);

          const idx = orderedDates.findIndex((d) => d.getTime() === dueDate.getTime());
          const bounds = getCycleBounds(dueDate, orderedDates, idx >= 0 ? idx : i, leaseStart, leaseEnd);
          const denominator = diffDays(bounds.start, bounds.end);
          if (denominator <= 0) continue;

          const numerator = overlapDays(bounds.start, bounds.end, reportStart, reportEndExclusive);
          const fraction = Math.max(0, Math.min(1, numerator / denominator));
          total += safeAmount(p.amount) * fraction;
        }
      }
      return total;
    }

    let total = 0;
    for (const [leaseId, leaseExpenses] of allLandlordRentExpensesByLease.entries()) {
      const lease = leaseById.get(leaseId);
      if (!lease) continue;
      const leaseStart = ymdToUtcDate(toYmd(lease.startDate));
      const leaseEnd = ymdToUtcDate(toYmd(lease.endDate));

      for (let i = 0; i < leaseExpenses.length; i += 1) {
        const e = leaseExpenses[i];
        const costYmd = toYmd(e.costDate);
        if (!inRange(costYmd, dateFrom, dateTo)) continue;
        if (apartmentId && resolveExpenseApartmentId(e) !== apartmentId) continue;

        const costDate = ymdToUtcDate(costYmd);
        if (!costDate) continue;

        const orderedDates = leaseExpenses
          .map((x) => ymdToUtcDate(toYmd(x.costDate)))
          .filter((x): x is Date => !!x);

        const idx = orderedDates.findIndex((d) => d.getTime() === costDate.getTime());
        const bounds = getCycleBounds(costDate, orderedDates, idx >= 0 ? idx : i, leaseStart, leaseEnd);
        const denominator = diffDays(bounds.start, bounds.end);
        if (denominator <= 0) continue;

        const numerator = overlapDays(bounds.start, bounds.end, reportStart, reportEndExclusive);
        const fraction = Math.max(0, Math.min(1, numerator / denominator));
        total += safeAmount(e.amount) * fraction;
      }
    }
    return total;
  };

  const computeOccupancyAverage = () => {
    if (!rangeDates || totalUnitsCount <= 0) return null;
    const activeLeases = leases.filter((l) => l.type === 'TENANT');
    const totalDays = diffDays(rangeDates.start, rangeDates.endExclusive);
    if (totalDays <= 0) return null;

    let sumRatio = 0;
    for (let i = 0; i < totalDays; i += 1) {
      const day = addDays(rangeDates.start, i);
      const dayYmd = day.toISOString().slice(0, 10);
      const activeCount = activeLeases.filter((l) => {
        const start = toYmd(l.startDate);
        const end = toYmd(l.endDate);
        if (!start) return false;
        if (start > dayYmd) return false;
        if (end && end < dayYmd) return false;
        return true;
      }).length;
      sumRatio += activeCount / totalUnitsCount;
    }

    return sumRatio / totalDays;
  };

  const summaryValues = useMemo(() => {
    const empty = SUMMARY_ROWS.reduce<Record<SummaryRowKey, number | null>>((acc, row) => {
      acc[row.key] = null;
      return acc;
    }, {} as Record<SummaryRowKey, number | null>);

    if (!rangeDates) {
      return { inValues: { ...empty }, outValues: { ...empty } };
    }

    const occupancy = computeOccupancyAverage();

    const inValues: Record<SummaryRowKey, number | null> = {
      inquilini: leases.filter((l) => l.type === 'TENANT' && inRange(toYmd(l.startDate), dateFrom, dateTo)).length,
      deposits: sumPayments(
        (p) => {
          const lease = p.leaseId ? leaseById.get(p.leaseId) : undefined;
          if (p.kind === 'DEPOSIT') {
            return !!lease && lease.type === 'TENANT' && inRange(paymentDateForMode(p, table1InMode), dateFrom, dateTo);
          }
          if (p.kind === 'DEPOSIT_RETURN_FROM_LANDLORD') {
            return !!lease && lease.type === 'LANDLORD' && inRange(paymentDateForMode(p, table1InMode), dateFrom, dateTo);
          }
          return false;
        },
        table1InMode,
      ),
      adminFee: sumPayments(
        (p) => {
          const lease = p.leaseId ? leaseById.get(p.leaseId) : undefined;
          return p.kind === 'ADMIN_FEE' && !!lease && lease.type === 'TENANT' && inRange(paymentDateForMode(p, table1InMode), dateFrom, dateTo);
        },
        table1InMode,
      ),
      bookingCost: null,
      registrationTax: null,
      bookingReceived: leases.filter((l) => inRange(toYmd(l.bookingDate), dateFrom, dateTo)).length,
      totCanoni: computeRentTotalByMode({ mode: table1InMode, side: 'IN' }),
      occupancy,
    };

    const outValues: Record<SummaryRowKey, number | null> = {
      inquilini: leases.filter((l) => l.type === 'TENANT' && inRange(toYmd(l.endDate), dateFrom, dateTo)).length,
      deposits: sumExpenses(
        (e) =>
          (e.type === 'DEPOSIT_REFUND' || e.type === 'DEPOSIT_TO_LANDLORD') &&
          inRange(expenseDateForMode(e, table1OutMode), dateFrom, dateTo),
        table1OutMode,
      ),
      adminFee: sumExpenses(
        (e) => e.type === 'ADMIN_FEE_TO_LANDLORD' && inRange(expenseDateForMode(e, table1OutMode), dateFrom, dateTo),
        table1OutMode,
      ),
      bookingCost: sumExpenses(
        (e) => e.type === 'BOOKING_COST' && inRange(expenseDateForMode(e, table1OutMode), dateFrom, dateTo),
        table1OutMode,
      ),
      registrationTax: sumExpenses(
        (e) => e.type === 'REGISTRATION_TAX' && inRange(expenseDateForMode(e, table1OutMode), dateFrom, dateTo),
        table1OutMode,
      ),
      bookingReceived: null,
      totCanoni: computeRentTotalByMode({ mode: table1OutMode, side: 'OUT' }),
      occupancy: null,
    };

    return { inValues, outValues };
  }, [
    rangeDates,
    leases,
    payments,
    expenses,
    leaseById,
    dateFrom,
    dateTo,
    table1InMode,
    table1OutMode,
    totalUnitsCount,
    properties,
    allTenantRentPaymentsByLease,
    allLandlordRentExpensesByLease,
  ]);

  const apartmentRows = useMemo(() => {
    if (!rangeDates) {
      return [] as Array<{
        apartmentId: string;
        label: string;
        activeRent: number;
        passiveRent: number;
        profitability: number | null;
      }>;
    }

    return apartmentIds
      .map((apartmentId) => {
        const activeRent = computeRentTotalByMode({
          mode: table2ActiveMode,
          side: 'IN',
          apartmentId,
        });

        const passiveRent = computeRentTotalByMode({
          mode: table2PassiveMode,
          side: 'OUT',
          apartmentId,
        });

        const profitability = passiveRent > 0 ? activeRent / passiveRent - 1 : null;
        const label = propertyLabel.get(apartmentId) ?? apartmentId;

        return {
          apartmentId,
          label,
          activeRent,
          passiveRent,
          profitability,
        };
      })
      .sort((a, b) => compareStr(a.label, b.label));
  }, [rangeDates, apartmentIds, table2ActiveMode, table2PassiveMode, propertyLabel, payments, expenses, leases]);

  const renderSummaryCell = (row: SummaryRow, value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    if (row.key === 'occupancy') return fmtPct(value);
    if (row.key === 'inquilini' || row.key === 'bookingReceived') return fmtCount(value);
    return fmtMoney(value);
  };

  return (
    <div className="app-shell">
      <div className="app-container space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="page-title">Report Investitori</h1>
            <p className="page-subtitle">
              Report riepilogativo con doppia lettura Cassa / Competenza per flussi e redditività per appartamento.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Periodo selezionato: {formatDateIT(dateFrom)} → {formatDateIT(dateTo)}
            </p>
          </div>

          <button
            onClick={loadAll}
            disabled={busy}
            className="btn-secondary text-sm"
          >
            Refresh
          </button>
        </header>

        {error && (
          <div className="alert-error">
            {error}
          </div>
        )}

        <div className="surface-card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Date 1" required>
              <Input type="date" value={dateFrom} onChange={(e: any) => setDateFrom(e.target.value)} disabled={busy} />
            </Field>

            <Field label="Date 2" required>
              <Input type="date" value={dateTo} onChange={(e: any) => setDateTo(e.target.value)} disabled={busy} />
            </Field>

            <Field label="Tabella 1 · IN">
              <Select value={table1InMode} onChange={(e: any) => setTable1InMode(e.target.value as Mode)} disabled={busy}>
                <option value="CASSA">Cassa</option>
                <option value="COMPETENZA">Competenza</option>
              </Select>
            </Field>

            <Field label="Tabella 1 · OUT">
              <Select value={table1OutMode} onChange={(e: any) => setTable1OutMode(e.target.value as Mode)} disabled={busy}>
                <option value="CASSA">Cassa</option>
                <option value="COMPETENZA">Competenza</option>
              </Select>
            </Field>

            <Field label="Tabella 2 · Canoni Attivi">
              <Select value={table2ActiveMode} onChange={(e: any) => setTable2ActiveMode(e.target.value as Mode)} disabled={busy}>
                <option value="CASSA">Cassa</option>
                <option value="COMPETENZA">Competenza</option>
              </Select>
            </Field>

            <Field label="Tabella 2 · Canoni Passivi">
              <Select value={table2PassiveMode} onChange={(e: any) => setTable2PassiveMode(e.target.value as Mode)} disabled={busy}>
                <option value="CASSA">Cassa</option>
                <option value="COMPETENZA">Competenza</option>
              </Select>
            </Field>
          </div>

          <div className="text-xs text-slate-500">
            In modalità Competenza i Tot Canoni e i Canoni Attivi/Passivi sono ripartiti pro-quota sul periodo selezionato. In modalità Cassa, invece, viene conteggiato l’intero importo se il movimento è pagato nell’intervallo selezionato.
          </div>
        </div>

        <div className="surface-card p-5 overflow-x-auto">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-medium">Tabella 1 · Riepilogo</h2>
            <div className="text-sm text-slate-500">
              IN {modeLabel(table1InMode)} · OUT {modeLabel(table1OutMode)}
            </div>
          </div>

          {loading ? (
            <div>Caricamento...</div>
          ) : !rangeDates ? (
            <div className="text-sm text-red-600">Intervallo date non valido.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-3 font-medium">Voce</th>
                  <th className="text-right p-3 font-medium">IN · {modeLabel(table1InMode)}</th>
                  <th className="text-right p-3 font-medium">OUT · {modeLabel(table1OutMode)}</th>
                </tr>
              </thead>
              <tbody>
                {SUMMARY_ROWS.map((row) => (
                  <tr key={row.key} className="border-b last:border-b-0">
                    <td className="p-3 font-medium">{row.label}</td>
                    <td className="p-3 text-right">{renderSummaryCell(row, summaryValues.inValues[row.key])}</td>
                    <td className="p-3 text-right">{renderSummaryCell(row, summaryValues.outValues[row.key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="surface-card p-5 overflow-x-auto">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-medium">Tabella 2 · Appartamenti</h2>
            <div className="text-sm text-slate-500">
              Attivi {modeLabel(table2ActiveMode)} · Passivi {modeLabel(table2PassiveMode)}
            </div>
          </div>

          {loading ? (
            <div>Caricamento...</div>
          ) : !rangeDates ? (
            <div className="text-sm text-red-600">Intervallo date non valido.</div>
          ) : apartmentRows.length === 0 ? (
            <div className="text-sm text-slate-500">Nessun appartamento disponibile.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-3 font-medium">Apartment ID</th>
                  <th className="text-right p-3 font-medium">Canoni Attivi · {modeLabel(table2ActiveMode)}</th>
                  <th className="text-right p-3 font-medium">Canoni Passivi · {modeLabel(table2PassiveMode)}</th>
                  <th className="text-right p-3 font-medium">Redditività</th>
                </tr>
              </thead>
              <tbody>
                {apartmentRows.map((row) => (
                  <tr key={row.apartmentId} className="border-b last:border-b-0">
                    <td className="p-3">
                      <div className="font-medium">{row.label}</div>
                      <div className="text-xs text-slate-400">id: {row.apartmentId}</div>
                    </td>
                    <td className="p-3 text-right">{fmtMoney(row.activeRent)}</td>
                    <td className="p-3 text-right">{fmtMoney(row.passiveRent)}</td>
                    <td className="p-3 text-right">{fmtProfitability(row.profitability)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
