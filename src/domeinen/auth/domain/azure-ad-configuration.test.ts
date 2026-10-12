import { describe, expect, it } from 'vitest';
import { buildAzureAdConfiguration } from './azure-ad-configuration';

const CONFIG = {
  tenantId: 'tenant-1',
  clientId: 'client-1',
  redirectUrl: 'com.example.app.auth://login/',
  apiScopes: ['api://client-1/access_as_user'],
};

describe('buildAzureAdConfiguration', () => {
  it('builds the v2 issuer and endpoints from the tenant id', () => {
    expect(buildAzureAdConfiguration(CONFIG)).toEqual({
      issuer: 'https://login.microsoftonline.com/tenant-1/v2.0',
      serviceConfiguration: {
        authorizationEndpoint: 'https://login.microsoftonline.com/tenant-1/oauth2/v2.0/authorize',
        tokenEndpoint: 'https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token',
      },
      clientId: 'client-1',
      redirectUrl: 'com.example.app.auth://login/',
      scopes: ['openid', 'profile', 'email', 'offline_access', 'api://client-1/access_as_user'],
    });
  });

  it('always asks for a refresh token, also without API scopes', () => {
    expect(buildAzureAdConfiguration({ ...CONFIG, apiScopes: [] }).scopes).toEqual([
      'openid',
      'profile',
      'email',
      'offline_access',
    ]);
  });

  it('does not repeat a base scope that is also configured', () => {
    expect(
      buildAzureAdConfiguration({ ...CONFIG, apiScopes: ['offline_access', 'api://x/y'] }).scopes,
    ).toEqual(['openid', 'profile', 'email', 'offline_access', 'api://x/y']);
  });

  it('returns a fresh, mutable scopes array every call', () => {
    const a = buildAzureAdConfiguration(CONFIG);
    const b = buildAzureAdConfiguration(CONFIG);

    expect(a.scopes).not.toBe(b.scopes);
    a.scopes.push('extra'); // must not throw: react-native-app-auth expects a mutable string[]
    expect(b.scopes).not.toContain('extra');
  });
});
