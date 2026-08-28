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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--color-primary)' }}>Ladataan...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<AlertsDashboard />} />
          <Route path="devices" element={<DeviceList />} />
          <Route path="scanner" element={<DeviceScanner />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
