# 0002. Expo Router

**Status:** aangenomen.

## Context

Imperatieve navigatie (`navigate()` vanuit stores en hooks, een `navigationRef` in het sessiebeheer om na een verlopen sessie naar het loginscherm te springen) maakt navigatie onvoorspelbaar en logica moeilijk testbaar.

## Besluit

Expo Router (bestandsgebaseerd, bovenop React Navigation). Routes in `src/app/` zijn dun: ze geven een scherm uit een domein door. Ingelogd of niet wordt **niet** genavigeerd maar bepaald met `Stack.Protected` op de sessiestatus.

## Gevolgen

- Een verlopen sessie hoeft niemand te weten: de status verandert en het loginscherm verschijnt. Er is geen `navigationRef` in het sessiebeheer.
- Deep links worden routes; getypeerde routes (`typedRoutes`) vangen kapotte paden bij het compileren.
- Domeinlogica beslist over bestemmingen als data (bijvoorbeeld een `ExitTarget`), niet als route-naam; het scherm vertaalt dat naar een route. Zo blijft die logica testbaar zonder router.

## Alternatieven

React Navigation direct: meer handwerk, dezelfde onderliggende bibliotheek. De domeinlagen weten niets van de router, dus overstappen kost weinig.
