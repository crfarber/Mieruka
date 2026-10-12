import type { AzureAdConfig } from '@/shared/config/runtime-config';

/**
 * Scopes every Azure AD sign-in asks for. `offline_access` is what returns a refresh token; without
 * it the session cannot be kept alive. The API's own scopes come from the configuration.
 */
const BASE_SCOPES: readonly string[] = ['openid', 'profile', 'email', 'offline_access'];

/**
 * What `react-native-app-auth`'s `authorize()`/`refresh()` need. A local, minimal shape rather than
 * the library's own type: this file is a pure domain layer and may not import a platform package
 * (`architecture.test.ts`). `platform/rn/azure-ad-authenticator.ts` passes the result straight to
 * the real functions; it is structurally the same shape as the library's `AuthConfiguration`.
 */
export type AzureAdAuthorizationConfiguration = {
  issuer: string;
  serviceConfiguration: {
    authorizationEndpoint: string;
    tokenEndpoint: string;
  };
  clientId: string;
  redirectUrl: string;
  scopes: string[];
};

/**
 * Builds the AppAuth configuration for Azure AD v2. Sets `serviceConfiguration` alongside `issuer`
 * so `authorize()` can skip fetching the discovery document before it shows the sign-in sheet.
 */
export function buildAzureAdConfiguration(
  config: AzureAdConfig,
): AzureAdAuthorizationConfiguration {
  const base = `https://login.microsoftonline.com/${config.tenantId}`;
  return {
    issuer: `${base}/v2.0`,
    serviceConfiguration: {
      authorizationEndpoint: `${base}/oauth2/v2.0/authorize`,
      tokenEndpoint: `${base}/oauth2/v2.0/token`,
    },
    clientId: config.clientId,
    redirectUrl: config.redirectUrl,
    scopes: [...BASE_SCOPES, ...config.apiScopes.filter((scope) => !BASE_SCOPES.includes(scope))],
  };
}
