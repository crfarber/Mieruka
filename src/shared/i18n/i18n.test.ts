import { describe, expect, it } from 'vitest';
import { createI18n } from './i18n';
import { en, LANGUAGES, nl } from './resources';

type Tree = { readonly [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((flat, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...flat, [path]: value }
      : { ...flat, ...flatten(value, path) };
  }, {});
}

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1] ?? '').sort();

describe('translations', () => {
  const dutch = flatten(nl);
  const english = flatten(en);

  it('has the same keys in every language', () => {
    expect(Object.keys(english).sort()).toEqual(Object.keys(dutch).sort());
  });

  it('has no empty texts', () => {
    const empty = [...Object.entries(dutch), ...Object.entries(english)]
      .filter(([, text]) => text.trim() === '')
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it('uses the same placeholders in every language', () => {
    const mismatched = Object.keys(dutch).filter(
      (key) => placeholders(dutch[key] ?? '').join() !== placeholders(english[key] ?? '').join(),
    );
    expect(mismatched).toEqual([]);
  });

  it('supports exactly the languages it has resources for', () => {
    expect([...LANGUAGES].sort()).toEqual(['en', 'nl']);
  });
});

describe('createI18n', () => {
  it('translates into the chosen language', () => {
    expect(createI18n('nl').t('common.retry')).toBe('Opnieuw proberen');
    expect(createI18n('en').t('common.retry')).toBe('Try again');
  });

  it('is ready immediately', () => {
    expect(createI18n('en').isInitialized).toBe(true);
  });

  it('fills in placeholders', () => {
    expect(createI18n('nl').t('login.version', { version: '1.2.3' })).toBe('Versie 1.2.3');
    expect(createI18n('en').t('login.version', { version: '1.2.3' })).toBe('Version 1.2.3');
  });

  it('switches language on the same instance', async () => {
    const i18n = createI18n('nl');
    await i18n.changeLanguage('en');
    expect(i18n.t('common.signOut')).toBe('Sign out');
  });

  it('shows the key for a missing text', () => {
    // The compiler rejects an unknown key; a key that slips through at runtime shows itself.
    expect(createI18n('nl').t('nope.missing' as never)).toBe('nope.missing');
  });

  it('keeps instances apart', () => {
    const first = createI18n('nl');
    const second = createI18n('en');
    expect(first.t('common.ok')).toBe('OK');
    expect(first.language).toBe('nl');
    expect(second.language).toBe('en');
  });
});
