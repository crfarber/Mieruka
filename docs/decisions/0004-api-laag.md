# 0004. API-laag: eigen HttpClient met zod

**Status:** aangenomen. Per project heroverwegen (zie "Alternatief").

## Context

Een gegenereerde client (bijvoorbeeld Orval uit `swagger.json`) geeft typen tijdens het compileren, maar valideert niets tijdens het draaien. Loopt de specificatie achter op de echte backend, of zijn de entiteiten losse objecten met veel velden waarvan de app er maar een paar gebruikt, dan eindigt dat in `as unknown as X` en fouten drie schermen verder.

## Besluit

Een kleine eigen `HttpClient` (`src/shared/api/http-client.ts`) en per domein een `api/`-map met endpoints en **zod-schema's** (tolerante lezer, zie [conventies](../conventions.md)). Elke response wordt bij de grens gecontroleerd; een kapotte rij in een lijst wordt overgeslagen en gelogd.

## Gevolgen

- Contractwijzigingen vallen op waar ze binnenkomen, met een leesbare melding.
- Nieuwe endpoints kosten een paar regels handwerk in plaats van een generatorrun.
- De `HttpClient` is generator-onafhankelijk: er hoeft niets te veranderen als je later toch genereert.

## Alternatief en wat het vraagt

Orval in `zod`-modus met een custom mutator die `HttpClient.request` aanroept: schema's en typen worden dan gegenereerd, de mappers blijven met de hand. Dit is alleen zinvol als de backend een **actuele OpenAPI-specificatie** publiceert die overeenkomt met wat de app aanroept, in elke omgeving.
