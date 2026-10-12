# 0014. Supportlog en bewaarde querycache

**Status:** aangenomen.

## Besluit

- Domein `support`: `supportLogText` is `formatLogExport` over de laatste 24 uur, maximaal 200 regels, met de kop `Supportlog`. Het scherm deelt die tekst via het systeem-sharesheet. De regels zijn al door `redact` gegaan.
- De Query-cache van geslaagde queries wordt kort na een wijziging bewaard (`query.cache`) en bij een herstelde sessie teruggezet, zodat de app na een herstart meteen data toont. Uitloggen, of een sessie die verloopt, wist die cache.

## Gevolgen

- Mutaties die de server niet haalden, gaan verloren: de boilerplate heeft geen offline-wachtrij. Heeft een project die nodig (werk op plekken zonder bereik), voeg dan een `outbox`-domein toe: bevestigde mutaties in volgorde, een tijdelijke fout (`isRetryable`) blijft aan het hoofd, een harde 4xx markeert alleen dat item.
- Geen crashmonitoring; zie [0010](0010-logging-en-monitoring.md).
