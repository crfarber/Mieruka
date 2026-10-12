import type { Clock } from '@/shared/platform/ports';
import { ok } from '@/shared/result';
import type { Authenticator } from './auth-service';

/** How long a demo access token lives. Short enough that a demo also runs the refresh path. */
export const DEMO_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

/**
 * Signs in without a backend, so a new project runs end to end before it has an identity provider.
 * The tokens are placeholders: an API that checks them refuses them. The configuration does not
 * allow this method in a production environment (`parseRuntimeConfig`).
 */
export function createDemoAuthenticator(clock: Clock): Authenticator {
  let issued = 0;

  const issue = () => {
    issued += 1;
    const now = clock.now();
    return {
      accessToken: `demo-access-${issued}`,
      refreshToken: `demo-refresh-${issued}`,
      expiresAt: now + DEMO_TOKEN_LIFETIME_MS,
    };
  };

  return {
    method: 'demo',
    signIn: () => Promise.resolve(ok(issue())),
    refresh: () => Promise.resolve(issue()),
  };
}
