import { describe, expect, it } from 'vitest';
import { HttpError, NetworkError } from '@/shared/api/errors';
import { createHttpClient } from '@/shared/api/http-client';
import { createLogger } from '@/shared/logging/logger';
import {
  createFakeClock,
  createInMemorySecretStore,
  deferred,
  flushPromises,
  jsonResponse,
} from '@/test/fakes';
import { CONNECTION_KEY, createConnectionRepository } from './connection-repository';
import {
  BunqNotConnectedError,
  createBunqConnection,
  type BunqConnectionEvent,
} from './bunq-connection';
import type { RequestSigner } from './rsa-signer';

type Responder = () => Response | Promise<Response>;

/** A scripted bunq: answers per "METHOD /path", the next queued answer first, else the default. */
function createFakeBunq() {
  const calls: { route: string; headers: Record<string, string> }[] = [];
  const queued = new Map<string, Responder[]>();
  const defaults = new Map<string, Responder>();
  let sessions = 0;

  defaults.set('POST /installation', () =>
    jsonResponse({ Response: [{ Token: { token: 'installation-token' } }] }),
  );
  defaults.set('POST /device-server', () => jsonResponse({ Response: [{ Id: { id: 1 } }] }));
  defaults.set('POST /session-server', () => {
    sessions += 1;
    return jsonResponse({
      Response: [{ Token: { token: `session-${sessions}` } }, { UserPerson: { id: 42 } }],
    });
  });

  const fetchImpl: typeof fetch = async (input, init) => {
    const route = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname.replace('/v1', '')}`;
    calls.push({ route, headers: (init?.headers ?? {}) as Record<string, string> });
    const responder = queued.get(route)?.shift() ?? defaults.get(route);
    if (!responder) {
      throw new Error(`No fake route for ${route}`);
    }
    return responder();
  };

  return {
    fetch: fetchImpl,
    calls,
    routes: () => calls.map((call) => call.route),
    once(route: string, responder: Responder) {
      queued.set(route, [...(queued.get(route) ?? []), responder]);
    },
  };
}

const signer: RequestSigner = {
  generateKeyPair: async () => ({ publicKeyPem: 'PUBLIC PEM', privateKey: 'private-key' }),
  sign: async (privateKey, data) => `${privateKey}:${data.length}`,
};

const storedConnection = {
  apiKey: 'stored-key',
  privateKey: 'private-key',
  installationToken: 'installation-token',
  sessionToken: 'session-old',
  userId: 42,
};

function setup(options: { stored?: object; signer?: RequestSigner } = {}) {
  const bunq = createFakeBunq();
  const store = createInMemorySecretStore(
    options.stored === undefined ? {} : { [CONNECTION_KEY]: JSON.stringify(options.stored) },
  );
  const logger = createLogger({ clock: createFakeClock() });
  const http = createHttpClient({
    baseUrl: 'https://bunq.test/v1',
    fetch: bunq.fetch,
    getAccessToken: async () => null,
    refreshAccessToken: () => Promise.reject(new Error('not used')),
  });
  const connection = createBunqConnection({
    http,
    signer: options.signer ?? signer,
    repository: createConnectionRepository(store),
    logger,
  });
  const events: BunqConnectionEvent[] = [];
  connection.subscribe((event) => events.push(event));

  /** A call that reports the session it ran in, after asking bunq with that session's token. */
  const call = () =>
    connection.withSession(async (session) => {
      const response = await bunq.fetch(`https://bunq.test/v1/user/${session.userId}/thing`, {
        headers: { 'X-Bunq-Client-Authentication': session.token },
      });
      if (!response.ok) {
        throw new HttpError(response.status, null);
      }
      return session.token;
    });

  const stored = () => {
    const raw = store.dump()[CONNECTION_KEY];
    return raw === undefined ? undefined : (JSON.parse(raw) as Record<string, unknown>);
  };

  return { bunq, store, logger, connection, events, call, stored };
}

const ok200 = () => jsonResponse({ Response: [] });
const status = (code: number) => () => new Response('{"Error":[]}', { status: code });

