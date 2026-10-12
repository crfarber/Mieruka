import type { nl } from './resources';

/** Makes `t('...')` check its key against the Dutch texts at compile time. */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof nl };
  }
}
