import { describe, expect, it } from 'vitest';
import { createFakeClock } from '@/test/fakes';
import { createDemoAuthenticator, DEMO_TOKEN_LIFETIME_MS } from './demo-authenticator';

const NOW = Date.UTC(2026, 8, 21, 12, 0, 0);

describe('createDemoAuthenticator', () => {
  it('signs in without a backend, with a token that lives for an hour', async () => {
    const authenticator = createDemoAuthenticator(createFakeClock(NOW));

    const result = await authenticator.signIn();

    expect(authenticator.method).toBe('demo');
    expect(result).toEqual({
      ok: true,
      value: {
        accessToken: 'demo-access-1',
        refreshToken: 'demo-refresh-1',
        expiresAt: NOW + DEMO_TOKEN_LIFETIME_MS,
      },
    });
  });

  it('hands out new tokens on every refresh, counted from the current time', async () => {
    const clock = createFakeClock(NOW);
    const authenticator = createDemoAuthenticator(clock);
    await authenticator.signIn();
    clock.advance(10_000);

    expect(await authenticator.refresh('demo-refresh-1')).toEqual({
      accessToken: 'demo-access-2',
      refreshToken: 'demo-refresh-2',
      expiresAt: NOW + 10_000 + DEMO_TOKEN_LIFETIME_MS,
    });
  });
});
