import { z } from 'zod';

/**
 * How the session was signed in, so a refresh goes back to the same place. `demo` needs no backend;
 * `azure-ad` signs in through a browser sheet (see `platform/rn/azure-ad-authenticator.ts`).
 */
export const AUTH_METHODS = ['demo', 'azure-ad'] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

/**
 * Everything that makes up a signed-in session, in ONE value that is stored in one write. Separate
 * keys for access token, refresh token, expiry and method can get out of sync; one value cannot.
 */
export type Session = {
  readonly method: AuthMethod;
  readonly accessToken: string;
  /** Never empty: without it the session cannot be recovered. */
  readonly refreshToken: string;
  /** Epoch milliseconds at which the access token stops being valid. */
  readonly expiresAt: number;
};

export const sessionSchema = z.object({
  method: z.enum(AUTH_METHODS),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int().positive(),
});

/** A token that expires within this margin is refreshed before it is used. */
export const ACCESS_TOKEN_SKEW_MS = 2 * 60 * 1000;

/** The background refresh runs this long before the token expires. */
export const PROACTIVE_REFRESH_LEAD_MS = 5 * 60 * 1000;

/** The token is valid and stays valid long enough to be used for a request. */
export function isAccessTokenFresh(session: Pick<Session, 'expiresAt'>, now: number): boolean {
  return session.expiresAt - now > ACCESS_TOKEN_SKEW_MS;
}

export function isAccessTokenExpired(session: Pick<Session, 'expiresAt'>, now: number): boolean {
  return session.expiresAt <= now;
}

/** Milliseconds until the background refresh is due. Zero when it is due now. */
export function getProactiveRefreshDelay(expiresAt: number, now: number): number {
  return Math.max(0, expiresAt - PROACTIVE_REFRESH_LEAD_MS - now);
}

/** Reads a stored session. Anything that is not a complete, valid session is treated as no session. */
export function parseStoredSession(raw: string | null): Session | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
