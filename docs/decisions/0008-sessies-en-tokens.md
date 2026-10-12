# 0008. Sessies en tokens

**Status:** aangenomen; het beleid is testbaar vastgelegd.

## Context

Typische fouten in zelfgebouwd tokenbeheer: module-globals (`isRefreshing`, `refreshPromise`), parallelle refreshes, uitloggen bij een netwerkfout, een refresh die na het uitloggen de sessie terugzet, en tokens die half blijven staan.

## Besluit

Eén `TokenProvider` met vaste garanties (zie [architectuur](../architecture.md)): single flight, tijdelijk is niet definitief, uitloggen wint, geordende opslag. Het beleid staat als pure functies in `refresh-policy.ts`: 3 pogingen met 2 s en 4 s pauze, definitief bij 401/403 of een OAuth-fout als `invalid_grant`, en bij twijfel tijdelijk.

`SessionLifecycle` regelt de timers achter een `Scheduler`-poort: vernieuwen vijf minuten voor het verlopen, herhalen na 5 s, 15 s, 60 s en 300 s, nooit vaker dan elke 30 s.

Hoe er ingelogd en ververst wordt, zit achter de `Authenticator`-poort (`signIn`, `refresh`); zie [0012](0012-azure-ad-inloggen.md) en [0017](0017-inlogmethode-per-build.md).

## Gevolgen

- De HTTP-client vraagt bij 401 één keer `refreshNow()` en probeert opnieuw; een tweede 401 wordt een gewone `HttpError`.
- Een sessie die niet te redden is, is een statuswijziging; er is geen `navigationRef`.
