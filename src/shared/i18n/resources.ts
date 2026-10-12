/**
 * All user-facing text. Dutch is the source; English must have exactly the same keys and the
 * same {{placeholders}} (checked by `i18n.test.ts`). Keys are typed: `t('unknown.key')` does not
 * compile.
 */
export const nl = {
  common: {
    yes: 'Ja',
    no: 'Nee',
    loading: 'Laden…',
    retry: 'Opnieuw proberen',
    cancel: 'Annuleren',
    back: 'Terug',
    ok: 'OK',
    signOut: 'Uitloggen',
    close: 'Sluiten',
    somethingWrong: 'Er is iets misgegaan.',
    offline: 'Geen verbinding. Probeer het later opnieuw.',
  },
  feedback: {
    takingLonger: 'Dit duurt langer dan verwacht…',
    processing: {
      signOut: 'Uitloggen…',
    },
  },
  login: {
    subtitle: 'Log in om verder te gaan.',
    signIn: 'Inloggen',
    demoHint: 'Demo-modus: je logt in zonder account. Kies een echte login vóór een release.',
    version: 'Versie {{version}}',
    sessionExpired: 'Je sessie is verlopen. Log opnieuw in.',
    method: {
      demo: 'demo',
      'azure-ad': 'Azure AD',
    },
    errors: {
      unavailable: 'Inloggen is niet beschikbaar in deze versie van de app.',
      failed: 'Het lukte niet. Probeer het opnieuw.',
    },
  },
  home: {
    title: 'Home',
    body: 'Je bent ingelogd. Bouw vanaf hier je eerste domein, zie docs/conventions.md.',
  },
  debug: {
    open: 'Debug',
    title: 'Opslag en stores',
    hint: 'Alleen tijdens ontwikkeling. Tokens komen van SecureStore, niet via getAccessToken.',
    refresh: 'Verversen',
    copyAccessToken: 'Kopieer access token',
    copyAccessTokenTitle: 'JWT naar klembord kopiëren?',
    copyAccessTokenWarning:
      'Dit is een geldig aanmeldtoken. Iedereen met toegang tot je klembord kan het gebruiken. Deel het niet.',
    copyAccessTokenConfirm: 'Kopieer token',
    copyAccessTokenCopied: 'Access token gekopieerd. Deel deze waarde niet.',
    copyAccessTokenUnavailable: 'Er is geen access token beschikbaar.',
    copyAccessTokenFailed: 'Access token kopiëren is mislukt.',
    storage: 'Storage',
    sessionStore: 'Session store',
    tokenProvider: 'TokenProvider',
    queryCache: 'Query cache',
  },
  settings: {
    open: 'Instellingen',
    title: 'Instellingen',
    version: '{{version}} ({{method}})',
    section: {
      general: 'Algemeen',
    },
    language: {
      title: 'Taal',
      hint: 'Kies de taal van de app. De keuze blijft bewaard, ook na uitloggen.',
      nl: 'Nederlands',
      en: 'Engels',
    },
  },
  support: {
    open: 'Log voor support',
    title: 'Support',
    hint: 'Dit is het log van de afgelopen dag. Persoonsgegevens zijn eruit gehaald. Stuur het naar support.',
    share: 'Delen',
    empty: 'Er staat nog niets in het log.',
  },
} as const;

type Widen<T> = T extends string ? string : { [Key in keyof T]: Widen<T[Key]> };

/** The shape of a language file: same keys as Dutch, any text. */
export type Translations = Widen<typeof nl>;

export const en: Translations = {
  common: {
    yes: 'Yes',
    no: 'No',
    loading: 'Loading…',
    retry: 'Try again',
    cancel: 'Cancel',
    back: 'Back',
    ok: 'OK',
    signOut: 'Sign out',
    close: 'Close',
    somethingWrong: 'Something went wrong.',
    offline: 'No connection. Please try again later.',
  },
  feedback: {
    takingLonger: 'This is taking longer than expected…',
    processing: {
      signOut: 'Signing out…',
    },
  },
  login: {
    subtitle: 'Sign in to continue.',
    signIn: 'Sign in',
    demoHint: 'Demo mode: you sign in without an account. Choose a real sign-in before a release.',
    version: 'Version {{version}}',
    sessionExpired: 'Your session has expired. Please sign in again.',
    method: {
      demo: 'demo',
      'azure-ad': 'Azure AD',
    },
    errors: {
      unavailable: 'Signing in is not available in this version of the app.',
      failed: 'That did not work. Please try again.',
    },
  },
  home: {
    title: 'Home',
    body: 'You are signed in. Build your first domain from here, see docs/conventions.md.',
  },
  debug: {
    open: 'Debug',
    title: 'Storage and stores',
    hint: 'Development only. Tokens come from SecureStore, not through getAccessToken.',
    refresh: 'Refresh',
    copyAccessToken: 'Copy access token',
    copyAccessTokenTitle: 'Copy JWT to the clipboard?',
    copyAccessTokenWarning:
      'This is a valid sign-in token. Anyone with access to your clipboard can use it. Do not share it.',
    copyAccessTokenConfirm: 'Copy token',
    copyAccessTokenCopied: 'Access token copied. Do not share this value.',
    copyAccessTokenUnavailable: 'No access token is available.',
    copyAccessTokenFailed: 'Copying the access token failed.',
    storage: 'Storage',
    sessionStore: 'Session store',
    tokenProvider: 'TokenProvider',
    queryCache: 'Query cache',
  },
  settings: {
    open: 'Settings',
    title: 'Settings',
    version: '{{version}} ({{method}})',
    section: {
      general: 'General',
    },
    language: {
      title: 'Language',
      hint: 'Choose the app language. The choice is kept, including after sign-out.',
      nl: 'Dutch',
      en: 'English',
    },
  },
  support: {
    open: 'Log for support',
    title: 'Support',
    hint: 'This is the log of the past day. Personal data has been removed. Send it to support.',
    share: 'Share',
    empty: 'The log is still empty.',
  },
};

export const LANGUAGES = ['nl', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const resources = { nl: { translation: nl }, en: { translation: en } } as const;