describe('connecting', () => {
  it('installs, registers the phone, starts a session and keeps all of it in secure storage', async () => {
    const { bunq, connection, events, stored } = setup();
    await connection.restore();

    const result = await connection.connect('  my-api-key ');

    expect(result).toEqual({ ok: true, value: undefined });
    expect(bunq.routes()).toEqual([
      'POST /installation',
      'POST /device-server',
      'POST /session-server',
    ]);
    expect(stored()).toEqual({
      apiKey: 'my-api-key',
      privateKey: 'private-key',
      installationToken: 'installation-token',
      sessionToken: 'session-1',
      userId: 42,
    });
    expect(connection.getStatus()).toBe('connected');
    expect(events).toEqual([{ type: 'restored', connected: false }, { type: 'connected' }]);
  });

  it('signs the device registration and the session with the new key', async () => {
    const { bunq, connection } = setup();

    await connection.connect('my-api-key');

    const signed = bunq.calls.filter((call) => 'X-Bunq-Client-Signature' in call.headers);
    expect(signed.map((call) => call.route)).toEqual([
      'POST /device-server',
      'POST /session-server',
    ]);
    expect(
      signed.every((call) => call.headers['X-Bunq-Client-Signature']?.startsWith('private-key:')),
    ).toBe(true);
  });

  it('does not ask bunq anything without a key', async () => {
    const { bunq, connection } = setup();

    expect(await connection.connect('  ')).toEqual({ ok: false, error: { kind: 'invalid-key' } });
    expect(bunq.calls).toEqual([]);
  });

  it('says bunq refused the key when the device may not register', async () => {
    const { bunq, connection, stored, logger } = setup();
    bunq.once('POST /device-server', status(400));

    const result = await connection.connect('wrong-key');

    expect(result).toEqual({ ok: false, error: { kind: 'refused', reason: null } });
    expect(stored()).toBeUndefined();
    expect(connection.getStatus()).toBe('disconnected');
    expect(JSON.stringify(logger.entries())).not.toContain('wrong-key');
  });

  it('says bunq refused the key when the session may not start', async () => {
    const { bunq, connection } = setup();
    bunq.once('POST /session-server', status(403));

    expect(await connection.connect('key')).toEqual({
      ok: false,
      error: { kind: 'refused', reason: null },
    });
  });

  it("passes on bunq's own reason for refusing the key, and logs it", async () => {
    const { bunq, connection, logger } = setup();
    bunq.once(
      'POST /device-server',
      () =>
        new Response(
          JSON.stringify({
            Error: [
              {
                error_description:
                  'User credentials are incorrect. Incorrect API key or IP address.',
                error_description_translated: 'Onjuiste gegevens.',
              },
            ],
          }),
          { status: 400 },
        ),
    );

    const result = await connection.connect('key');

    const reason = 'User credentials are incorrect. Incorrect API key or IP address.';
    expect(result).toEqual({ ok: false, error: { kind: 'refused', reason } });
    expect(logger.entries().find((entry) => entry.category === 'bunq')?.data).toEqual({
      status: 400,
      reason,
    });
  });

  it('logs a failure it cannot explain before passing it on', async () => {
    const { connection, logger } = setup({
      signer: { ...signer, generateKeyPair: () => Promise.reject(new Error('no BigInt')) },
    });

    await expect(connection.connect('key')).rejects.toThrow('no BigInt');

    expect(logger.entries().some((entry) => entry.level === 'error')).toBe(true);
  });

  it('says bunq is unavailable when the network is down or bunq has trouble', async () => {
    const { bunq, connection } = setup();
    bunq.once('POST /installation', () => Promise.reject(new TypeError('Network request failed')));
    bunq.once('POST /installation', status(503));

    expect(await connection.connect('key')).toEqual({ ok: false, error: { kind: 'unavailable' } });
    expect(await connection.connect('key')).toEqual({ ok: false, error: { kind: 'unavailable' } });
  });

  it('treats a refused installation as a fault of the app, not of the key', async () => {
    const { bunq, connection } = setup();
    bunq.once('POST /installation', status(400));

    await expect(connection.connect('key')).rejects.toBeInstanceOf(HttpError);
  });

  it('throws away a connection that completes after the user disconnected', async () => {
    const keyPair = deferred<{ publicKeyPem: string; privateKey: string }>();
    const { connection, stored, bunq } = setup({
      signer: { ...signer, generateKeyPair: () => keyPair.promise },
    });
    await connection.restore();

    const connecting = connection.connect('key');
    await connection.disconnect();
    keyPair.resolve({ publicKeyPem: 'PEM', privateKey: 'private-key' });

    expect(await connecting).toEqual({ ok: false, error: { kind: 'cancelled' } });
    expect(stored()).toBeUndefined();
    expect(connection.getStatus()).toBe('disconnected');
    expect(bunq.routes()).toEqual([
      'POST /installation',
      'POST /device-server',
      'POST /session-server',
    ]);
  });

  it('reports a cancel instead of an error when the user disconnected during a failing connect', async () => {
    const keyPair = deferred<{ publicKeyPem: string; privateKey: string }>();
    const { connection } = setup({ signer: { ...signer, generateKeyPair: () => keyPair.promise } });

    const connecting = connection.connect('key');
    await flushPromises();
    await connection.disconnect();
    keyPair.reject(new Error('key generation failed'));

    expect(await connecting).toEqual({ ok: false, error: { kind: 'cancelled' } });
  });
});

