import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Authenticator } from '@/domeinen/auth';
import { AuthExpiredError, TokenRefreshError } from '@/shared/api/errors';
import type { RuntimeConfig } from '@/shared/config/runtime-config';
import { err, ok } from '@/shared/result';
import {
  createFakeClock,
  createFakeScheduler,
  createInMemorySecretStore,
  createInMemoryStore,
  createRecordingSleep,
  flushPromises,
  jsonResponse,
  type FakeClock,
} from '@/test/fakes';
import { createContainer } from './container';

/**
 * The walking skeleton: the real parts, wired as in the app, with a fake device and a fake
 * backend. If these pass, sign-in, token handling and data loading work together. Add a scenario
 * here for every new end-to-end route.
 */

const NOW = Date.UTC(2026, 8, 21, 12, 0, 0);
const MINUTE = 60_000;

const azureAdConfig: RuntimeConfig = {
  apiBaseUrl: 'https://api.test',
  environment: 'internal',
  auth: {
    provider: 'azure-ad',
    azureAd: {
      tenantId: 'tenant',
      clientId: 'client',
      redirectUrl: 'com.example.app.auth://login/',
      apiScopes: [],
    },
  },
};

const demoConfig: RuntimeConfig = {
  ...azureAdConfig,
  auth: { provider: 'demo' },
};

/** An example endpoint, read the way a domain `api/` would: through a zod schema. */
const itemsSchema = z.array(z.looseObject({ id: z.string() }));
const ITEMS_PATH = '/api/items';

type Recorded = {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string | undefined;
};
type Responder = (request: Recorded) => Response | Promise<Response>;

function createBackend() {
  const requests: Recorded[] = [];
  const queues = new Map<string, Responder[]>();
  const defaults = new Map<string, Responder>();

  const key = (method: string, path: string) => `${method} ${path}`;

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const request: Recorded = {
      method,
      path: url.pathname,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? init.body : undefined,
    };
    requests.push(request);

    const routeKey = key(method, url.pathname);
    const responder = queues.get(routeKey)?.shift() ?? defaults.get(routeKey);
    if (!responder) {
      throw new Error(`No fake route for ${routeKey}`);
    }
    return responder(request);
  };

  return {
    fetch: fetchImpl,
    requests,
    /** Answers every request to the route. */
    on(method: string, path: string, responder: Responder) {
      defaults.set(key(method, path), responder);
    },
    /** Answers only the next request to the route. */
    once(method: string, path: string, responder: Responder) {
      queues.set(key(method, path), [...(queues.get(key(method, path)) ?? []), responder]);
    },
    callsTo: (method: string, path: string) =>
      requests.filter((request) => request.method === method && request.path === path),
  };
}

/**
 * Stands in for the Azure AD browser sheet. Signs in with `access-1`; every refresh hands out the
 * next token, valid for an hour from the fake clock, unless the test replaces `refresh`.
 */
function createFakeAuthenticator(clock: FakeClock) {
  const refreshed: string[] = [];
  let issued = 1;
  const authenticator: Authenticator = {
    method: 'azure-ad',
    signIn: async () =>
      ok({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: NOW + 60 * MINUTE,
      }),
    refresh: async (refreshToken) => {
      refreshed.push(refreshToken);
      issued += 1;
      return {
        accessToken: `access-${issued}`,
        refreshToken: `refresh-${issued}`,
        expiresAt: clock.now() + 60 * MINUTE,
      };
    },
  };
  return { authenticator, refreshed };
}

const storedSession = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    method: 'azure-ad',
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresAt: NOW + 60 * MINUTE,
    ...overrides,
  });

