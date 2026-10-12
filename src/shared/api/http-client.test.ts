import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createLogger } from '@/shared/logging/logger';
import { createFakeClock, emptyResponse, jsonResponse, problemResponse } from '@/test/fakes';
import {
  AuthExpiredError,
  HttpError,
  NetworkError,
  ResponseParseError,
  TimeoutError,
} from './errors';
import { createHttpClient, type HttpClientDeps } from './http-client';

function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

/** A fetch that never answers, but honours the abort signal like the real one. */
function hangingFetch() {
  return vi.fn<typeof fetch>(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(abortError());
          return;
        }
        signal?.addEventListener('abort', () => reject(abortError()));
      }),
  );
}

function setup(overrides: Partial<HttpClientDeps> = {}) {
  const fetchMock = vi.fn<typeof fetch>();
  const getAccessToken = vi.fn<() => Promise<string | null>>().mockResolvedValue('token-1');
  const refreshAccessToken = vi.fn<() => Promise<string>>().mockResolvedValue('token-2');

  const client = createHttpClient({
    baseUrl: 'https://api.test/',
    fetch: fetchMock,
    getAccessToken,
    refreshAccessToken,
    ...overrides,
  });

  const lastInit = (call = 0): RequestInit => {
    const init = fetchMock.mock.calls[call]?.[1];
    if (!init) {
      throw new Error(`fetch call ${call} has no init`);
    }
    return init;
  };
  const lastHeaders = (call = 0) => lastInit(call).headers as Record<string, string>;

  return { client, fetchMock, getAccessToken, refreshAccessToken, lastInit, lastHeaders };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('request: building the call', () => {
  it('sends a GET with base url, query and bearer token', async () => {
    const { client, fetchMock, lastInit, lastHeaders } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await client.request('/things', { query: { phone: '+31612345678', page: 2, skip: undefined } });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.test/things?phone=%2B31612345678&page=2',
    );
    expect(lastInit().method).toBe('GET');
    expect(lastHeaders()).toMatchObject({
      Accept: 'application/json',
      Authorization: 'Bearer token-1',
    });
  });

  it('sends a JSON body with the right content type', async () => {
    const { client, fetchMock, lastInit, lastHeaders } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await client.request('/things', { method: 'POST', json: { name: 'x' } });

    expect(lastInit().method).toBe('POST');
    expect(lastInit().body).toBe('{"name":"x"}');
    expect(lastHeaders()['Content-Type']).toBe('application/json');
  });

  it('sends a form body with the right content type', async () => {
    const { client, fetchMock, lastInit, lastHeaders } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await client.request('/connect/token', {
      method: 'POST',
      auth: false,
      form: { grant_type: 'refresh_token', refresh_token: 'a+b' },
    });

    expect(lastInit().body).toBe('grant_type=refresh_token&refresh_token=a%2Bb');
    expect(lastHeaders()['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('leaves the content type to fetch for multipart bodies', async () => {
    const { client, fetchMock, lastInit, lastHeaders } = setup();
    fetchMock.mockResolvedValueOnce(emptyResponse());
    const body = new FormData();
    body.append('file', 'data');

    await client.request('/upload', { method: 'POST', body, responseType: 'none' });

    expect(lastInit().body).toBe(body);
    expect(lastHeaders()['Content-Type']).toBeUndefined();
  });

  it('lets callers add and override headers', async () => {
    const { client, fetchMock, lastHeaders } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await client.request('/things', { headers: { Accept: 'text/plain', 'X-Trace': 'abc' } });

    expect(lastHeaders()).toMatchObject({ Accept: 'text/plain', 'X-Trace': 'abc' });
  });

  it('skips the token entirely when auth is false', async () => {
    const { client, fetchMock, getAccessToken, lastHeaders } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await client.request('/public', { auth: false });

    expect(getAccessToken).not.toHaveBeenCalled();
    expect(lastHeaders().Authorization).toBeUndefined();
  });
});

describe('request: reading the answer', () => {
  it('parses a JSON body', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 7 }));

    await expect(client.request('/things')).resolves.toEqual({ id: 7 });
  });

  it('returns undefined for an empty body', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(emptyResponse());

    await expect(client.request('/things')).resolves.toBeUndefined();
  });

  it('returns text when asked for text', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(new Response('plain text', { status: 200 }));

    await expect(client.request('/things', { responseType: 'text' })).resolves.toBe('plain text');
  });

  it('ignores the body when asked for none', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(new Response('not json at all', { status: 200 }));

    await expect(client.request('/things', { responseType: 'none' })).resolves.toBeUndefined();
  });

  it('throws ResponseParseError for a body that is not JSON', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(new Response('<html>oops</html>', { status: 200 }));

    await expect(client.request('/things')).rejects.toBeInstanceOf(ResponseParseError);
  });
});

