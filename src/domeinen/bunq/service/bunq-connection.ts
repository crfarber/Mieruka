import { HttpError, isRetryable } from '@/shared/api/errors';
import type { HttpClient } from '@/shared/api/http-client';
import type { Logger } from '@/shared/logging/logger';
import { err, ok, type Result } from '@/shared/result';
import {
  bunqErrorDescription,
  createInstallation,
  registerDevice,
  startSession,
  type BunqSession,
} from '../api/bunq-api';
import { parseApiKey, type BunqConnection, type ConnectFailure } from '../domain/connection';
import type { ConnectionRepository } from './connection-repository';
import type { RequestSigner } from './rsa-signer';

export type BunqConnectionStatus = 'unknown' | 'connected' | 'disconnected';

/** `user`: the user disconnected or signed out. `refused`: bunq no longer accepts the API key. */
export type DisconnectReason = 'user' | 'refused';

export type BunqConnectionEvent =
  | { type: 'restored'; connected: boolean }
  | { type: 'connected' }
  | { type: 'disconnected'; reason: DisconnectReason };

/** There is no connection with bunq (any more): the user has to connect (again). Never retried. */
export class BunqNotConnectedError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Not connected to bunq', options);
    this.name = 'BunqNotConnectedError';
  }
}

export type BunqConnectionService = {
  /** Loads the stored connection. Call once at start-up, before anything talks to bunq. */
  restore(): Promise<void>;
  /**
   * Connects with an API key from the bunq app: a new key pair, an installation, this phone as a
   * device, and a first session. Slow: generating the key takes seconds on a phone.
   */
  connect(apiKey: string): Promise<Result<void, ConnectFailure>>;
  /** Forgets the connection on this phone. The API key stays valid in bunq until the user revokes it. */
  disconnect(): Promise<void>;
  /**
   * Runs a call in the current session. When bunq answers 401 the session has ended: one new
   * session is started (however many calls ask at the same time) and the call runs once more.
   */
  withSession<T>(call: (session: BunqSession) => Promise<T>): Promise<T>;
  getStatus(): BunqConnectionStatus;
  subscribe(listener: (event: BunqConnectionEvent) => void): () => void;
};

export type BunqConnectionDeps = {
  /** An HTTP client for bunq's API (see `BUNQ_API_URLS`). */
  http: HttpClient;
  signer: RequestSigner;
  repository: ConnectionRepository;
  logger?: Logger;
};

const sessionOf = (connection: BunqConnection): BunqSession => ({
  token: connection.sessionToken,
  userId: connection.userId,
});

/**
 * Owns the connection with bunq, the same way the token provider owns the app's own session
 * (docs/decisions/0018):
 * - one new session at a time, however many calls find the old one ended;
 * - a temporary failure keeps the connection; only a refusal by bunq ends it;
 * - a disconnect while connecting or renewing wins: the late result is thrown away;
 * - storage writes happen in order, so a late save cannot undo a disconnect.
 */
