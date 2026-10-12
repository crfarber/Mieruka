import { describe, expect, it } from 'vitest';
import { describeConnectFailure, parseApiKey, parseStoredConnection } from './connection';

const stored = {
  apiKey: 'key',
  privateKey: '{"n":"ab","d":"cd"}',
  installationToken: 'installation',
  sessionToken: 'session',
  userId: 42,
};

describe('parseStoredConnection', () => {
  it('reads a complete connection', () => {
    expect(parseStoredConnection(JSON.stringify(stored))).toEqual(stored);
  });

  it.each([
    ['nothing', null],
    ['an empty value', ''],
    ['broken JSON', '{"apiKey":'],
    ['a missing token', JSON.stringify({ ...stored, sessionToken: undefined })],
    ['an empty api key', JSON.stringify({ ...stored, apiKey: '' })],
    ['a user id that is not a number', JSON.stringify({ ...stored, userId: '42' })],
  ])('treats %s as no connection', (_case, raw) => {
    expect(parseStoredConnection(raw)).toBeNull();
  });
});

describe('parseApiKey', () => {
  it('drops the spaces a copy-paste leaves around the key', () => {
    expect(parseApiKey('  abc123\n')).toEqual({ ok: true, value: 'abc123' });
  });

  it('refuses an empty key', () => {
    expect(parseApiKey('   ')).toEqual({ ok: false, error: 'empty' });
  });

  it('refuses a key with spaces inside', () => {
    expect(parseApiKey('abc 123')).toEqual({ ok: false, error: 'malformed' });
  });
});

describe('describeConnectFailure', () => {
  it('has a text for every failure the user can do something about', () => {
    expect(describeConnectFailure({ kind: 'invalid-key' })).toBe('bunq.connect.errors.invalidKey');
    expect(describeConnectFailure({ kind: 'refused', reason: null })).toBe(
      'bunq.connect.errors.refused',
    );
    expect(describeConnectFailure({ kind: 'unavailable' })).toBe('bunq.connect.errors.unavailable');
  });

  it('says nothing when the user stopped it', () => {
    expect(describeConnectFailure({ kind: 'cancelled' })).toBeNull();
  });
});