describe('starting the app', () => {
  it('restores a stored connection', async () => {
    const { connection, events } = setup({ stored: storedConnection });

    await connection.restore();

    expect(connection.getStatus()).toBe('connected');
    expect(events).toEqual([{ type: 'restored', connected: true }]);
  });

  it('is unknown until restored, then disconnected without a stored connection', async () => {
    const { connection } = setup();
    expect(connection.getStatus()).toBe('unknown');

    await connection.restore();

    expect(connection.getStatus()).toBe('disconnected');
  });

  it('removes a damaged connection', async () => {
    const { connection, store } = setup({ stored: { apiKey: 'only-a-key' } });

    await connection.restore();

    expect(connection.getStatus()).toBe('disconnected');
    expect(store.dump()).toEqual({});
  });

  it('restores once, however often it is asked', async () => {
    const { connection, events } = setup({ stored: storedConnection });

    await Promise.all([connection.restore(), connection.restore()]);
    await connection.restore();

    expect(events).toHaveLength(1);
  });

  it('tries again after secure storage could not be read', async () => {
    const { connection, store } = setup({ stored: storedConnection });
    const getItem = store.getItem;
    store.getItem = () => Promise.reject(new Error('keychain locked'));

    await expect(connection.restore()).rejects.toThrow('keychain locked');
    store.getItem = getItem;
    await connection.restore();

    expect(connection.getStatus()).toBe('connected');
  });
});

