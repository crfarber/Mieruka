import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig, type RawEnv } from './runtime-config';

const minimal: RawEnv = {};

const azure: RawEnv = {
  EXPO_PUBLIC_AUTH_PROVIDER: 'azure-ad',
  EXPO_PUBLIC_AZURE_AD_TENANT_ID: 'tenant',
  EXPO_PUBLIC_AZURE_AD_CLIENT_ID: 'client',
  EXPO_PUBLIC_AZURE_AD_REDIRECT_URL: 'com.example.app.auth://login/',
};

describe('parseRuntimeConfig', () => {
  it('accepts an empty environment and applies defaults (demo sign-in, internal, no api)', () => {
    const result = parseRuntimeConfig(minimal);

    expect(result).toEqual({
      ok: true,
      value: {
        apiBaseUrl: null,
        environment: 'internal',
        auth: { provider: 'demo' },
      },
    });
  });

  it('strips trailing slashes from the base url', () => {
    const result = parseRuntimeConfig({
      ...minimal,
      EXPO_PUBLIC_API_BASE_URL: 'https://api.test//',
    });
    expect(result.ok && result.value.apiBaseUrl).toBe('https://api.test');
  });

  it('treats a missing or empty api base url as no backend', () => {
    const missing = parseRuntimeConfig({});
    const empty = parseRuntimeConfig({ EXPO_PUBLIC_API_BASE_URL: '' });
    expect(missing.ok && missing.value.apiBaseUrl).toBeNull();
    expect(empty.ok && empty.value.apiBaseUrl).toBeNull();
  });

  it('rejects an invalid api base url', () => {
    expect(parseRuntimeConfig({ EXPO_PUBLIC_API_BASE_URL: 'not a url' }).ok).toBe(false);
  });

  it('treats empty strings as missing', () => {
    const result = parseRuntimeConfig({
      ...minimal,
      EXPO_PUBLIC_ENVIRONMENT: '',
      EXPO_PUBLIC_AUTH_PROVIDER: '',
      EXPO_PUBLIC_AZURE_AD_TENANT_ID: '',
    });
    expect(result.ok && result.value.environment).toBe('internal');
    expect(result.ok && result.value.auth).toEqual({ provider: 'demo' });
  });

  it('accepts a known environment and rejects an unknown one', () => {
    const acceptance = parseRuntimeConfig({
      ...minimal,
      EXPO_PUBLIC_ENVIRONMENT: 'acceptance',
    });
    expect(acceptance.ok && acceptance.value.environment).toBe('acceptance');

    expect(parseRuntimeConfig({ ...minimal, EXPO_PUBLIC_ENVIRONMENT: 'staging' }).ok).toBe(false);
  });

  it('rejects an unknown auth provider', () => {
    const result = parseRuntimeConfig({
      ...minimal,
      EXPO_PUBLIC_AUTH_PROVIDER: 'msal',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error[0]).toContain('EXPO_PUBLIC_AUTH_PROVIDER');
  });

  it('does not allow demo sign-in in production', () => {
    const result = parseRuntimeConfig({
      ...minimal,
      EXPO_PUBLIC_ENVIRONMENT: 'production',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error[0]).toContain('not allowed in production');

    const real = parseRuntimeConfig({
      ...minimal,
      ...azure,
      EXPO_PUBLIC_ENVIRONMENT: 'production',
    });
    expect(real.ok).toBe(true);
  });

  it('builds the Azure AD config when all three fields are present', () => {
    const result = parseRuntimeConfig({ ...minimal, ...azure });
    expect(result.ok && result.value.auth).toEqual({
      provider: 'azure-ad',
      azureAd: {
        tenantId: 'tenant',
        clientId: 'client',
        redirectUrl: 'com.example.app.auth://login/',
        apiScopes: [],
      },
    });
  });

  it('reads the API scopes, space- or comma-separated', () => {
    const result = parseRuntimeConfig({
      ...minimal,
      ...azure,
      EXPO_PUBLIC_AZURE_AD_SCOPES: 'api://client/read, api://client/write  api://client/admin',
    });
    expect(
      result.ok && result.value.auth.provider === 'azure-ad' && result.value.auth.azureAd,
    ).toMatchObject({
      apiScopes: ['api://client/read', 'api://client/write', 'api://client/admin'],
    });
  });

  it('rejects azure-ad sign-in with a partial Azure AD config', () => {
    const result = parseRuntimeConfig({
      ...minimal,
      EXPO_PUBLIC_AUTH_PROVIDER: 'azure-ad',
      EXPO_PUBLIC_AZURE_AD_TENANT_ID: 'tenant',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error[0]).toContain('AZURE_AD');
  });

  it('ignores Azure AD fields while the demo provider is chosen', () => {
    const result = parseRuntimeConfig({
      ...minimal,
      EXPO_PUBLIC_AZURE_AD_TENANT_ID: 'tenant',
    });
    expect(result.ok && result.value.auth).toEqual({ provider: 'demo' });
  });
});
