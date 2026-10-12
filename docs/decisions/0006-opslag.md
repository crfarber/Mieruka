# 0006. Opslag: beveiligde opslag in stukken, gewone opslag met SQLite

**Status:** aangenomen.

## Context

Tokens horen niet in onbeveiligde opslag (AsyncStorage). Een sessie die over meerdere sleutels verspreid staat, kan half geschreven of inconsistent raken.

## Besluit

- Tokens gaan in **Keychain/Keystore** (`expo-secure-store`) achter de `SecretStore`-poort, als **één** JSON-waarde op één sleutel (`auth.session`), gevalideerd bij het lezen. Beschadigde data geldt als geen sessie en wordt verwijderd.
- Beveiligde opslag heeft een groottelimiet (Expo adviseert 2048 bytes; een Azure AD-token kan groter zijn). `createChunkedSecretStore` verdeelt een waarde over stukken van 1800 tekens; het aantal wordt als laatste geschreven zodat een halve waarde nooit zichtbaar is.
- Voorkeuren zonder geheimen komen achter de `KeyValueStore`-poort, met `expo-sqlite/kv-store` als device-adapter (`shared/platform/rn/key-value-store.ts`). Gekozen boven MMKV: het is een Expo-eigen package (eigen config-plugin, geen extra AppDelegate-aanpassing) en de API is al gelijk aan de `KeyValueStore`-poort.

## Gevolgen

- Wat er bij uitloggen gewist wordt, is bewust een lijst (`clearUserData` in `src/bootstrap/container.ts`): sessie en Query-cache. Voorkeuren zoals de taalkeuze blijven staan. Een nieuw domein dat gebruikersdata bewaart, voegt zich daar toe.
