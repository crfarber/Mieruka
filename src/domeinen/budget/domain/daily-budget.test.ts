import { describe, expect, it } from 'vitest';
import {
  calendarDateAt,
  dailyBudget,
  daysInMonth,
  daysLeftInMonth,
  type CalendarDate,
} from './daily-budget';

const euros = (cents: number) => ({ cents, currency: 'EUR' });
const date = (year: number, month: number, day: number): CalendarDate => ({ year, month, day });

describe('calendarDateAt', () => {
  it('gives the date in the time zone of the device', () => {
    const lateOnTheLastDayInUtc = Date.UTC(2026, 9, 31, 23, 30);

    expect(calendarDateAt(lateOnTheLastDayInUtc, 0)).toEqual(date(2026, 10, 31));
    expect(calendarDateAt(lateOnTheLastDayInUtc, 60)).toEqual(date(2026, 11, 1));
  });

  it('goes back a day west of UTC', () => {
    expect(calendarDateAt(Date.UTC(2026, 10, 1, 2, 0), -300)).toEqual(date(2026, 10, 31));
  });
});

describe('daysInMonth', () => {
  it.each([
    [2026, 1, 31],
    [2026, 4, 30],
    [2026, 2, 28],
    [2028, 2, 29],
    [2100, 2, 28],
    [2000, 2, 29],
    [2026, 12, 31],
  ])('%i-%i has %i days', (year, month, days) => {
    expect(daysInMonth(year, month)).toBe(days);
  });
});

describe('daysLeftInMonth', () => {
  it('counts today', () => {
    expect(daysLeftInMonth(date(2026, 10, 12))).toBe(20);
  });

  it('is the whole month on the first day', () => {
    expect(daysLeftInMonth(date(2026, 10, 1))).toBe(31);
  });

  it('is one on the last day', () => {
    expect(daysLeftInMonth(date(2026, 2, 28))).toBe(1);
  });
});

describe('dailyBudget', () => {
  it('divides the balance over the days left, today included', () => {
    expect(dailyBudget(euros(40_000), date(2026, 10, 12))).toEqual({
      kind: 'per-day',
      perDay: euros(2_000),
      daysLeft: 20,
    });
  });

  it('rounds down, so the days together never add up to more than the balance', () => {
    const budget = dailyBudget(euros(1_000), date(2026, 10, 29));

    expect(budget).toEqual({ kind: 'per-day', perDay: euros(333), daysLeft: 3 });
  });

  it('gives the whole balance on the last day of the month', () => {
    expect(dailyBudget(euros(1_234), date(2026, 10, 31))).toEqual({
      kind: 'per-day',
      perDay: euros(1_234),
      daysLeft: 1,
    });
  });

  it('keeps the currency of the account', () => {
    const budget = dailyBudget({ cents: 3_000, currency: 'USD' }, date(2026, 10, 31));

    expect(budget.kind === 'per-day' && budget.perDay.currency).toBe('USD');
  });

  it('has nothing to spend when the balance is zero', () => {
    expect(dailyBudget(euros(0), date(2026, 10, 12))).toEqual({
      kind: 'nothing-left',
      daysLeft: 20,
    });
  });

  it('has nothing to spend when the account is overdrawn', () => {
    expect(dailyBudget(euros(-2_500), date(2026, 10, 12)).kind).toBe('nothing-left');
  });
});