function setup(
  options: {
    stored?: string;
    config?: RuntimeConfig;
    keyValueStore?: ReturnType<typeof createInMemoryStore>;
    authenticator?: Partial<Authenticator>;
  } = {},
) {
  const clock = createFakeClock(NOW);
  const secretStore = createInMemorySecretStore(
    options.stored === undefined ? {} : { 'auth.session': options.stored },
  );
  const backend = createBackend();
  const scheduler = createFakeScheduler();
  const recording = createRecordingSleep();
  const fake = createFakeAuthenticator(clock);
  const config = options.config ?? azureAdConfig;

  backend.on('GET', ITEMS_PATH, () => jsonResponse([{ id: 'item-1' }]));

  const keyValueStore = options.keyValueStore ?? createInMemoryStore();
  const container = createContainer({
    config,
    secretStore,
    keyValueStore,
    language: 'nl',
    deviceAuthenticator:
      config.auth.provider === 'demo' ? null : { ...fake.authenticator, ...options.authenticator },
    logShare: { share: async () => undefined },
    fetch: backend.fetch,
    clock,
    sleep: recording.sleep,
    scheduler,
  });
  const loadItems = () => container.http.requestJson(ITEMS_PATH, itemsSchema);

  return {
    container,
    backend,
    clock,
    secretStore,
    keyValueStore,
    scheduler,
    sleeps: recording.delays,
    refreshed: fake.refreshed,
    loadItems,
  };
}

describe('signing in', () => {
  it('signs in, stores the session and loads data with the token', async () => {
    const { container, backend, secretStore, loadItems } = setup();
    await container.start();
    expect(container.sessionStore.getState().status).toBe('signed-out');

    const login = await container.authService.signIn();

    expect(login.ok).toBe(true);
    expect(container.sessionStore.getState()).toMatchObject({
      status: 'signed-in',
      method: 'azure-ad',
    });
    expect(JSON.parse(secretStore.dump()['auth.session'] ?? '{}')).toMatchObject({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresAt: NOW + 60 * MINUTE,
    });

    expect(await loadItems()).toEqual([{ id: 'item-1' }]);
    expect(backend.callsTo('GET', ITEMS_PATH)[0]?.headers.Authorization).toBe('Bearer access-1');
  });

  it('does not sign in when the user cancels the sign-in sheet', async () => {
    const { container, secretStore } = setup({
      authenticator: {
        signIn: async () => err({ kind: 'cancelled' as const }),
      },
    });
    await container.start();

    const login = await container.authService.signIn();

    expect(login).toEqual({ ok: false, error: { kind: 'cancelled' } });
    expect(container.sessionStore.getState().status).toBe('signed-out');
    expect(secretStore.dump()).toEqual({});
  });

  it('signs in when no api base url is configured and refuses the first request', async () => {
    const { container, backend, loadItems } = setup({
      config: { ...demoConfig, apiBaseUrl: null },
    });
    await container.start();

    expect((await container.authService.signIn()).ok).toBe(true);
    expect(container.sessionStore.getState()).toMatchObject({
      status: 'signed-in',
      method: 'demo',
    });
    await expect(loadItems()).rejects.toThrow('EXPO_PUBLIC_API_BASE_URL');
    expect(backend.requests).toEqual([]);
  });

  it('signs in without a backend when the build uses the demo sign-in', async () => {
    const { container, backend, loadItems } = setup({ config: demoConfig });
    await container.start();

    expect(container.authService.method).toBe('demo');
    expect((await container.authService.signIn()).ok).toBe(true);
    expect(container.sessionStore.getState()).toMatchObject({
      status: 'signed-in',
      method: 'demo',
    });
    await loadItems();
    expect(backend.callsTo('GET', ITEMS_PATH)[0]?.headers.Authorization).toBe(
      'Bearer demo-access-1',
    );
  });

  it('refuses to start when the device sign-in does not match the configuration', () => {
    expect(() =>
      createContainer({
        config: azureAdConfig,
        secretStore: createInMemorySecretStore(),
        keyValueStore: createInMemoryStore(),
        language: 'nl',
        deviceAuthenticator: null,
        logShare: { share: async () => undefined },
      }),
    ).toThrow('No device authenticator for azure-ad sign-in');
  });
});

