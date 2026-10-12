import { describe, expect, it } from 'vitest';
import { createInMemorySecretStore } from '@/test/fakes';
import { createChunkedSecretStore } from './chunked-store';

describe('createChunkedSecretStore', () => {
  it('stores a short value in one piece', async () => {
    const inner = createInMemorySecretStore();
    const store = createChunkedSecretStore(inner, 10);

    await store.setItem('key', 'short');

    expect(await store.getItem('key')).toBe('short');
    expect(inner.dump()).toEqual({ key: '1', 'key.0': 'short' });
  });

  it('spreads a long value over several pieces and joins it again', async () => {
    const inner = createInMemorySecretStore();
    const store = createChunkedSecretStore(inner, 4);
    const value = 'abcdefghijkl-mnop';

    await store.setItem('key', value);

    expect(await store.getItem('key')).toBe(value);
    expect(Object.keys(inner.dump()).sort()).toEqual([
      'key',
      'key.0',
      'key.1',
      'key.2',
      'key.3',
      'key.4',
    ]);
    expect(inner.dump().key).toBe('5');
  });

  it('never stores a piece larger than the chunk size', async () => {
    const inner = createInMemorySecretStore();
    const store = createChunkedSecretStore(inner, 1800);

    await store.setItem('key', 'x'.repeat(5000));

    const sizes = Object.entries(inner.dump())
      .filter(([key]) => key.startsWith('key.'))
      .map(([, value]) => value.length);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(1800);
    expect(sizes.reduce((total, size) => total + size, 0)).toBe(5000);
  });

  it('round-trips multi-byte text', async () => {
    const store = createChunkedSecretStore(createInMemorySecretStore(), 3);
    await store.setItem('key', 'héllo wörld ✓');
    expect(await store.getItem('key')).toBe('héllo wörld ✓');
  });

  it('cleans up the old pieces when a value is replaced by a shorter one', async () => {
    const inner = createInMemorySecretStore();
    const store = createChunkedSecretStore(inner, 4);

    await store.setItem('key', 'a'.repeat(20));
    await store.setItem('key', 'b');

    expect(await store.getItem('key')).toBe('b');
    expect(Object.keys(inner.dump()).sort()).toEqual(['key', 'key.0']);
  });

  it('removes every piece', async () => {
    const inner = createInMemorySecretStore();
    const store = createChunkedSecretStore(inner, 4);
    await store.setItem('key', 'a'.repeat(20));

    await store.removeItem('key');

    expect(inner.dump()).toEqual({});
    expect(await store.getItem('key')).toBeNull();
  });

  it('returns null for an unknown key', async () => {
    expect(await createChunkedSecretStore(createInMemorySecretStore()).getItem('nope')).toBeNull();
  });

  it('treats a value with a missing piece as absent', async () => {
    const inner = createInMemorySecretStore();
    const store = createChunkedSecretStore(inner, 4);
    await store.setItem('key', 'a'.repeat(12));
    await inner.removeItem('key.1');

    expect(await store.getItem('key')).toBeNull();
  });

  it('treats a garbled piece count as absent', async () => {
    const inner = createInMemorySecretStore({ key: 'not a number' });
    expect(await createChunkedSecretStore(inner).getItem('key')).toBeNull();
  });

  it('keeps the values of different keys apart', async () => {
    const store = createChunkedSecretStore(createInMemorySecretStore(), 4);
    await store.setItem('a', '1111222233');
    await store.setItem('b', 'xy');

    expect(await store.getItem('a')).toBe('1111222233');
    expect(await store.getItem('b')).toBe('xy');
  });

  it('is marked as secure', () => {
    expect(createChunkedSecretStore(createInMemorySecretStore()).secure).toBe(true);
  });
});
