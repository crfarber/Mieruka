import { AuthExpiredError, TokenRefreshError } from '@/shared/api/errors';
import type { Logger } from '@/shared/logging/logger';
import type { Clock } from '@/shared/platform/ports';
import { getBackgroundRetryDelay, MIN_REFRESH_INTERVAL_MS } from '../domain/refresh-policy';
import { getProactiveRefreshDelay, isAccessTokenFresh } from '../domain/session';
import type { TokenProvider } from './token-provider';

/** Timer port. `schedule` returns a function that cancels the timer. */
export type Scheduler = {
  schedule(callback: () => void, delayMs: number): () => void;
};

export type SessionLifecycle = {
  /** Start following the session: schedule refreshes, react to sign-in and sign-out. */
  start(): void;
  stop(): void;
  /** Call when the app comes back to the foreground. */
  onForeground(): Promise<void>;
};

export type SessionLifecycleDeps = {
  provider: TokenProvider;
  scheduler: Scheduler;
  clock: Clock;
  logger?: Logger;
};

/**
 * Keeps the token fresh without the user noticing: refreshes shortly before it expires, and when
 * the app returns to the foreground. Temporary failures are retried with a growing pause; they
 * never sign the user out. Everything is a timer or an event, so the rules are testable.
 */
export function createSessionLifecycle(deps: SessionLifecycleDeps): SessionLifecycle {
  const { provider, scheduler, clock, logger } = deps;

  let cancelTimer: (() => void) | null = null;
  let unsubscribe: (() => void) | null = null;
  let retry = 0;
  let running = false;

  function cancel(): void {
    cancelTimer?.();
    cancelTimer = null;
  }

  function scheduleIn(delayMs: number): void {
    cancel();
    cancelTimer = scheduler.schedule(() => {
      cancelTimer = null;
      void refresh();
    }, delayMs);
  }

  function scheduleProactive(minimumDelayMs = 0): void {
    const expiresAt = provider.getExpiresAt();
    if (expiresAt === null) {
      cancel();
      return;
    }
    scheduleIn(Math.max(minimumDelayMs, getProactiveRefreshDelay(expiresAt, clock.now())));
  }

  async function refresh(): Promise<void> {
    if (!running || provider.getStatus() !== 'signed-in') {
      return;
    }
    try {
      await provider.refreshNow();
      retry = 0; // the provider announces the refresh, which reschedules
    } catch (error) {
      if (error instanceof TokenRefreshError) {
        const delay = getBackgroundRetryDelay(retry);
        retry += 1;
        logger?.warn('auth', 'Refresh failed temporarily, will retry', { retry, delay });
        scheduleIn(delay);
      } else if (!(error instanceof AuthExpiredError)) {
        logger?.error('auth', 'Unexpected refresh error', { error });
      }
      // AuthExpiredError: the provider has already signed the user out.
    }
  }

  return {
    start() {
      if (running) {
        return;
      }
      running = true;
      unsubscribe = provider.subscribe((event) => {
        switch (event.type) {
          case 'restored':
            if (event.method !== null) {
              scheduleProactive();
            }
            break;
          case 'signed-in':
            retry = 0;
            scheduleProactive();
            break;
          case 'refreshed':
            retry = 0;
            // A short-lived token must not make us refresh in a tight loop.
            scheduleProactive(MIN_REFRESH_INTERVAL_MS);
            break;
          case 'signed-out':
            retry = 0;
            cancel();
            break;
        }
      });
      if (provider.getStatus() === 'signed-in') {
        scheduleProactive();
      }
    },

    stop() {
      running = false;
      unsubscribe?.();
      unsubscribe = null;
      cancel();
      retry = 0;
    },

    async onForeground() {
      if (!running || provider.getStatus() !== 'signed-in') {
        return;
      }
      const expiresAt = provider.getExpiresAt();
      if (expiresAt !== null && isAccessTokenFresh({ expiresAt }, clock.now())) {
        scheduleProactive();
        return;
      }
      retry = 0;
      await refresh();
    },
  };
}
