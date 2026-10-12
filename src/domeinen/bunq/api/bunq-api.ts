import { z } from 'zod';
import { HttpError, ResponseParseError } from '@/shared/api/errors';
import type { HttpClient, RequestOptions } from '@/shared/api/http-client';
import type { QueryValue } from '@/shared/api/url';
import type { BunqEnvironment } from '@/shared/config/runtime-config';
import type { Logger } from '@/shared/logging/logger';
import { parseDecimalAmount } from '@/shared/money';
import type { MonetaryAccount } from '../domain/accounts';

/** Base URLs from bunq's OpenAPI description (`servers`). */
export const BUNQ_API_URLS: Record<BunqEnvironment, string> = {
  production: 'https://api.bunq.com/v1',
  sandbox: 'https://public-api.sandbox.bunq.com/v1',
};

/** How the app introduces itself to bunq: the User-Agent of every call and the name of the device. */
export const CLIENT_NAME = 'Mieruka';

/** Signs a request body. bunq checks the signature when a device registers and a session starts. */
export type SignBody = (body: string) => Promise<string>;

/** The session a call runs in: its token, and the user the paths are about. */
export type BunqSession = { token: string; userId: number };

/**
 * The options of every bunq call. bunq has its own authentication header instead of the bearer
 * token of the app's own backend, hence `auth: false`. Cache-Control and User-Agent are mandatory.
 */
async function bunqOptions(request: {
  token?: string;
  json?: Record<string, unknown>;
  sign?: SignBody;
  query?: Record<string, QueryValue>;
}): Promise<RequestOptions> {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache',
    'User-Agent': CLIENT_NAME,
  };
  if (request.token !== undefined) {
    headers['X-Bunq-Client-Authentication'] = request.token;
  }
  if (request.json !== undefined && request.sign !== undefined) {
    // The HTTP client sends JSON.stringify(json); the signature must cover exactly those bytes.
    headers['X-Bunq-Client-Signature'] = await request.sign(JSON.stringify(request.json));
  }
  return {
    auth: false,
    method: request.json === undefined ? 'GET' : 'POST',
    headers,
    json: request.json,
    query: request.query,
  };
}

/** bunq wraps every answer in a list of one-key objects: `{ "Response": [{ "Token": {…} }, …] }`. */
const envelopeSchema = z.looseObject({
  Response: z.array(z.record(z.string(), z.unknown())),
});

type ResponseItem = Record<string, unknown>;

/** The first item under one of `keys`, checked against `schema`. Missing or malformed: a parse error. */
function pick<T>(
  items: readonly ResponseItem[],
  keys: readonly string[],
  schema: z.ZodType<T>,
  path: string,
): T {
  for (const item of items) {
    const key = keys.find((candidate) => candidate in item);
    if (key !== undefined) {
      const parsed = schema.safeParse(item[key]);
      if (parsed.success) {
        return parsed.data;
      }
      throw new ResponseParseError(
        parsed.error.issues.map(
          (issue) => `${path} ${key}.${issue.path.join('.')}: ${issue.message}`,
        ),
      );
    }
  }
  throw new ResponseParseError([`${path}: no ${keys.join(' or ')} in the response`]);
}

/** How bunq explains a 4xx (the field the bunq SDKs read: `Error[].error_description`). */
const errorSchema = z.looseObject({
  Error: z.array(z.looseObject({ error_description: z.string() })).min(1),
});

/**
 * bunq's own explanation of a refusal, for example "Incorrect API key or IP address.". Null when
 * the failure is not an answer from bunq or has no explanation in the expected shape.
 */
export function bunqErrorDescription(error: unknown): string | null {
  if (!(error instanceof HttpError)) {
    return null;
  }
  let body: unknown;
  try {
    body = JSON.parse(error.body);
  } catch {
    return null;
  }
  const parsed = errorSchema.safeParse(body);
  return parsed.success
    ? parsed.data.Error.map((entry) => entry.error_description).join(' ')
    : null;
}

const tokenSchema = z.looseObject({ token: z.string().min(1) });
const userSchema = z.looseObject({ id: z.number().int().positive() });