describe('starting the app', () => {
  it('restores a stored session and uses its token', async () => {
    const { container, backend, loadItems } = setup({
      stored: storedSession(),
    });

    await container.start();

    expect(container.sessionStore.getState()).toMatchObject({
      status: 'signed-in',
      method: 'azure-ad',
    });
    await loadItems();
    expect(backend.callsTo('GET', ITEMS_PATH)[0]?.headers.Authorization).toBe('Bearer access-1');
  });

  it('shows the login when the stored session is damaged', async () => {
    const { container, secretStore } = setup({
      stored: '{"method":"azure-ad"}',
    });

    await container.start();

    expect(container.sessionStore.getState().status).toBe('signed-out');
    expect(secretStore.dump()).toEqual({});
  });

  it('shows the login when secure storage cannot be read, instead of a blank screen', async () => {
    const { container, secretStore } = setup();
    secretStore.getItem = () => Promise.reject(new Error('keychain locked'));

    await container.start();

    expect(container.sessionStore.getState().status).toBe('signed-out');
    expect(container.logger.entries().some((entry) => entry.level === 'error')).toBe(true);
  });

  it('ends a session that a build with another sign-in method stored', async () => {
    const { container, secretStore, loadItems } = setup({
      config: demoConfig,
      stored: storedSession({ expiresAt: NOW - MINUTE }),
    });
    await container.start();

    const error = await loadItems().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AuthExpiredError);
    expect(container.sessionStore.getState().status).toBe('signed-out');
    expect(secretStore.dump()).toEqual({});
  });

  it('shows the cached data of the signed-in user right away', async () => {
    const keyValueStore = createInMemoryStore();
    const first = setup({ stored: storedSession(), keyValueStore });
    await first.container.start();
    first.container.queryClient.setQueryData(['items'], [{ id: 'cached' }]);
    // The cache is written shortly after a change, not on every change.
    const cacheSave = first.scheduler.pending().find((timer) => timer.delayMs === 500);
    cacheSave?.callback();
    await flushPromises();
    first.container.stop();

    const second = setup({ stored: storedSession(), keyValueStore });
    await second.container.start();

    expect(second.container.queryClient.getQueryData(['items'])).toEqual([{ id: 'cached' }]);
  });
});

describe('language', () => {
  it('switches at once and starts in the chosen language next time, also after signing out', async () => {
    const keyValueStore = createInMemoryStore();
    const first = setup({ stored: storedSession(), keyValueStore });
    await first.container.start();
    expect(first.container.i18n.t('common.signOut')).toBe('Uitloggen');

    await first.container.languageSettings.choose('en');
    expect(first.container.i18n.t('common.signOut')).toBe('Sign out');
    await first.container.authService.signOut();
    first.container.stop();

    const second = setup({ keyValueStore });
    await second.container.start();

    expect(second.container.i18n.language).toBe('en');
    expect(second.container.i18n.t('common.signOut')).toBe('Sign out');
  });
});

describe('keeping the token fresh', () => {
  it('refreshes a token that is about to expire before sending the request', async () => {
    const { container, backend, refreshed, loadItems } = setup({
      stored: storedSession({ expiresAt: NOW + MINUTE }),
    });
    await container.start();

    await loadItems();

    expect(refreshed).toEqual(['refresh-1']);
    expect(backend.callsTo('GET', ITEMS_PATH)[0]?.headers.Authorization).toBe('Bearer access-2');
  });

  it('refreshes once and retries when the server answers 401', async () => {
    const { container, backend, refreshed, loadItems } = setup({
      stored: storedSession(),
    });
    backend.once('GET', ITEMS_PATH, () => new Response(null, { status: 401 }));
    await container.start();

    const items = await loadItems();

    expect(items).toHaveLength(1);
    expect(backend.callsTo('GET', ITEMS_PATH)).toHaveLength(2);
    expect(refreshed).toHaveLength(1);
    expect(backend.callsTo('GET', ITEMS_PATH)[1]?.headers.Authorization).toBe('Bearer access-2');
  });

  it('sends only one refresh when several requests need a token at the same time', async () => {
    const { container, refreshed, loadItems } = setup({
      stored: storedSession({ expiresAt: NOW + MINUTE }),
    });
    await container.start();

    await Promise.all([loadItems(), loadItems(), loadItems()]);

    expect(refreshed).toHaveLength(1);
  });

  it('refreshes in the background shortly before the token expires', async () => {
    const { container, clock, scheduler, refreshed } = setup({
      stored: storedSession(),
    });
    await container.start();
    expect(scheduler.pending().map((timer) => timer.delayMs)).toEqual([55 * MINUTE]);

    clock.advance(55 * MINUTE);
    await scheduler.fireNext();

    expect(refreshed).toHaveLength(1);
    expect(container.tokenProvider.getExpiresAt()).toBe(clock.now() + 60 * MINUTE);
  });
});

