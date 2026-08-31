// * 1. Tuodaan Firebasen vaatimat kirjastot
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ! TIETOTURVAHUOMIO (Vite & .env)
// Kaikki VITE_ alkuiset ympäristömuuttujat käännetään osaksi selaimen JavaScript-koodia.
// Nämä avaimet OVAT JULKISIA! Se ei ole tietoturva-aukko, sillä Firebasen turvallisuus
// ei perustu näiden avaimien piilottamiseen, vaan tietokannan käyttöoikeussääntöihin (firestore.rules).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// * 2. Alustetaan itse sovellusyhteys yllä olevilla asetuksilla
const app = initializeApp(firebaseConfig);

// * 3. Alustetaan Firestore (Tietokanta)
// Käytämme persistentLocalCache-ominaisuutta. Tämä tallentaa luetut tiedot selaimen
// välimuistiin. Tämä on tärkeää kenttätyössä: jos yhteys katkeaa (offline), 
// aiemmin ladatut laitteet näkyvät yhä sovelluksessa!
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

// * 4. Alustetaan tunnistautuminen (Auth)
// Tätä kautta hoidetaan Google/Sähköposti -kirjautumiset
export const auth = getAuth(app);
