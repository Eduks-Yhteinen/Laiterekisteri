import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AlertsDashboard } from './pages/AlertsDashboard';
import { DeviceList } from './pages/DeviceList';
import { DeviceScanner } from './pages/DeviceScanner';
import './App.css';

function App() {
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