describe('request: failures', () => {
  it('throws HttpError with the problem details of the backend', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(
      problemResponse(422, { title: 'Invalid', detail: 'Plate is not valid', traceId: 'abc' }),
    );

    const error = await client.request('/things').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({
      status: 422,
      message: 'Plate is not valid',
      problem: { title: 'Invalid', detail: 'Plate is not valid', traceId: 'abc' },
    });
  });

  it('throws HttpError without problem details for a non-JSON error page', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }));

    const error = await client.request('/things').catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 502, problem: null, message: 'HTTP 502' });
  });

  it('wraps a failing fetch in NetworkError', async () => {
    const { client, fetchMock } = setup();
    const cause = new TypeError('Network request failed');
    fetchMock.mockRejectedValueOnce(cause);

    const error = await client.request('/things').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).cause).toBe(cause);
  });

  it('throws AuthExpiredError when there is no token at all', async () => {
    const { client, fetchMock, getAccessToken } = setup();
    getAccessToken.mockResolvedValueOnce(null);

    await expect(client.request('/things')).rejects.toMatchObject({
      name: 'AuthExpiredError',
      reason: 'no-session',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not log response bodies', async () => {
    const logger = createLogger({ clock: createFakeClock() });
    const { client, fetchMock } = setup({ logger });
    fetchMock.mockResolvedValueOnce(
      problemResponse(500, { title: 'Boom', detail: 'secret internal detail', traceId: 'trace-9' }),
    );

    await client.request('/things').catch(() => undefined);

    const logged = JSON.stringify(logger.entries());
    expect(logged).toContain('trace-9');
    expect(logged).not.toContain('secret internal detail');
  });
});

describe('request: token refresh', () => {
  it('refreshes once on a 401 and retries with the new token', async () => {
    const { client, fetchMock, refreshAccessToken, lastHeaders } = setup();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ id: 1 }));

    await expect(client.request('/things')).resolves.toEqual({ id: 1 });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(lastHeaders(0).Authorization).toBe('Bearer token-1');
    expect(lastHeaders(1).Authorization).toBe('Bearer token-2');
  });

  it('gives up after a second 401 and does not refresh again', async () => {
    const { client, fetchMock, refreshAccessToken } = setup();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    const error = await client.request('/things').catch((caught: unknown) => caught);

    expect(error).toMatchObject({ name: 'HttpError', status: 401 });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('propagates AuthExpiredError from the refresh', async () => {
    const { client, fetchMock, refreshAccessToken } = setup();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    refreshAccessToken.mockRejectedValueOnce(new AuthExpiredError('refresh-rejected'));

    await expect(client.request('/things')).rejects.toMatchObject({
      name: 'AuthExpiredError',
      reason: 'refresh-rejected',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not refresh for requests without auth', async () => {
    const { client, fetchMock, refreshAccessToken } = setup();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(client.request('/connect/token', { auth: false })).rejects.toMatchObject({
      name: 'HttpError',
      status: 401,
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('does not refresh for other error statuses', async () => {
    const { client, fetchMock, refreshAccessToken } = setup();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));

    await expect(client.request('/things')).rejects.toMatchObject({ status: 403 });
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });
});

describe('request: timeout and abort', () => {
  it('throws TimeoutError when the server does not answer in time', async () => {
    vi.useFakeTimers();
    const { client, fetchMock } = setup();
    fetchMock.mockImplementation(hangingFetch());

    const assertion = expect(client.request('/slow', { timeoutMs: 1000 })).rejects.toBeInstanceOf(
      TimeoutError,
    );
    await vi.advanceTimersByTimeAsync(1000);

    await assertion;
  });

  it('uses the default timeout of the client', async () => {
    vi.useFakeTimers();
    const { client, fetchMock } = setup({ defaultTimeoutMs: 500 });
    fetchMock.mockImplementation(hangingFetch());

    const assertion = expect(client.request('/slow')).rejects.toMatchObject({
      name: 'TimeoutError',
      timeoutMs: 500,
    });
    await vi.advanceTimersByTimeAsync(500);

    await assertion;
  });

  it('also times out while the body is being read', async () => {
    vi.useFakeTimers();
    const { client, fetchMock } = setup();
    fetchMock.mockImplementation(async (_url, init) => {
      const slowBody = new Promise<string>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(abortError()));
      });
      return { status: 200, ok: true, text: () => slowBody } as unknown as Response;
    });

    const assertion = expect(client.request('/slow', { timeoutMs: 1000 })).rejects.toBeInstanceOf(
      TimeoutError,
    );
    await vi.advanceTimersByTimeAsync(1000);

    await assertion;
  });

  it('does not fire the timeout after a fast answer', async () => {
    vi.useFakeTimers();
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1 }));

    await expect(client.request('/fast', { timeoutMs: 1000 })).resolves.toEqual({ id: 1 });

    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes an abort from the caller through as an AbortError', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockImplementation(hangingFetch());
    const controller = new AbortController();

    const assertion = expect(
      client.request('/things', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();

    await assertion;
  });

  it('rejects immediately for a signal that is already aborted', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockImplementation(hangingFetch());
    const controller = new AbortController();
    controller.abort();

    await expect(client.request('/things', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

describe('requestJson', () => {
  const thing = z.object({ id: z.number(), name: z.string() });

  it('returns validated data', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, name: 'x', extra: 'dropped' }));

    await expect(client.requestJson('/things/1', thing)).resolves.toEqual({ id: 1, name: 'x' });
  });

  it('throws ResponseParseError listing what is wrong', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'one' }));

    const error = await client.requestJson('/things/1', thing).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ResponseParseError);
    expect((error as ResponseParseError).issues.join(' ')).toContain('id');
    expect((error as ResponseParseError).issues.join(' ')).toContain('name');
  });

  it('passes request errors through unchanged', async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(client.requestJson('/things/1', thing)).rejects.toMatchObject({ status: 404 });
  });
});
