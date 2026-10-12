import { describe, expect, it, vi } from 'vitest';
import { AuthExpiredError, NetworkError } from '@/shared/api/errors';
import {
  createFakeClock,
  createFakeScheduler,
  createInMemorySecretStore,
  createRecordingSleep,
  flushPromises,
} from '@/test/fakes';
import type { Session } from '../domain/session';
import { createSessionLifecycle } from './session-lifecycle';
import { createSessionRepository } from './session-repository';
import { createTokenProvider, type Refresher, type TokenSet } from './token-provider';

const NOW = Date.UTC(2026, 8, 21, 12, 0, 0);
const MINUTE = 60_000;

const makeSession = (expiresInMinutes: number): Session => ({
  method: 'demo',
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: NOW + expiresInMinutes * MINUTE,
});

async function setup(session: Session | null = makeSession(60)) {
  const clock = createFakeClock(NOW);
  const scheduler = createFakeScheduler();
  const refresh = vi.fn<Refresher>(async (): Promise<TokenSet> => ({
    accessToken: 'access-2',
    refreshToken: 'refresh-2',
    expiresAt: clock.now() + 60 * MINUTE,
  }));
  const repository = createSessionRepository(createInMemorySecretStore());
  const provider = createTokenProvider({
    repository,
    refresh,
    clock,
    sleep: createRecordingSleep().sleep,
  });
  if (session) {
    await provider.signIn(session);
  } else {
    await provider.restore();
  }
  const lifecycle = createSessionLifecycle({ provider, scheduler, clock });
  return { provider, lifecycle, scheduler, refresh, clock };
}

describe('scheduling the background refresh', () => {
  it('schedules a refresh five minutes before the token expires', async () => {
    const { lifecycle, scheduler } = await setup(makeSession(60));

    lifecycle.start();

    expect(scheduler.pending().map((timer) => timer.delayMs)).toEqual([55 * MINUTE]);
  });

  it('schedules it immediately when it is already due', async () => {
    const { lifecycle, scheduler } = await setup(makeSession(3));

    lifecycle.start();

    expect(scheduler.pending().map((timer) => timer.delayMs)).toEqual([0]);
  });

  it('schedules nothing without a session', async () => {
    const { lifecycle, scheduler } = await setup(null);

    lifecycle.start();

    expect(scheduler.pending()).toEqual([]);
  });

  it('starts scheduling when the user signs in later', async () => {
    const { lifecycle, scheduler, provider } = await setup(null);
    lifecycle.start();

    await provider.signIn(makeSession(30));

    expect(scheduler.pending().map((timer) => timer.delayMs)).toEqual([25 * MINUTE]);
  });

  it('starts scheduling when a stored session is restored after start', async () => {
    const clock = createFakeClock(NOW);
    const scheduler = createFakeScheduler();
    const store = createInMemorySecretStore();
    const repository = createSessionRepository(store);
    await repository.save(makeSession(60));
    const provider = createTokenProvider({
      repository,
      refresh: vi.fn(),
      clock,
      sleep: createRecordingSleep().sleep,
    });
    const lifecycle = createSessionLifecycle({ provider, scheduler, clock });
    lifecycle.start();
    expect(scheduler.pending()).toEqual([]);

    await provider.restore();

    expect(scheduler.pending().map((timer) => timer.delayMs)).toEqual([55 * MINUTE]);
  });

  it('cancels the timer when the user signs out', async () => {
    const { lifecycle, scheduler, provider } = await setup();
    lifecycle.start();

    await provider.signOut();

    expect(scheduler.pending()).toEqual([]);
  });

  it('cancels the timer when it is stopped, and does nothing after that', async () => {
    const { lifecycle, scheduler, provider } = await setup();
    lifecycle.start();

    lifecycle.stop();
    await provider.signIn(makeSession(30));

    expect(scheduler.pending()).toEqual([]);
  });

  it('keeps one timer when started twice', async () => {
    const { lifecycle, scheduler } = await setup();

    lifecycle.start();
    lifecycle.start();

    expect(scheduler.pending()).toHaveLength(1);
  });
});

