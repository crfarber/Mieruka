import { describe, expect, it, vi } from 'vitest';
import { AuthExpiredError, NetworkError, TokenRefreshError } from '@/shared/api/errors';
import type { Sleep } from '@/shared/platform/ports';
import {
  createFakeClock,
  createInMemorySecretStore,
  createRecordingSleep,
  deferred,
  flushPromises,
} from '@/test/fakes';
import type { Session } from '../domain/session';
import { createSessionRepository, SESSION_KEY, type SessionRepository } from './session-repository';
import {
  createTokenProvider,
  type Refresher,
  type SessionEvent,
  type TokenSet,
} from './token-provider';

const NOW = Date.UTC(2026, 8, 21, 12, 0, 0);
const MINUTE = 60_000;

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  method: 'demo',
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: NOW + 60 * MINUTE,
  ...overrides,
});

const nextTokens = (overrides: Partial<TokenSet> = {}): TokenSet => ({
  accessToken: 'access-2',
  refreshToken: 'refresh-2',
  expiresAt: NOW + 120 * MINUTE,
  ...overrides,
});

type SetupOptions = {
  stored?: Session | null;
  repository?: SessionRepository;
  sleep?: Sleep;
};

function setup(options: SetupOptions = {}) {
  const clock = createFakeClock(NOW);
  const store = createInMemorySecretStore();
  const realRepository = createSessionRepository(store);
  const repository = options.repository ?? realRepository;
  const recording = createRecordingSleep();
  const delays = recording.delays;
  const refresh = vi.fn<Refresher>(async () => nextTokens());
  const provider = createTokenProvider({
    repository,
    refresh,
    clock,
    sleep: options.sleep ?? recording.sleep,
  });
  const events: SessionEvent[] = [];
  provider.subscribe((event) => events.push(event));

  const seed = async (session: Session | null = options.stored ?? makeSession()) => {
    if (session) {
      await realRepository.save(session);
    }
    await provider.restore();
  };

  return { provider, refresh, clock, store, realRepository, delays, events, seed };
}

