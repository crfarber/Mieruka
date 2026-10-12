import { z } from 'zod';
import { err, ok, type Result } from '@/shared/result';

/**
 * Everything the app needs to talk to bunq for one user, in ONE value that is stored in one write
 * (docs/decisions/0018). Secret: it lives in the connection service and secure storage, nowhere else.
 */
export type BunqConnection = {
  /** The API key the user made in the bunq app. Needed again for every new session. */
  readonly apiKey: string;
  /** The private key of this installation, in the signer's own format. */
  readonly privateKey: string;
  /** Authenticates the calls that start a session. */
  readonly installationToken: string;
  /** Authenticates every other call, until bunq ends the session. */
  readonly sessionToken: string;
  /** The bunq user the API key belongs to. Part of every path (`/user/{id}/...`). */
  readonly userId: number;
};

const connectionSchema = z.object({
  apiKey: z.string().min(1),
  privateKey: z.string().min(1),
  installationToken: z.string().min(1),
  sessionToken: z.string().min(1),
  userId: z.number().int().positive(),
});

/** Reads a stored connection. Anything that is not complete and valid counts as no connection. */
export function parseStoredConnection(raw: string | null): BunqConnection | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = connectionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * An API key as typed or pasted. Spaces around it are a copy-paste accident and go; a key with
 * spaces inside cannot be right.
 */
export function parseApiKey(input: string): Result<string, 'empty' | 'malformed'> {
  const key = input.trim();
  if (key === '') {
    return err('empty');
  }
  if (/\s/.test(key)) {
    return err('malformed');
  }
  return ok(key);
}

/** The ways connecting can fail in an expected manner, and the text that belongs to each. */
export type ConnectFailure =
  /** Nothing usable was typed. */
  | { kind: 'invalid-key' }
  /**
   * bunq answered, but would not register this device or start a session with the key. `reason`
   * is bunq's own explanation, when it gave one.
   */
  | { kind: 'refused'; reason: string | null }
  /** bunq could not be reached, or had a temporary problem. Trying again later may work. */
  | { kind: 'unavailable' }
  /** The user disconnected (or signed out) while connecting. Nothing to explain. */
  | { kind: 'cancelled' };

/** Translation keys (see `shared/i18n/resources.ts`). */
export type ConnectMessageKey =
  | 'bunq.connect.errors.invalidKey'
  | 'bunq.connect.errors.refused'
  | 'bunq.connect.errors.unavailable';

/** Null when nothing needs to be said. */
export function describeConnectFailure(failure: ConnectFailure): ConnectMessageKey | null {
  switch (failure.kind) {
    case 'invalid-key':
      return 'bunq.connect.errors.invalidKey';
    case 'refused':
      return 'bunq.connect.errors.refused';
    case 'unavailable':
      return 'bunq.connect.errors.unavailable';
    case 'cancelled':
      return null;
  }
}
