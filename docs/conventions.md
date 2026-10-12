# Conventies

Dit is de React Native-versie van het contract van de web-boilerplate: dezelfde ideeën (laagregels per domein, server-state alleen in TanStack Query, één auth-ingang, i18n-regels, "klaar" = check + test + build), met de webonderdelen vervangen door hun mobiele tegenhanger.

## 1. Taal

Code, commentaar, commit-berichten en identifiers zijn Engels. Documentatie en gebruikersteksten (bron) zijn Nederlands. Vakbegrippen die de klant zo noemt, blijven ongewijzigd.

## 2. Structuur

```text
src/domeinen/<naam>/
  domain/       pure regels, types, mappers          → zonder React Native, zonder I/O
  api/          endpoints + zod-schema's             → praat via de HttpClient
  service/      use-cases                            → poorten als argument
  store/        Zustand (vanilla)                    → alleen client-state
  hooks/        React-hooks en contexten             ─┐
  components/   presentatiecomponenten               ─┤
  platform/rn/  device-implementatie van een poort    ┼ React Native
  screens/      schermen                             ─┘
  index.ts      publieke, pure ingang
  ui.ts         publieke React Native-ingang
```

De naam `domeinen` volgt de web-boilerplate (`src/domeinen/`), zodat projecten van hetzelfde team er hetzelfde uitzien. Een laag mag alleen importeren uit zichzelf of een lagere: `domain < api, service < store < hooks, components, platform < screens`. Een domein dat een ander nodig heeft, gebruikt alleen diens `index.ts` of `ui.ts`, en domeinen mogen geen kring vormen. Dit wordt afgedwongen in `src/architecture.test.ts`; een overtreding laat de test falen met de bestandsnaam.

`platform/rn/` is voor een poort die één domein zelf definieert (bijvoorbeeld de `Authenticator` van `auth`, voor Azure AD geïmplementeerd met `react-native-app-auth`) en die een native module nodig heeft — dus niet in `domain`/`api`/`service` mag staan. Een poort die meerdere domeinen delen (`Clock`, `SecretStore`, ...) hoort in `src/shared/platform/ports.ts`, met de device-implementatie in `src/shared/platform/rn/`.

`src/app/` bevat alleen routes die een scherm uit een `ui.ts` doorgeven. `src/bootstrap/` is de enige plek die onderdelen bouwt en koppelt.

### Een nieuw domein toevoegen

1. Maak `src/domeinen/<naam>/` met de lagen die je nodig hebt, plus `index.ts` en (bij schermen) `ui.ts`.
2. Schrijf de regels in `domain/` en de endpoints met zod-schema's in `api/`, met tests.
3. Bouw de onderdelen in `src/bootstrap/container.ts`, geef ze door in `src/bootstrap/providers.tsx`, en voeg een route toe in `src/app/`.
4. Bewaart het domein gebruikersdata: wis die in `clearUserData` in de container.
5. Voeg een scenario toe aan `src/bootstrap/container.test.ts` en teksten (nl én en) aan `src/shared/i18n/resources.ts`.

## 3. TypeScript

`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax` en `erasableSyntaxOnly` staan aan. Gevolgen:

- Geen `enum` en geen constructor-parameter-properties: gebruik `const` objecten met `as const` en union types, en expliciete klassevelden.
- Geen `any`, geen `!`, geen `@ts-ignore`. Onbekende data is `unknown` en gaat door een zod-schema of type guard.
- `import type` voor types. Geen circulaire imports (`import/no-cycle`).
- Publieke functies hebben expliciete returntypes als de inferentie niets zegt over de bedoeling.

## 4. State

| Soort data                            | Waar                                                |
| ------------------------------------- | --------------------------------------------------- |
| Server-data                           | TanStack Query (`hooks/`), sleutels per domein      |
| UI-status die meerdere schermen delen | Zustand in `store/`                                 |
| Sessie (tokens)                       | `TokenProvider` + beveiligde opslag, nergens anders |
| Voorkeuren zonder geheimen            | `KeyValueStore`-poort                               |

Zustand-stores worden met een fabriek gemaakt (`createSessionStore()`), niet als module-global, en bevatten nooit tokens. Dezelfde data in Zustand, een Context én opslag dupliceren is verboden.

## 5. API

- Eén `HttpClient` (`src/shared/api/http-client.ts`): basis-URL, bearer-token, één keer verversen bij 401, time-out over verbinding én body, `ProblemDetails` naar `HttpError`, nooit body's loggen.
- Elk endpoint staat in `api/` van zijn domein en valideert met `requestJson(pad, schema)`. **Tolerante lezer**: verplicht is wat de app gebruikt, de rest gaat ongemoeid door (`z.looseObject`). Ontbreekt een verplicht veld, dan is dat een `ResponseParseError` op de grens, niet een `undefined` drie schermen verder.
- Lijsten worden per rij geparseerd: één kapotte rij mag de lijst niet leegmaken.
- Fouten: `HttpError`, `NetworkError`, `TimeoutError`, `ResponseParseError`, `AuthExpiredError`, `TokenRefreshError`. `isRetryable(error)` bepaalt of opnieuw proberen zin heeft. Zie [ADR 0004](decisions/0004-api-laag.md) voor Orval.
- Mutaties worden nooit automatisch herhaald (`retry: false`).

