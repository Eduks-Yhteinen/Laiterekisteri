# Tietosuoja (Privacy / GDPR)

Tämä dokumentti kuvaa Laiterekisteri-sovelluksen tietosuojakäytännöt ja sen, miten käsittelemme käyttäjien henkilötietoja ja arkaluontoista dataa.

## Kameran käyttö (Viivakoodiskanneri)

Sovellus sisältää ominaisuuden, jonka avulla laitteiden sarjanumeroita voidaan lukea suoraan mobiililaitteen tai tietokoneen kameralla.

### Tietosuojaperiaatteet kameran osalta:
1. **Lokaali prosessointi:** Kameran videovirtaa ei koskaan lähetetä palvelimelle, pilveen tai kolmansille osapuolille. Videokuvan analysointi ja viivakoodien tunnistaminen tapahtuu 100 % paikallisesti käyttäjän selaimessa (`html5-qrcode` -kirjaston avulla).
2. **Käyttäjän suostumus:** Sovellus ei käynnistä kameraa automaattisesti. Käyttäjälle näytetään selkeä tietosuojailmoitus ennen selaimen oman luvanpyyntöikkunan avaamista. Kamera suljetaan välittömästi, kun skannaus on suoritettu tai käyttäjä peruu toiminnon.
3. **Tietojen tallennus:** Videovirrasta ei oteta kuvakaappauksia, eikä kuvadataa tallenneta laitteen muistiin tai selaimen välimuistiin. Vain tekstimuotoinen lopputulos (dekoodattu sarjanumero) välitetään sovelluksen tilaan.

Nämä toimenpiteet on suunniteltu varmistamaan, että kenttätyöntekijöiden ympäristöstä tai henkilöistä ei vahingossakaan kerätä tunnistettavaa kuvatietoa.
