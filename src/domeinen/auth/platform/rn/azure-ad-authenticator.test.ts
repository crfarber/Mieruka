import { describe, expect, it, vi } from 'vitest';
import { AuthExpiredError, TokenRefreshError } from '@/shared/api/errors';
import type { AppAuthClient } from './azure-ad-authenticator';
import { createAzureAdAuthenticator } from './azure-ad-authenticator';

const CONFIG = {
  tenantId: 'tenant-1',
  clientId: 'client-1',
  redirectUrl: 'com.example.app.auth://login/',
  apiScopes: [],
};

function setup(client: Partial<AppAuthClient> = {}) {
  const fullClient: AppAuthClient = {
    authorize: vi.fn(),
    refresh: vi.fn(),
    ...client,
  };
  const authenticator = createAzureAdAuthenticator({ config: CONFIG, client: fullClient });
  return { authenticator, client: fullClient };
}

describe('signIn', () => {
  it('signs in and converts the expiry to epoch milliseconds', async () => {
    const { authenticator, client } = setup({
      authorize: vi.fn(async () => ({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        accessTokenExpirationDate: '2026-09-22T10:00:00.000Z',
        idToken: 'id-1',
        tokenType: 'Bearer',
        scopes: ['openid'],
        authorizationCode: 'code-1',
      })),
    });

    const result = await authenticator.signIn();

    expect(authenticator.method).toBe('azure-ad');
    expect(result).toEqual({
      ok: true,
      value: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: Date.parse('2026-09-22T10:00:00.000Z'),
      },
    });
    expect(client.authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        redirectUrl: 'com.example.app.auth://login/',
      }),
    );
  });

  it('fails when Azure AD does not return a refresh token', async () => {
    const { authenticator } = setup({
      authorize: vi.fn(async () => ({
        accessToken: 'access-1',
        refreshToken: '',
        accessTokenExpirationDate: '2026-09-22T10:00:00.000Z',
        idToken: 'id-1',
        tokenType: 'Bearer',
        scopes: [],
        authorizationCode: 'code-1',
      })),
    });

    expect(await authenticator.signIn()).toEqual({ ok: false, error: { kind: 'failed' } });
  });

  it('reports a cancel when the user declines consent', async () => {
    const { authenticator } = setup({
      authorize: vi.fn(async () => {
        throw Object.assign(new Error('Access denied'), { code: 'access_denied' });
      }),
    });

    expect(await authenticator.signIn()).toEqual({ ok: false, error: { kind: 'cancelled' } });
  });

  it('reports a cancel when the sheet is dismissed (the iOS fallback code for it)', async () => {
    const { authenticator } = setup({
      authorize: vi.fn(async () => {
        // Confirmed on a device: declining the system prompt gives this code with a message
        // that does not mention "cancel" (see domain/login-failures.ts).
        throw Object.assign(new Error("The operation couldn't be completed."), {
          code: 'authentication_failed',
        });
      }),
    });

    expect(await authenticator.signIn()).toEqual({ ok: false, error: { kind: 'cancelled' } });
  });

  it('reports a failure for a distinct, non-cancel code', async () => {
    const { authenticator } = setup({
      authorize: vi.fn(async () => {
        throw Object.assign(new Error('No browser found'), { code: 'browser_not_found' });
      }),
    });

    expect(await authenticator.signIn()).toEqual({ ok: false, error: { kind: 'failed' } });
  });

  it('reports a failure when the rejection is not an AppAuthError', async () => {
    const { authenticator } = setup({
      authorize: vi.fn(async () => {
        throw new Error('boom');
      }),
    });

    expect(await authenticator.signIn()).toEqual({ ok: false, error: { kind: 'failed' } });
  });
});

describe('refresh', () => {
  it('exchanges the refresh token and keeps a rotated one', async () => {
    const { authenticator, client } = setup({
      refresh: vi.fn(async () => ({
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
        accessTokenExpirationDate: '2026-09-22T11:00:00.000Z',
        idToken: 'id-2',
        tokenType: 'Bearer',
      })),
    });

    const result = await authenticator.refresh('refresh-1');

    expect(result).toEqual({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      expiresAt: Date.parse('2026-09-22T11:00:00.000Z'),
    });
    expect(client.refresh).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'client-1' }), {
      refreshToken: 'refresh-1',
    });
  });

  it('keeps the current refresh token when Azure AD does not rotate it', async () => {
    const { authenticator } = setup({
      refresh: vi.fn(async () => ({
        accessToken: 'access-2',
        refreshToken: null,
        accessTokenExpirationDate: '2026-09-22T11:00:00.000Z',
        idToken: 'id-2',
        tokenType: 'Bearer',
      })),
    });

    expect(await authenticator.refresh('refresh-1')).toEqual({
      accessToken: 'access-2',
      refreshToken: undefined,
      expiresAt: Date.parse('2026-09-22T11:00:00.000Z'),
    });
  });

  it('signs the user out when the refresh token is definitively refused', async () => {
    const { authenticator } = setup({
      refresh: vi.fn(async () => {
        throw Object.assign(new Error('AADSTS70008: expired'), { code: 'invalid_grant' });
      }),
    });

    await expect(authenticator.refresh('refresh-1')).rejects.toThrow(AuthExpiredError);
  });

  it('keeps the session on a temporary failure', async () => {
    const { authenticator } = setup({
      refresh: vi.fn(async () => {
        throw Object.assign(new Error('The Internet connection appears to be offline.'), {
          code: 'token_refresh_failed',
        });
      }),
    });

    await expect(authenticator.refresh('refresh-1')).rejects.toThrow(TokenRefreshError);
  });
});