/** The kinds of user a session can be for (`SessionServerCreate` in bunq's OpenAPI description). */
const USER_KINDS = ['UserPerson', 'UserCompany', 'UserApiKey', 'UserPaymentServiceProvider'];

/** POST /installation: hands bunq the public key. The token authenticates the next two calls. */
export async function createInstallation(http: HttpClient, publicKeyPem: string): Promise<string> {
  const path = '/installation';
  const envelope = await http.requestJson(
    path,
    envelopeSchema,
    await bunqOptions({ json: { client_public_key: publicKeyPem } }),
  );
  return pick(envelope.Response, ['Token'], tokenSchema, path).token;
}

/**
 * POST /device-server: registers this phone for the API key. All IP addresses are allowed (`*`),
 * because a phone changes address with every network (docs/functioneel/open-vragen.md, 2).
 */
export async function registerDevice(
  http: HttpClient,
  request: { installationToken: string; apiKey: string; sign: SignBody },
): Promise<void> {
  await http.requestJson(
    '/device-server',
    envelopeSchema,
    await bunqOptions({
      token: request.installationToken,
      sign: request.sign,
      json: { description: CLIENT_NAME, secret: request.apiKey, permitted_ips: ['*'] },
    }),
  );
}

/** POST /session-server: logs in with the API key. Also how a new session starts after one ends. */
export async function startSession(
  http: HttpClient,
  request: { installationToken: string; apiKey: string; sign: SignBody },
): Promise<BunqSession> {
  const path = '/session-server';
  const envelope = await http.requestJson(
    path,
    envelopeSchema,
    await bunqOptions({
      token: request.installationToken,
      sign: request.sign,
      json: { secret: request.apiKey },
    }),
  );
  return {
    token: pick(envelope.Response, ['Token'], tokenSchema, path).token,
    userId: pick(envelope.Response, USER_KINDS, userSchema, path).id,
  };
}

/** The kinds of account that hold money of the user. Others (cards, external, investment) are left out. */
const ACCOUNT_KINDS = ['MonetaryAccountBank', 'MonetaryAccountSavings', 'MonetaryAccountJoint'];

const accountSchema = z.looseObject({
  id: z.number().int(),
  description: z.string(),
  status: z.string(),
  balance: z.looseObject({ value: z.string(), currency: z.string().length(3) }),
  alias: z.array(z.looseObject({ type: z.string(), value: z.string() })).optional(),
});

/** bunq's page limit for a list (doc.bunq.com, "Pagination"). Nobody has more accounts than that. */
const MAX_PAGE_SIZE = 200;

/**
 * GET /user/{id}/monetary-account: the accounts of every kind. Each row is read on its own, so one
 * malformed account does not empty the list; it is left out and logged.
 */
export async function listMonetaryAccounts(
  http: HttpClient,
  session: BunqSession,
  logger?: Logger,
): Promise<MonetaryAccount[]> {
  const envelope = await http.requestJson(
    `/user/${session.userId}/monetary-account`,
    envelopeSchema,
    await bunqOptions({ token: session.token, query: { count: MAX_PAGE_SIZE } }),
  );

  const accounts: MonetaryAccount[] = [];
  for (const item of envelope.Response) {
    const kind = ACCOUNT_KINDS.find((candidate) => candidate in item);
    if (kind === undefined) {
      continue;
    }
    const parsed = accountSchema.safeParse(item[kind]);
    const cents = parsed.success ? parseDecimalAmount(parsed.data.balance.value) : null;
    if (!parsed.success || cents === null) {
      logger?.warn('bunq', 'Skipped an account that does not have the expected shape', {
        kind,
        issues: parsed.success
          ? ['balance.value: not an amount']
          : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      });
      continue;
    }
    const account = parsed.data;
    accounts.push({
      id: account.id,
      description: account.description,
      iban: account.alias?.find((alias) => alias.type === 'IBAN')?.value ?? null,
      balance: { cents, currency: account.balance.currency },
      status: account.status,
    });
  }
  return accounts;
}
