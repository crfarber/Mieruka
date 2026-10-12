import { LANGUAGES, type Language } from '@/shared/i18n/resources';
import type { Logger } from '@/shared/logging/logger';
import type { KeyValueStore } from '@/shared/platform/ports';

export const LANGUAGE_KEY = 'settings.language';

/**
 * The language the user picked in the settings. Without a choice the app follows the phone.
 * It is a device preference: signing out keeps it.
 */
export type LanguageSettings = {
  /** Applies the remembered choice, if any. Call once at start, before the first screen. */
  restore(): Promise<void>;
  /** Shows the app in this language at once, and after the next start too. */
  choose(language: Language): Promise<void>;
};

export type LanguageSettingsDeps = {
  store: KeyValueStore;
  apply: (language: Language) => Promise<unknown>;
  logger?: Logger;
};

export function createLanguageSettings(deps: LanguageSettingsDeps): LanguageSettings {
  const { store, apply, logger } = deps;

  return {
    async restore() {
      let stored: string | null;
      try {
        stored = await store.getItem(LANGUAGE_KEY);
      } catch (error) {
        logger?.warn('app', 'Could not read the chosen language', { error });
        return;
      }
      const language = LANGUAGES.find((candidate) => candidate === stored);
      if (language !== undefined) {
        await apply(language);
      }
    },

    async choose(language) {
      await apply(language);
      try {
        await store.setItem(LANGUAGE_KEY, language);
      } catch (error) {
        logger?.warn('app', 'Could not save the chosen language', { error });
      }
    },
  };
}
