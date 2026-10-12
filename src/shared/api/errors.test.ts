import { describe, expect, it } from 'vitest';
import {
  AuthExpiredError,
  HttpError,
  isAbortError,
  isRetryable,
  NetworkError,
  ResponseParseError,
  TimeoutError,
  TokenRefreshError,
} from './errors';

describe('HttpError', () => {
  it('prefers the problem detail as message', () => {
    const error = new HttpError(400, { title: 'Bad', detail: 'Field X is required' });
    expect(error.message).toBe('Field X is required');
    expect(error.status).toBe(400);
  });

  it('falls back to the title, then to the status', () => {
    expect(new HttpError(400, { title: 'Bad' }).message).toBe('Bad');
    expect(new HttpError(502, null).message).toBe('HTTP 502');
  });

  it('truncates a very large body', () => {
    const error = new HttpError(500, null, 'x'.repeat(5000));
    expect(error.body).toHaveLength(2000);
  });

  it('keeps the cause', () => {
    const cause = new Error('inner');
    expect(new HttpError(500, null, '', { cause }).cause).toBe(cause);
  });
});

describe('error names', () => {
  it('makes every error identifiable', () => {
    expect(new NetworkError().name).toBe('NetworkError');
    expect(new TimeoutError(10).name).toBe('TimeoutError');
    expect(new ResponseParseError(['a']).name).toBe('ResponseParseError');
    expect(new AuthExpiredError('no-session').name).toBe('AuthExpiredError');
    expect(new TokenRefreshError().name).toBe('TokenRefreshError');
  });

  it('exposes the details', () => {
    expect(new TimeoutError(1500).timeoutMs).toBe(1500);
    expect(new TimeoutError(1500).message).toContain('1500');
    expect(new ResponseParseError(['a: bad', 'b: worse']).issues).toEqual(['a: bad', 'b: worse']);
    expect(new AuthExpiredError('refresh-rejected').reason).toBe('refresh-rejected');
  });
});

describe('isAbortError', () => {
  it('recognises an abort error', () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    expect(isAbortError(error)).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isAbortError(new Error('x'))).toBe(false);
    expect(isAbortError('AbortError')).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});

describe('isRetryable', () => {
  it.each([
    ['network error', new NetworkError()],
    ['timeout', new TimeoutError(100)],
    ['temporary refresh failure', new TokenRefreshError()],
    ['HTTP 408', new HttpError(408, null)],
    ['HTTP 429', new HttpError(429, null)],
    ['HTTP 500', new HttpError(500, null)],
    ['HTTP 503', new HttpError(503, null)],
  ])('retries %s', (_name, error) => {
    expect(isRetryable(error)).toBe(true);
  });

  it.each([
    ['HTTP 400', new HttpError(400, null)],
    ['HTTP 401', new HttpError(401, null)],
    ['HTTP 404', new HttpError(404, null)],
    ['HTTP 422', new HttpError(422, null)],
    ['parse error', new ResponseParseError(['bad'])],
    ['expired session', new AuthExpiredError('refresh-rejected')],
    ['a plain error', new Error('x')],
    ['a string', 'boom'],
  ])('does not retry %s', (_name, error) => {
    expect(isRetryable(error)).toBe(false);
  });
});
