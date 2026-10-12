import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import {
  bindSessionStore,
  createSessionRepository,
  createSessionStore,
  createTokenProvider,
  SESSION_KEY,
} from '@/domeinen/auth';
import { ACCOUNT_CHOICE_KEY, CONNECTION_KEY } from '@/domeinen/bunq';
import { LANGUAGE_KEY } from '@/domeinen/settings';
import { createFakeClock, createInMemorySecretStore, createRecordingSleep } from '@/test/fakes';
import { collectDebugSnapshot } from './collect-debug-snapshot';

const refresher = async () => {
  throw new Error('refresh should not run during a debug snapshot');
};

describe('collectDebugSnapshot', () => {
  it('returns null for each known key when storage is empty', async () => {
    const store = createInMemorySecretStore();
    const sessionStore = createSessionStore();
    const provider = createTokenProvider({
      repository: createSessionRepository(store),
      refresh: refresher,
      clock: createFakeClock(),
      sleep: createRecordingSleep().sleep,
    });
    bindSessionStore(provider, sessionStore);
    await provider.restore();

    const snapshot = await collectDebugSnapshot({
      secretStore: store,
      keyValueStore: store,
      sessionStore,
      tokenProvider: provider,
      queryClient: new QueryClient(),
    });

    expect(snapshot.storage[SESSION_KEY]).toBeNull();
    expect(snapshot.storage[LANGUAGE_KEY]).toBeNull();
    expect(snapshot.storage[ACCOUNT_CHOICE_KEY]).toBeNull();
    expect(snapshot.sessionStore).toEqual({
      status: 'signed-out',
      method: null,
      signedOutReason: null,
    });
    expect(snapshot.tokenProvider).toEqual({
      status: 'signed-out',
      method: null,
      expiresAt: null,
    });
    expect(snapshot.queryCache).toEqual([]);
  });

  it('includes the access token from disk after a session is saved', async () => {
    const store = createInMemorySecretStore();
    const repository = createSessionRepository(store);
    await repository.save({
      method: 'demo',
      accessToken: 'access-token-value',
      refreshToken: 'refresh-token-value',
      expiresAt: Date.UTC(2026, 8, 21, 13, 0, 0),
    });
    await store.setItem(LANGUAGE_KEY, 'en');
    await store.setItem(ACCOUNT_CHOICE_KEY, '11');
    await store.setItem(CONNECTION_KEY, '{"apiKey":"bunq-api-key"}');

    const sessionStore = createSessionStore();
    const provider = createTokenProvider({
      repository,
      refresh: refresher,
      clock: createFakeClock(),
      sleep: createRecordingSleep().sleep,
    });
    await provider.restore();
    sessionStore.setState({
      status: 'signed-in',
      method: 'demo',
      signedOutReason: null,
    });

    const snapshot = await collectDebugSnapshot({
      secretStore: store,
      keyValueStore: store,
      sessionStore,
      tokenProvider: provider,
      queryClient: new QueryClient(),
    });

    expect(snapshot.storage[SESSION_KEY]).toEqual({
      method: 'demo',
      accessToken: 'access-token-value',
      refreshToken: 'refresh-token-value',
      expiresAt: Date.UTC(2026, 8, 21, 13, 0, 0),
    });
    expect(snapshot.storage[LANGUAGE_KEY]).toBe('en');
    expect(snapshot.storage[ACCOUNT_CHOICE_KEY]).toBe(11);
    expect(JSON.stringify(snapshot)).not.toContain('bunq-api-key');
    expect(snapshot.sessionStore.status).toBe('signed-in');
    expect(snapshot.tokenProvider).toMatchObject({
      status: 'signed-in',
      method: 'demo',
      expiresAt: Date.UTC(2026, 8, 21, 13, 0, 0),
    });
  });

  it('includes query cache entries without refreshing tokens', async () => {
    const store = createInMemorySecretStore();
    const sessionStore = createSessionStore();
    const provider = createTokenProvider({
      repository: createSessionRepository(store),
      refresh: refresher,
      clock: createFakeClock(),
      sleep: createRecordingSleep().sleep,
    });
    await provider.restore();

    const queryClient = new QueryClient();
    queryClient.setQueryData(['items', 'list'], [{ id: 'a1' }]);

    const snapshot = await collectDebugSnapshot({
      secretStore: store,
      keyValueStore: store,
      sessionStore,
      tokenProvider: provider,
      queryClient,
    });

    expect(snapshot.queryCache).toEqual([
      {
        queryKey: ['items', 'list'],
        status: 'success',
        dataUpdatedAt: expect.any(Number),
        data: [{ id: 'a1' }],
      },
    ]);
  });

  it('truncates oversized query data', async () => {
    const store = createInMemorySecretStore();
    const sessionStore = createSessionStore();
    const provider = createTokenProvider({
      repository: createSessionRepository(store),
      refresh: refresher,
      clock: createFakeClock(),
      sleep: createRecordingSleep().sleep,
    });
    await provider.restore();

    const queryClient = new QueryClient();
    queryClient.setQueryData(['big'], { blob: 'x'.repeat(10_000) });

    const snapshot = await collectDebugSnapshot({
      secretStore: store,
      keyValueStore: store,
      sessionStore,
      tokenProvider: provider,
      queryClient,
    });

    expect(snapshot.queryCache[0]?.data).toMatchObject({ truncated: true });
  });
});
