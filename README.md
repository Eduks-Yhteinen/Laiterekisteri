# Laiterekisteri

Laiterekisteri on nykyaikainen verkkosovellus mobiililaitteiden (kuten puhelimien, tablettien ja tietokoneiden) sekä muun irtaimiston hallintaan. Sovellus on suunniteltu erityisesti kenttätyöhön: sen sisäänrakennettu viivakoodiskanneri toimii suoraan selaimessa ja käyttää laitteen omaa kameraa (toimii offline-tilassa, paikallisesti).

Projektin lähdekoodi toimii myös **oppimisympäristönä**. Koodiin on jätetty runsaasti kommentteja ("Värikoodattuja", kts. kohta Koodin lukeminen) joiden tarkoituksena on opettaa, miksi asioita on tehty tietyllä tavalla.

---

## Teknologiapino (Tech Stack)

Sovellus on rakennettu moderneilla web-teknologioilla, jotka mahdollistavat nopean kehityksen ja vahvan tietoturvan:
- **Vite:** Äärimmäisen nopea käännöstyökalu ja kehityspalvelin.
- **React:** UI-kirjasto, jolla rakennamme käyttöliittymän komponentit.
- **TypeScript:** Tuo JavaScriptiin vahvan tyypityksen, joka vähentää ajonaikaisia virheitä. *Kaikki koodi on pelkkää TypeScriptiä (.ts / .tsx).*
- **Firebase:** Googlen alusta, jota käytetään tietokantana (Firestore) ja käyttäjien tunnistautumiseen (Auth).
- **Zod:** Skeemavalidaatiokirjasto, jolla varmistamme että tietokannasta ja skannerista tuleva data on juuri sitä mitä odotamme.
- **html5-qrcode:** Lokaali kirjasto viivakoodien/QR-koodien skannaamiseen selaimessa.

---

## Arkkitehtuuri ja Datan Minimointi (Tietosuoja / GDPR)

Sovelluksen arkkitehtuurissa on tehty kriittinen suunnittelupäätös **datan minimoinnin** (Data Minimization) ja GDPR:n noudattamisen takia:

1. **Yleinen Laitetieto (`devices` -kokoelma):** Sisältää laitteen mallin, tilan, sarjanumeron ja takuutiedot. Kuka tahansa kirjautunut käyttäjä (kuten kenttätyöntekijä) voi lukea näitä tietoja työssään.
2. **Henkilötiedot (`device_pii` -kokoelma):** Yhdistää laitteen oikeaan henkilöön (esim. nimeen ja sähköpostiin). Vain ja ainoastaan ylläpitäjillä (Admin) on pääsy tähän kokoelmaan.

Tämä jako tarkoittaa, että tavallinen käyttäjä voi skannata laitteen ja tarkistaa "onko tämä laite rikki vai varastossa", näkemättä koskaan, kenen hallussa laite on, jollei siihen ole erillistä oikeutta. Lue lisää tietosuojasta: [TIETOSUOJA.md](./TIETOSUOJA.md).

---

## Tietoturva ja Ympäristömuuttujat (.env)

Sovellus käyttää Firebasea suoraan selaimesta. Tästä johtuen kaikki `VITE_`-alkuiset ympäristömuuttujat (esim. Firebase API-avain) ovat **julkisia** ja ne lähetetään käyttäjän selaimeen. 

Tämä **ei** ole tietoturva-aukko. Firebasen tietoturva perustuu täysin palvelimen päässä tapahtuvaan Role-Based Access Control -määrittelyyn (`firestore.rules`). Vaikka hyökkääjä saisi API-avaimen, hän ei voi lukea tai kirjoittaa tietokantaan ilman sallittua roolia. 

Lue lisää: [TURVALLISUUS.md](./TURVALLISUUS.md).

---

## Asennusohjeet (Getting Started)

Näillä ohjeilla saat sovelluksen pyörimään omalle koneellesi (localhost). Huom: Kehityspalvelin vaatii HTTPS-yhteyden, jotta selain sallii kameran käytön (Vite on konfiguroitu luomaan automaattisesti lokaalit SSL-sertifikaatit).

1. **Kloonaa repositorio ja asenna riippuvuudet:**
   ```bash
   git clone [repon-osoite]
   cd Laiterekisteri
   npm install
   ```

2. **Määritä ympäristömuuttujat (.env):**
   Luo projektin juureen tiedosto `.env.local` ja aseta sinne Firebasen asetukset (kysy avaimet tiiminvetäjältä).
   ```env
   VITE_FIREBASE_API_KEY="AIzaSy..."
   VITE_FIREBASE_AUTH_DOMAIN="..."
   VITE_FIREBASE_PROJECT_ID="..."
   VITE_FIREBASE_STORAGE_BUCKET="..."
   VITE_FIREBASE_MESSAGING_SENDER_ID="..."
   VITE_FIREBASE_APP_ID="..."
   ```

3. **Käynnistä kehityspalvelin:**
   ```bash
   npm run dev
   ```
   Palvelin käynnistyy yleensä osoitteeseen `https://localhost:5173`. Mobiilitestausta varten sovellus kuuntelee myös lokaalia IP-osoitetta.

---

## Koodin lukeminen (Better Comments -standardi)

Helpottaaksemme uuden kehittäjän tai koodausta opettelevan henkilön elämää, kooditiedostot on kommentoitu käyttäen VS Code -laajennuksen **Better Comments** värikoodausstandardia:

- `// *` (Vihreä): Tärkeä huomio, arkkitehtuurinen päätös tai päävaihe.
- `// !` (Punainen): Varoitus tai tietoturvakriittinen kohta (esim. Zod-validaatio). Älä ohita näitä!
- `// ?` (Sininen): Kysymys tai pohdinta. Syitä siihen, miksi jokin asia ehkä tehtiin hieman erikoisella tavalla (esim. Reactin StrictMode-ongelmat).
- `// TODO:` (Oranssi): Jatkokehitysideat.
- Yksinkertaiset `//` kommentit kuvaavat koodin perustoimintaa.

---

## Kansiorakenne

- `src/components/` - Uudelleenkäytettävät käyttöliittymäkomponentit (esim. Layout, Login).
- `src/pages/` - Kokonaiset näkymät tai sivut (esim. DeviceList, DeviceScanner, AlertsDashboard).
- `src/assets/` - Kuvat ja logot.
- `scripts/` - Ylläpidon ja migraatioiden skriptit (esim. vanhan SharePoint-datan tuonti).
- `firestore.rules` - Firebasen turvasäännöt.
