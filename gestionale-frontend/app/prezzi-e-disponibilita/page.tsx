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
  airbnbPrice?: number;
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

type EditableOverrideField = 'prices' | 'monthlyUtilities' | 'deposit' | 'adminFee';

type PriceAvailabilityOverride = {
  propertyId: string;
  prices?: number;
  monthlyUtilities?: number;
  deposit?: number;
  adminFee?: number;
  updatedAt?: any;
  updatedByUid?: string;
  updatedByEmail?: string | null;
};

type EditableMoneyCellProps = {
  value: number;
  overridden: boolean;
  disabled?: boolean;
  onCommit: (value: number) => Promise<void>;
  onReset: () => Promise<void>;
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

const LinkCell = ({ value, label = 'Apri' }: { value?: string; label?: string }) => {
  const s = cleanStr(value ?? '');
  if (!s) return <span className="text-slate-300">—</span>;

  const href = normalizeUrl(s);
  if (/^https?:\/\//i.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={s}
        className="inline-flex items-center whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
      >
        {label}
      </a>
    );
  }

  return (
    <span className="inline-block max-w-[150px] truncate whitespace-nowrap" title={s}>
      {s}
    </span>
  );
};

const EditableMoneyCell = ({
  value,
  overridden,
  disabled = false,
  onCommit,
  onReset,
}: EditableMoneyCellProps) => {
  const [draft, setDraft] = useState(fmtMoney(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(fmtMoney(value));
  }, [value]);

  const commit = async () => {
    const raw = cleanStr(draft).replace(',', '.');

    if (!raw) {
      if (overridden) {
        setSaving(true);
        try {
          await onReset();
        } finally {
          setSaving(false);
        }
      } else {
        setDraft(fmtMoney(value));
      }
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(fmtMoney(value));
      return;
    }

    if (Math.abs(parsed - value) < 0.000001) {
      setDraft(fmtMoney(value));
      return;
    }

    setSaving(true);
    try {
      await onCommit(parsed);
    } catch {
      setDraft(fmtMoney(value));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            setDraft(fmtMoney(value));
            e.currentTarget.blur();
          }
        }}
        disabled={disabled || saving}
        className={`w-24 rounded border px-2 py-1 text-right ${
          overridden
            ? 'border-sky-300 bg-sky-50'
            : 'border-slate-300 bg-white'
        } disabled:opacity-60`}
        title={overridden ? 'Valore manuale condiviso' : 'Valore automatico: modifica per creare un override condiviso'}
      />
      {overridden ? (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void onReset()}
          disabled={disabled || saving}
          className="text-xs text-slate-500 hover:text-slate-900 disabled:opacity-50"
          title="Ripristina il valore automatico"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
};

