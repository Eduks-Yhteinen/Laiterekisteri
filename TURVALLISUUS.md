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

## Riippuvuudet
- **html5-qrcode**: Käytetään laitteen kameran hyödyntämiseen skannauksessa.
- **zod**: Käytetään syötteiden validointiin.