export function createBunqConnection(deps: BunqConnectionDeps): BunqConnectionService {
  const { http, signer, repository, logger } = deps;

  let connection: BunqConnection | null = null;
  let restored = false;
  let restoring: Promise<void> | null = null;
  /** Bumped by every connect and disconnect, so work that started earlier can tell it is stale. */
  let generation = 0;
  let renewing: Promise<BunqConnection> | null = null;
  let writeQueue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(event: BunqConnectionEvent) => void>();

  const emit = (event: BunqConnectionEvent): void => {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        logger?.error('bunq', 'Connection listener failed', { error });
      }
    }
  };

  /** Runs storage operations one after the other, in the order they were requested. */
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = writeQueue.then(operation, operation);
    writeQueue = result.catch(() => undefined);
    return result;
  };

  async function load(): Promise<void> {
    const stored = await repository.load();
    // A connect or disconnect that happened while loading is more recent than what was stored.
    if (!restored && generation === 0) {
      connection = stored;
    }
    restored = true;
    emit({ type: 'restored', connected: connection !== null });
  }

  function restore(): Promise<void> {
    if (restoring === null) {
      restoring = load().catch((error: unknown) => {
        restoring = null; // let a later call try again
        throw error;
      });
    }
    return restoring;
  }

  async function end(reason: DisconnectReason): Promise<void> {
    const wasConnected = connection !== null;
    generation += 1;
    connection = null;
    restored = true;
    try {
      await enqueue(() => repository.clear());
    } finally {
      if (wasConnected || reason === 'user') {
        emit({ type: 'disconnected', reason });
      }
    }
  }

  async function connect(input: string): Promise<Result<void, ConnectFailure>> {
    const apiKey = parseApiKey(input);
    if (!apiKey.ok) {
      return err({ kind: 'invalid-key' });
    }
    // Taken before the first await: a disconnect right after pressing "connect" must still win.
    const startedIn = generation;
    await restore();

    // Until the device registers, the API key plays no part: a refusal before that is not about it.
    let stage: 'setup' | 'login' = 'setup';
    let next: BunqConnection;
    try {
      const keys = await signer.generateKeyPair();
      const installationToken = await createInstallation(http, keys.publicKeyPem);
      const sign = (body: string) => signer.sign(keys.privateKey, body);
      stage = 'login';
      await registerDevice(http, { installationToken, apiKey: apiKey.value, sign });
      const session = await startSession(http, { installationToken, apiKey: apiKey.value, sign });
      next = {
        apiKey: apiKey.value,
        privateKey: keys.privateKey,
        installationToken,
        sessionToken: session.token,
        userId: session.userId,
      };
    } catch (error) {
      if (generation !== startedIn) {
        return err({ kind: 'cancelled' });
      }
      if (isRetryable(error)) {
        logger?.warn('bunq', 'Could not reach bunq while connecting', { stage, error });
        return err({ kind: 'unavailable' });
      }
      if (stage === 'login' && error instanceof HttpError) {
        const reason = bunqErrorDescription(error);
        logger?.warn('bunq', 'bunq refused the API key', { status: error.status, reason });
        return err({ kind: 'refused', reason });
      }
      logger?.error('bunq', 'Connecting to bunq failed unexpectedly', { stage, error });
      throw error;
    }

    if (generation !== startedIn) {
      return err({ kind: 'cancelled' });
    }
    generation += 1;
    connection = next;
    restored = true;
    await enqueue(() => repository.save(next));
    logger?.info('bunq', 'Connected to bunq');
    emit({ type: 'connected' });
    return ok(undefined);
  }

  async function renew(current: BunqConnection, startedIn: number): Promise<BunqConnection> {
    let session: BunqSession;
    try {
      session = await startSession(http, {
        installationToken: current.installationToken,
        apiKey: current.apiKey,
        sign: (body) => signer.sign(current.privateKey, body),
      });
    } catch (error) {
      if (error instanceof HttpError && !isRetryable(error) && generation === startedIn) {
        logger?.warn('bunq', 'bunq refused a new session, the connection ends', {
          status: error.status,
          reason: bunqErrorDescription(error),
        });
        await end('refused');
        throw new BunqNotConnectedError({ cause: error });
      }
      throw error;
    }

    if (generation !== startedIn) {
      throw new BunqNotConnectedError();
    }
    const next: BunqConnection = {
      ...current,
      sessionToken: session.token,
      userId: session.userId,
    };
    // In memory first, with no await since the check above: a disconnect cannot slip in between,
    // and one that comes during the save clears storage after it.
    connection = next;
    await enqueue(() => repository.save(next));
    logger?.info('bunq', 'Started a new bunq session');
    return next;
  }

  /** Joins the renewal that is running, or starts one. */
  function renewShared(): Promise<BunqConnection> {
    const current = connection;
    if (current === null) {
      return Promise.reject(new BunqNotConnectedError());
    }
    if (renewing === null) {
      const tracked: Promise<BunqConnection> = renew(current, generation).finally(() => {
        if (renewing === tracked) {
          renewing = null;
        }
      });
      renewing = tracked;
    }
    return renewing;
  }

  async function withSession<T>(call: (session: BunqSession) => Promise<T>): Promise<T> {
    await restore();
    const used = connection;
    if (used === null) {
      throw new BunqNotConnectedError();
    }
    try {
      return await call(sessionOf(used));
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 401)) {
        throw error;
      }
      // Another call may already have started a new session while this one was underway.
      const latest = connection;
      const renewed =
        latest !== null && latest.sessionToken !== used.sessionToken ? latest : await renewShared();
      return call(sessionOf(renewed));
    }
  }

  return {
    restore,
    connect,
    disconnect: () => end('user'),
    withSession,
    getStatus: () => (!restored ? 'unknown' : connection ? 'connected' : 'disconnected'),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
