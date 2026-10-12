# Architectuur

## Uitgangspunten

1. **Regels zijn puur.** Wat de app "weet" over het vakgebied staat in `domain/` als gewone functies zonder React Native en zonder I/O.
2. **De buitenwereld zit achter poorten.** Tijd (`Clock`, `Sleep`), opslag (`KeyValueStore`, `SecretStore`), timers (`Scheduler`), tril (`Haptics`), inloggen (`Authenticator`) en netwerk (`fetch`) komen binnen als argument. Op het apparaat is dat Expo, in tests een fake.
3. **De API-grens valideert.** Elke response gaat door zod. Wat de app nodig heeft is verplicht, de rest blijft ongemoeid.
4. **Eén eigenaar per soort data.** Server-data: TanStack Query. Client-state: Zustand. Tokens: alleen de `TokenProvider`.
5. **Eén plek waar alles aan elkaar hangt:** `src/bootstrap/container.ts`. Geen singletons, geen globals.

## Lagen en afhankelijkheden

```text
 screens ──► components, hooks ──► store ──► api, service ──► domain
   (React Native)                              (puur TypeScript)
```

Een pijl betekent "mag importeren". Naar rechts is lager. Tussen domeinen kan alleen via `index.ts` (puur) en `ui.ts` (React Native), en zonder kringen. `src/shared/` kent geen domeinen; `src/app/` en `src/bootstrap/` staan boven de domeinen. Alles hierboven staat als test in `src/architecture.test.ts`.

## Domeinen in de boilerplate

| Domein     | Inhoud                                                                                                                                           | Zie                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth`     | sessie, refresh-beleid, `TokenProvider`, `SessionLifecycle`, `Authenticator`-poort met demo- en Azure AD-implementatie, sessiestore, loginscherm | [0008](decisions/0008-sessies-en-tokens.md), [0012](decisions/0012-azure-ad-inloggen.md), [0017](decisions/0017-inlogmethode-per-build.md) |
| `settings` | instellingenscherm, taalkeuze (NL/EN, bewaard), uitloggen                                                                                        | [0013](decisions/0013-instellingen-en-taal.md)                                                                                             |
| `support`  | log van de laatste dag, al geredigeerd, delen via het systeem                                                                                    | [0014](decisions/0014-supportlog-en-querycache.md)                                                                                         |
| `home`     | het startscherm na inloggen; vervang het door het eerste echte domein                                                                            |                                                                                                                                            |

Daarnaast `src/bootstrap/dev/`: een debugscherm (alleen in `__DEV__`) met opslag, sessie en querycache, en het access token kopiëren.

## Opstarten

```text
index.js → expo-router/entry
app/_layout.tsx
  └─ createNativeContainer()       leest .env (falen met duidelijke melding), bouwt container
       └─ container.start()        taal herstellen, SessionLifecycle.start(), TokenProvider.restore()
            └─ sessionStore.status: unknown → signed-in | signed-out
  └─ <Navigator>                   splash tot status bekend is
       └─ Stack.Protected          (app) als signed-in, (auth) als signed-out
```

Uitloggen, of een sessie die niet te redden is, wijzigt alleen de sessiestatus; de navigatie volgt vanzelf. Bij een verlopen sessie toont het loginscherm waarom (`signedOutReason`).

## Een verzoek met token

```text
hook (useQuery) ─► api.list() ─► HttpClient.requestJson
                                   ├─ TokenProvider.getAccessToken()   ververst zo nodig, één keer tegelijk
                                   ├─ fetch met Bearer, time-out over verbinding én body
                                   ├─ 401? ─► TokenProvider.refreshNow() ─► één keer opnieuw
                                   └─ zod-schema ─► data | ResponseParseError
