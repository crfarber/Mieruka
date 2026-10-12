/** Total tries for one refresh, including the first. */
export const MAX_REFRESH_ATTEMPTS = 3;

/** Wait after the first failed try, after the second, and so on. The last value is reused if needed. */
export const REFRESH_BACKOFF_MS: readonly number[] = [2_000, 4_000];

/** After a temporary failure, do not try an optional refresh again for this long. */
export const OPPORTUNISTIC_REFRESH_COOLDOWN_MS = 30_000;

/** A refresh that just succeeded is never followed by another within this time, however short the token lives. */
export const MIN_REFRESH_INTERVAL_MS = 30_000;

/** Waits between background retries after a refresh kept failing for a temporary reason. */
export const BACKGROUND_RETRY_DELAYS_MS: readonly number[] = [5_000, 15_000, 60_000, 300_000];

/**
 * - `definitive`: the server refused the refresh token (expired, revoked, wrong client). The
 *   session is lost and the user must sign in again.
 * - `transient`: anything else (no network, timeout, server error). The session is KEPT and the
 *   refresh is tried again later. When in doubt, choose this one: signing a user out in the
 *   middle of a job is worse than trying again.
 */
export type RefreshFailureKind = 'definitive' | 'transient';

const DEFINITIVE_OAUTH_ERRORS = [
  'invalid_grant',
  'unauthorized_client',
  'invalid_client',
  'invalid_scope',
  'consent_required',
  'interaction_required',
] as const;

export type RefreshFailure = {
  status?: number;
  /** The `error` field of an OAuth error response, when there was one. */
  oauthError?: string | null;
  /** Free text from a native module (Azure AD) that reports errors as messages only. */
  message?: string | null;
};

export function classifyRefreshFailure(failure: RefreshFailure): RefreshFailureKind {
  if (failure.status === 401 || failure.status === 403) {
    return 'definitive';
  }
  const text = `${failure.oauthError ?? ''} ${failure.message ?? ''}`.toLowerCase();
  return DEFINITIVE_OAUTH_ERRORS.some((code) => text.includes(code)) ? 'definitive' : 'transient';
}

/** Pause before try `attempt + 1`, given that try `attempt` (counting from 1) failed. */
export function getRefreshBackoff(attempt: number): number {
  const index = Math.min(attempt - 1, REFRESH_BACKOFF_MS.length - 1);
  return REFRESH_BACKOFF_MS[index] ?? 0;
}

/** Pause before background retry number `retry` (counting from 0). Stays at the longest delay. */
export function getBackgroundRetryDelay(retry: number): number {
  const index = Math.min(Math.max(retry, 0), BACKGROUND_RETRY_DELAYS_MS.length - 1);
  return BACKGROUND_RETRY_DELAYS_MS[index] ?? 0;
}
