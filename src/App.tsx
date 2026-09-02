import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { AlertsDashboard } from './pages/AlertsDashboard';
import { DeviceList } from './pages/DeviceList';
import { DeviceScanner } from './pages/DeviceScanner';
import './App.css';

function AppContent() {
  const { user, role, loading } = useAuth();

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
          {/* 
            * How does this work? (Routing & Access Control)
            * We conditionally render routes based on the user's role. 
            * Basic users only get access to the scanner. Navigating to any other route (`*`) redirects them back to the scanner.
            * Admins get access to the dashboard and device list as well. 
          */}
          {role === 'User' ? (
            <>
              <Route index element={<Navigate to="/scanner" replace />} />
              <Route path="scanner" element={<DeviceScanner />} />
              <Route path="*" element={<Navigate to="/scanner" replace />} />
            </>
          ) : (
            <>
              <Route index element={<AlertsDashboard />} />
              <Route path="devices" element={<DeviceList />} />
              <Route path="scanner" element={<DeviceScanner />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
