# 0018. Koppeling met bunq via een API-sleutel

**Status:** aangenomen.

## Context

De app geeft inzicht in het saldo van één bunq-rekening: het saldo gedeeld door de dagen die nog over zijn in de maand. Er is geen eigen backend. bunq biedt twee manieren om in te loggen ([doc.bunq.com, Authentication](https://doc.bunq.com/basics/authentication)):

- **OAuth**: verplicht voor publieke apps, maar de token-uitwisseling vraagt een `client_secret`. Dat geheim mag niet in de app (`EXPO_PUBLIC_*` is niet geheim) en vraagt dus een eigen backend.
- **API-sleutel**: toegestaan "as long as only you have access to your application". De gebruiker maakt de sleutel zelf aan in de bunq-app.

Met een API-sleutel verloopt het inloggen in drie stappen: `POST /installation` (een eigen RSA-sleutelpaar van 2048 bits, publieke sleutel als PEM), `POST /device-server` (dit toestel registreren voor de sleutel) en `POST /session-server` (een sessie starten). Een sessie verloopt na de "Auto Logout"-tijd van de gebruiker (standaard een week). Daarna start je gewoon een nieuwe sessie. De verzoeken voor toestel en sessie worden ondertekend (`X-Bunq-Client-Signature`: RSA PKCS #1 v1.5 met SHA-256 over de body, base64).

## Besluit

- **API-sleutel, geen OAuth.** De app is voor eigen gebruik. Komt er een backend, dan kan OAuth daar alsnog bij; de rest van het domein verandert dan niet.
- **Domein `bunq`** voor de koppeling, de rekeningen en de rekeningkeuze. **Domein `budget`** voor de regel "per dag" en het startscherm; het vervangt `home`.
- **`BunqConnectionService` is de enige eigenaar** van API-sleutel, privésleutel, installatietoken en sessietoken. Dit is een bewuste uitzondering op "tokens alleen in de `TokenProvider`": die regel gaat over de sessie van de app zelf, dit zijn sleutels van een andere partij. Dezelfde garanties gelden wel: één `BunqConnection`-waarde in de `SecretStore` (sleutel `bunq.connection`), één sessievernieuwing tegelijk, een tijdelijke fout houdt de koppeling in stand, ontkoppelen wint van een late vernieuwing, en schrijfacties gaan in volgorde. Logs en Zustand bevatten nooit sleutels of tokens.
- **Een 401 van bunq betekent: de sessie is voorbij.** Er start één nieuwe sessie en het verzoek wordt één keer herhaald. Weigert bunq ook die nieuwe sessie (een 4xx die niet `isRetryable` is), dan eindigt de koppeling met reden `refused` en vraagt de app opnieuw om een sleutel.
- **RSA in TypeScript** met `micro-rsa-dsa-dh` (BigInt, zonder native module), achter de poort `RequestSigner`. Willekeur komt van `expo-crypto` (`RandomBytes`-poort). De publieke sleutel wordt zelf als DER/PEM gecodeerd; de test controleert sleutel en handtekening tegen OpenSSL van Node. De privésleutel tekent zonder blinding: blinding beschermt tegen iemand die handtekeningen timet over berichten die hij zelf kiest, en de app tekent alleen haar eigen verzoeken. Blinding zou bovendien een globale `crypto.getRandomValues` nodig hebben, en die heeft React Native niet.
- **Rekeningkeuze** is een voorkeur zonder geheim en staat in de `KeyValueStore` (`bunq.account`).
- **Sandbox per build**: `EXPO_PUBLIC_BUNQ_ENVIRONMENT=sandbox` praat met `public-api.sandbox.bunq.com` (testgebruikers met speelgeld). De standaard is `production`.
- De publieke sleutel van de server (`ServerPublicKey`) wordt niet bewaard en antwoorden worden niet op handtekening gecontroleerd; TLS beschermt de verbinding al.

## Gevolgen

- **Een sleutel maken is traag.** Gemeten in Hermes 0.12 (uit 2022, op een server): 8 tot 34 seconden, en de JS-thread staat zolang stil. Het gebeurt één keer, bij het koppelen; het statusscherm staat er dan al. Tekenen kost ongeveer een seconde, alleen bij een nieuwe sessie. Is dit op een echt toestel te traag, vervang dan alleen `createRsaSigner` door een native implementatie (bijvoorbeeld `react-native-quick-crypto`); de poort blijft gelijk.
- Een API-sleutel geeft volledige toegang tot het account, ook betalen. De app leest alleen; het koppelscherm zegt dat eerlijk.
- Uitloggen uit de app (`clearUserData`) en ontkoppelen wissen de koppeling, de rekeningkeuze en de bunq-data in de Query-cache. De sleutel blijft geldig bij bunq totdat de gebruiker hem in de bunq-app intrekt.
- Saldi staan, net als andere server-data, in de bewaarde Query-cache (`KeyValueStore`), zodat het startscherm direct iets toont.
- Open punten over het gedrag van bunq staan in [open-vragen.md](../functioneel/open-vragen.md) (1 tot en met 5).
