import type { z } from 'zod';
import type { Logger } from '@/shared/logging/logger';
import {
  AuthExpiredError,
  HttpError,
  isAbortError,
  NetworkError,
  ResponseParseError,
  TimeoutError,
} from './errors';
import { parseProblemDetails } from './problem-details';
import { buildUrl, encodeForm, type QueryValue } from './url';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestOptions = {
  method?: HttpMethod;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  /** JSON body. Mutually exclusive with `form` and `body`. */
  json?: unknown;
  /** application/x-www-form-urlencoded body. */
  form?: Record<string, string>;
  /** Multipart (or other raw) body. The Content-Type header is set by fetch. */
  body?: FormData;
  /** Default true: sends the bearer token and refreshes once on a 401. */
  auth?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Default 'json'. 'none' ignores the response body. */
  responseType?: 'json' | 'text' | 'none';
};

export type HttpClientDeps = {
  baseUrl: string;
  fetch: typeof fetch;
  getAccessToken: () => Promise<string | null>;
  /** Returns a fresh token or throws AuthExpiredError. Called at most once per request. */
  refreshAccessToken: () => Promise<string>;
  defaultTimeoutMs?: number;
  logger?: Logger;
};

export type HttpClient = {
  request(path: string, options?: RequestOptions): Promise<unknown>;
  /** Like `request`, but validates the JSON response against a schema. */
  requestJson<T>(path: string, schema: z.ZodType<T>, options?: RequestOptions): Promise<T>;
};

const DEFAULT_TIMEOUT_MS = 30_000;

type RawResponse = { status: number; ok: boolean; text: string };

function buildInit(options: RequestOptions, token: string | null): RequestInit {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  let body: RequestInit['body'];

  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  } else if (options.form !== undefined) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = encodeForm(options.form);
  } else if (options.body !== undefined) {
    body = options.body;
  }

  if (token !== null) {
    headers.Authorization = `Bearer ${token}`;
  }

  return { method: options.method ?? 'GET', headers, body };
}

function parseBody(text: string, responseType: 'json' | 'text' | 'none'): unknown {
  if (responseType === 'none') {
    return undefined;
  }
  if (responseType === 'text') {
    return text;
  }
  if (text.trim() === '') {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new ResponseParseError(['Response is not valid JSON'], { cause });
  }
}

export function createHttpClient(deps: HttpClientDeps): HttpClient {
  const defaultTimeoutMs = deps.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;

  /** One attempt. The timeout covers connecting and reading the body. */
  async function execute(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    external: AbortSignal | undefined,
  ): Promise<RawResponse> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const abortFromOutside = () => controller.abort();

    if (external?.aborted) {
      controller.abort();
    } else {
      external?.addEventListener('abort', abortFromOutside, { once: true });
    }

    try {
      const response = await deps.fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      return { status: response.status, ok: response.ok, text };
    } catch (error) {
      if (timedOut) {
        throw new TimeoutError(timeoutMs, { cause: error });
      }
      if (isAbortError(error)) {
        throw error;
      }
      throw new NetworkError({ cause: error });
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', abortFromOutside);
    }
  }

  async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
    const method = options.method ?? 'GET';
    const url = buildUrl(deps.baseUrl, path, options.query);
    const useAuth = options.auth !== false;
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;

    let token: string | null = null;
    if (useAuth) {
      token = await deps.getAccessToken();
      if (token === null) {
        throw new AuthExpiredError('no-session');
      }
    }

    let raw = await execute(url, buildInit(options, token), timeoutMs, options.signal);

    if (raw.status === 401 && useAuth) {
      deps.logger?.info('http', 'Got 401, refreshing token', { method, path });
      const freshToken = await deps.refreshAccessToken();
      raw = await execute(url, buildInit(options, freshToken), timeoutMs, options.signal);
    }

    if (!raw.ok) {
      const problem = parseProblemDetails(raw.text);
      deps.logger?.warn('http', 'Request failed', {
        method,
        path,
        status: raw.status,
        traceId: problem?.traceId,
      });
      throw new HttpError(raw.status, problem, raw.text);
    }

    return parseBody(raw.text, options.responseType ?? 'json');
  }

  async function requestJson<T>(
    path: string,
    schema: z.ZodType<T>,
    options?: RequestOptions,
  ): Promise<T> {
    const data = await request(path, options);
    const parsed = schema.safeParse(data);
    if (parsed.success) {
      return parsed.data;
    }
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    deps.logger?.warn('http', 'Response does not match schema', { path, issues });
    throw new ResponseParseError(issues);
  }

  return { request, requestJson };
}
