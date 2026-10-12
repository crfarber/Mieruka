# 0001. Expo met prebuild (CNG) en EAS

**Status:** aangenomen.

## Context

Een kale React Native-app met handmatig onderhouden `ios/`- en `android/`-mappen, `react-native-config` en native flavors per omgeving is duur om te upgraden en foutgevoelig in native configuratie.

## Besluit

Expo SDK 57 met **Continuous Native Generation**: `ios/` en `android/` worden gegenereerd (`expo prebuild`) en staan niet in git. Native wijzigingen gaan via config-plugins in `app.config.ts`. Builds lopen via EAS; ontwikkelen gebeurt met een **development client** (`expo run:ios`), niet met Expo Go, zodat native modules (bijvoorbeeld `react-native-app-auth`) beschikbaar zijn.

## Gevolgen

- Upgraden is `expo install` plus `prebuild`, geen handmatig samenvoegen van native projecten.
- Drie varianten (intern, acceptatie, productie) komen uit één codebase via `APP_VARIANT` ([0009](0009-varianten-en-bundle-ids.md)).
- Modules zonder config-plugin vragen een eigen kleine plugin. Dat is bewust: de native wijziging is dan gedocumenteerd en herhaalbaar.
- Native code die niet met plugins kan, is een reden om te heroverwegen (bare workflow), niet om `ios/` handmatig te gaan bewerken.

## Alternatieven

Bare React Native: meer controle, maar precies de onderhoudslast die we kwijt willen.
