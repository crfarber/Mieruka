import { AuthExpiredError, TokenRefreshError } from '@/shared/api/errors';
import type { Logger } from '@/shared/logging/logger';
import type { Clock, Sleep } from '@/shared/platform/ports';
import {
  getRefreshBackoff,
  MAX_REFRESH_ATTEMPTS,
  OPPORTUNISTIC_REFRESH_COOLDOWN_MS,
} from '../domain/refresh-policy';
import {
  isAccessTokenExpired,
  isAccessTokenFresh,
  type Session,
  type AuthMethod,
} from '../domain/session';
import type { SessionRepository } from './session-repository';

/** What a refresh returns. The refresh token is optional: some providers keep the old one. */
export type TokenSet = {
  accessToken: string;
  refreshToken?: string;
  /** Epoch milliseconds. */
  expiresAt: number;
};

/**
 * Exchanges the refresh token for new tokens. It MUST throw `AuthExpiredError` when the server
 * definitively refused the refresh token. Any other error counts as temporary.
 */
export type Refresher = (session: Session) => Promise<TokenSet>;

export type SessionStatus = 'unknown' | 'signed-in' | 'signed-out';

export type SessionEvent =
  | { type: 'restored'; method: AuthMethod | null }
  | { type: 'signed-in'; method: AuthMethod }
  | { type: 'refreshed' }
  | { type: 'signed-out'; reason: 'user' | 'expired' };

export type TokenProvider = {
  /** Loads the stored session. Call once at start-up, before anything needs a token. */
  restore(): Promise<AuthMethod | null>;
  signIn(session: Session): Promise<void>;
  signOut(reason?: 'user' | 'expired'): Promise<void>;
  /**
   * A token that is good to use, refreshing it first when it is about to expire. Null when nobody
   * is signed in. Throws `TokenRefreshError` when a refresh is needed but failing for a temporary
   * reason and the current token has already expired.
   */
  getAccessToken(): Promise<string | null>;
  /** Refreshes now, for example after the server answered 401. Throws AuthExpiredError or TokenRefreshError. */
  refreshNow(): Promise<string>;
  getStatus(): SessionStatus;
  getMethod(): AuthMethod | null;
  /** When the current access token expires (epoch ms), or null without a session. */
  getExpiresAt(): number | null;
  subscribe(listener: (event: SessionEvent) => void): () => void;
};

export type TokenProviderDeps = {
  repository: SessionRepository;
  refresh: Refresher;
  clock: Clock;
  sleep: Sleep;
  logger?: Logger;
};

/**
 * Owns the session. Guarantees:
 * - one refresh at a time, however many requests ask for a token (single flight);
 * - a temporary failure never signs the user out; only a definitive refusal does;
 * - a sign-out while a refresh is running wins: the refresh result is thrown away;
 * - storage writes happen in order, so a late save cannot undo a sign-out.
 */
