'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '@/lib/apiClient';
import { formatDateIT } from '@/lib/dateFormat';
import { Field, Input } from '@/components/form/Field';

type Property = {
  id: string;
  code?: string;
  name?: string;
  type?: string;
  apartmentId?: string;
  baseMonthlyRent?: number;
  monthlyUtilities?: number;
  depositMonths?: number;
  adminFeePortali?: number;
  balcony?: boolean;
  dryer?: boolean;
  bed?: string;
  ac?: string;
  heating?: string;
  roomSizeSqm?: number;
  linkSito?: string;
  airbnb?: string;
  spotahome?: string;
  studentCom?: string;
  inlife?: string;
  roomlala?: string;
  studentville?: string;
  spacest?: string;
  housinganywhere?: string;
  erasmusplay?: string;
};

type Lease = {
  id: string;
  type?: 'TENANT' | 'LANDLORD' | string;
  propertyId?: string;
  startDate?: any;
  endDate?: any;
  monthlyRentWithoutBills?: number;
  monthlyRentDiscounted?: boolean;
  monthlyRentWithBills?: number;
  billsIncludedAmount?: number;
  depositAmount?: number;
  depositDiscounted?: boolean;
  adminFeeAmount?: number;
};

type Payment = {
  id: string;
  leaseId?: string;
  kind?: string;
  amount?: number;
  discounted?: boolean;
};

type Expense = {
  id: string;
  leaseId?: string;
  type?: string;
  amount?: number;
  discounted?: boolean;
};

type InputState = {
  date1: string;
  date2: string;
  depositMonths: string;
  depositPlusMonths: string;
  adminFeePlus: string;
  pricesPlus: string;
  adminFeeMilanoHomePercentage: string;
  adminFeeMilanoHomeMonths: string;
  adminFeePartnerPercentage: string;
};

type Row = {
  property: Property;
  latestLease?: Lease;
  availableYmd: string;
  prices: number;
  pricesDiscounted: number | null;
  pricesPlus: number;
  monthlyUtilities: number;
  deposit: number;
  depositDiscounted: number | null;
  depositPlus: number;
  adminFee: number;
  adminFeePortali: number | null;
  adminFeePlus: number;
  adminFeePartner: number;
  adminFeeMilanoHome: number;
};

const cleanStr = (s: string) => (s ?? '').trim();

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

const toFiniteNumber = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const inputNumber = (v: string, fallback: number) => {
  const s = cleanStr(v).replace(',', '.');
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

const fmtMoney = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return n.toFixed(2);
};

const yesNo = (v?: boolean) => (v ? 'yes' : 'no');

const isInInclusiveRange = (ymd: string, from: string, to: string) => {
  if (!ymd || !from || !to) return false;
  return from <= ymd && ymd <= to;
};

const maxYmd = (values: string[]) => {
  const sorted = values.filter(Boolean).sort();
  return sorted.length ? sorted[sorted.length - 1] : '';
};

const normalizeUrl = (value?: string) => {
  const s = cleanStr(value ?? '');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return s;
};

const LinkCell = ({ value }: { value?: string }) => {
  const s = cleanStr(value ?? '');
  if (!s) return <span />;
  const href = normalizeUrl(s);
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="text-sky-700 underline break-all">
        {s}
      </a>
    );
  }
  return <span className="break-all">{s}</span>;
};

