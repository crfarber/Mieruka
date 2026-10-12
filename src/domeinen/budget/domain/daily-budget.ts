import type { Money } from '@/shared/money';

/** A day on the calendar, without a time. `month` runs from 1 (January) to 12. */
export type CalendarDate = { year: number; month: number; day: number };

/** The calendar date at a moment, for a device that is `offsetMinutes` ahead of UTC. */
export function calendarDateAt(epochMs: number, offsetMinutes: number): CalendarDate {
  const local = new Date(epochMs + offsetMinutes * 60_000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
  };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const THIRTY_DAY_MONTHS = new Set([4, 6, 9, 11]);

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return THIRTY_DAY_MONTHS.has(month) ? 30 : 31;
}

/** The days still to spend this month, today included: 1 on the last day of the month. */
export function daysLeftInMonth(today: CalendarDate): number {
  return daysInMonth(today.year, today.month) - today.day + 1;
}

export type DailyBudget =
  { kind: 'per-day'; perDay: Money; daysLeft: number } | { kind: 'nothing-left'; daysLeft: number };

/**
 * The balance spread evenly over the days left in the month. Rounded down to the cent, so the
 * days together never add up to more than there is. A balance of zero or less leaves nothing.
 */
export function dailyBudget(balance: Money, today: CalendarDate): DailyBudget {
  const daysLeft = daysLeftInMonth(today);
  if (balance.cents <= 0) {
    return { kind: 'nothing-left', daysLeft };
  }
  return {
    kind: 'per-day',
    perDay: { cents: Math.floor(balance.cents / daysLeft), currency: balance.currency },
    daysLeft,
  };
}
