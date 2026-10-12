import type { ProblemDetails } from './problem-details';

const MAX_BODY_LENGTH = 2000;

type ErrorOptions = { cause?: unknown };

/** The server answered with a non-2xx status. */
export class HttpError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails | null;
  /** Raw response body (truncated). Needed for non-problem formats such as OAuth error responses. */
  readonly body: string;

  constructor(status: number, problem: ProblemDetails | null, body = '', options?: ErrorOptions) {
    super(problem?.detail ?? problem?.title ?? `HTTP ${status}`, options);
    this.name = 'HttpError';
    this.status = status;
    this.problem = problem;
    this.body = body.slice(0, MAX_BODY_LENGTH);
  }
}

/** The request never got an answer (offline, DNS, connection reset). */
export class NetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super('Network request failed', options);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, options?: ErrorOptions) {
    super(`Request timed out after ${timeoutMs}ms`, options);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** The answer did not have the expected shape. Never retry: the server will answer the same again. */
export class ResponseParseError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[], options?: ErrorOptions) {
    super(`Unexpected response: ${issues.join('; ')}`, options);
    this.name = 'ResponseParseError';
    this.issues = issues;
  }
}

export type AuthExpiredReason = 'no-session' | 'refresh-rejected' | 'signed-out';

/** The session cannot be recovered. The app must send the user back to login. */
export class AuthExpiredError extends Error {
  readonly reason: AuthExpiredReason;

  constructor(reason: AuthExpiredReason, options?: ErrorOptions) {
    super(`Session expired (${reason})`, options);
    this.name = 'AuthExpiredError';
    this.reason = reason;
  }
}

/** Refreshing the token failed for a temporary reason. The session is kept; try again later. */
export class TokenRefreshError extends Error {
  constructor(options?: ErrorOptions) {
    super('Token refresh failed temporarily', options);
    this.name = 'TokenRefreshError';
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/** Whether repeating the same request could succeed. */
export function isRetryable(error: unknown): boolean {
  if (error instanceof NetworkError || error instanceof TimeoutError) {
    return true;
  }
  if (error instanceof TokenRefreshError) {
    return true;
  }
  if (error instanceof HttpError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  return false;
}
