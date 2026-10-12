import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_RETRY_DELAYS_MS,
  classifyRefreshFailure,
  getBackgroundRetryDelay,
  getRefreshBackoff,
  MAX_REFRESH_ATTEMPTS,
} from './refresh-policy';

describe('classifyRefreshFailure', () => {
  it.each([401, 403])('HTTP %i means the refresh token is refused for good', (status) => {
    expect(classifyRefreshFailure({ status })).toBe('definitive');
  });

  it.each([
    'invalid_grant',
    'unauthorized_client',
    'invalid_client',
    'invalid_scope',
    'consent_required',
    'interaction_required',
  ])('OAuth error %s is definitive', (oauthError) => {
    expect(classifyRefreshFailure({ status: 400, oauthError })).toBe('definitive');
  });

  it('recognises an OAuth error inside a free text message (Azure AD)', () => {
    expect(classifyRefreshFailure({ message: 'AADSTS70000: Invalid_Grant: token revoked' })).toBe(
      'definitive',
    );
  });

  it.each([
    ['a server error', { status: 500 }],
    ['a bad gateway', { status: 502 }],
    ['a timeout', { status: 408 }],
    ['throttling', { status: 429 }],
    ['no status at all (network)', {}],
    ['an unrelated message', { message: 'Network request failed' }],
    ['an unknown OAuth error', { status: 400, oauthError: 'temporarily_unavailable' }],
  ])('%s is transient', (_name, failure) => {
    expect(classifyRefreshFailure(failure)).toBe('transient');
  });
});

describe('getRefreshBackoff', () => {
  it('waits 2 seconds after the first failure and 4 after the second', () => {
    expect(getRefreshBackoff(1)).toBe(2_000);
    expect(getRefreshBackoff(2)).toBe(4_000);
  });

  it('keeps the longest wait for further attempts', () => {
    expect(getRefreshBackoff(5)).toBe(4_000);
  });

  it('makes three attempts in total', () => {
    expect(MAX_REFRESH_ATTEMPTS).toBe(3);
  });
});

describe('getBackgroundRetryDelay', () => {
  it('grows with every retry', () => {
    expect([0, 1, 2, 3].map(getBackgroundRetryDelay)).toEqual([...BACKGROUND_RETRY_DELAYS_MS]);
  });

  it('stays at the longest delay', () => {
    expect(getBackgroundRetryDelay(50)).toBe(300_000);
  });

  it('starts at the first delay for a negative count', () => {
    expect(getBackgroundRetryDelay(-1)).toBe(5_000);
  });
});