export default function PrezziDisponibilitaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, PriceAvailabilityOverride>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

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
      const [propertiesRes, leasesRes, paymentsRes, expensesRes, overridesRes] = await Promise.all([
        fetchWithAuth('/properties'),
        fetchWithAuth('/leases'),
        fetchWithAuth('/payments'),
        fetchWithAuth('/expenses'),
        fetchWithAuth('/price-availability-overrides'),
      ]);

      setProperties(Array.isArray(propertiesRes) ? propertiesRes : []);
      setLeases(Array.isArray(leasesRes) ? leasesRes : []);
      setPayments(Array.isArray(paymentsRes) ? paymentsRes : []);
      setExpenses(Array.isArray(expensesRes) ? expensesRes : []);

      const overridesMap: Record<string, PriceAvailabilityOverride> = {};
      if (Array.isArray(overridesRes)) {
        for (const item of overridesRes) {
          const propertyId = cleanStr(item?.propertyId ?? item?.id ?? '');
          if (!propertyId) continue;
          overridesMap[propertyId] = {
            ...item,
            propertyId,
          };
        }
      }
      setPriceOverrides(overridesMap);
    } catch (e: any) {
      setError(e?.message ?? 'Errore caricamento dati');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const saveOverride = async (
    propertyId: string,
    field: EditableOverrideField,
    value: number | null,
  ) => {
    setSaveError(null);

    try {
      const updated = await fetchWithAuth(
        `/price-availability-overrides/${encodeURIComponent(propertyId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        },
      );

      setPriceOverrides((prev) => ({
        ...prev,
        [propertyId]: {
          ...(updated ?? {}),
          propertyId,
        },
      }));
    } catch (e: any) {
      setSaveError(e?.message ?? 'Errore nel salvataggio del prezzo manuale');
      throw e;
    }
  };

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

        const override = priceOverrides[property.id];

        const automaticPrices = latestLease
          ? toFiniteNumber(latestLease.monthlyRentWithBills, toFiniteNumber(property.baseMonthlyRent, 0))
          : toFiniteNumber(property.baseMonthlyRent, 0);
        const prices =
          override?.prices !== undefined
            ? toFiniteNumber(override.prices, automaticPrices)
            : automaticPrices;

        const pricesDiscounted = latestLease?.monthlyRentDiscounted ? prices : null;

        const automaticMonthlyUtilities = latestLease
          ? toFiniteNumber(latestLease.billsIncludedAmount, toFiniteNumber(property.monthlyUtilities, 0))
          : toFiniteNumber(property.monthlyUtilities, 0);
        const monthlyUtilities =
          override?.monthlyUtilities !== undefined
            ? toFiniteNumber(override.monthlyUtilities, automaticMonthlyUtilities)
            : automaticMonthlyUtilities;

        const automaticDeposit =
          latestLease?.depositAmount !== undefined && latestLease?.depositAmount !== null
            ? toFiniteNumber(latestLease.depositAmount, prices * depositMonths)
            : prices * depositMonths;
        const deposit =
          override?.deposit !== undefined
            ? toFiniteNumber(override.deposit, automaticDeposit)
            : automaticDeposit;

        const hasExplicitDeposit =
          override?.deposit !== undefined ||
          (latestLease?.depositAmount !== undefined && latestLease?.depositAmount !== null);

        const depositDiscounted =
          latestLease &&
          (latestLease.depositDiscounted || discountedDepositLeaseIds.has(latestLease.id)) &&
          hasExplicitDeposit
            ? deposit
            : null;

        const automaticAdminFee =
          latestLease?.adminFeeAmount !== undefined && latestLease?.adminFeeAmount !== null
            ? toFiniteNumber(latestLease.adminFeeAmount, prices + monthlyUtilities)
            : prices + monthlyUtilities;
        const adminFee =
          override?.adminFee !== undefined
            ? toFiniteNumber(override.adminFee, automaticAdminFee)
            : automaticAdminFee;

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
    priceOverrides,
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
            <p className="text-sm text-slate-600 mt-2">
              I campi Prices, Monthly Utilities, Deposit e Admin Fee sono modificabili: il valore manuale viene salvato e condiviso con tutti gli utenti autenticati. Le colonne calcolate restano automatiche.
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
        {saveError ? <div className="surface-card p-6 text-red-700">{saveError}</div> : null}

        {!loading && !error ? (
          <div className="surface-card p-0 overflow-hidden">
            <div className="max-h-[72vh] overflow-auto">
              <table className="min-w-[3400px] w-full text-sm">
                <thead className="sticky top-0 z-30 bg-slate-100 text-slate-700 shadow-sm">
                  <tr>
                    <th className="sticky left-0 z-40 min-w-[110px] border-b border-slate-200 bg-slate-100 px-3 py-3 text-left whitespace-nowrap">Code</th>
                    <th className="min-w-[190px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">Name</th>
                    <th className="min-w-[90px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">Type</th>
                    <th className="min-w-[130px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">Apartment ID</th>
                    <th className="min-w-[110px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">Available</th>
                    <th className="min-w-[150px] border-b border-slate-200 px-3 py-3 text-right whitespace-nowrap">Prices (editabile)</th>
                    <th className="min-w-[145px] border-b border-slate-200 px-3 py-3 text-right whitespace-nowrap">Prices Discounted</th>
                    <th className="min-w-[115px] border-b border-slate-200 px-3 py-3 text-right whitespace-nowrap">Prices Plus</th>
                    <th className="min-w-[195px] border-b border-slate-200 px-3 py-3 text-right whitespace-nowrap">Monthly Utilities (Euro, editabile)</th>
                    <th className="min-w-[170px] border-b border-slate-200 px-3 py-3 text-right whitespace-nowrap">Deposit (Euro, editabile)</th>
                    <th className="min-w-[165px] border-b border-slate-200 px-3 py-3 text-right whitespace-nowrap">Deposit discounted (Euro)</th>
                    <th className="min-w-[130px] border-b border-slate-200 px-3 py-3 text-right whitespace-nowrap">Deposit Plus (Euro)</th>
                    <th className="min-w-[155px] border-b border-slate-200 px-3 py-3 text-right whitespace-nowrap">Admin Fee (editabile)</th>
                    <th className="min-w-[130px] border-b border-slate-200 px-3 py-3 text-right whitespace-nowrap">Admin Fee Portali</th>
                    <th className="min-w-[120px] border-b border-slate-200 px-3 py-3 text-right whitespace-nowrap">Admin Fee Plus</th>
                    <th className="min-w-[135px] border-b border-slate-200 px-3 py-3 text-right whitespace-nowrap">Admin Fee Partner</th>
                    <th className="min-w-[165px] border-b border-slate-200 px-3 py-3 text-right whitespace-nowrap">Admin Fee Milano Home</th>
                    <th className="min-w-[85px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">Balcony</th>
                    <th className="min-w-[75px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">Dryer</th>
                    <th className="min-w-[120px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">Bed</th>
                    <th className="min-w-[85px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">AC</th>
                    <th className="min-w-[110px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">Heating</th>
                    <th className="min-w-[100px] border-b border-slate-200 px-3 py-3 text-right whitespace-nowrap">Room size</th>
                    <th className="min-w-[105px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">Link Sito</th>
                    <th className="min-w-[95px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">Airbnb</th>
                    <th className="min-w-[120px] border-b border-slate-200 px-3 py-3 text-right whitespace-nowrap">Prezzo Airbnb</th>
                    <th className="min-w-[115px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">Spotahome</th>
                    <th className="min-w-[115px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">student.com</th>
                    <th className="min-w-[95px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">Inlife</th>
                    <th className="min-w-[105px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">ROOMLALA</th>
                    <th className="min-w-[125px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">STUDENTVILLE</th>
                    <th className="min-w-[95px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">SPACEST</th>
                    <th className="min-w-[145px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">housinganywhere</th>
                    <th className="min-w-[115px] border-b border-slate-200 px-3 py-3 text-left whitespace-nowrap">erasmusplay</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.property.id} className="border-t border-slate-200 align-top hover:bg-slate-50/70">
                      <td className="sticky left-0 z-20 min-w-[110px] bg-white px-3 py-3 font-medium text-slate-900 whitespace-nowrap">{row.property.code ?? ''}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.property.name ?? ''}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.property.type ?? ''}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.property.apartmentId ?? ''}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.availableYmd ? formatDateIT(row.availableYmd) : ''}</td>
                      <td className="px-3 py-3 text-right">
                        <EditableMoneyCell
                          value={row.prices}
                          overridden={priceOverrides[row.property.id]?.prices !== undefined}
                          onCommit={(value) => saveOverride(row.property.id, 'prices', value)}
                          onReset={() => saveOverride(row.property.id, 'prices', null)}
                        />
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(row.pricesDiscounted)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(row.pricesPlus)}</td>
                      <td className="px-3 py-3 text-right">
                        <EditableMoneyCell
                          value={row.monthlyUtilities}
                          overridden={priceOverrides[row.property.id]?.monthlyUtilities !== undefined}
                          onCommit={(value) => saveOverride(row.property.id, 'monthlyUtilities', value)}
                          onReset={() => saveOverride(row.property.id, 'monthlyUtilities', null)}
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <EditableMoneyCell
                          value={row.deposit}
                          overridden={priceOverrides[row.property.id]?.deposit !== undefined}
                          onCommit={(value) => saveOverride(row.property.id, 'deposit', value)}
                          onReset={() => saveOverride(row.property.id, 'deposit', null)}
                        />
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(row.depositDiscounted)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(row.depositPlus)}</td>
                      <td className="px-3 py-3 text-right">
                        <EditableMoneyCell
                          value={row.adminFee}
                          overridden={priceOverrides[row.property.id]?.adminFee !== undefined}
                          onCommit={(value) => saveOverride(row.property.id, 'adminFee', value)}
                          onReset={() => saveOverride(row.property.id, 'adminFee', null)}
                        />
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(row.adminFeePortali)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(row.adminFeePlus)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(row.adminFeePartner)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(row.adminFeeMilanoHome)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{yesNo(row.property.balcony)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{yesNo(row.property.dryer)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.property.bed ?? ''}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.property.ac ?? ''}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.property.heating ?? ''}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(row.property.roomSizeSqm ?? null)}</td>
                      <td className="px-3 py-3"><LinkCell value={row.property.linkSito} label="Apri" /></td>
                      <td className="px-3 py-3"><LinkCell value={row.property.airbnb} label="Apri" /></td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{fmtMoney(row.property.airbnbPrice ?? null)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.property.spotahome ?? ''}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.property.studentCom ?? ''}</td>
                      <td className="px-3 py-3"><LinkCell value={row.property.inlife} label="Apri" /></td>
                      <td className="px-3 py-3"><LinkCell value={row.property.roomlala} label="Apri" /></td>
                      <td className="px-3 py-3"><LinkCell value={row.property.studentville} label="Apri" /></td>
                      <td className="px-3 py-3"><LinkCell value={row.property.spacest} label="Apri" /></td>
                      <td className="px-3 py-3"><LinkCell value={row.property.housinganywhere} label="Apri" /></td>
                      <td className="px-3 py-3"><LinkCell value={row.property.erasmusplay} label="Apri" /></td>
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
