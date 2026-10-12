import { describe, expect, it } from 'vitest';
import { createLogger } from '@/shared/logging/logger';
import type { Language } from '@/shared/i18n/resources';
import type { KeyValueStore } from '@/shared/platform/ports';
import { createFakeClock, createInMemoryStore } from '@/test/fakes';
import { createLanguageSettings, LANGUAGE_KEY } from './language-settings';

function setup(store: KeyValueStore = createInMemoryStore()) {
  const applied: Language[] = [];
  const logger = createLogger({ clock: createFakeClock() });
  const settings = createLanguageSettings({
    store,
    apply: async (language) => {
      applied.push(language);
    },
    logger,
  });
  return { settings, applied, logger };
}

const brokenStore: KeyValueStore = {
  getItem: () => Promise.reject(new Error('disk')),
  setItem: () => Promise.reject(new Error('disk')),
  removeItem: () => Promise.reject(new Error('disk')),
};

describe('createLanguageSettings', () => {
  it('switches the app at once and remembers the choice', async () => {
    const store = createInMemoryStore();
    const { settings, applied } = setup(store);

    await settings.choose('en');

    expect(applied).toEqual(['en']);
    expect(store.dump()[LANGUAGE_KEY]).toBe('en');
  });

  it('applies the remembered choice at start', async () => {
    const { settings, applied } = setup(createInMemoryStore({ [LANGUAGE_KEY]: 'en' }));

    await settings.restore();

    expect(applied).toEqual(['en']);
  });

  it('keeps the phone language when nothing was chosen', async () => {
    const { settings, applied } = setup();

    await settings.restore();

    expect(applied).toEqual([]);
  });

  it('ignores a remembered value that is not a supported language', async () => {
    const { settings, applied } = setup(createInMemoryStore({ [LANGUAGE_KEY]: 'de' }));

    await settings.restore();

    expect(applied).toEqual([]);
  });

  it('starts in the phone language when storage cannot be read', async () => {
    const { settings, applied, logger } = setup(brokenStore);

    await settings.restore();

    expect(applied).toEqual([]);
    expect(logger.entries().some((entry) => entry.level === 'warn')).toBe(true);
  });

  it('still switches when the choice cannot be saved', async () => {
    const { settings, applied, logger } = setup(brokenStore);

    await settings.choose('nl');

    expect(applied).toEqual(['nl']);
    expect(logger.entries().some((entry) => entry.level === 'warn')).toBe(true);
  });
});
