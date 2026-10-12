import { z } from 'zod';
import { err, ok, type Result } from '@/shared/result';

export const ENVIRONMENTS = ['internal', 'acceptance', 'production'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const AUTH_PROVIDERS = ['demo', 'azure-ad'] as const;
export type AuthProviderName = (typeof AUTH_PROVIDERS)[number];

export type AzureAdConfig = {
  tenantId: string;
  clientId: string;
  redirectUrl: string;
  /** Scopes of the API, on top of the OpenID scopes every sign-in asks for. */
  apiScopes: readonly string[];
};

/** Which sign-in this build uses, with what that method needs. */
export type AuthConfig = { provider: 'demo' } | { provider: 'azure-ad'; azureAd: AzureAdConfig };

export type RuntimeConfig = {
  /** Null until a backend exists. A request then fails instead of calling a made-up host. */
  apiBaseUrl: string | null;
  environment: Environment;
  auth: AuthConfig;
};

/** Names of the variables the app reads. Expo inlines EXPO_PUBLIC_* at build time. */
export type RawEnv = Partial<
  Record<
    | 'EXPO_PUBLIC_API_BASE_URL'
    | 'EXPO_PUBLIC_ENVIRONMENT'
    | 'EXPO_PUBLIC_AUTH_PROVIDER'
    | 'EXPO_PUBLIC_AZURE_AD_TENANT_ID'
    | 'EXPO_PUBLIC_AZURE_AD_CLIENT_ID'
    | 'EXPO_PUBLIC_AZURE_AD_REDIRECT_URL'
    | 'EXPO_PUBLIC_AZURE_AD_SCOPES',
    string | undefined
  >
>;

const optionalString = z.string().min(1).optional();

const envSchema = z.object({
  EXPO_PUBLIC_API_BASE_URL: z
    .url()
    .transform((value) => value.replace(/\/+$/, ''))
    .optional(),
  EXPO_PUBLIC_ENVIRONMENT: z.enum(ENVIRONMENTS).default('internal'),
  EXPO_PUBLIC_AUTH_PROVIDER: z.enum(AUTH_PROVIDERS).default('demo'),
  EXPO_PUBLIC_AZURE_AD_TENANT_ID: optionalString,
  EXPO_PUBLIC_AZURE_AD_CLIENT_ID: optionalString,
  EXPO_PUBLIC_AZURE_AD_REDIRECT_URL: optionalString,
  EXPO_PUBLIC_AZURE_AD_SCOPES: optionalString,
});

/** `.env` files produce empty strings for unset variables; treat them as missing. */
function withoutEmptyValues(env: RawEnv): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, value === '' ? undefined : value]),
  );
}

/** Space- or comma-separated, like the `scope` parameter of OAuth itself. */
function parseScopes(value: string | undefined): string[] {
  return (value ?? '').split(/[\s,]+/).filter((scope) => scope !== '');
}

/** Validates the environment once at startup. Fails fast with readable messages. */
export function parseRuntimeConfig(env: RawEnv): Result<RuntimeConfig, string[]> {
  const parsed = envSchema.safeParse(withoutEmptyValues(env));
  if (!parsed.success) {
    return err(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }

  const data = parsed.data;
  const base = {
    apiBaseUrl: data.EXPO_PUBLIC_API_BASE_URL ?? null,
    environment: data.EXPO_PUBLIC_ENVIRONMENT,
  };

  if (data.EXPO_PUBLIC_AUTH_PROVIDER === 'demo') {
    if (data.EXPO_PUBLIC_ENVIRONMENT === 'production') {
      return err([
        'EXPO_PUBLIC_AUTH_PROVIDER: demo sign-in is not allowed in production, choose a real provider',
      ]);
    }
    return ok({ ...base, auth: { provider: 'demo' } });
  }

  const tenantId = data.EXPO_PUBLIC_AZURE_AD_TENANT_ID;
  const clientId = data.EXPO_PUBLIC_AZURE_AD_CLIENT_ID;
  const redirectUrl = data.EXPO_PUBLIC_AZURE_AD_REDIRECT_URL;
  if (tenantId === undefined || clientId === undefined || redirectUrl === undefined) {
    return err([
      'EXPO_PUBLIC_AZURE_AD_*: azure-ad sign-in needs the tenant id, client id and redirect url',
    ]);
  }

  return ok({
    ...base,
    auth: {
      provider: 'azure-ad',
      azureAd: {
        tenantId,
        clientId,
        redirectUrl,
        apiScopes: parseScopes(data.EXPO_PUBLIC_AZURE_AD_SCOPES),
      },
    },
  });
}