```

### Wat de `TokenProvider` garandeert

- **Eén refresh tegelijk**, hoeveel verzoeken er ook een token willen (single flight).
- **Tijdelijk is niet definitief.** Geen netwerk of een serverfout laat de sessie staan; drie pogingen met 2 s en 4 s pauze, daarna `TokenRefreshError`. Een token dat bijna maar nog niet verlopen is, wordt gewoon gebruikt (na één poging, met 30 s rust erna). Alleen een weigering (`invalid_grant`, 401/403) beëindigt de sessie.
- **Uitloggen wint.** Een refresh die klaar komt nadat de gebruiker uitlogde (of als iemand anders inlogde) wordt weggegooid en herstelt de sessie niet.
- **Opslag in volgorde.** Schrijfacties gaan via een wachtrij, dus een late `save` kan een `clear` niet ongedaan maken.
- **Eén Session-object** op één sleutel, in stukken van 1800 tekens verdeeld vanwege de limiet van de beveiligde opslag.

`SessionLifecycle` ververst op de achtergrond vijf minuten voor het verlopen, nooit vaker dan elke 30 s, en herhaalt mislukte pogingen na 5 s, 15 s, 60 s en daarna elke 5 min. Bij terugkeer naar de voorgrond ververst hij meteen als dat nodig is.

## Uitloggen en gebruikersdata

`clearUserData` in de container wist bij uitloggen (en bij een verlopen sessie) de Query-cache in het geheugen en op schijf. Voorkeuren zoals de taalkeuze blijven staan. Een domein dat gebruikersdata bewaart (concepten, een wachtrij, foto's), voegt hier zijn opruimactie toe, met een scenario in `container.test.ts`.

## Fouten

Verwachte uitkomsten zijn een `Result` (inloggen geannuleerd, validatie). Onverwachte zijn excepties met een vaste taxonomie in `src/shared/api/errors.ts`; `isRetryable` beslist over opnieuw proberen. TanStack Query probeert alleen tijdelijke fouten opnieuw (maximaal 3 pogingen, 1 s, 2 s, 4 s) en mutaties nooit.

## Logging en privacy

`Logger` houdt een ringbuffer van 1000 regels met categorie en niveau. Alles gaat door `redact`: sleutels met token, wachtwoord, code of geheim worden `[redacted]`, telefoon en e-mail gemaskeerd, lange teksten en diepe objecten afgekapt. Body's van verzoeken en antwoorden worden niet gelogd. `container.test.ts` bewaakt dat tokens niet in het log belanden. Het exporteren voor support gebruikt `formatLogExport`.

## Feedback

Toasts voor niet-blokkerende meldingen, een blokkerend statusscherm voor verzend-acties, bevestigingen via `confirm()`/`choose()`. Zie [0015](decisions/0015-feedback-en-dialogen.md) en [0016](decisions/0016-statusscherm-bij-acties.md).

## Testen

| Soort               | Waar                                 | Hoe                                            |
| ------------------- | ------------------------------------ | ---------------------------------------------- |
| Unit                | `domain`, `api`, `service`, `shared` | Vitest in Node, fakes voor de poorten          |
| Integratie (skelet) | `src/bootstrap/container.test.ts`    | echte onderdelen, nep-apparaat, nep-backend    |
| Architectuur        | `src/architecture.test.ts`           | leest de imports en controleert de laagregels  |
| Bundel              | CI-job `bundle`                      | `expo export`: vangt kapotte imports en routes |
| Component (later)   | `screens/`, `components/`            | React Native Testing Library, zie ADR 0003     |
| End-to-end (later)  | complete flows op simulator          | bijvoorbeeld Maestro                           |

## Niet in de boilerplate (wel eerder gebouwd)

Deze onderdelen zijn bewust weggelaten omdat niet elk project ze nodig heeft. Ze passen in dezelfde opbouw (een domein, een poort, een regel in de container):

- **Pushmeldingen** (Firebase Messaging + Notifee): registratie, ontvangst op voorgrond, achtergrond en koude start, ontdubbelen, meldingenhistorie.
- **Offline-wachtrij** (`outbox`): bevestigde mutaties in volgorde versturen zodra er weer verbinding is.
- **Toestemmingen** (locatie, camera, meldingen) met uitleg en herstel via de systeeminstellingen.
- **Locatie**, **camera/foto-upload** (versleutelde wachtrij, multipart) en **adres zoeken** (Google Places).
