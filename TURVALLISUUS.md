# Tietoturva (Security)

Tämä dokumentti kuvaa Laiterekisteri-sovelluksen tietoturvakäytännöt.

## Syötteiden validointi ja XSS-suojaus

Kaikki käyttäjältä tuleva syöte ja ulkoisista lähteistä (kuten kameroista) saatava tieto validoidaan tiukasti ennen sen käyttöä sovelluksessa. Tähän tarkoitukseen käytämme `zod`-kirjastoa.

### Esimerkki: Viivakoodiskannerin validointi
Viivakoodiskannerin (`DeviceScanner.tsx`) lukema tulos ohjataan aina Zod-skeeman läpi. Tämä estää mahdolliset injektiohyökkäykset, mikäli skannattu QR-koodi tai viivakoodi sisältää haitallista dataa:

```typescript
const serialNumberSchema = z.string()
  .min(3, "Koodi on liian lyhyt")
  .max(50, "Koodi on liian pitkä")
  .regex(/^[a-zA-Z0-9\-_]+$/, "Koodi sisältää kiellettyjä merkkejä");
```

Tämä varmistaa, ettei skannerista tuleva syöte voi sisältää esimerkiksi HTML-tageja tai JavaScript-koodia, joka suoritettaisiin selaimessa (XSS).

## Tunnistautuminen (Authentication) ja Pääsynhallinta (RBAC)

Sovellus noudattaa erittäin tiukkaa tunnistautumis- ja pääsynhallintapolitiikkaa (Role-Based Access Control).

1. **Kirjautumisrajapinta:** Sovellukseen voi kirjautua ainoastaan Google- tai Microsoft-tunnuksilla. Muut kirjautumistavat (esim. sähköposti/salasana) on estetty.
2. **Verkkotunnuksen rajoitus:** Kirjautuminen on sallittu ainoastaan virallisia sähköpostiosoitteita käyttäen (`@edu.lappeenranta.fi` tai `@lappee.fi`). Kaikki muut domainit hylätään automaattisesti Firestore-tietokannan säännöissä (Rules).
3. **Käyttäjäroolit:**
   - **Global Admin:** Kaikki oikeudet koko tietokantaan ja roolien hallintaan.
   - **Admin:** Oikeus lukea henkilötietoja ja päivittää olemassa olevien laitteiden tilatietoja (esim. `LastCheckIn` ja `DeviceStatus`).
   - **User (Peruskäyttäjä):** Vain lukuoikeus julkisiin, ei-yksilöiviin laitetietoihin.

## Tietokannan turvallisuus (Firestore Rules)

Sovelluksen taustajärjestelmän (Firebase Firestore) tietoturva perustuu tiukkoihin tietokantasääntöihin (`firestore.rules`):

- **Default Deny:** Kaikki haut ja päivitykset tietokantaan on oletuksena estetty, ellei erillistä sääntöä ole erikseen määritelty sallivaksi.
- **Roolipohjaiset säännöt:** Vain erikseen määritellyt ja validoidut järjestelmänvalvojat saavat kirjoitus- tai lukuoikeuden henkilötietoja sisältäviin kokoelmiin (`device_pii` ja `user_roles`).
- **Kenttätason päivitysrajoitus:** Admins-käyttäjien päivitysoikeudet julkiseen laitedataan (`devices`) on rajattu tiukasti ainoastaan tiettyjen kenttien muokkaamiseen (esim. skannauksen aikaleima `LastCheckIn`), mikä estää laitteen muun datan vahingollisen tai luvattoman muuttamisen.

## Riippuvuudet
- **html5-qrcode**: Käytetään laitteen kameran hyödyntämiseen skannauksessa.
- **zod**: Käytetään syötteiden validointiin.

## Kolmansien osapuolten integraatiot (Intune & Google Admin)

Järjestelmä on integroitu suoraan laitehallintajärjestelmiin (Microsoft Intune ja Google Admin) hyödyntäen Firebase Cloud Functions -taustapalveluita. 

- **Tokenien suojaus (Credentials):** Laiterekisterin selainkäyttöliittymä ei koskaan käsittele eikä varastoi Microsoft Graph API:n tai Google Admin API:n salaisuuksia (Client Secret). Nämä avaimet sijaitsevat turvallisesti Google Cloudin Secret Managerissa ja ovat ainoastaan Cloud Functions -taustapalvelun saatavilla.
- **Sovellustason käyttöoikeudet (Application Permissions):** Koska käyttäjät voivat kirjautua sekä Google- että Microsoft-tunnuksilla, taustapalvelu hyödyntää itsenäistä sovellustason autentikointia muodostaessaan yhteyden Graph API:in. Laiterekisteri toimii portinvartijana: se validoi selaimesta tulevan HTTPS-kutsun tekijän roolin (RBAC, vain Admin / Global Admin) ennen kuin se välittää muutospyynnön (esim. `DeviceName` tai `PrimaryUser`) eteenpäin Intuneen.
- **Muokkauksen rajoitukset:** Ylläpitäjät pystyvät muokkaamaan ainoastaan laitteen nimeä (`DeviceName`) ja pääkäyttäjää (`PrimaryUser`). Laitteen sarjanumero (`Serial`) on ohjelmallisesti lukittu taustajärjestelmässä, eikä sitä voi muuttaa API-kutsujen tai käyttöliittymän kautta. Näin estetään laitteiden identiteetin väärentäminen.
