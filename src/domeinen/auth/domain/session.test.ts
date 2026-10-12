import { describe, expect, it } from 'vitest';
import {
  ACCESS_TOKEN_SKEW_MS,
  getProactiveRefreshDelay,
  isAccessTokenExpired,
  isAccessTokenFresh,
  parseStoredSession,
  PROACTIVE_REFRESH_LEAD_MS,
  type Session,
} from './session';

const NOW = 1_800_000_000_000;

const session: Session = {
  method: 'demo',
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: NOW + 3_600_000,
};

describe('isAccessTokenFresh', () => {
  it('is true well before expiry', () => {
    expect(isAccessTokenFresh({ expiresAt: NOW + 10 * 60_000 }, NOW)).toBe(true);
  });

  it('is false inside the safety margin', () => {
    expect(isAccessTokenFresh({ expiresAt: NOW + ACCESS_TOKEN_SKEW_MS }, NOW)).toBe(false);
    expect(isAccessTokenFresh({ expiresAt: NOW + ACCESS_TOKEN_SKEW_MS + 1 }, NOW)).toBe(true);
  });

  it('is false after expiry', () => {
    expect(isAccessTokenFresh({ expiresAt: NOW - 1 }, NOW)).toBe(false);
  });
});

describe('isAccessTokenExpired', () => {
  it('treats the exact expiry moment as expired', () => {
    expect(isAccessTokenExpired({ expiresAt: NOW }, NOW)).toBe(true);
    expect(isAccessTokenExpired({ expiresAt: NOW + 1 }, NOW)).toBe(false);
  });
});

describe('getProactiveRefreshDelay', () => {
  it('waits until five minutes before expiry', () => {
    expect(getProactiveRefreshDelay(NOW + 60 * 60_000, NOW)).toBe(
      60 * 60_000 - PROACTIVE_REFRESH_LEAD_MS,
    );
  });

  it('is zero when the refresh is already due', () => {
    expect(getProactiveRefreshDelay(NOW + 60_000, NOW)).toBe(0);
    expect(getProactiveRefreshDelay(NOW - 60_000, NOW)).toBe(0);
  });
});

describe('parseStoredSession', () => {
  it('reads a valid session', () => {
    expect(parseStoredSession(JSON.stringify(session))).toEqual(session);
  });

  it.each([
    ['null', null],
    ['an empty string', ''],
    ['invalid JSON', '{not json'],
    ['a JSON string', '"text"'],
    ['an empty object', '{}'],
    ['an empty refresh token', JSON.stringify({ ...session, refreshToken: '' })],
    ['a missing access token', JSON.stringify({ ...session, accessToken: undefined })],
    ['an unknown user type', JSON.stringify({ ...session, method: 'admin' })],
    ['a non-numeric expiry', JSON.stringify({ ...session, expiresAt: 'tomorrow' })],
    ['a zero expiry', JSON.stringify({ ...session, expiresAt: 0 })],
  ])('returns null for %s', (_name, raw) => {
    expect(parseStoredSession(raw)).toBeNull();
  });

  it('drops unknown fields', () => {
    const parsed = parseStoredSession(JSON.stringify({ ...session, legacy: 'field' }));
    expect(parsed).toEqual(session);
  });
});
