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
  budget: {
    title: 'Per dag',
    perDay: 'Vandaag te besteden',
    daysLeft: 'Nog {{count}} dagen deze maand, vandaag meegeteld.',
    lastDay: 'Vandaag is de laatste dag van de maand.',
    nothingLeft: 'Er staat niets meer op deze rekening om te verdelen.',
    balance: 'Saldo {{amount}} op {{account}}',
    loadFailed: 'Het saldo kon niet worden opgehaald.',
    connect: {
      title: 'Koppel je bunq-rekening',
      body: 'De app leest het saldo van één bunq-rekening en rekent uit hoeveel je per dag kunt uitgeven tot het eind van de maand.',
      refused:
        'bunq accepteert de koppeling niet meer. Koppel opnieuw met een geldige API-sleutel.',
      action: 'bunq koppelen',
    },
    choose: {
      body: 'Kies de rekening waarmee je wilt rekenen.',
      missing: 'De gekozen rekening is er niet meer. Kies een andere.',
      action: 'Andere rekening kiezen',
    },
  },
  bunq: {
    connect: {
      title: 'bunq koppelen',
      intro: 'Koppel de app met een API-sleutel uit de bunq-app.',
      howTo:
        'Maak in de bunq-app een API-sleutel aan: in de instellingen, onder Developers → API keys.',
      apiKey: 'API-sleutel',
      warning:
        'Een API-sleutel geeft volledige toegang tot je bunq-account. Deze app gebruikt hem alleen om saldi te lezen en bewaart hem versleuteld op dit toestel.',
      submit: 'Koppelen',
      processing: 'Verbinden met bunq… Een sleutel maken kan een halve minuut duren.',
      connected: 'Gekoppeld met bunq',
      errors: {
        invalidKey: 'Vul de API-sleutel in, zonder spaties.',
        refused: 'bunq heeft deze sleutel geweigerd. Controleer hem en probeer het opnieuw.',
        unavailable: 'bunq is nu niet bereikbaar. Probeer het later opnieuw.',
      },
    },
    accounts: {
      title: 'Rekening',
      hint: 'Kies de rekening waarmee je wilt rekenen.',
      empty: 'Er zijn geen actieve rekeningen gevonden.',
      loadFailed: 'De rekeningen konden niet worden opgehaald.',
      disconnect: 'bunq ontkoppelen',
      disconnectTitle: 'bunq ontkoppelen?',
      disconnectMessage:
        'De API-sleutel wordt van dit toestel verwijderd. Trek hem ook in de bunq-app in als je hem niet meer gebruikt.',
      disconnecting: 'Ontkoppelen…',
    },
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
  budget: {
    title: 'Per day',
    perDay: 'To spend today',
    daysLeft: '{{count}} days left this month, today included.',
    lastDay: 'Today is the last day of the month.',
    nothingLeft: 'There is nothing left on this account to divide.',
    balance: 'Balance {{amount}} on {{account}}',
    loadFailed: 'The balance could not be loaded.',
    connect: {
      title: 'Connect your bunq account',
      body: 'The app reads the balance of one bunq account and works out how much you can spend per day until the end of the month.',
      refused: 'bunq no longer accepts the connection. Connect again with a valid API key.',
      action: 'Connect bunq',
    },
    choose: {
      body: 'Choose the account to budget with.',
      missing: 'The chosen account is gone. Choose another one.',
      action: 'Choose another account',
    },
  },
  bunq: {
    connect: {
      title: 'Connect bunq',
      intro: 'Connect the app with an API key from the bunq app.',
      howTo: 'Create an API key in the bunq app: in the settings, under Developers → API keys.',
      apiKey: 'API key',
      warning:
        'An API key gives full access to your bunq account. This app only uses it to read balances and keeps it encrypted on this device.',
      submit: 'Connect',
      processing: 'Connecting to bunq… Creating a key can take half a minute.',
      connected: 'Connected to bunq',
      errors: {
        invalidKey: 'Enter the API key, without spaces.',
        refused: 'bunq refused this key. Check it and try again.',
        unavailable: 'bunq cannot be reached right now. Please try again later.',
      },
    },
    accounts: {
      title: 'Account',
      hint: 'Choose the account to budget with.',
      empty: 'No active accounts were found.',
      loadFailed: 'The accounts could not be loaded.',
      disconnect: 'Disconnect bunq',
      disconnectTitle: 'Disconnect bunq?',
      disconnectMessage:
        'The API key is removed from this device. Also revoke it in the bunq app if you no longer use it.',
      disconnecting: 'Disconnecting…',
    },
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