describe('restore', () => {
  it('is unknown until it has run', () => {
    expect(setup().provider.getStatus()).toBe('unknown');
  });

  it('reports no session when nothing is stored', async () => {
    const { provider, events } = setup();

    expect(await provider.restore()).toBeNull();

    expect(provider.getStatus()).toBe('signed-out');
    expect(events).toEqual([{ type: 'restored', method: null }]);
  });

  it('loads the stored session', async () => {
    const { provider, seed, events } = setup();
    await seed(makeSession({ method: 'azure-ad' }));

    expect(provider.getStatus()).toBe('signed-in');
    expect(provider.getMethod()).toBe('azure-ad');
    expect(provider.getExpiresAt()).toBe(NOW + 60 * MINUTE);
    expect(events).toEqual([{ type: 'restored', method: 'azure-ad' }]);
  });

  it('ignores damaged data', async () => {
    const { provider, store } = setup();
    await store.setItem(SESSION_KEY, '{"broken":true}');

    expect(await provider.restore()).toBeNull();
    expect(provider.getStatus()).toBe('signed-out');
  });

  it('runs only once, however often it is called', async () => {
    const load = vi.fn(async () => makeSession());
    const repository: SessionRepository = { load, save: vi.fn(), clear: vi.fn() };
    const { provider } = setup({ repository });

    await Promise.all([provider.restore(), provider.restore(), provider.getAccessToken()]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('can be retried after the storage failed', async () => {
    const load = vi
      .fn<SessionRepository['load']>()
      .mockRejectedValueOnce(new Error('keychain locked'))
      .mockResolvedValueOnce(makeSession());
    const repository: SessionRepository = { load, save: vi.fn(), clear: vi.fn() };
    const { provider } = setup({ repository });

    await expect(provider.restore()).rejects.toThrow('keychain locked');
    expect(provider.getStatus()).toBe('unknown');

    expect(await provider.restore()).toBe('demo');
    expect(provider.getStatus()).toBe('signed-in');
  });

  it('does not overwrite a sign-in that happened while it was loading', async () => {
    const gate = deferred<Session | null>();
    const repository: SessionRepository = {
      load: () => gate.promise,
      save: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    };
    const { provider } = setup({ repository });

    const restoring = provider.restore();
    await provider.signIn(makeSession({ accessToken: 'new-login' }));
    gate.resolve(makeSession({ accessToken: 'stale-from-disk' }));
    await restoring;

    expect(await provider.getAccessToken()).toBe('new-login');
  });
});

describe('signIn and signOut', () => {
  it('signs in and stores the session', async () => {
    const { provider, realRepository, events } = setup();

    await provider.signIn(makeSession());

    expect(provider.getStatus()).toBe('signed-in');
    expect(await realRepository.load()).toEqual(makeSession());
    expect(events).toContainEqual({ type: 'signed-in', method: 'demo' });
  });

  it('signs out, clears storage and tells listeners', async () => {
    const { provider, seed, store, events } = setup();
    await seed();

    await provider.signOut();

    expect(provider.getStatus()).toBe('signed-out');
    expect(await provider.getAccessToken()).toBeNull();
    expect(store.dump()).toEqual({});
    expect(events.at(-1)).toEqual({ type: 'signed-out', reason: 'user' });
  });

  it('does not announce a second sign-out for the same session', async () => {
    const { provider, seed, events } = setup();
    await seed();

    await provider.signOut('expired');
    await provider.signOut('expired');

    expect(events.filter((event) => event.type === 'signed-out')).toHaveLength(1);
  });

  it('still announces a sign-out the user asked for when nobody was signed in', async () => {
    const { provider, events } = setup();
    await provider.restore();

    await provider.signOut('user');

    expect(events.filter((event) => event.type === 'signed-out')).toHaveLength(1);
  });

  it('is signed out in memory and reports the error when storage cannot be cleared', async () => {
    const repository: SessionRepository = {
      load: async () => makeSession(),
      save: async () => undefined,
      clear: async () => {
        throw new Error('keychain locked');
      },
    };
    const { provider, events } = setup({ repository });
    await provider.restore();

    await expect(provider.signOut()).rejects.toThrow('keychain locked');

    expect(provider.getStatus()).toBe('signed-out');
    expect(events.at(-1)).toEqual({ type: 'signed-out', reason: 'user' });
  });

  it('stops notifying a listener that unsubscribed, and survives one that throws', async () => {
    const { provider } = setup();
    const received: SessionEvent[] = [];
    const unsubscribe = provider.subscribe((event) => received.push(event));
    provider.subscribe(() => {
      throw new Error('bad listener');
    });

    await provider.signIn(makeSession());
    unsubscribe();
    await provider.signOut();

    expect(received.map((event) => event.type)).toEqual(['signed-in']);
  });
});

describe('getAccessToken', () => {
  it('returns null without a session', async () => {
    const { provider, refresh } = setup();
    expect(await provider.getAccessToken()).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('returns the current token while it is comfortably valid', async () => {
    const { provider, seed, refresh } = setup();
    await seed();

    expect(await provider.getAccessToken()).toBe('access-1');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes a token that is about to expire and stores the result', async () => {
    const { provider, seed, refresh, realRepository, events } = setup();
    await seed(makeSession({ expiresAt: NOW + MINUTE }));

    expect(await provider.getAccessToken()).toBe('access-2');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(await realRepository.load()).toMatchObject({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      expiresAt: NOW + 120 * MINUTE,
    });
    expect(events).toContainEqual({ type: 'refreshed' });
  });

  it('hands the session to the refresher', async () => {
    const { provider, seed, refresh } = setup();
    await seed(makeSession({ expiresAt: NOW - 1 }));

    await provider.getAccessToken();

    expect(refresh).toHaveBeenCalledWith(makeSession({ expiresAt: NOW - 1 }));
  });

  it('keeps the old refresh token when the refresher returns no new one', async () => {
    const { provider, seed, refresh, realRepository } = setup();
    await seed(makeSession({ expiresAt: NOW - 1 }));
    refresh.mockResolvedValueOnce({ accessToken: 'access-2', expiresAt: NOW + 60 * MINUTE });

    await provider.getAccessToken();

    expect((await realRepository.load())?.refreshToken).toBe('refresh-1');
  });

  it('keeps the user type through a refresh', async () => {
    const { provider, seed } = setup();
    await seed(makeSession({ method: 'azure-ad', expiresAt: NOW - 1 }));

    await provider.getAccessToken();

    expect(provider.getMethod()).toBe('azure-ad');
  });

  it('runs one refresh however many callers ask at the same time (single flight)', async () => {
    const { provider, seed, refresh } = setup();
    await seed(makeSession({ expiresAt: NOW - 1 }));
    const gate = deferred<TokenSet>();
    refresh.mockReturnValueOnce(gate.promise);

    const callers = [provider.getAccessToken(), provider.getAccessToken(), provider.refreshNow()];
    gate.resolve(nextTokens());

    expect(await Promise.all(callers)).toEqual(['access-2', 'access-2', 'access-2']);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('starts a new refresh once the previous one has finished', async () => {
    const { provider, seed, refresh } = setup();
    await seed(makeSession({ expiresAt: NOW - 1 }));

    await provider.refreshNow();
    await provider.refreshNow();

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  describe('when the token is about to expire but still works', () => {
    it('carries on with it if the refresh fails for a temporary reason, after a single try', async () => {
      const { provider, seed, refresh, delays } = setup();
      await seed(makeSession({ expiresAt: NOW + MINUTE }));
      refresh.mockRejectedValue(new NetworkError());

      expect(await provider.getAccessToken()).toBe('access-1');

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(delays).toEqual([]);
      expect(provider.getStatus()).toBe('signed-in');
    });

    it('does not try again for a while, so a bad connection does not slow down every request', async () => {
      const { provider, seed, refresh, clock } = setup();
      await seed(makeSession({ expiresAt: NOW + 20 * MINUTE }));
      refresh.mockRejectedValue(new NetworkError());
      clock.set(NOW + 18 * MINUTE + 30_000); // 90 seconds left: inside the margin, not expired

      await provider.getAccessToken();
      await provider.getAccessToken();
      await provider.getAccessToken();
      expect(refresh).toHaveBeenCalledTimes(1);

      clock.advance(31_000);
      await provider.getAccessToken();
      expect(refresh).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the token has expired', () => {
    it('retries with a growing pause and then reports a temporary failure', async () => {
      const { provider, seed, refresh, delays } = setup();
      await seed(makeSession({ expiresAt: NOW - 1 }));
      refresh.mockRejectedValue(new NetworkError());

      await expect(provider.getAccessToken()).rejects.toBeInstanceOf(TokenRefreshError);

      expect(refresh).toHaveBeenCalledTimes(3);
      expect(delays).toEqual([2_000, 4_000]);
    });

    it('keeps the session after a temporary failure', async () => {
      const { provider, seed, refresh, realRepository } = setup();
      await seed(makeSession({ expiresAt: NOW - 1 }));
      refresh.mockRejectedValue(new NetworkError());

      await provider.getAccessToken().catch(() => undefined);

      expect(provider.getStatus()).toBe('signed-in');
      expect(await realRepository.load()).not.toBeNull();
    });

    it('succeeds on a later attempt', async () => {
      const { provider, seed, refresh, delays } = setup();
      await seed(makeSession({ expiresAt: NOW - 1 }));
      refresh.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce(nextTokens());

      expect(await provider.getAccessToken()).toBe('access-2');

      expect(refresh).toHaveBeenCalledTimes(2);
      expect(delays).toEqual([2_000]);
    });

    it('wraps an unexpected error as a temporary failure and keeps the cause', async () => {
      const { provider, seed, refresh } = setup();
      await seed(makeSession({ expiresAt: NOW - 1 }));
      const cause = new TypeError('boom');
      refresh.mockRejectedValue(cause);

      const error = await provider.getAccessToken().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(TokenRefreshError);
      expect((error as TokenRefreshError).cause).toBe(cause);
    });
  });

  describe('when the server refuses the refresh token for good', () => {
    it('signs out without retrying and passes the error on', async () => {
      const { provider, seed, refresh, store, events, delays } = setup();
      await seed(makeSession({ expiresAt: NOW - 1 }));
      refresh.mockRejectedValue(new AuthExpiredError('refresh-rejected'));

      await expect(provider.getAccessToken()).rejects.toMatchObject({
        name: 'AuthExpiredError',
        reason: 'refresh-rejected',
      });

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(delays).toEqual([]);
      expect(provider.getStatus()).toBe('signed-out');
      expect(store.dump()).toEqual({});
      expect(events.at(-1)).toEqual({ type: 'signed-out', reason: 'expired' });
    });

    it('signs out once, even when many requests were waiting', async () => {
      const { provider, seed, refresh, events } = setup();
      await seed(makeSession({ expiresAt: NOW - 1 }));
      refresh.mockRejectedValue(new AuthExpiredError('refresh-rejected'));

      const results = await Promise.allSettled([
        provider.getAccessToken(),
        provider.getAccessToken(),
        provider.refreshNow(),
      ]);

      expect(results.every((result) => result.status === 'rejected')).toBe(true);
      expect(events.filter((event) => event.type === 'signed-out')).toHaveLength(1);
    });
  });

  describe('refreshNow', () => {
    it('refreshes even when the token is still fresh', async () => {
      const { provider, seed, refresh } = setup();
      await seed();

      expect(await provider.refreshNow()).toBe('access-2');
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('fails without a session', async () => {
      const { provider, refresh } = setup();
      await provider.restore();

      await expect(provider.refreshNow()).rejects.toMatchObject({ reason: 'no-session' });
      expect(refresh).not.toHaveBeenCalled();
    });

    it('retries a temporary failure the full number of times', async () => {
      const { provider, seed, refresh } = setup();
      await seed();
      refresh.mockRejectedValue(new NetworkError());

      await expect(provider.refreshNow()).rejects.toBeInstanceOf(TokenRefreshError);

      expect(refresh).toHaveBeenCalledTimes(3);
    });
  });
});

describe('a sign-out or sign-in while a refresh is running', () => {
  it('discards the result of the refresh after a sign-out, and does not bring the session back', async () => {
    const { provider, seed, refresh, store } = setup();
    await seed({ ...makeSession(), expiresAt: NOW - 1 });
    const gate = deferred<TokenSet>();
    refresh.mockReturnValueOnce(gate.promise);

    const pending = provider.getAccessToken();
    await flushPromises(); // the refresh has started
    await provider.signOut('user');
    gate.resolve(nextTokens());

    await expect(pending).rejects.toMatchObject({ name: 'AuthExpiredError', reason: 'signed-out' });
    expect(provider.getStatus()).toBe('signed-out');
    expect(store.dump()).toEqual({});
  });

  it('does not sign the user out a second time when the refresh is refused after they signed out', async () => {
    const { provider, seed, refresh, events } = setup();
    await seed({ ...makeSession(), expiresAt: NOW - 1 });
    const gate = deferred<TokenSet>();
    refresh.mockReturnValueOnce(gate.promise);

    const pending = provider.getAccessToken();
    await flushPromises(); // the refresh has started
    await provider.signOut('user');
    gate.reject(new AuthExpiredError('refresh-rejected'));

    await expect(pending).rejects.toBeInstanceOf(AuthExpiredError);
    expect(events.filter((event) => event.type === 'signed-out')).toHaveLength(1);
  });

  it('does not overwrite a new sign-in with the result of the refresh of the old session', async () => {
    const { provider, seed, refresh, realRepository } = setup();
    await seed({ ...makeSession(), expiresAt: NOW - 1 });
    const gate = deferred<TokenSet>();
    refresh.mockReturnValueOnce(gate.promise);

    const pending = provider.getAccessToken();
    await flushPromises(); // the refresh has started
    await provider.signIn(
      makeSession({ accessToken: 'other-user', refreshToken: 'other-refresh' }),
    );
    gate.resolve(nextTokens());

    await expect(pending).rejects.toMatchObject({ reason: 'signed-out' });
    expect(await provider.getAccessToken()).toBe('other-user');
    expect(await realRepository.load()).toMatchObject({ accessToken: 'other-user' });
  });

  it('stops retrying once the user has signed out', async () => {
    let signOutDuringPause = async () => {};
    const { provider, seed, refresh } = setup({ sleep: () => signOutDuringPause() });
    signOutDuringPause = () => provider.signOut('user');
    await seed({ ...makeSession(), expiresAt: NOW - 1 });
    refresh.mockRejectedValue(new NetworkError());

    await expect(provider.getAccessToken()).rejects.toMatchObject({ reason: 'signed-out' });

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
