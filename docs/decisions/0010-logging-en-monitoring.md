# 0010. Logging en monitoring

**Status:** logging aangenomen; monitoring per project te kiezen.

## Context

`console.log` door de hele code, met telefoonnummers, tokens of volledige berichten erin, is een privacyprobleem en helpt support niet.

## Besluit

- Een `Logger` met categorie (`auth`, `http`, ...) en niveau, een ringbuffer van 1000 regels en een optionele `sink` (in ontwikkeling naar de console). Alle data gaat door `redact`. Zie [architectuur](../architecture.md).
- `formatLogExport` maakt de tekst voor support (nieuwste eerst, filter op categorie en leeftijd). Het supportscherm ([0014](0014-supportlog-en-querycache.md)) gebruikt alleen dit. Het debugscherm in ontwikkeling blijft apart.
- `console.*` is verboden buiten `src/shared/platform/rn/` (lint en architectuurtest).

## Open

Crash- en foutmonitoring (Sentry of vergelijkbaar): niet gekozen. Vereist: geen persoonsgegevens (de `redact`-laag is de basis), source maps via EAS, en een `LogSink` die fouten doorstuurt zodat domeincode niets van de dienst weet.
