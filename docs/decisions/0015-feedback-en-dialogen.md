# 0015. Feedback en dialogen

**Status:** aangenomen. Voor verzend-acties aangevuld door [0016](0016-statusscherm-bij-acties.md).

## Context

Zonder vaste regel mengen apps meldingen door elkaar: een globale `showModal(ReactElement)`, native `Alert.alert` voor bevestigingen én fouten én validatie, bottom sheets en aparte schermen, elk op een andere plek gestart.

## Besluit

Eén vaste set, met de regel: **kies het lichtste patroon dat past.** Alleen een beslissing blokkeert de app.

| Situatie                     | Patroon                                                                |
| ---------------------------- | ---------------------------------------------------------------------- |
| Gelukt, niet-blokkerend      | Toast (verdwijnt vanzelf)                                              |
| Onomkeerbaar of riskant      | Bevestigingsdialoog (`confirm()` / `choose()` achter native `Alert`)   |
| Keuze uit meerdere opties    | Bottom sheet; bij onomkeerbare keuze een bevestiging in dezelfde sheet |
| Invoer van meer dan één ding | Eigen scherm                                                           |
| Validatie                    | Inline bij het veld                                                    |

- **Geen globale `showModal(ReactElement)`.**
- **Welke melding bij welk resultaat** is een pure functie per domein (bijvoorbeeld `feedbackFor(result)`). `shared` kent alleen de vorm van een toast of bevestiging.
- **ToastQueue** in `shared/feedback`: Zustand-store, één toast tegelijk, auto-dismiss via de `Scheduler`-poort, tril via de `Haptics`-poort. De host hangt in de root-layout zodat hij navigatie overleeft.
- **Haptics** als poort (`notify('success' | 'warning' | 'error')`), met `expo-haptics` als adapter.
