import { BadRequestException } from '@nestjs/common';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type RentInstallment = {
  dueDate: Date;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  sequence: number;
};

export type BuildRentScheduleInput = {
  startDate: Date;
  endDate?: Date;
  monthlyRent: number;
  dueDayOfMonth?: number;
  monthsIfNoEnd?: number;
};

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function normalizeUtcDate(value: Date): Date {
  return utcDate(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function lastDayOfMonthUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function addMonthsClampedUtc(value: Date, months: number, preferredDay = value.getUTCDate()): Date {
  const normalized = normalizeUtcDate(value);
  const absoluteMonth = normalized.getUTCFullYear() * 12 + normalized.getUTCMonth() + months;
  const year = Math.floor(absoluteMonth / 12);
  const month = absoluteMonth - year * 12;
  const day = Math.min(Math.max(1, preferredDay), lastDayOfMonthUtc(year, month));
  return utcDate(year, month, day);
}

export function addDaysUtc(value: Date, days: number): Date {
  const normalized = normalizeUtcDate(value);
  normalized.setUTCDate(normalized.getUTCDate() + days);
  return normalized;
}

export function daysBetweenUtc(from: Date, to: Date): number {
  const start = normalizeUtcDate(from).getTime();
  const end = normalizeUtcDate(to).getTime();
  return Math.round((end - start) / MS_PER_DAY);
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeDueDay(value?: number): number | undefined {
  if (value === undefined || value === null || !Number.isFinite(value)) return undefined;
  return Math.max(1, Math.min(28, Math.trunc(value)));
}

function prorata(monthlyRent: number, usedDays: number, periodDays: number): number {
  if (usedDays <= 0) return 0;
  return monthlyRent * (usedDays / Math.max(1, periodDays));
}

export function firstRentDueDate(startDate: Date, dueDayOfMonth?: number): Date {
  const start = normalizeUtcDate(startDate);
  const dueDay = normalizeDueDay(dueDayOfMonth);
  if (dueDay === undefined) return start;

  let candidate = utcDate(start.getUTCFullYear(), start.getUTCMonth(), dueDay);
  if (candidate.getTime() < start.getTime()) {
    candidate = addMonthsClampedUtc(candidate, 1, dueDay);
  }
  return candidate;
}

/**
 * Builds rent installments using the real contractual periods.
 *
 * Rules:
 * - without dueDayOfMonth, the first installment is due on startDate and each
 *   following installment is due on the monthly anniversary of startDate;
 * - nextPaymentDue intentionally does not participate in rent generation;
 * - with dueDayOfMonth, the first due date is the first occurrence of that day
 *   on or after startDate. The first installment includes the pro-rata for the
 *   usage between startDate and the first due date;
 * - rent is paid at the beginning of each usage period;
 * - endDate is inclusive. The last period is reduced to its actual daily
 *   pro-rata when it is shorter than a full contractual month;
 * - the daily rate uses the actual number of days in the relevant contractual
 *   monthly period.
 */
export function buildRentInstallments(input: BuildRentScheduleInput): RentInstallment[] {
  const startDate = normalizeUtcDate(input.startDate);
  const endDate = input.endDate ? normalizeUtcDate(input.endDate) : undefined;
  const monthlyRent = Number(input.monthlyRent);
  const monthsIfNoEnd = Math.max(1, Math.trunc(input.monthsIfNoEnd ?? 12));
  const dueDay = normalizeDueDay(input.dueDayOfMonth);

  if (!Number.isFinite(monthlyRent)) {
    throw new BadRequestException('monthlyRent missing or invalid');
  }
  if (endDate && endDate.getTime() < startDate.getTime()) {
    throw new BadRequestException('endDate must be greater than or equal to startDate');
  }

  const firstDueDate = firstRentDueDate(startDate, dueDay);
  const anchorDay = firstDueDate.getUTCDate();
  const effectiveEnd = endDate
    ? addDaysUtc(endDate, 1)
    : addMonthsClampedUtc(firstDueDate, monthsIfNoEnd, anchorDay);

  const installments: RentInstallment[] = [];

  // If the contract finishes before the first configured due day, there is no
  // full billing period: charge only the initial usage at the first due date.
  if (dueDay !== undefined && effectiveEnd.getTime() <= firstDueDate.getTime()) {
    const previousDueDate = addMonthsClampedUtc(firstDueDate, -1, anchorDay);
    const referenceDays = daysBetweenUtc(previousDueDate, firstDueDate);
    const usedDays = daysBetweenUtc(startDate, effectiveEnd);
    installments.push({
      dueDate: firstDueDate,
      amount: roundMoney(prorata(monthlyRent, usedDays, referenceDays)),
      periodStart: startDate,
      periodEnd: effectiveEnd,
      sequence: 1,
    });
    return installments;
  }

  let initialProrata = 0;
  if (dueDay !== undefined && firstDueDate.getTime() > startDate.getTime()) {
    const previousDueDate = addMonthsClampedUtc(firstDueDate, -1, anchorDay);
    const referenceDays = daysBetweenUtc(previousDueDate, firstDueDate);
    const usedDays = daysBetweenUtc(startDate, firstDueDate);
    initialProrata = prorata(monthlyRent, usedDays, referenceDays);
  }

  let sequence = 1;
  let periodStart = firstDueDate;
  while (periodStart.getTime() < effectiveEnd.getTime()) {
    const periodEnd = addMonthsClampedUtc(firstDueDate, sequence, anchorDay);
    const coveredEnd = periodEnd.getTime() < effectiveEnd.getTime() ? periodEnd : effectiveEnd;
    const periodDays = daysBetweenUtc(periodStart, periodEnd);
    const usedDays = daysBetweenUtc(periodStart, coveredEnd);

    let amount = prorata(monthlyRent, usedDays, periodDays);
    if (sequence === 1) amount += initialProrata;

    installments.push({
      dueDate: periodStart,
      amount: roundMoney(Math.abs(amount) < 0.005 ? 0 : amount),
      periodStart,
      periodEnd: coveredEnd,
      sequence,
    });

    periodStart = periodEnd;
    sequence += 1;
  }

  return installments;
}
