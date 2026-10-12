# 0011. iOS scene-lifecycle (Xcode 27)

**Status:** actief. Verwijderen bij de upgrade naar Expo SDK 58.

## Probleem

Een app die met Xcode 27 (iOS 27-SDK) is gebouwd, crasht op iOS 27 direct bij het opstarten, nog voordat er JavaScript draait: `EXC_BREAKPOINT` in `UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`. UIKit eist het scene-lifecycle, en de native template van Expo SDK 57 gebruikt nog het oude model waarin `AppDelegate` zelf het venster maakt. Elke Expo SDK 57-app crasht zo.

## Besluit

In `app.config.ts` staat de plugin `expo-build-properties` met `ios: { enableSceneSupport: true }`. Bij `expo prebuild` past die twee bestanden aan in `ios/`:

- `Info.plist` krijgt een `UIApplicationSceneManifest` met `EXExpoAppSceneDelegate`;
- `AppDelegate.swift` conformeert aan `ExpoReactNativeFactoryProvider` en maakt het venster niet meer zelf. `ExpoAppSceneDelegate` doet dat, en stuurt deep links en levenscyclus-events door.

Vereist `expo` 57.0.23 of hoger en `expo-build-properties` 57.0.20 of hoger. Expo SDK 58 heeft dit in de template; dan is de optie overbodig en kan de plugin weg.

## Gevolgen

- Na een wijziging aan de optie of een update van `expo`: `pnpm exec expo prebuild --platform ios` en opnieuw bouwen. `ios/` is gegenereerd en staat niet in git.
- Zonder de optie start de app niet in de iOS 27-simulator.
- De plugin faalt met een duidelijke fout als `AppDelegate.swift` niet het standaard SDK 57-formaat heeft. Handmatige aanpassingen in `ios/` horen daarom niet thuis in het project maar in een config-plugin.
- `react-native-app-auth` past `AppDelegate.swift` ook aan en moet in de pluginlijst **vóór** `expo-build-properties` staan ([0012](0012-azure-ad-inloggen.md)).
- Bron: de vastgepinde opmerking van de maintainers in [expo/expo#46664](https://github.com/expo/expo/issues/46664); de werking is na te lezen in `node_modules/expo-build-properties/build/iosSceneSupport.js`.
