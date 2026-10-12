import { describe, expect, it, vi } from 'vitest';
import { createFakeClock, createInMemorySecretStore, createRecordingSleep } from '@/test/fakes';
import type { Session } from '../domain/session';
import { createSessionRepository } from '../service/session-repository';
import { createTokenProvider, type Refresher } from '../service/token-provider';
import { bindSessionStore, createSessionStore } from './session-store';

const NOW = Date.UTC(2026, 8, 21, 12, 0, 0);
const session: Session = {
  method: 'azure-ad',
  accessToken: 'a',
  refreshToken: 'r',
  expiresAt: NOW + 3_600_000,
};

function setup() {
  const repository = createSessionRepository(createInMemorySecretStore());
  const provider = createTokenProvider({
    repository,
    refresh: vi.fn<Refresher>(),
    clock: createFakeClock(NOW),
    sleep: createRecordingSleep().sleep,
  });
  const store = createSessionStore();
  return { repository, provider, store };
}

describe('session store', () => {
  it('starts unknown', () => {
    expect(setup().store.getState()).toEqual({
      status: 'unknown',
      method: null,
      signedOutReason: null,
    });
  });

  it('becomes signed-out when nothing was stored', async () => {
    const { provider, store } = setup();
    bindSessionStore(provider, store);

    await provider.restore();

    expect(store.getState()).toMatchObject({ status: 'signed-out', method: null });
  });

  it('becomes signed-in with the user type of the stored session', async () => {
    const { provider, store, repository } = setup();
    await repository.save(session);
    bindSessionStore(provider, store);

    await provider.restore();

    expect(store.getState()).toMatchObject({ status: 'signed-in', method: 'azure-ad' });
  });

  it('follows a sign-in and a sign-out by the user', async () => {
    const { provider, store } = setup();
    bindSessionStore(provider, store);
    await provider.restore();

    await provider.signIn(session);
    expect(store.getState()).toMatchObject({ status: 'signed-in', method: 'azure-ad' });

    await provider.signOut('user');
    expect(store.getState()).toEqual({
      status: 'signed-out',
      method: null,
      signedOutReason: 'user',
    });
  });

  it('remembers that the session ended by itself, so the login screen can explain', async () => {
    const { provider, store } = setup();
    bindSessionStore(provider, store);
    await provider.signIn(session);

    await provider.signOut('expired');

    expect(store.getState().signedOutReason).toBe('expired');
  });

  it('forgets the reason after signing in again', async () => {
    const { provider, store } = setup();
    bindSessionStore(provider, store);
    await provider.signIn(session);
    await provider.signOut('expired');

    await provider.signIn(session);

    expect(store.getState().signedOutReason).toBeNull();
  });

  it('picks up a provider that had already restored before the binding', async () => {
    const { provider, store, repository } = setup();
    await repository.save(session);
    await provider.restore();

    bindSessionStore(provider, store);

    expect(store.getState()).toMatchObject({ status: 'signed-in', method: 'azure-ad' });
  });

  it('stops following the provider after unbinding', async () => {
    const { provider, store } = setup();
    const unbind = bindSessionStore(provider, store);
    await provider.restore();

    unbind();
    await provider.signIn(session);

    expect(store.getState().status).toBe('signed-out');
  });

  it('never holds the tokens', async () => {
    const { provider, store } = setup();
    bindSessionStore(provider, store);
    await provider.signIn(session);

    expect(JSON.stringify(store.getState())).not.toContain('"a"');
    expect(Object.keys(store.getState()).sort()).toEqual(['method', 'signedOutReason', 'status']);
  });
});
