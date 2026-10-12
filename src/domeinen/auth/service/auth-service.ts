import { AuthExpiredError } from '@/shared/api/errors';
import type { Logger } from '@/shared/logging/logger';
import { ok, type Result } from '@/shared/result';
import type { LoginFailure } from '../domain/login-failures';
import type { AuthMethod } from '../domain/session';
import type { Refresher, TokenProvider, TokenSet } from './token-provider';

/**
 * One way to sign in, picked per build (`EXPO_PUBLIC_AUTH_PROVIDER`). The demo one is pure
 * (`demo-authenticator.ts`); a real one usually needs a native module and lives in `platform/rn`.
 */
export type Authenticator = {
  readonly method: AuthMethod;
  signIn(): Promise<Result<Required<TokenSet>, LoginFailure>>;
  /** MUST throw `AuthExpiredError` when the refresh token is definitively refused. */
  refresh(refreshToken: string): Promise<TokenSet>;
};

/**
 * Refreshes with the authenticator of this build. A session stored by a build with another method
 * (the configuration changed) cannot be refreshed here, so it ends instead of failing forever.
 */
export function createRefresher(authenticator: Authenticator): Refresher {
  return async (session) => {
    if (session.method !== authenticator.method) {
      throw new AuthExpiredError('refresh-rejected');
    }
    return authenticator.refresh(session.refreshToken);
  };
}

export type AuthService = {
  /** Which sign-in this build uses, so the login screen can say so. */
  readonly method: AuthMethod;
  signIn(): Promise<Result<void, LoginFailure>>;
  signOut(): Promise<void>;
};

export type AuthServiceDeps = {
  provider: TokenProvider;
  authenticator: Authenticator;
  /** Called after sign-out so caches and stored user data can be dropped. */
  onSignedOut?: () => Promise<void> | void;
  logger?: Logger;
};

export function createAuthService(deps: AuthServiceDeps): AuthService {
  const { provider, authenticator, logger } = deps;

  return {
    method: authenticator.method,

    async signIn() {
      const result = await authenticator.signIn();
      if (!result.ok) {
        return result;
      }
      await provider.signIn({ method: authenticator.method, ...result.value });
      logger?.info('auth', 'Signed in', { method: authenticator.method });
      return ok(undefined);
    },

    async signOut() {
      await provider.signOut('user');
      await deps.onSignedOut?.();
    },
  };
}
