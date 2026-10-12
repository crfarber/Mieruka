import { describe, expect, it } from 'vitest';
import { formatMoney, parseDecimalAmount } from './money';

describe('parseDecimalAmount', () => {
  it.each([
    ['12.30', 1230],
    ['12.3', 1230],
    ['7', 700],
    ['0.05', 5],
    ['-45.10', -4510],
    [' 1.00 ', 100],
  ])('reads %s as %i cents', (value, cents) => {
    expect(parseDecimalAmount(value)).toBe(cents);
  });

  it('reads minus zero as zero', () => {
    expect(Object.is(parseDecimalAmount('-0.00'), 0)).toBe(true);
  });

  it.each(['', 'abc', '1,50', '1.234', '1e3', '--1', '.50', '12.'])('refuses %j', (value) => {
    expect(parseDecimalAmount(value)).toBeNull();
  });

  it('refuses an amount too large to count in cents exactly', () => {
    expect(parseDecimalAmount('900719925474099.00')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('writes euros the Dutch way', () => {
    expect(formatMoney({ cents: 123450, currency: 'EUR' }, 'nl')).toBe('€ 1.234,50');
  });

  it('writes euros the English way', () => {
    expect(formatMoney({ cents: 123450, currency: 'EUR' }, 'en')).toBe('€1,234.50');
  });

  it('keeps the sign of a negative amount', () => {
    expect(formatMoney({ cents: -305, currency: 'EUR' }, 'nl')).toContain('-3,05');
  });
});
