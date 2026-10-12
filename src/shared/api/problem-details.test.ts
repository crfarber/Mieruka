import { describe, expect, it } from 'vitest';
import { parseProblemDetails } from './problem-details';

describe('parseProblemDetails', () => {
  it('parses a full problem details body', () => {
    const body = JSON.stringify({
      type: 'https://example.test/errors/validation',
      title: 'Validation failed',
      status: 400,
      detail: 'Name is required',
      instance: '/api/thing',
      traceId: '00-abc-01',
    });

    expect(parseProblemDetails(body)).toEqual({
      type: 'https://example.test/errors/validation',
      title: 'Validation failed',
      status: 400,
      detail: 'Name is required',
      instance: '/api/thing',
      traceId: '00-abc-01',
    });
  });

  it('keeps only known fields with the right type', () => {
    const body = JSON.stringify({ title: 'Oops', status: '400', detail: 5, extra: 'ignored' });
    expect(parseProblemDetails(body)).toEqual({ title: 'Oops' });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['invalid JSON', '<html>Bad gateway</html>'],
    ['a JSON array', '[1,2]'],
    ['a JSON string', '"text"'],
    ['a JSON number', '12'],
    ['an object without known fields', '{"foo":"bar"}'],
    ['an empty object', '{}'],
  ])('returns null for %s', (_name, body) => {
    expect(parseProblemDetails(body)).toBeNull();
  });
});
