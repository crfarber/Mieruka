import { describe, expect, it } from 'vitest';
import {
  AuthExpiredError,
  HttpError,
  NetworkError,
  ResponseParseError,
  TimeoutError,
} from '@/shared/api/errors';
import { createLogger } from '@/shared/logging/logger';
import { createFakeClock } from '@/test/fakes';
import { createQueryClient, queryRetryDelay, shouldRetryQuery } from './create-query-client';

describe('shouldRetryQuery', () => {
  it('retries a temporary failure, twice', () => {
    expect(shouldRetryQuery(0, new NetworkError())).toBe(true);
    expect(shouldRetryQuery(1, new TimeoutError(1000))).toBe(true);
    expect(shouldRetryQuery(2, new NetworkError())).toBe(false);
  });

  it('retries server errors and throttling', () => {
    expect(shouldRetryQuery(0, new HttpError(503, null))).toBe(true);
    expect(shouldRetryQuery(0, new HttpError(429, null))).toBe(true);
  });

  it.each([
    ['a client error', new HttpError(404, null)],
    ['a broken payload', new ResponseParseError(['x'])],
    ['an expired session', new AuthExpiredError('refresh-rejected')],
    ['something unexpected', new Error('boom')],
  ])('does not retry %s', (_name, error) => {
    expect(shouldRetryQuery(0, error)).toBe(false);
  });
});

describe('queryRetryDelay', () => {
  it('doubles up to ten seconds', () => {
    expect([0, 1, 2, 3, 4, 10].map(queryRetryDelay)).toEqual([
      1_000, 2_000, 4_000, 8_000, 10_000, 10_000,
    ]);
  });
});

describe('createQueryClient', () => {
  it('uses the retry policy and keeps data for a day', () => {
    const options = createQueryClient().getDefaultOptions();
    expect(options.queries?.retry).toBe(shouldRetryQuery);
    expect(options.queries?.retryDelay).toBe(queryRetryDelay);
    expect(options.queries?.gcTime).toBe(24 * 60 * 60 * 1000);
  });

  it('never retries a mutation: a submit must not be sent twice by accident', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });

  it('logs a failing query', async () => {
    const logger = createLogger({ clock: createFakeClock() });
    const client = createQueryClient(logger);

    await client
      .fetchQuery({
        queryKey: ['broken'],
        queryFn: () => Promise.reject(new HttpError(404, null)),
        retry: false,
      })
      .catch(() => undefined);

    expect(logger.entries().some((entry) => entry.message === 'Query failed')).toBe(true);
  });
});
