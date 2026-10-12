import { describe, expect, it, vi } from 'vitest';
import { AuthExpiredError } from '@/shared/api/errors';
import { err, ok } from '@/shared/result';
import { createFakeClock, createInMemorySecretStore, createRecordingSleep } from '@/test/fakes';
import { createAuthService, createRefresher, type Authenticator } from './auth-service';
import { createSessionRepository } from './session-repository';
import { createTokenProvider, type Refresher } from './token-provider';

const NOW = Date.UTC(2026, 8, 21, 12, 0, 0);
const tokens = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: NOW + 3_600_000 };

function fakeAuthenticator(overrides: Partial<Authenticator> = {}): Authenticator {
  return {
    method: 'azure-ad',
    signIn: vi.fn(async () => ok(tokens)),
    refresh: vi.fn(async () => tokens),
    ...overrides,
  };
}

function setup(options: { authenticator?: Authenticator; onSignedOut?: () => void } = {}) {
  const store = createInMemorySecretStore();
  const provider = createTokenProvider({
    repository: createSessionRepository(store),
    refresh: vi.fn<Refresher>(),
    clock: createFakeClock(NOW),
    sleep: createRecordingSleep().sleep,
  });
  const authenticator = options.authenticator ?? fakeAuthenticator();
  const service = createAuthService({
    provider,
    authenticator,
    onSignedOut: options.onSignedOut,
  });
  return { service, provider, authenticator, store };
}

describe('signIn', () => {
  it('signs in with the method of the authenticator', async () => {
    const { service, provider } = setup();

    expect(await service.signIn()).toEqual({ ok: true, value: undefined });
    expect(provider.getStatus()).toBe('signed-in');
    expect(provider.getMethod()).toBe('azure-ad');
    expect(await provider.getAccessToken()).toBe('access-1');
  });

  it('tells which method this build uses', () => {
    const { service } = setup({ authenticator: fakeAuthenticator({ method: 'demo' }) });

    expect(service.method).toBe('demo');
  });

  it('does not sign in when the user cancels', async () => {
    const authenticator = fakeAuthenticator({
      signIn: vi.fn(async () => err({ kind: 'cancelled' as const })),
    });
    const { service, provider, store } = setup({ authenticator });

    expect(await service.signIn()).toEqual({ ok: false, error: { kind: 'cancelled' } });
    expect(provider.getMethod()).toBeNull();
    expect(store.dump()).toEqual({});
  });
});

describe('signOut', () => {
  it('signs out and then lets the app clean up its user data', async () => {
    const onSignedOut = vi.fn();
    const { service, provider, store } = setup({ onSignedOut });
    await service.signIn();

    await service.signOut();

    expect(provider.getStatus()).toBe('signed-out');
    expect(store.dump()).toEqual({});
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });

  it('works without a cleanup callback', async () => {
    const { service, provider } = setup();
    await service.signIn();

    await expect(service.signOut()).resolves.toBeUndefined();
    expect(provider.getStatus()).toBe('signed-out');
  });
});

describe('createRefresher', () => {
  const session = (method: 'azure-ad' | 'demo') => ({
    method,
    accessToken: 'a',
    refreshToken: 'r',
    expiresAt: NOW,
  });

  it('refreshes with the authenticator of this build', async () => {
    const authenticator = fakeAuthenticator();

    expect(await createRefresher(authenticator)(session('azure-ad'))).toEqual(tokens);
    expect(authenticator.refresh).toHaveBeenCalledWith('r');
  });

  it('ends a session that another sign-in method stored', async () => {
    const authenticator = fakeAuthenticator();

    await expect(createRefresher(authenticator)(session('demo'))).rejects.toBeInstanceOf(
      AuthExpiredError,
    );
    expect(authenticator.refresh).not.toHaveBeenCalled();
  });
});
