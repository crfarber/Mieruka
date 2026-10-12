# 0003. Vitest in Node voor de logica, later jest-expo voor componenten

**Status:** aangenomen.

## Context

Logica die in schermen, hooks en stores zit, is niet los te testen. Tests die door React Native heen moeten, zijn traag en breekbaar.

## Besluit

De testpiramide begint onderaan. Alle logica staat in pure TypeScript en draait in **Vitest in een Node-omgeving**: het hele pakket draait in ongeveer een seconde, zonder simulator of Metro. Poorten en fakes maken tijd, opslag en netwerk beheersbaar.

Schermen en componenten worden apart getest zodra daar iets te testen valt, met `jest-expo` en React Native Testing Library. Dat is een tweede runner naast Vitest; voeg hem toe bij het eerste scherm met echte logica, niet eerder.

## Gevolgen

- Coverage-drempels gelden voor `domain`, `api`, `service` en `shared` (90% regels, 85% branches). Schermen tellen niet mee tot er een runner voor is.
- Wie logica in een scherm zet, merkt dat direct: de architectuurtest houdt `domain/api/service` vrij van React Native, en wat testbaar moet zijn hoort daar.

## Alternatieven

Alleen `jest-expo`: één runner, maar tests starten trager en logica testen door React Native heen maakt het te makkelijk logica in componenten te laten zitten.
