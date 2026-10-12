# 0013. Instellingen en taal

**Status:** aangenomen.

## Besluit

- Domein `settings` met een scherm achter het tandwiel in de header: taal, support, in ontwikkeling ook debug, en onderaan uitloggen met de appversie en de inlogmethode.
- Taal: NL en EN. Zonder keuze volgt de app de telefoontaal (`detectLanguage` in `src/bootstrap/native.ts`). Een keuze staat in de gewone opslag (`settings.language`), wordt bij de start teruggezet nog tijdens het splashscherm, en blijft staan na uitloggen: het is een apparaatvoorkeur.
- Uitloggen loopt via het statusscherm ([0016](0016-statusscherm-bij-acties.md)). Moet uitloggen in een project geblokkeerd worden (bijvoorbeeld bij werk dat nog niet verstuurd is), dan komt daar een guard-service voor in `settings/service/`, gekoppeld in de container.

## Gevolgen

- Toestemmingen (locatie, camera, meldingen) zitten niet in de boilerplate. Voeg ze toe als poort `DevicePermissions` met een adapter in `settings/platform/rn/`, en een stap-functie die kiest tussen vragen en de systeeminstellingen openen (op iOS komt de dialoog na een weigering niet terug).
- Systeemteksten in `app.config.ts` (Info.plist) staan niet in i18n.
