import { describe, expect, it } from 'vitest';
import { createInMemorySecretStore } from '@/test/fakes';
import type { Session } from '../domain/session';
import { createSessionRepository, SESSION_KEY } from './session-repository';

const session: Session = {
  method: 'azure-ad',
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: 1_800_000_000_000,
};

describe('createSessionRepository', () => {
  it('returns null when nothing is stored', async () => {
    expect(await createSessionRepository(createInMemorySecretStore()).load()).toBeNull();
  });

  it('saves and loads a session', async () => {
    const repository = createSessionRepository(createInMemorySecretStore());

    await repository.save(session);

    expect(await repository.load()).toEqual(session);
  });

  it('stores the whole session under one key', async () => {
    const store = createInMemorySecretStore();

    await createSessionRepository(store).save(session);

    expect(Object.keys(store.dump())).toEqual([SESSION_KEY]);
  });

  it('clears the session', async () => {
    const store = createInMemorySecretStore();
    const repository = createSessionRepository(store);
    await repository.save(session);

    await repository.clear();

    expect(store.dump()).toEqual({});
    expect(await repository.load()).toBeNull();
  });

  it('removes damaged data and reports no session', async () => {
    const store = createInMemorySecretStore({ [SESSION_KEY]: '{"method":"azure-ad"}' });

    expect(await createSessionRepository(store).load()).toBeNull();
    expect(store.dump()).toEqual({});
  });

  it('removes data that is not JSON', async () => {
    const store = createInMemorySecretStore({ [SESSION_KEY]: 'garbage' });

    expect(await createSessionRepository(store).load()).toBeNull();
    expect(store.dump()).toEqual({});
  });
});
