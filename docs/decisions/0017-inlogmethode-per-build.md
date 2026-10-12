# 0017. Inlogmethode per build: demo of Azure AD

**Status:** aangenomen.

## Context

Een nieuw project heeft vaak nog geen identity provider of app-registratie, maar moet wel vanaf dag één end-to-end draaien: inloggen, beveiligde routes, tokens op requests, uitloggen. De web-boilerplate lost dat op met `VITE_AUTH_PROVIDER` (`demo` als standaard, optioneel MSAL).

## Besluit

- `EXPO_PUBLIC_AUTH_PROVIDER` kiest per build: `demo` (standaard) of `azure-ad`.
- De `Authenticator`-poort (`method`, `signIn`, `refresh`) staat in `auth/service/auth-service.ts`. `createDemoAuthenticator` is puur (geen netwerk, tokens van een uur, via de `Clock`); de Azure AD-adapter staat in `platform/rn/` ([0012](0012-azure-ad-inloggen.md)).
- De container kiest de authenticator op basis van de configuratie. Een device-authenticator die niet past bij de configuratie is een koppelfout en laat de app bij de start falen, niet bij de eerste inlogpoging.
- De sessie onthoudt haar `method`. Een sessie van een andere methode (de configuratie is gewijzigd) wordt bij de eerste refresh beëindigd in plaats van eindeloos te falen.
- `parseRuntimeConfig` weigert `demo` als `EXPO_PUBLIC_ENVIRONMENT=production`.

## Gevolgen

- Een nieuwe methode (bijvoorbeeld een eigen OAuth-server of SMS-code) is: een waarde in `AUTH_METHODS` en `AUTH_PROVIDERS`, een `Authenticator`-implementatie, een tak in `buildDeviceAuthenticator` (`native.ts`) en eventueel een eigen loginscherm-stap.
- Demo-tokens worden door een echte API geweigerd; de demo is voor de app-flow, niet voor echte data.
