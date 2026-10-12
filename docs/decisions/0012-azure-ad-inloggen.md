# 0012. Azure AD (Microsoft Entra ID) met react-native-app-auth

**Status:** aangenomen. Op een iOS-simulator getest met een echte tenant; Android nog niet.

## Besluit

`react-native-app-auth` 8.4.1 voor inloggen met Azure AD in een systeembrowser-sheet (OAuth 2.0 authorization code + PKCE). Alternatief was `expo-auth-session`; `react-native-app-auth` heeft een Expo-config-plugin die de Swift-`AppDelegate` van SDK 57 herkent, en levert refresh-tokens zonder eigen tokenverwerking.

## Opbouw

- `domain/azure-ad-configuration.ts`: bouwt de AppAuth-configuratie (issuer, endpoints, scopes) uit `RuntimeConfig.auth.azureAd`. Altijd `openid profile email offline_access` (zonder `offline_access` geen refresh-token), plus de API-scopes uit `EXPO_PUBLIC_AZURE_AD_SCOPES`. `serviceConfiguration` staat naast `issuer`, zodat het discovery-document niet eerst opgehaald hoeft te worden.
- `domain/login-failures.ts` (`classifyAppAuthError`): annulering versus een echte fout, puur op de foutcode, **niet** op de boodschap: op een toestel gaf een annulering iOS' generieke `authentication_failed` met een boodschap van Foundation zelf, zonder "cancel". Zie het commentaar in de code voor de afleiding per platform.
- `platform/rn/azure-ad-authenticator.ts`: de dunne adapter achter de `Authenticator`-poort. Herbruikt `classifyRefreshFailure` voor een geweigerde refresh.
- `app.config.ts`: plugin `react-native-app-auth` met `redirectUrls: ['<app id>.auth://login/']`, één vast scheme in elke omgeving. **Moet vóór** de `expo-build-properties`-plugin staan: beide passen `AppDelegate.swift` aan, en de mods draaien in de omgekeerde volgorde van de lijst ([0011](0011-ios-scene-lifecycle.md)).

## Inrichten

1. Maak in Entra ID een app-registratie met platform "Mobile and desktop applications" en als redirect-URI de waarde van `AUTH_REDIRECT_URL` uit `app.config.ts`.
2. Geef de app-registratie toegang tot de API (scope, bijvoorbeeld `api://<api-client-id>/access_as_user`).
3. Zet in `.env.local` (of als EAS-omgevingsvariabelen): `EXPO_PUBLIC_AUTH_PROVIDER=azure-ad`, tenant-id, client-id, redirect-URL en scopes.
4. `pnpm prebuild` en opnieuw bouwen: het URL-scheme moet in `Info.plist` en `AndroidManifest.xml` staan.

## Gevolgen

- De redirect-URL is geen geheim (het is een URL-scheme, geen credential). Tenant- en client-id zijn ook niet geheim, maar horen per omgeving in EAS of `.env.local`, niet in code.
- Een offline poging toont dezelfde generieke melding als een echte fout (`LoginFailure` heeft geen `network`-variant).