export default function PrezziDisponibilitaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [inputs, setInputs] = useState<InputState>({
    date1: '',
    date2: '',
    depositMonths: '2',
    depositPlusMonths: '3',
    adminFeePlus: '1.22',
    pricesPlus: '1.22',
    adminFeeMilanoHomePercentage: '15',
    adminFeeMilanoHomeMonths: '12',
    adminFeePartnerPercentage: '15',
  });

  const onChange = (key: keyof InputState, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

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
      setError(e?.message ?? 'Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const depositMonths = inputNumber(inputs.depositMonths, 2);
  const depositPlusMonths = inputNumber(inputs.depositPlusMonths, 3);
  const adminFeePlusMultiplier = inputNumber(inputs.adminFeePlus, 1.22);
  const pricesPlusMultiplier = inputNumber(inputs.pricesPlus, 1.22);
  const adminFeeMilanoHomePct = inputNumber(inputs.adminFeeMilanoHomePercentage, 15) / 100;
  const adminFeeMilanoHomeMonths = inputNumber(inputs.adminFeeMilanoHomeMonths, 12);
  const adminFeePartnerPct = inputNumber(inputs.adminFeePartnerPercentage, 15) / 100;

  const nonApartmentProperties = useMemo(
    () => properties.filter((p) => (p.type ?? '').toUpperCase() !== 'APARTMENT'),
    [properties],
  );

  const leasesByProperty = useMemo(() => {
    const map = new Map<string, Lease[]>();
    for (const lease of leases) {
      const propertyId = cleanStr(lease.propertyId ?? '');
      if (!propertyId) continue;
      const arr = map.get(propertyId) ?? [];
      arr.push(lease);
      map.set(propertyId, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const ay = toYmd(a.startDate);
        const by = toYmd(b.startDate);
        if (ay === by) return 0;
        return ay < by ? -1 : 1;
      });
    }
    return map;
  }, [leases]);

  const discountedDepositLeaseIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of payments) {
      if (!p.leaseId || !p.discounted) continue;
      if (p.kind === 'DEPOSIT' || p.kind === 'DEPOSIT_RETURN_FROM_LANDLORD') ids.add(p.leaseId);
    }
    for (const e of expenses) {
      if (!e.leaseId || !e.discounted) continue;
      if (e.type === 'DEPOSIT_TO_LANDLORD' || e.type === 'DEPOSIT_REFUND') ids.add(e.leaseId);
    }
    return ids;
  }, [payments, expenses]);

  const rows = useMemo<Row[]>(() => {
    const applyAvailabilityFilter = !!inputs.date1 && !!inputs.date2;

    return nonApartmentProperties
      .map((property) => {
        const relatedLeases = leasesByProperty.get(property.id) ?? [];
        const latestLease = relatedLeases.length ? relatedLeases[relatedLeases.length - 1] : undefined;
        const availableYmd = maxYmd(relatedLeases.map((lease) => toYmd(lease.endDate)));

        const prices = latestLease
          ? toFiniteNumber(latestLease.monthlyRentWithoutBills, toFiniteNumber(property.baseMonthlyRent, 0))
          : toFiniteNumber(property.baseMonthlyRent, 0);

        const pricesDiscounted = latestLease?.monthlyRentDiscounted ? prices : null;
        const monthlyUtilities = latestLease
          ? toFiniteNumber(latestLease.billsIncludedAmount, toFiniteNumber(property.monthlyUtilities, 0))
          : toFiniteNumber(property.monthlyUtilities, 0);

        const deposit = latestLease?.depositAmount !== undefined && latestLease?.depositAmount !== null
          ? toFiniteNumber(latestLease.depositAmount, prices * depositMonths)
          : prices * depositMonths;

        const depositDiscounted =
          latestLease &&
          (latestLease.depositDiscounted || discountedDepositLeaseIds.has(latestLease.id)) &&
          latestLease.depositAmount !== undefined &&
          latestLease.depositAmount !== null
            ? toFiniteNumber(latestLease.depositAmount, 0)
            : null;

        const adminFee = latestLease?.adminFeeAmount !== undefined && latestLease?.adminFeeAmount !== null
          ? toFiniteNumber(latestLease.adminFeeAmount, prices + monthlyUtilities)
          : prices + monthlyUtilities;

        const adminFeePortali =
          property.adminFeePortali !== undefined && property.adminFeePortali !== null
            ? toFiniteNumber(property.adminFeePortali, 0)
            : null;

        return {
          property,
          latestLease,
          availableYmd,
          prices,
          pricesDiscounted,
          pricesPlus: prices * pricesPlusMultiplier,
          monthlyUtilities,
          deposit,
          depositDiscounted,
          depositPlus: prices * depositPlusMonths,
          adminFee,
          adminFeePortali,
          adminFeePlus: (prices + monthlyUtilities) * adminFeePlusMultiplier,
          adminFeePartner:
            (prices + monthlyUtilities) * adminFeePlusMultiplier * (1 - adminFeePartnerPct),
          adminFeeMilanoHome:
            prices * adminFeeMilanoHomeMonths * adminFeeMilanoHomePct * adminFeePlusMultiplier,
        } satisfies Row;
      })
      .filter((row) => {
        if (!applyAvailabilityFilter) return true;

        const relatedLeases = leasesByProperty.get(row.property.id) ?? [];
        if (relatedLeases.length === 0) return false;
        if (!row.availableYmd) return false;
        if (!(row.availableYmd < inputs.date1)) return false;

        const hasLeaseStartingInWindow = relatedLeases.some((lease) => {
          const startYmd = toYmd(lease.startDate);
          return isInInclusiveRange(startYmd, inputs.date1, inputs.date2);
        });

        return !hasLeaseStartingInWindow;
      })
      .sort((a, b) => {
        const ac = cleanStr(a.property.code ?? '');
        const bc = cleanStr(b.property.code ?? '');
        if (ac === bc) return cleanStr(a.property.name ?? '').localeCompare(cleanStr(b.property.name ?? ''));
        return ac.localeCompare(bc);
      });
  }, [
    nonApartmentProperties,
    leasesByProperty,
    inputs.date1,
    inputs.date2,
    depositMonths,
    depositPlusMonths,
    adminFeePlusMultiplier,
    pricesPlusMultiplier,
    adminFeeMilanoHomePct,
    adminFeeMilanoHomeMonths,
    adminFeePartnerPct,
    discountedDepositLeaseIds,
  ]);

  const resetInputs = () => {
    setInputs({
      date1: '',
      date2: '',
      depositMonths: '2',
      depositPlusMonths: '3',
      adminFeePlus: '1.22',
      pricesPlus: '1.22',
      adminFeeMilanoHomePercentage: '15',
      adminFeeMilanoHomeMonths: '12',
      adminFeePartnerPercentage: '15',
    });
  };

  return (
    <div className="app-shell">
      <div className="app-container space-y-6">
        <div className="surface-card p-6 md:p-7 space-y-3">
          <div>
            <h1 className="page-title">Prezzi e disponibilità</h1>
            <p className="page-subtitle">
              Vista di pricing e disponibilità per tutte le property non di tipo APARTMENT, con formule dinamiche su depositi e admin fee.
            </p>
          </div>
          <div className="text-sm text-slate-600">
            {inputs.date1 && inputs.date2
              ? 'Filtro attivo: vengono mostrate solo le property con ultima end date precedente a DATE1 e senza nuovi contratti con start date compresa tra DATE1 e DATE2.'
              : 'Filtro date non impostato: vengono mostrate tutte le property non di tipo APARTMENT.'}
          </div>
        </div>

        <div className="surface-card p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Field label="DATE1">
              <Input type="date" value={inputs.date1} onChange={(e: any) => onChange('date1', e.target.value)} />
            </Field>
            <Field label="DATE2">
              <Input type="date" value={inputs.date2} onChange={(e: any) => onChange('date2', e.target.value)} />
            </Field>
            <Field label="DEPOSIT months">
              <Input value={inputs.depositMonths} onChange={(e: any) => onChange('depositMonths', e.target.value)} />
            </Field>
            <Field label="DEPOSIT Plus (months)">
              <Input value={inputs.depositPlusMonths} onChange={(e: any) => onChange('depositPlusMonths', e.target.value)} />
            </Field>
            <Field label="Admin Fee Plus">
              <Input value={inputs.adminFeePlus} onChange={(e: any) => onChange('adminFeePlus', e.target.value)} />
            </Field>
            <Field label="Prices Plus">
              <Input value={inputs.pricesPlus} onChange={(e: any) => onChange('pricesPlus', e.target.value)} />
            </Field>
            <Field label="Admin Fee Milano Home Percentage (%)">
              <Input
                value={inputs.adminFeeMilanoHomePercentage}
                onChange={(e: any) => onChange('adminFeeMilanoHomePercentage', e.target.value)}
              />
            </Field>
            <Field label="Admin Fee Milano Home Months">
              <Input
                value={inputs.adminFeeMilanoHomeMonths}
                onChange={(e: any) => onChange('adminFeeMilanoHomeMonths', e.target.value)}
              />
            </Field>
            <Field label="Admin Fee Partner (%)">
              <Input
                value={inputs.adminFeePartnerPercentage}
                onChange={(e: any) => onChange('adminFeePartnerPercentage', e.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadAll}
              className="px-4 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50"
            >
              Ricarica dati
            </button>
            <button
              type="button"
              onClick={resetInputs}
              className="px-4 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50"
            >
              Reset input
            </button>
            <div className="text-sm text-slate-600">Righe mostrate: {rows.length}</div>
          </div>
        </div>

        {loading ? <div className="surface-card p-6">Caricamento…</div> : null}
        {error ? <div className="surface-card p-6 text-red-700">{error}</div> : null}

        {!loading && !error ? (
          <div className="surface-card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[2800px] w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="text-left px-3 py-3">Code</th>
                    <th className="text-left px-3 py-3">Name</th>
                    <th className="text-left px-3 py-3">Type</th>
                    <th className="text-left px-3 py-3">Apartment ID</th>
                    <th className="text-left px-3 py-3">Available</th>
                    <th className="text-right px-3 py-3">Prices</th>
                    <th className="text-right px-3 py-3">Prices Discounted</th>
                    <th className="text-right px-3 py-3">Prices Plus</th>
                    <th className="text-right px-3 py-3">Monthly Utilities (Euro)</th>
                    <th className="text-right px-3 py-3">Deposit (Euro)</th>
                    <th className="text-right px-3 py-3">Deposit discounted (Euro)</th>
                    <th className="text-right px-3 py-3">Deposit Plus (Euro)</th>
                    <th className="text-right px-3 py-3">Admin Fee</th>
                    <th className="text-right px-3 py-3">Admin Fee Portali</th>
                    <th className="text-right px-3 py-3">Admin Fee Plus</th>
                    <th className="text-right px-3 py-3">Admin Fee Partner</th>
                    <th className="text-right px-3 py-3">Admin Fee Milano Home</th>
                    <th className="text-left px-3 py-3">Balcony</th>
                    <th className="text-left px-3 py-3">Dryer</th>
                    <th className="text-left px-3 py-3">Bed</th>
                    <th className="text-left px-3 py-3">AC</th>
                    <th className="text-left px-3 py-3">Heating</th>
                    <th className="text-right px-3 py-3">Room size</th>
                    <th className="text-left px-3 py-3">Link Sito</th>
                    <th className="text-left px-3 py-3">Airbnb</th>
                    <th className="text-left px-3 py-3">Spotahome</th>
                    <th className="text-left px-3 py-3">student.com</th>
                    <th className="text-left px-3 py-3">Inlife</th>
                    <th className="text-left px-3 py-3">ROOMLALA</th>
                    <th className="text-left px-3 py-3">STUDENTVILLE</th>
                    <th className="text-left px-3 py-3">SPACEST</th>
                    <th className="text-left px-3 py-3">housinganywhere</th>
                    <th className="text-left px-3 py-3">erasmusplay</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.property.id} className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3 font-medium text-slate-900">{row.property.code ?? ''}</td>
                      <td className="px-3 py-3">{row.property.name ?? ''}</td>
                      <td className="px-3 py-3">{row.property.type ?? ''}</td>
                      <td className="px-3 py-3">{row.property.apartmentId ?? ''}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.availableYmd ? formatDateIT(row.availableYmd) : ''}</td>
                      <td className="px-3 py-3 text-right">{fmtMoney(row.prices)}</td>
                      <td className="px-3 py-3 text-right">{fmtMoney(row.pricesDiscounted)}</td>
                      <td className="px-3 py-3 text-right">{fmtMoney(row.pricesPlus)}</td>
                      <td className="px-3 py-3 text-right">{fmtMoney(row.monthlyUtilities)}</td>
                      <td className="px-3 py-3 text-right">{fmtMoney(row.deposit)}</td>
                      <td className="px-3 py-3 text-right">{fmtMoney(row.depositDiscounted)}</td>
                      <td className="px-3 py-3 text-right">{fmtMoney(row.depositPlus)}</td>
                      <td className="px-3 py-3 text-right">{fmtMoney(row.adminFee)}</td>
                      <td className="px-3 py-3 text-right">{fmtMoney(row.adminFeePortali)}</td>
                      <td className="px-3 py-3 text-right">{fmtMoney(row.adminFeePlus)}</td>
                      <td className="px-3 py-3 text-right">{fmtMoney(row.adminFeePartner)}</td>
                      <td className="px-3 py-3 text-right">{fmtMoney(row.adminFeeMilanoHome)}</td>
                      <td className="px-3 py-3">{yesNo(row.property.balcony)}</td>
                      <td className="px-3 py-3">{yesNo(row.property.dryer)}</td>
                      <td className="px-3 py-3">{row.property.bed ?? ''}</td>
                      <td className="px-3 py-3">{row.property.ac ?? ''}</td>
                      <td className="px-3 py-3">{row.property.heating ?? ''}</td>
                      <td className="px-3 py-3 text-right">{fmtMoney(row.property.roomSizeSqm ?? null)}</td>
                      <td className="px-3 py-3"><LinkCell value={row.property.linkSito} /></td>
                      <td className="px-3 py-3"><LinkCell value={row.property.airbnb} /></td>
                      <td className="px-3 py-3">{row.property.spotahome ?? ''}</td>
                      <td className="px-3 py-3">{row.property.studentCom ?? ''}</td>
                      <td className="px-3 py-3"><LinkCell value={row.property.inlife} /></td>
                      <td className="px-3 py-3"><LinkCell value={row.property.roomlala} /></td>
                      <td className="px-3 py-3"><LinkCell value={row.property.studentville} /></td>
                      <td className="px-3 py-3"><LinkCell value={row.property.spacest} /></td>
                      <td className="px-3 py-3"><LinkCell value={row.property.housinganywhere} /></td>
                      <td className="px-3 py-3"><LinkCell value={row.property.erasmusplay} /></td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={33} className="px-3 py-8 text-center text-slate-500">
                        Nessuna property trovata con i criteri correnti.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