## 6. Sessies en beveiliging

- Alleen `TokenProvider` leest en schrijft tokens; de rest vraagt `getAccessToken()` of `refreshNow()`.
- Een tijdelijke fout (geen netwerk, 5xx) houdt de sessie in stand; alleen een definitieve weigering (`invalid_grant`, 401/403 op de refresh) logt uit. Zie `refresh-policy.ts`.
- De inlogmethode komt uit `EXPO_PUBLIC_AUTH_PROVIDER` (`demo` of `azure-ad`, zie [ADR 0017](decisions/0017-inlogmethode-per-build.md)). `demo` mag niet in productie.
- Geheimen staan in de Keychain/Keystore via `SecretStore`; grote waarden worden verdeeld over stukken (`chunked-store.ts`).
- `EXPO_PUBLIC_*` wordt in de app gebakken en is dus **niet geheim**. Echte geheimen horen in de backend.
- Logdata gaat door `redact` (tokens, wachtwoorden, codes verborgen; telefoon en e-mail gemaskeerd).

## 7. Tekst (i18n)

Alle zichtbare tekst staat in `src/shared/i18n/resources.ts`, Nederlands als bron. Sleutels zijn getypeerd: `t('login.title')` met een onbekende sleutel faalt in de compiler. Engels moet dezelfde sleutels en `{{placeholders}}` hebben; `i18n.test.ts` controleert dat. Statuscodes en typen krijgen in het domein een sleutel, nooit een tekst.

## 8. Stijl en navigatie

- `StyleSheet.create` met tokens uit `src/shared/ui/theme.ts`, geen losse kleuren of maten in schermen. Zie [ADR 0007](decisions/0007-styling.md).
- Iconen uit `@expo/vector-icons` (Ionicons). Een eigen iconenset komt in `src/shared/ui/icons/`.
- Expo Router met dunne routes. Wie ingelogd is bepaalt `Stack.Protected` op basis van de sessiestatus; er wordt niet imperatief genavigeerd voor inloggen of uitloggen.
- Lijsten: `SectionList`/`FlatList` met stabiele `keyExtractor`, geen inline zware berekeningen (gebruik `useMemo` of een domeinfunctie).

## 9. Testen

- Vitest in Node voor `domain`, `api`, `service`, `store` en `shared`. Schermen worden pas getest als daar logica in zit; die hoort in een domeinfunctie of hook.
- Fakes in plaats van mocks: `createFakeClock`, `createInMemorySecretStore`, `createFakeScheduler`, `deferred` (`src/test/fakes.ts`). Tijd loopt nooit echt; wachten is `Sleep`.
- Testnamen beschrijven gedrag ("houdt de sessie na een tijdelijke fout"). Een opgeloste bug krijgt een regressietest.
- Drempels: 90% regels, statements en functies, 85% branches, over `domeinen/**/{domain,service,api}` en `shared`.
- `src/bootstrap/container.test.ts` test de hele keten. `src/architecture.test.ts` test de lagen.

## 10. Git en CI

- `pre-commit`: lint-staged (prettier en oxlint op gewijzigde bestanden) en typecheck. `pre-push`: `pnpm run ci`.
- CI (`.github/workflows/ci.yml`): kwaliteit (format, lint, typecheck, tests met coverage) en een Metro-bundel voor Android. Acties zijn op commit-hash vastgezet.
- Klein en vaak committen, per onderdeel een branch.

## Verschil met de web-boilerplate

| Web-boilerplate        | Deze boilerplate                                          |
| ---------------------- | --------------------------------------------------------- |
| Vite, TanStack Router  | Expo (prebuild/EAS), Expo Router                          |
| Tailwind/shadcn        | `StyleSheet` met tokens                                   |
| `VITE_AUTH_PROVIDER`   | `EXPO_PUBLIC_AUTH_PROVIDER` (`demo` of `azure-ad`)        |
| MSAL in de browser     | Azure AD via een native browser-sheet, tokens in Keychain |
| `sessionStorage`       | `SecretStore` (Keychain/Keystore) en `KeyValueStore`      |
| Orval-mutator          | Eigen `HttpClient` + zod (zie ADR 0004)                   |
| Storybook              | later: component-tests (zie ADR 0003)                     |
| `pages/` in een domein | `screens/` (routes staan in `src/app/`)                   |
