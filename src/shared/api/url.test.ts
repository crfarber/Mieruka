import { describe, expect, it } from 'vitest';
import { buildUrl, encodeForm } from './url';

describe('buildUrl', () => {
  it('joins base and path with exactly one slash', () => {
    expect(buildUrl('https://api.test', '/things')).toBe('https://api.test/things');
    expect(buildUrl('https://api.test/', 'things')).toBe('https://api.test/things');
    expect(buildUrl('https://api.test///', '/things')).toBe('https://api.test/things');
  });

  it('appends encoded query parameters', () => {
    expect(buildUrl('https://api.test', '/things', { name: 'a b', page: 2, active: true })).toBe(
      'https://api.test/things?name=a%20b&page=2&active=true',
    );
  });

  it('encodes a plus sign in phone numbers as %2B', () => {
    expect(buildUrl('https://api.test', '/sms', { phoneNumber: '+31612345678' })).toBe(
      'https://api.test/sms?phoneNumber=%2B31612345678',
    );
  });

  it('skips undefined and null values', () => {
    expect(buildUrl('https://api.test', '/things', { a: undefined, b: null, c: 0 })).toBe(
      'https://api.test/things?c=0',
    );
  });

  it('adds no question mark when there is nothing to add', () => {
    expect(buildUrl('https://api.test', '/things', {})).toBe('https://api.test/things');
    expect(buildUrl('https://api.test', '/things', { a: undefined })).toBe(
      'https://api.test/things',
    );
  });

  it('extends a path that already has a query string', () => {
    expect(buildUrl('https://api.test', '/things?x=1', { y: 2 })).toBe(
      'https://api.test/things?x=1&y=2',
    );
  });

  it('encodes keys too', () => {
    expect(buildUrl('https://api.test', '/things', { 'a&b': '1=2' })).toBe(
      'https://api.test/things?a%26b=1%3D2',
    );
  });
});

describe('encodeForm', () => {
  it('encodes fields as a form body', () => {
    expect(encodeForm({ grant_type: 'refresh_token', refresh_token: 'a+b/c=' })).toBe(
      'grant_type=refresh_token&refresh_token=a%2Bb%2Fc%3D',
    );
  });

  it('returns an empty string for no fields', () => {
    expect(encodeForm({})).toBe('');
  });
});
