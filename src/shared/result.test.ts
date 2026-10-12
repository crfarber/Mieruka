import { describe, expect, it } from 'vitest';
import { err, ok } from './result';

describe('Result', () => {
  it('wraps a value in ok', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it('wraps an error in err', () => {
    expect(err('boom')).toEqual({ ok: false, error: 'boom' });
  });

  it('narrows on the ok flag', () => {
    const result = Math.random() >= 0 ? ok('yes') : err(new Error('no'));
    if (result.ok) {
      expect(result.value).toBe('yes');
    } else {
      expect.unreachable();
    }
  });
});
