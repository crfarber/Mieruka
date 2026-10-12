import { describe, expect, it } from 'vitest';
import { maskValue, redact } from './redact';

describe('maskValue', () => {
  it('keeps only the last three characters', () => {
    expect(maskValue('+31612345678')).toBe('***678');
  });

  it('masks short values completely', () => {
    expect(maskValue('abc')).toBe('***');
    expect(maskValue('')).toBe('***');
  });
});

describe('redact', () => {
  it('passes primitives through', () => {
    expect(redact(1)).toBe(1);
    expect(redact(true)).toBe(true);
    expect(redact('text')).toBe('text');
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  it('hides secrets by key name, at any depth', () => {
    const result = redact({
      accessToken: 'abc',
      refresh_token: 'def',
      Authorization: 'Bearer abc',
      password: 'hunter2',
      smsCode: '123456',
      nested: { clientSecret: 'shh', ok: 'fine' },
    });

    expect(result).toEqual({
      accessToken: '[redacted]',
      refresh_token: '[redacted]',
      Authorization: '[redacted]',
      password: '[redacted]',
      smsCode: '[redacted]',
      nested: { clientSecret: '[redacted]', ok: 'fine' },
    });
  });

  it('masks personal data by key name', () => {
    expect(redact({ phoneNumber: '+31612345678', email: 'jan@example.test' })).toEqual({
      phoneNumber: '***678',
      email: '***est',
    });
  });

  it('truncates long strings', () => {
    const result = redact('x'.repeat(600));
    expect(typeof result).toBe('string');
    expect(String(result)).toHaveLength(500 + '…[+100]'.length);
    expect(String(result).endsWith('…[+100]')).toBe(true);
  });

  it('limits array length', () => {
    const result = redact(Array.from({ length: 80 }, (_, index) => index));
    expect(result).toHaveLength(50);
  });

  it('limits nesting depth so cycles cannot hang', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => redact(cyclic)).not.toThrow();
    expect(JSON.stringify(redact(cyclic))).toContain('[max depth]');
  });

  it('serialises errors without their stack', () => {
    expect(redact(new TypeError('bad'))).toEqual({ name: 'TypeError', message: 'bad' });
  });

  it('serialises dates as ISO strings', () => {
    expect(redact(new Date(Date.UTC(2026, 8, 21)))).toBe('2026-09-21T00:00:00.000Z');
  });

  it('describes values that cannot be serialised', () => {
    expect(redact(10n)).toBe('10');
    expect(redact(() => 1)).toBe('[function]');
    expect(redact(Symbol('x'))).toBe('Symbol(x)');
  });
});
