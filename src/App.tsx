import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { AlertsDashboard } from './pages/AlertsDashboard';
import { DeviceList } from './pages/DeviceList';
import { DeviceScanner } from './pages/DeviceScanner';
import './App.css';

function App() {
  // * Tila (State) pitää sisällään tiedon siitä, kuka on kirjautunut sisään.
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // * useEffect ajetaan vain kerran, kun sovellus käynnistyy (tyhjä [] lopussa).
  // Se tilaa Firebasen onAuthStateChanged -tapahtuman.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Kun tieto on saatu, lopetetaan latausanimaatio
    });
    
    // ! Tärkeää: Aina kun tilaat (subscribe) jotain, muista myös perua tilaus (unsubscribe).
    // Tämä estää muistivuodot, jos komponentti tuhotaan.
    return unsubscribe;
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--color-primary)' }}>Ladataan...</div>;
  }

  // * Jos käyttäjä ei ole kirjautunut, näytetään VAIN Login-komponentti.
  // Reititystä ei edes piirretä, joten suojaus on varma.
  if (!user) {
    return <Login />;
  }

  // * Sovelluksen pääreititys (Routing).
  // React Router Dom vastaa siitä, mitä komponenttia näytetään missäkin URL-osoitteessa.
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* index tarkoittaa, että tämä näytetään heti juuressa (/) */}
          <Route index element={<AlertsDashboard />} />
          <Route path="devices" element={<DeviceList />} />
          <Route path="scanner" element={<DeviceScanner />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
