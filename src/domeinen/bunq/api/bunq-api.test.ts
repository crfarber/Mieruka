import { describe, expect, it } from 'vitest';
import { HttpError, NetworkError, ResponseParseError } from '@/shared/api/errors';
import { createHttpClient } from '@/shared/api/http-client';
import { createLogger } from '@/shared/logging/logger';
import { createFakeClock, jsonResponse } from '@/test/fakes';
import {
  bunqErrorDescription,
  CLIENT_NAME,
  createInstallation,
  listMonetaryAccounts,
  registerDevice,
  startSession,
} from './bunq-api';

type Sent = { method: string; url: URL; headers: Record<string, string>; body: string | undefined };

function setup(answer: unknown) {
  const sent: Sent[] = [];
  const logger = createLogger({ clock: createFakeClock() });
  const http = createHttpClient({
    baseUrl: 'https://bunq.test/v1',
    fetch: async (input, init) => {
      sent.push({
        method: init?.method ?? 'GET',
        url: new URL(String(input)),
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      return jsonResponse(answer);
    },
    // The app's own sign-in. bunq calls must never send its token.
    getAccessToken: async () => 'app-token',
    refreshAccessToken: async () => 'app-token-2',
    logger,
  });
  return { http, sent, logger };
}

const sign = async (body: string) => `signed(${body})`;

const bankAccount = (overrides: Record<string, unknown> = {}) => ({
  id: 11,
  description: 'Boodschappen',
  status: 'ACTIVE',
  currency: 'EUR',
  balance: { value: '412.35', currency: 'EUR' },
  alias: [
    { type: 'EMAIL', value: 'someone@example.com', name: 'Someone' },
    { type: 'IBAN', value: 'NL00BUNQ0000000011', name: 'Someone' },
  ],
  ...overrides,
});

describe('createInstallation', () => {
  it('hands bunq the public key and returns the installation token', async () => {
    const { http, sent } = setup({
      Response: [
        { Id: { id: 1 } },
        { Token: { id: 2, token: 'installation-token' } },
        { ServerPublicKey: { server_public_key: 'PEM' } },
      ],
    });

    const token = await createInstallation(http, 'PUBLIC KEY PEM');

    expect(token).toBe('installation-token');
    expect(sent[0]?.method).toBe('POST');
    expect(sent[0]?.url.pathname).toBe('/v1/installation');
    expect(JSON.parse(sent[0]?.body ?? '{}')).toEqual({ client_public_key: 'PUBLIC KEY PEM' });
    expect(sent[0]?.headers).toMatchObject({
      'Cache-Control': 'no-cache',
      'User-Agent': CLIENT_NAME,
      'Content-Type': 'application/json',
    });
    expect(sent[0]?.headers).not.toHaveProperty('Authorization');
    expect(sent[0]?.headers).not.toHaveProperty('X-Bunq-Client-Authentication');
  });

  it('refuses an answer without a token', async () => {
    const { http } = setup({ Response: [{ Id: { id: 1 } }] });

    await expect(createInstallation(http, 'PEM')).rejects.toBeInstanceOf(ResponseParseError);
  });

  it('refuses a token that is not a text', async () => {
    const { http } = setup({ Response: [{ Token: { token: 42 } }] });

    await expect(createInstallation(http, 'PEM')).rejects.toThrow('Token.token');
  });
});

describe('registerDevice', () => {
  it('registers the phone for the api key, signed, for every IP address', async () => {
    const { http, sent } = setup({ Response: [{ Id: { id: 3 } }] });

    await registerDevice(http, { installationToken: 'installation-token', apiKey: 'key', sign });

    const request = sent[0];
    expect(request?.url.pathname).toBe('/v1/device-server');
    expect(JSON.parse(request?.body ?? '{}')).toEqual({
      description: CLIENT_NAME,
      secret: 'key',
      permitted_ips: ['*'],
    });
    expect(request?.headers['X-Bunq-Client-Authentication']).toBe('installation-token');
    expect(request?.headers['X-Bunq-Client-Signature']).toBe(`signed(${request?.body})`);
    expect(request?.headers).not.toHaveProperty('Authorization');
  });
});

describe('startSession', () => {
  it('logs in with the api key and returns the session token and the user', async () => {
    const { http, sent } = setup({
      Response: [
        { Id: { id: 5 } },
        { Token: { id: 6, token: 'session-token' } },
        { UserPerson: { id: 1234, display_name: 'Someone' } },
      ],
    });

    const session = await startSession(http, {
      installationToken: 'installation-token',
      apiKey: 'key',
      sign,
    });

    expect(session).toEqual({ token: 'session-token', userId: 1234 });
    expect(sent[0]?.url.pathname).toBe('/v1/session-server');
    expect(sent[0]?.body).toBe('{"secret":"key"}');
    expect(sent[0]?.headers['X-Bunq-Client-Signature']).toBe('signed({"secret":"key"})');
    expect(sent[0]?.headers['X-Bunq-Client-Authentication']).toBe('installation-token');
  });

  it('accepts a company as the user', async () => {
    const { http } = setup({
      Response: [{ Token: { token: 'session-token' } }, { UserCompany: { id: 77 } }],
    });

    const session = await startSession(http, { installationToken: 'i', apiKey: 'k', sign });

    expect(session.userId).toBe(77);
  });

  it('refuses an answer without a user', async () => {
    const { http } = setup({ Response: [{ Token: { token: 'session-token' } }] });

    await expect(startSession(http, { installationToken: 'i', apiKey: 'k', sign })).rejects.toThrow(
      'no UserPerson or UserCompany',
    );
  });
});

describe('bunqErrorDescription', () => {
  const refusal = (body: string) => new HttpError(400, null, body);

  it("reads bunq's own explanation of a refusal", () => {
    const body = JSON.stringify({
      Error: [{ error_description: 'Incorrect API key or IP address.' }],
    });

    expect(bunqErrorDescription(refusal(body))).toBe('Incorrect API key or IP address.');
  });

  it('joins several explanations', () => {
    const body = JSON.stringify({
      Error: [{ error_description: 'One.' }, { error_description: 'Two.' }],
    });

    expect(bunqErrorDescription(refusal(body))).toBe('One. Two.');
  });

  it.each([
    ['an empty body', ''],
    ['a body that is not JSON', '<html>'],
    ['an empty list of errors', '{"Error":[]}'],
    ['another shape', '{"title":"Bad request"}'],
  ])('has nothing to say for %s', (_case, body) => {
    expect(bunqErrorDescription(refusal(body))).toBeNull();
  });

  it('has nothing to say when bunq did not answer at all', () => {
    expect(bunqErrorDescription(new NetworkError())).toBeNull();
  });
});

describe('listMonetaryAccounts', () => {
  const session = { token: 'session-token', userId: 1234 };

  it('reads the accounts of the user with the session token', async () => {
    const { http, sent } = setup({
      Response: [
        { MonetaryAccountBank: bankAccount() },
        {
          MonetaryAccountSavings: bankAccount({
            id: 12,
            description: 'Sparen',
            balance: { value: '-3.5', currency: 'EUR' },
            alias: [],
          }),
        },
        { MonetaryAccountJoint: bankAccount({ id: 13, status: 'CANCELLED', alias: undefined }) },
      ],
      Pagination: { future_url: null, newer_url: null, older_url: null },
    });

    const accounts = await listMonetaryAccounts(http, session);

    expect(accounts).toEqual([
      {
        id: 11,
        description: 'Boodschappen',
        iban: 'NL00BUNQ0000000011',
        balance: { cents: 41235, currency: 'EUR' },
        status: 'ACTIVE',
      },
      {
        id: 12,
        description: 'Sparen',
        iban: null,
        balance: { cents: -350, currency: 'EUR' },
        status: 'ACTIVE',
      },
      {
        id: 13,
        description: 'Boodschappen',
        iban: null,
        balance: { cents: 41235, currency: 'EUR' },
        status: 'CANCELLED',
      },
    ]);
    expect(sent[0]?.method).toBe('GET');
    expect(sent[0]?.url.pathname).toBe('/v1/user/1234/monetary-account');
    expect(sent[0]?.url.searchParams.get('count')).toBe('200');
    expect(sent[0]?.headers['X-Bunq-Client-Authentication']).toBe('session-token');
    expect(sent[0]?.headers).not.toHaveProperty('X-Bunq-Client-Signature');
    expect(sent[0]?.headers).not.toHaveProperty('Authorization');
  });

  it('leaves out kinds of account that hold no money of the user, without a warning', async () => {
    const { http, logger } = setup({
      Response: [{ MonetaryAccountCard: { id: 20 } }, { MonetaryAccountBank: bankAccount() }],
    });

    const accounts = await listMonetaryAccounts(http, session, logger);

    expect(accounts.map((account) => account.id)).toEqual([11]);
    expect(logger.entries()).toEqual([]);
  });

  it('leaves out a malformed account and logs it, without emptying the list', async () => {
    const { http, logger } = setup({
      Response: [
        { MonetaryAccountBank: bankAccount({ id: 'eleven' }) },
        {
          MonetaryAccountBank: bankAccount({ id: 14, balance: { value: 'n/a', currency: 'EUR' } }),
        },
        { MonetaryAccountBank: bankAccount({ id: 15 }) },
      ],
    });

    const accounts = await listMonetaryAccounts(http, session, logger);

    expect(accounts.map((account) => account.id)).toEqual([15]);
    const warnings = logger.entries().filter((entry) => entry.category === 'bunq');
    expect(warnings).toHaveLength(2);
  });
});
