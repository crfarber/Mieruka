import type { AuthConfiguration, AuthorizeResult, RefreshResult } from 'react-native-app-auth';
import { AuthExpiredError, TokenRefreshError } from '@/shared/api/errors';
import type { AzureAdConfig } from '@/shared/config/runtime-config';
import type { Logger } from '@/shared/logging/logger';
import { err, ok, type Result } from '@/shared/result';
import { buildAzureAdConfiguration } from '../../domain/azure-ad-configuration';
import { classifyAppAuthError, type LoginFailure } from '../../domain/login-failures';
import { classifyRefreshFailure } from '../../domain/refresh-policy';
import type { Authenticator } from '../../service/auth-service';
import type { TokenSet } from '../../service/token-provider';

/**
 * The slice of `react-native-app-auth` this adapter needs, injected so tests can fake it: the real
 * functions call into a native module that only exists inside the built app.
 */
export type AppAuthClient = {
  authorize(config: AuthConfiguration): Promise<AuthorizeResult>;
  refresh(
    config: AuthConfiguration,
    refreshConfig: { refreshToken: string },
  ): Promise<RefreshResult>;
};

export type AzureAdAuthenticatorDeps = {
  config: AzureAdConfig;
  client: AppAuthClient;
  logger?: Logger;
};

/** Reads `.code`/`.message` off whatever `react-native-app-auth` rejects with, without trusting its shape. */
function toFailure(error: unknown): { code?: string; message?: string } {
  if (typeof error !== 'object' || error === null) {
    return {};
  }
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  const message =
    'message' in error && typeof error.message === 'string' ? error.message : undefined;
  return { code, message };
}

/** Azure AD (Microsoft Entra ID) sign-in in a browser sheet, backed by `react-native-app-auth`. */
export function createAzureAdAuthenticator(deps: AzureAdAuthenticatorDeps): Authenticator {
  const { config, client, logger } = deps;
  const authConfig = buildAzureAdConfiguration(config);

  return {
    method: 'azure-ad',

    async signIn(): Promise<Result<Required<TokenSet>, LoginFailure>> {
      let result: AuthorizeResult;
      try {
        result = await client.authorize(authConfig);
      } catch (error) {
        const failure = classifyAppAuthError(toFailure(error));
        if (failure.kind !== 'cancelled') {
          logger?.warn('auth', 'Azure AD sign-in failed', { error });
        }
        return err(failure);
      }

      // Without a refresh token the session cannot be kept alive (is `offline_access` requested?).
      if (!result.refreshToken) {
        logger?.error('auth', 'Azure AD sign-in did not return a refresh token');
        return err({ kind: 'failed' });
      }

      return ok({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: Date.parse(result.accessTokenExpirationDate),
      });
    },

    async refresh(refreshToken: string): Promise<TokenSet> {
      let result: RefreshResult;
      try {
        result = await client.refresh(authConfig, { refreshToken });
      } catch (error) {
        const { code, message } = toFailure(error);
        if (classifyRefreshFailure({ oauthError: code, message }) === 'definitive') {
          throw new AuthExpiredError('refresh-rejected', { cause: error });
        }
        throw new TokenRefreshError({ cause: error });
      }

      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? undefined,
        expiresAt: Date.parse(result.accessTokenExpirationDate),
      };
    },
  };
}
