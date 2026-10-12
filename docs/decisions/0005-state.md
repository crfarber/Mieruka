# 0005. State: TanStack Query voor server-data, Zustand alleen voor client-state

**Status:** aangenomen.

## Context

Als dezelfde data in een store, een context én in opslag staat, hangt de bron van waarheid af van het scherm, en lopen de kopieën uit elkaar.

## Besluit

- **Server-data** staat in TanStack Query, met sleutels per domein (bijvoorbeeld `itemKeys.list()`). Een lijst en een detail zijn aparte cache-items; er is geen samengevoegde entiteit in een store.
- **Client-state** in Zustand (vanilla, via een fabriek), alleen voor wat echt client-state is, zoals de sessiestatus.
- **Sessie** in de `TokenProvider`; de UI ziet alleen `status`, `method` en `signedOutReason`.

## Gevolgen

- Uitloggen wist de Query-cache (`queryClient.clear()`), zodat de volgende gebruiker niets van de vorige ziet. Ook de bewaarde cache op schijf gaat mee weg.
- Geslaagde queries worden bewaard (`query.cache`) en bij een herstelde sessie teruggezet, zodat de app na een herstart meteen iets toont.
