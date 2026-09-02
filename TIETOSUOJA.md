# Tietosuoja (Privacy / GDPR)

Tämä dokumentti kuvaa Laiterekisteri-sovelluksen tietosuojakäytännöt ja sen, miten käsittelemme käyttäjien henkilötietoja ja arkaluontoista dataa.

## Kameran käyttö (Viivakoodiskanneri)

Sovellus sisältää ominaisuuden, jonka avulla laitteiden sarjanumeroita voidaan lukea suoraan mobiililaitteen tai tietokoneen kameralla.

### Tietosuojaperiaatteet kameran osalta:
1. **Lokaali prosessointi:** Kameran videovirtaa ei koskaan lähetetä palvelimelle, pilveen tai kolmansille osapuolille. Videokuvan analysointi ja viivakoodien tunnistaminen tapahtuu 100 % paikallisesti käyttäjän selaimessa (`html5-qrcode` -kirjaston avulla).
2. **Käyttäjän suostumus:** Sovellus ei käynnistä kameraa automaattisesti. Käyttäjälle näytetään selkeä tietosuojailmoitus ennen selaimen oman luvanpyyntöikkunan avaamista. Kamera suljetaan välittömästi, kun skannaus on suoritettu tai käyttäjä peruu toiminnon.
3. **Tietojen tallennus:** Videovirrasta ei oteta kuvakaappauksia, eikä kuvadataa tallenneta laitteen muistiin tai selaimen välimuistiin. Vain tekstimuotoinen lopputulos (dekoodattu sarjanumero) välitetään sovelluksen tilaan.

Nämä toimenpiteet on suunniteltu varmistamaan, että kenttätyöntekijöiden ympäristöstä tai henkilöistä ei vahingossakaan kerätä tunnistettavaa kuvatietoa.

## Henkilötietojen (PII) käsittely ja Roolipohjainen pääsy (RBAC)

Sovellus käsittelee laitteisiin liittyviä henkilötietoja, kuten ensisijaisen käyttäjän nimeä (`Käyttäjä`) ja laitteen yksilöllistä nimeä (`Nimi`), erittäin tiukasti.

### Tietosuojaperiaatteet henkilötietojen osalta:
1. **Roolipohjainen näkyvyys ja Kontekstisidonnaisuus:** Yleiset laitelistaukset ja hälytykset on täysin piilotettu tavallisilta käyttäjiltä (User-rooli). Peruskäyttäjät näkevät ainoastaan ei-yksilöiviä laitetietoja (sarjanumero, malli, tila) ja *vain silloin*, kun he ovat nimenomaisesti skannanneet kyseisen laitteen (Data Minimization). Henkilötietoja (PII) näytetään käyttöliittymässä ainoastaan erikseen valtuutetuille ylläpitäjille (Global Admin ja Admin).
2. **Tietokantatason eristys:** Henkilöön yhdistettävät tiedot on eristetty tietokannassa omaan kokoelmaansa (`device_pii`), jotta vahingossa tapahtuvia tietovuotoja ei pääse syntymään yleisen laitedatan (`devices`) lukemisen yhteydessä.
3. **Minimointi:** Tietokannasta haetaan asiakaslaitteelle (selaimeen) kerrallaan vain sen verran henkilötietoja kuin on ehdottoman välttämätöntä, ja vain silloin kun käyttäjän rooli sen sallii.

## Tietojen siirto kolmansiin osapuoliin (Microsoft Intune)

Laiterekisteri mahdollistaa laitteiden vastuuhenkilöiden (esim. `PrimaryUser` eli sähköpostiosoite) päivittämisen suoraan käyttöliittymästä.

### Tietosuojaperiaatteet integraatiossa:
1. **Rajoitettu muokkausoikeus:** Vain ylläpitäjäroolilla (Admin / Global Admin) toimivat henkilöt voivat tehdä muutoksia henkilötietoihin, jotka välitetään eteenpäin Microsoft Intuneen.
2. **Suojattu tiedonsiirto:** Tietojen päivitys selaimesta Intuneen tapahtuu aina turvallisen taustapalvelun (Firebase Cloud Functions) kautta. Suorat API-kutsut selaimesta Microsoftin palvelimiin on estetty, jotta tietojen siirto voidaan monitoroida ja varmentaa Laiterekisterin omien roolisääntöjen mukaisesti.
3. **Auditointi ja yhdenmukaisuus:** Taustapalvelu varmistaa automaattisesti, että jos henkilötietoa (käyttäjä) muutetaan Intunessa Laiterekisterin kautta, sama muutos tallentuu välittömästi myös Laiterekisterin suojattuun `device_pii`-kokoelmaan. Tämä takaa tiedon eheyden ja sen, että laitteen todellinen omistajuus on aina läpinäkyvästi todennettavissa.

## Azure AD -käyttäjähaku (Intune Autocomplete)

Kun ylläpitäjä (Admin) muokkaa laitteen ensisijaista käyttäjää (PrimaryUser), sovellus hakee sähköpostiosoitteita ja nimiä automaattisesti Azure Active Directorystä ehdottaakseen niitä käyttöliittymässä.

### Tietosuojaperiaatteet käyttäjähaussa:
1. **Rajoitettu Pääsy:** Vain Global Admin - ja Admin-rooleilla on oikeus suorittaa käyttähakuja. Tätä valvotaan tiukasti (hardcoded-tarkistuksella) taustapalvelussa (searchIntuneUsers).
2. **Minimointi:** Microsoft Graph API:lta pyydetään vain minimitiedot (displayName ja userPrincipalName), jolloin tarpeetonta henkilötietoa ei ladata järjestelmään tai selaimeen.
3. **Turvallisuus:** Käyttäjähaku ei koskaan vuoda tietoja Azure AD:stä standardikäyttäjille, eikä API-avaimia altisteta selaimelle.
