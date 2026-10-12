# Expo Boilerplate

Herbruikbare starter voor een React Native-app met Expo: inloggen en sessiebeheer, een gelaagde domeinstructuur met een architectuurtest, getypeerde i18n (NL/EN), een gevalideerde configuratie per omgeving, en tooling (oxlint, Prettier, Vitest, Husky, CI). Het is de mobiele tegenhanger van de web-boilerplate: dezelfde ideeën, dezelfde mapnamen.

## Tech stack

- Expo SDK 57 met prebuild (CNG) en EAS, Expo Router, React Native 0.86, React 19 (met React Compiler)
- TanStack Query (server-data) en Zustand (client-state), zod op de API-grens
- Inloggen: `demo` (standaard, geen backend nodig) of Azure AD via `react-native-app-auth`
- i18next met getypeerde sleutels, `StyleSheet` met design-tokens, Ionicons
- Vitest in Node, oxlint, Prettier, Husky + lint-staged, GitHub Actions

## Snel starten

Vereisten: Node ≥ 22.13, pnpm 11 (`corepack enable`), Xcode en/of Android Studio.

```bash
pnpm install
cp .env.example .env.local     # werkt direct: demo-login, voorbeeld-API-URL
pnpm ios                       # of: pnpm android (bouwt de native app en start Metro)
pnpm start                     # daarna alleen Metro starten (dev client)
```

Zonder geldige configuratie stopt de app bij het opstarten met een duidelijke melding welke variabele ontbreekt.

## Een nieuw project starten

1. **Identiteit:** pas `APP` bovenin [app.config.ts](app.config.ts) aan (naam, slug, bundle-ID, scheme, versie, merkkleur) en `name`/`productName` in `package.json`.
2. **Uiterlijk:** zet de kleuren in [src/shared/ui/theme.ts](src/shared/ui/theme.ts) en vervang `assets/images/icon.png`, `adaptive-icon.png` en `splash-icon.png`.
3. **Teksten:** pas de teksten in [src/shared/i18n/resources.ts](src/shared/i18n/resources.ts) aan (o.a. `home` en `login.subtitle`).
4. **Backend:** laat `EXPO_PUBLIC_API_BASE_URL` leeg tot er een API is. Zet hem in `.env.local` en per EAS-profiel zodra die er is.
5. **Inloggen:** blijf op `demo` tot de app-registratie er is; schakel dan over op Azure AD ([ADR 0012](docs/decisions/0012-azure-ad-inloggen.md)). `demo` wordt geweigerd in productie.
6. **EAS:** `eas init` en zet het project-ID in `EXPO_PUBLIC_EAS_PROJECT_ID`.
7. **Eerste domein:** vervang `home` door je eerste echte domein, zie [docs/conventions.md](docs/conventions.md#een-nieuw-domein-toevoegen).
8. Verwijder dit hoofdstuk uit de README en beschrijf het project.

## Configuratie

| Variabele                    | Betekenis                                                     |
| ---------------------------- | ------------------------------------------------------------- |
| `APP_VARIANT`                | `internal` / `acceptance` / `production`, gezet in `eas.json` |
| `EXPO_PUBLIC_API_BASE_URL`   | basis-URL van de API (optioneel; leeg = geen backend)         |
| `EXPO_PUBLIC_ENVIRONMENT`    | `internal` / `acceptance` / `production`                      |
| `EXPO_PUBLIC_AUTH_PROVIDER`  | `demo` (standaard) of `azure-ad`                              |
| `EXPO_PUBLIC_AZURE_AD_*`     | tenant, client, redirect-URL en API-scopes bij `azure-ad`     |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | EAS-project, alleen voor EAS Build/Update                     |

Zie [.env.example](.env.example). `EXPO_PUBLIC_*` wordt in de app gebakken en is niet geheim.

## Scripts

| Script                          | Doet                                                        |
| ------------------------------- | ----------------------------------------------------------- |
| `pnpm run check`                | formatteren controleren, lint (oxlint) en typecheck         |
| `pnpm test`                     | alle unit- en integratietests (Vitest, in Node, ~1 seconde) |
| `pnpm test:coverage`            | tests met coverage-drempels (90% regels, 85% branches)      |
| `pnpm run ci`                   | `check` + `test:coverage`: wat CI en `pre-push` draaien     |
| `pnpm format` / `pnpm lint:fix` | automatisch herstellen                                      |
| `pnpm prebuild`                 | native projecten opnieuw genereren (`ios/` en `android/`)   |
| `pnpm run doctor`               | Expo-configuratie controleren                               |

Een wijziging is **klaar** als `pnpm run ci` slaagt en de app bundelt (`pnpm exec expo export --platform android`, draait ook in CI).

## Opbouw

```text
src/
  app/            Expo Router: dunne routes, alleen koppelen (geen logica)
  bootstrap/      composition root: bouwt alle onderdelen en koppelt ze (container.ts)
  domeinen/       één map per domein: auth, settings, support, home
  shared/         herbruikbare basis: HTTP-client, logger, config, i18n, poorten, feedback, UI-primitieven
  test/           fakes voor tests (klok, opslag, scheduler, HTTP-antwoorden)
docs/             conventies, architectuur, beslissingen (ADR's)
```

Elk domein (`src/domeinen/<naam>/`) heeft dezelfde lagen:

| Laag                              | Bevat                                                    | Mag React Native gebruiken |
| --------------------------------- | -------------------------------------------------------- | -------------------------- |
| `domain/`                         | pure regels en types                                     | nee                        |
| `api/`                            | endpoints en zod-schema's                                | nee                        |
| `service/`                        | use-cases met geïnjecteerde poorten (opslag, klok, HTTP) | nee                        |
| `store/`                          | Zustand, alleen client-state                             | nee (vanilla)              |
| `hooks/` `components/` `screens/` | React Native                                             | ja                         |

`index.ts` is de publieke, pure ingang van een domein; `ui.ts` de React Native-ingang. Andere domeinen en routes importeren alleen via die twee bestanden. Deze regels worden afgedwongen door [src/architecture.test.ts](src/architecture.test.ts).

## Documentatie

- [docs/conventions.md](docs/conventions.md): hoe we hier code schrijven
- [docs/architecture.md](docs/architecture.md): lagen, datastromen, sessiebeheer, wat bewust niet in de boilerplate zit
- [docs/decisions/](docs/decisions/): waarom we voor deze aanpak kozen
- [docs/functioneel/open-vragen.md](docs/functioneel/open-vragen.md): open vragen met de aanname die we maken
- [CLAUDE.md](CLAUDE.md): werkafspraken voor AI-assistenten