export function createTokenProvider(deps: TokenProviderDeps): TokenProvider {
  const { repository, refresh, clock, sleep, logger } = deps;

  let session: Session | null = null;
  let restored = false;
  let restoring: Promise<AuthMethod | null> | null = null;
  /** Bumped by every sign-in and sign-out, so work that started earlier can tell it is stale. */
  let generation = 0;
  let inFlight: Promise<Session> | null = null;
  let nextOptionalRefreshAt = 0;
  let writeQueue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(event: SessionEvent) => void>();

  const emit = (event: SessionEvent): void => {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        logger?.error('auth', 'Session listener failed', { error });
      }
    }
  };

  /** Runs storage operations one after the other, in the order they were requested. */
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = writeQueue.then(operation, operation);
    writeQueue = result.catch(() => undefined);
    return result;
  };

  async function runRefresh(
    current: Session,
    startedIn: number,
    maxAttempts: number,
  ): Promise<Session> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const tokens = await refresh(current);

        if (generation !== startedIn) {
          throw new AuthExpiredError('signed-out');
        }

        const next: Session = {
          method: current.method,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken ?? current.refreshToken,
          expiresAt: tokens.expiresAt,
        };
        // No await between the check above and the enqueue: a sign-out cannot slip in between.
        await enqueue(() => repository.save(next));
        session = next;
        emit({ type: 'refreshed' });
        return next;
      } catch (error) {
        if (error instanceof AuthExpiredError) {
          if (error.reason !== 'signed-out' && generation === startedIn) {
            logger?.warn('auth', 'Refresh token refused, signing out');
            await signOut('expired');
          }
          throw error;
        }

        lastError = error;
        logger?.warn('auth', 'Token refresh attempt failed', { attempt, error });

        if (attempt < maxAttempts) {
          await sleep(getRefreshBackoff(attempt));
          if (generation !== startedIn) {
            throw new AuthExpiredError('signed-out');
          }
        }
      }
    }

    // Temporary trouble (network, server): keep the session so a later attempt can succeed.
    throw lastError instanceof TokenRefreshError
      ? lastError
      : new TokenRefreshError({ cause: lastError });
  }

  /** Joins the refresh that is running, or starts one. `maxAttempts` only matters for the one that starts. */
  function refreshShared(maxAttempts: number): Promise<Session> {
    const current = session;
    if (current === null) {
      return Promise.reject(new AuthExpiredError('no-session'));
    }
    if (inFlight === null) {
      const run = runRefresh(current, generation, maxAttempts);
      const tracked: Promise<Session> = run.finally(() => {
        if (inFlight === tracked) {
          inFlight = null;
        }
      });
      inFlight = tracked;
    }
    return inFlight;
  }

  async function loadSession(): Promise<AuthMethod | null> {
    const stored = await repository.load();
    // A sign-in or sign-out that happened while loading is more recent than what was stored.
    if (!restored && generation === 0) {
      session = stored;
    }
    restored = true;
    emit({ type: 'restored', method: session?.method ?? null });
    return session?.method ?? null;
  }

  function restore(): Promise<AuthMethod | null> {
    if (restoring === null) {
      restoring = loadSession().catch((error: unknown) => {
        restoring = null; // let a later call try again
        throw error;
      });
    }
    return restoring;
  }

  async function signIn(next: Session): Promise<void> {
    generation += 1;
    session = next;
    restored = true;
    await enqueue(() => repository.save(next));
    emit({ type: 'signed-in', method: next.method });
  }

  async function signOut(reason: 'user' | 'expired' = 'user'): Promise<void> {
    const wasSignedIn = session !== null;
    generation += 1;
    session = null;
    restored = true;
    try {
      await enqueue(() => repository.clear());
    } catch (error) {
      // The session may still be on disk. The app is signed out in memory either way.
      logger?.error('auth', 'Could not clear the stored session', { error });
      throw error;
    } finally {
      if (wasSignedIn || reason === 'user') {
        emit({ type: 'signed-out', reason });
      }
    }
  }

  async function getAccessToken(): Promise<string | null> {
    await restore();
    const current = session;
    if (current === null) {
      return null;
    }
    const now = clock.now();
    if (isAccessTokenFresh(current, now)) {
      return current.accessToken;
    }

    // The token is about to expire but still works: refresh if it is easy, otherwise carry on with it.
    // A failing refresh must not slow down every request, so try once and then leave it for a while.
    const stillValid = !isAccessTokenExpired(current, now);
    if (stillValid && now < nextOptionalRefreshAt) {
      return current.accessToken;
    }

    try {
      return (await refreshShared(stillValid ? 1 : MAX_REFRESH_ATTEMPTS)).accessToken;
    } catch (error) {
      if (error instanceof TokenRefreshError) {
        nextOptionalRefreshAt = clock.now() + OPPORTUNISTIC_REFRESH_COOLDOWN_MS;
        const latest = session;
        if (latest !== null && !isAccessTokenExpired(latest, clock.now())) {
          return latest.accessToken;
        }
      }
      throw error;
    }
  }

  async function refreshNow(): Promise<string> {
    await restore();
    return (await refreshShared(MAX_REFRESH_ATTEMPTS)).accessToken;
  }

  return {
    restore,
    signIn,
    signOut,
    getAccessToken,
    refreshNow,
    getStatus: () => (!restored ? 'unknown' : session ? 'signed-in' : 'signed-out'),
    getMethod: () => session?.method ?? null,
    getExpiresAt: () => session?.expiresAt ?? null,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
