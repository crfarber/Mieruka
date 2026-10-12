import { createInstance, type i18n as I18n } from 'i18next';
import { resources, type Language } from './resources';

/**
 * A new i18n instance per app (and per test), not a global. Resources are inline, so it is ready
 * immediately. Missing keys show the key itself, which makes them easy to spot.
 */
export function createI18n(language: Language): I18n {
  const instance = createInstance();
  void instance.init({
    resources,
    lng: language,
    fallbackLng: 'nl',
    initAsync: false,
    interpolation: { escapeValue: false }, // React Native does not render HTML
    returnNull: false,
  });
  return instance;
}
