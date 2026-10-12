# 0009. Varianten en bundle-ID's

**Status:** aangenomen. Bundle-ID's per project vastleggen vóór de eerste storebuild.

## Besluit

Eén codebase, drie varianten (`internal`, `acceptance`, `production`) via `APP_VARIANT`, per EAS-buildprofiel gezet in `eas.json` en uitgelezen in `app.config.ts`. Geen native flavors, geen `react-native-config`. Elke variant heeft eigen naam, bundle-ID en URL-scheme, zodat ze naast elkaar op een toestel staan. Runtime-configuratie (`EXPO_PUBLIC_*`) wordt met zod gevalideerd (`parseRuntimeConfig`): de app start niet met een ontbrekende of ongeldige waarde.

## Bundle-ID's

Afgeleid van `APP.id` in `app.config.ts`: `<id>` (productie), `<id>.acceptance`, `<id>.internal`. De boilerplate gebruikt `com.example.expoboilerplate`; vervang dat bij de start van een project. Neemt de app een bestaande store-listing over, dan horen de bestaande ID's erin (en een hogere versie).

## Gevolgen

- Native configuratiebestanden met projectsleutels (bijvoorbeeld `google-services.json` bij push) staan in `.gitignore` en komen via EAS-bestandsvariabelen.
- `EXPO_PUBLIC_*` is niet geheim; zie [conventies](../conventions.md).
