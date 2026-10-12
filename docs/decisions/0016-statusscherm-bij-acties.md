# 0016. Statusscherm bij acties

**Status:** aangenomen.

## Context

Alleen een laadstatus op de knop en een toast achteraf laat de rest van de app bruikbaar tijdens het versturen: gebruikers tikken door naar andere schermen of tikken twee keer.

## Besluit

Verzend-acties (alles wat een mutatie naar de server stuurt, en uitloggen) gebruiken één blokkerend **statusscherm** over de hele app:

| Fase        | Kleur     | Gedrag                                                                        |
| ----------- | --------- | ----------------------------------------------------------------------------- |
| Verwerken   | `action`  | Spinner + tekst; na 10 s "duurt langer"; blokkeert aanraking en Android-terug |
| Gelukt      | `success` | Vinkje + tekst; sluit na 1,5 s (tik eerder)                                   |
| In wachtrij | `warning` | Tekst; sluit na 2,5 s (tik eerder)                                            |
| Mislukt     | `danger`  | Tekst + "Sluiten", eventueel "Opnieuw proberen"; blijft tot tik               |

- **`StatusOverlay`** in `shared/feedback`: Zustand-store, `run(message, task)` met de eindstand als returnwaarde van `task`, zodat het scherm niet dichtgaat tussen "klaar" en "gelukt". Een tweede `run` terwijl er één loopt wordt genegeerd (dubbel-tik).
- Bevestigingsvragen en bottom sheets komen **vóór** `run`. Uitkomsten die daarna een dialoog vragen, geven `tone: 'none'` en openen dan de `Alert`.
- Toasts blijven voor niet-blokkerende meldingen ([0015](0015-feedback-en-dialogen.md)).

## Gevolgen

- De host hangt in de root-layout naast `ToastHost`, zodat hij navigatie overleeft.