describe('when the timer fires', () => {
  it('refreshes and schedules the next one from the new expiry', async () => {
    const { lifecycle, scheduler, refresh } = await setup(makeSession(6));
    lifecycle.start();

    await scheduler.fireNext();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(scheduler.pending().map((timer) => timer.delayMs)).toEqual([55 * MINUTE]);
  });

  it('never refreshes in a tight loop, even when the server hands out very short tokens', async () => {
    const { lifecycle, scheduler, refresh, clock } = await setup(makeSession(3));
    refresh.mockImplementation(async () => ({
      accessToken: 'short-lived',
      expiresAt: clock.now() + MINUTE,
    }));
    lifecycle.start();

    await scheduler.fireNext();

    expect(scheduler.pending().map((timer) => timer.delayMs)).toEqual([30_000]);
  });

  it('retries after a temporary failure with growing pauses, and keeps the session', async () => {
    const { lifecycle, scheduler, refresh, provider } = await setup(makeSession(3));
    refresh.mockRejectedValue(new NetworkError());
    lifecycle.start();

    const delays: number[] = [];
    for (let round = 0; round < 6; round += 1) {
      await scheduler.fireNext();
      delays.push(scheduler.pending()[0]?.delayMs ?? -1);
    }

    expect(delays).toEqual([5_000, 15_000, 60_000, 300_000, 300_000, 300_000]);
    expect(provider.getStatus()).toBe('signed-in');
  });

  it('starts the pauses over after a success', async () => {
    const { lifecycle, scheduler, refresh } = await setup(makeSession(3));
    // The provider retries three times by itself; all three must fail for the lifecycle to see it.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      refresh.mockRejectedValueOnce(new NetworkError());
    }
    lifecycle.start();

    await scheduler.fireNext(); // fails, retry in 5 s
    expect(scheduler.pending()[0]?.delayMs).toBe(5_000);
    await scheduler.fireNext(); // succeeds
    expect(scheduler.pending()[0]?.delayMs).toBe(55 * MINUTE);
  });

  it('does not retry after the server refused the refresh token, the user is signed out', async () => {
    const { lifecycle, scheduler, refresh, provider } = await setup(makeSession(3));
    refresh.mockRejectedValue(new AuthExpiredError('refresh-rejected'));
    lifecycle.start();

    await scheduler.fireNext();

    expect(scheduler.pending()).toEqual([]);
    expect(provider.getStatus()).toBe('signed-out');
  });

  it('survives an unexpected error without scheduling anything', async () => {
    const { lifecycle, scheduler, provider } = await setup(makeSession(3));
    vi.spyOn(provider, 'refreshNow').mockRejectedValue(new Error('what'));
    lifecycle.start();

    await scheduler.fireNext();
    await flushPromises();

    expect(scheduler.pending()).toEqual([]);
  });

  it('does nothing when the user signed out in the meantime', async () => {
    const { lifecycle, scheduler, refresh, provider } = await setup(makeSession(3));
    lifecycle.start();
    const timer = scheduler.pending()[0];

    await provider.signOut();
    timer?.callback();
    await flushPromises();

    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('onForeground', () => {
  it('does nothing when nobody is signed in', async () => {
    const { lifecycle, scheduler, refresh } = await setup(null);
    lifecycle.start();

    await lifecycle.onForeground();

    expect(refresh).not.toHaveBeenCalled();
    expect(scheduler.pending()).toEqual([]);
  });

  it('only reschedules while the token is still fresh', async () => {
    const { lifecycle, scheduler, refresh, clock } = await setup(makeSession(60));
    lifecycle.start();
    clock.advance(10 * MINUTE);

    await lifecycle.onForeground();

    expect(refresh).not.toHaveBeenCalled();
    expect(scheduler.pending().map((timer) => timer.delayMs)).toEqual([45 * MINUTE]);
  });

  it('refreshes at once when the token expired while the app was in the background', async () => {
    const { lifecycle, refresh, clock, provider } = await setup(makeSession(60));
    lifecycle.start();
    clock.advance(90 * MINUTE);

    await lifecycle.onForeground();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(provider.getStatus()).toBe('signed-in');
  });

  it('keeps the session when the refresh fails because there is no network, and retries later', async () => {
    const { lifecycle, scheduler, refresh, clock, provider } = await setup(makeSession(60));
    refresh.mockRejectedValue(new NetworkError());
    lifecycle.start();
    clock.advance(90 * MINUTE);

    await lifecycle.onForeground();

    expect(provider.getStatus()).toBe('signed-in');
    expect(scheduler.pending().map((timer) => timer.delayMs)).toEqual([5_000]);
  });

  it('does nothing before it is started', async () => {
    const { lifecycle, refresh, clock } = await setup(makeSession(60));
    clock.advance(90 * MINUTE);

    await lifecycle.onForeground();

    expect(refresh).not.toHaveBeenCalled();
  });
});