describe('calling bunq in a session', () => {
  it('uses the stored session', async () => {
    const { bunq, connection, call } = setup({ stored: storedConnection });
    bunq.once('GET /user/42/thing', ok200);

    expect(await call()).toBe('session-old');
    expect(bunq.calls[0]?.headers['X-Bunq-Client-Authentication']).toBe('session-old');
    expect(connection.getStatus()).toBe('connected');
  });

  it('refuses to call without a connection', async () => {
    const { call, bunq } = setup();

    await expect(call()).rejects.toBeInstanceOf(BunqNotConnectedError);
    expect(bunq.calls).toEqual([]);
  });

  it('starts a new session once when the old one ended, and stores it', async () => {
    const { bunq, call, stored } = setup({ stored: storedConnection });
    bunq.once('GET /user/42/thing', status(401));
    bunq.once('GET /user/42/thing', ok200);

    expect(await call()).toBe('session-1');
    expect(bunq.routes()).toEqual([
      'GET /user/42/thing',
      'POST /session-server',
      'GET /user/42/thing',
    ]);
    expect(bunq.calls[1]?.headers['X-Bunq-Client-Authentication']).toBe('installation-token');
    expect(stored()?.sessionToken).toBe('session-1');
    expect(stored()?.apiKey).toBe('stored-key');
  });

  it('starts only one new session when several calls find the old one ended', async () => {
    const { bunq, call } = setup({ stored: storedConnection });
    for (let index = 0; index < 3; index += 1) {
      bunq.once('GET /user/42/thing', status(401));
    }
    for (let index = 0; index < 3; index += 1) {
      bunq.once('GET /user/42/thing', ok200);
    }

    expect(await Promise.all([call(), call(), call()])).toEqual([
      'session-1',
      'session-1',
      'session-1',
    ]);
    expect(bunq.routes().filter((route) => route === 'POST /session-server')).toHaveLength(1);
  });

  it('uses a session another call already renewed instead of starting yet another', async () => {
    const { bunq, call } = setup({ stored: storedConnection });
    const slowAnswer = deferred<Response>();
    bunq.once('GET /user/42/thing', () => slowAnswer.promise);
    bunq.once('GET /user/42/thing', status(401));
    bunq.once('GET /user/42/thing', ok200);
    bunq.once('GET /user/42/thing', ok200);

    const slow = call();
    await flushPromises();
    expect(await call()).toBe('session-1');
    slowAnswer.resolve(new Response(null, { status: 401 }));

    expect(await slow).toBe('session-1');
    expect(bunq.routes().filter((route) => route === 'POST /session-server')).toHaveLength(1);
  });

  it('gives up when the new session is refused too, without starting a third', async () => {
    const { bunq, call } = setup({ stored: storedConnection });
    bunq.once('GET /user/42/thing', status(401));
    bunq.once('GET /user/42/thing', status(401));

    await expect(call()).rejects.toMatchObject({ status: 401 });
    expect(bunq.routes().filter((route) => route === 'POST /session-server')).toHaveLength(1);
  });

  it('passes on other failures without starting a new session', async () => {
    const { bunq, call } = setup({ stored: storedConnection });
    bunq.once('GET /user/42/thing', status(500));

    await expect(call()).rejects.toMatchObject({ status: 500 });
    expect(bunq.routes()).toEqual(['GET /user/42/thing']);
  });

  it('ends the connection when bunq no longer accepts the api key', async () => {
    const { bunq, connection, call, events, store } = setup({ stored: storedConnection });
    bunq.once('GET /user/42/thing', status(401));
    bunq.once('POST /session-server', status(400));

    await expect(call()).rejects.toBeInstanceOf(BunqNotConnectedError);
    expect(connection.getStatus()).toBe('disconnected');
    expect(store.dump()).toEqual({});
    expect(events.at(-1)).toEqual({ type: 'disconnected', reason: 'refused' });
  });

  it('keeps the connection when bunq cannot be reached for a new session', async () => {
    const { bunq, connection, call, stored } = setup({ stored: storedConnection });
    bunq.once('GET /user/42/thing', status(401));
    bunq.once('POST /session-server', () => Promise.reject(new TypeError('offline')));

    await expect(call()).rejects.toBeInstanceOf(NetworkError);
    expect(connection.getStatus()).toBe('connected');
    expect(stored()?.sessionToken).toBe('session-old');
  });

  it('throws away a new session that arrives after the user disconnected', async () => {
    const { bunq, connection, call, stored } = setup({ stored: storedConnection });
    const sessionAnswer = deferred<Response>();
    bunq.once('GET /user/42/thing', status(401));
    bunq.once('POST /session-server', () => sessionAnswer.promise);

    const calling = call();
    await flushPromises();
    await connection.disconnect();
    sessionAnswer.resolve(
      jsonResponse({ Response: [{ Token: { token: 'late' } }, { UserPerson: { id: 42 } }] }),
    );

    await expect(calling).rejects.toBeInstanceOf(BunqNotConnectedError);
    expect(connection.getStatus()).toBe('disconnected');
    expect(stored()).toBeUndefined();
  });

  it('does not end a newer connection when an old session is refused late', async () => {
    const { bunq, connection, call, stored } = setup({ stored: storedConnection });
    const sessionAnswer = deferred<Response>();
    bunq.once('GET /user/42/thing', status(401));
    bunq.once('POST /session-server', () => sessionAnswer.promise);

    const calling = call();
    await flushPromises();
    await connection.disconnect();
    await connection.connect('new-key');
    sessionAnswer.resolve(new Response(null, { status: 400 }));

    await expect(calling).rejects.toMatchObject({ status: 400 });
    expect(connection.getStatus()).toBe('connected');
    expect(stored()?.apiKey).toBe('new-key');
  });
});

describe('disconnecting', () => {
  it('forgets the connection and tells the listeners', async () => {
    const { connection, events, store } = setup({ stored: storedConnection });
    await connection.restore();

    await connection.disconnect();

    expect(connection.getStatus()).toBe('disconnected');
    expect(store.dump()).toEqual({});
    expect(events.at(-1)).toEqual({ type: 'disconnected', reason: 'user' });
  });

  it('keeps telling the other listeners when one of them fails', async () => {
    const { connection, events, logger } = setup({ stored: storedConnection });
    connection.subscribe(() => {
      throw new Error('listener broke');
    });

    await connection.restore();

    expect(events).toHaveLength(1);
    expect(logger.entries().some((entry) => entry.level === 'error')).toBe(true);
  });

  it('stops telling a listener that unsubscribed', async () => {
    const { connection } = setup({ stored: storedConnection });
    const heard: BunqConnectionEvent[] = [];
    const unsubscribe = connection.subscribe((event) => heard.push(event));

    unsubscribe();
    await connection.restore();

    expect(heard).toEqual([]);
  });
});