describe('when the session cannot be kept', () => {
  it('signs the user out and clears their data when the refresh token is refused', async () => {
    const { container, secretStore, keyValueStore, loadItems } = setup({
      stored: storedSession({ expiresAt: NOW - MINUTE }),
      authenticator: {
        refresh: () => Promise.reject(new AuthExpiredError('refresh-rejected')),
      },
    });
    await container.start();
    container.queryClient.setQueryData(['items'], ['previous user data']);

    const error = await loadItems().catch((caught: unknown) => caught);
    await flushPromises();

    expect(error).toBeInstanceOf(AuthExpiredError);
    expect(container.sessionStore.getState()).toMatchObject({
      status: 'signed-out',
      signedOutReason: 'expired',
    });
    expect(secretStore.dump()).toEqual({});
    expect(container.queryClient.getQueryData(['items'])).toBeUndefined();
    expect(keyValueStore.dump()['query.cache']).toBeUndefined();
  });

  it('keeps the session when the network is down during a refresh', async () => {
    const { container, secretStore, sleeps, loadItems } = setup({
      stored: storedSession({ expiresAt: NOW - MINUTE }),
      authenticator: {
        refresh: () => Promise.reject(new TypeError('Network request failed')),
      },
    });
    await container.start();

    const error = await loadItems().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TokenRefreshError);
    expect(container.sessionStore.getState().status).toBe('signed-in');
    expect(secretStore.dump()['auth.session']).toBeDefined();
    expect(sleeps).toEqual([2_000, 4_000]);
  });

  it('signs out on request and removes the data of that user, but keeps preferences', async () => {
    const { container, secretStore, keyValueStore } = setup({
      stored: storedSession(),
    });
    await container.start();
    container.queryClient.setQueryData(['items'], ['data']);
    await container.languageSettings.choose('en');

    await container.authService.signOut();

    expect(container.sessionStore.getState()).toMatchObject({
      status: 'signed-out',
      signedOutReason: 'user',
    });
    expect(secretStore.dump()).toEqual({});
    expect(container.queryClient.getQueryData(['items'])).toBeUndefined();
    expect(keyValueStore.dump()['settings.language']).toBe('en');
  });
});

describe('privacy', () => {
  it('never writes tokens to the log', async () => {
    const { container, backend, loadItems } = setup({
      authenticator: {
        signIn: async () =>
          ok({
            accessToken: 'access-secret',
            refreshToken: 'refresh-secret',
            expiresAt: NOW + 60 * MINUTE,
          }),
      },
    });
    backend.once('GET', ITEMS_PATH, () => new Response(null, { status: 401 }));
    await container.start();

    await container.authService.signIn();
    await loadItems();
    await container.authService.signOut();

    const log = JSON.stringify(container.logger.entries());
    for (const secret of ['access-secret', 'refresh-secret', 'access-2', 'refresh-2']) {
      expect(log).not.toContain(secret);
    }
  });
});

describe('stopping', () => {
  it('stops following the session', async () => {
    const { container, scheduler } = setup({ stored: storedSession() });
    await container.start();

    container.stop();

    expect(scheduler.pending()).toEqual([]);
  });
});
