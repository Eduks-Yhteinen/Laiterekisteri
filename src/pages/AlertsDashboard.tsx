import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, QueryDocumentSnapshot, limit, getCountFromServer } from 'firebase/firestore';
import { AlertTriangle, Clock, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import type { Device } from '../types';
import './AlertsDashboard.css';
import { formatDate, isOlderThan30Days, isExpiringWithin30Days, isExpiringWithin6Months } from '../dateUtils';
import { DeviceEditModal } from '../components/DeviceEditModal';
import { doc, updateDoc } from 'firebase/firestore';



const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export function AlertsDashboard() {
  const [inactiveDevices, setInactiveDevices] = useState<Device[]>([]);
  const [expiringDevices, setExpiringDevices] = useState<Device[]>([]);
  const [lifecycleDevices, setLifecycleDevices] = useState<Device[]>([]);
  const [deviceCounts, setDeviceCounts] = useState<{ name: string, value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        // * 1. Piirakkakaavion datan haku (Tyyppien lukumäärät)
        // ! OPTIMOINTI: Emme hae itse dokumentteja, vaan käytämme getCountFromServer -metodia.
        // Se on satoja kertoja nopeampi ja maksaa vähemmän Firebase-lukuja (reads).
        // 1000 dokumentin laskeminen maksaa vain 1 lukukerran (1 read).
        const types = ['Windows', 'Apple', 'Android', 'Chromebook'];
        const countsData = await Promise.all(types.map(async (type) => {
          const q = query(
            collection(db, 'devices'),
            where('DeviceType', '==', type),
            where('DeviceStatus', '==', 'Käytössä')
          );
          const snap = await getCountFromServer(q);
          return { name: type, value: snap.data().count };
        }));

        setDeviceCounts(countsData.filter(d => d.value > 0)); // Näytetään vain ne joissa on laitteita

        // * 2. Hälytysten datan haku
        // ? POHDINTA: Tuotannossa hälytykset (esim. yli 30pv inaktiiviset) kannattaa 
        // ehkä laskea Cloud Functionin avulla kerran yössä erilliseen dokumenttiin.
        // Tässä haemme 500 uusinta laitetta ja suodatamme selaimessa, mikä ei skaalaudu satoihin tuhansiin.
        const q = query(collection(db, 'devices'), where('DeviceStatus', '==', 'Käytössä'), limit(500));
        const querySnapshot = await getDocs(q);
        const devices: Device[] = [];
        querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
          devices.push(doc.data() as Device);
        });

        // Etsitään laitteet, joita ei ole näkynyt yli 30 päivään
        const inactive = devices.filter(d => isOlderThan30Days(d.LastCheckIn)).slice(0, 50);

        const expiring = devices.filter(d => {
          const expDate = d.AutoUpdateExpiration || d.LeaseEnd;
          return expDate && isExpiringWithin30Days(expDate);
        }).slice(0, 50);

        const lifecycle = devices.filter(d => d.LeaseType === 'Elinkaari' && d.LeaseEnd && isExpiringWithin6Months(d.LeaseEnd)).slice(0, 50);

        setInactiveDevices(inactive);
        setExpiringDevices(expiring);
        setLifecycleDevices(lifecycle);
      } catch (err: any) {
        console.error('Error fetching alerts:', err);
        setError(err.message || 'Error fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  if (loading) return <div className="p-4">Ladataan hälytyksiä ja tilastoja...</div>;
  if (error) return <div className="p-4 text-red-500">Virhe: {error}</div>;

  const onPieClick = (data: any) => {
    if (data && data.name) {
      navigate(`/devices?type=${data.name}`);
    }
  };

  const handleDeviceClick = (device: Device) => {
    setSelectedDevice(device);
    setIsEditModalOpen(true);
  };

  const handleModalClose = () => {
    setIsEditModalOpen(false);
    setSelectedDevice(null);
  };

  const handleSaveSuccess = () => {
    // Optionally refresh the alerts
    // fetchAlerts(); 
    handleModalClose();
  };

  const handleQuickAction = async (device: Device, action: 'poista' | 'varastoon' | '+1vuosi', e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Haluatko varmasti suorittaa toiminnon laitteelle ${device.Serial}?`)) {
      try {
        const updateData: Partial<Device> = {};
        if (action === 'poista') {
          updateData.DeviceStatus = 'Poistettu';
          updateData.PoistonSyy = 'Elinkaari päättynyt';
          updateData.PoistoPaiva = new Date().toISOString();
        } else if (action === 'varastoon') {
          updateData.DeviceStatus = 'Varastossa';
        } else if (action === '+1vuosi') {
          if (device.LeaseEnd) {
            const d = new Date(device.LeaseEnd);
            d.setFullYear(d.getFullYear() + 1);
            updateData.LeaseEnd = d.toISOString();
          }
        }
        await updateDoc(doc(db, 'devices', device.Serial), updateData);
        // Remove from list locally for better UX
        setLifecycleDevices(prev => prev.filter(d => d.Serial !== device.Serial));
      } catch (err) {
        console.error('Error applying quick action:', err);
        alert('Toiminnon suorittaminen epäonnistui.');
      }
    }
  };

  return (
    <div className="alerts-dashboard">
      <h1 className="page-title">Hälytykset ja Tilastot</h1>
      <p className="page-subtitle">Laitekannan yleiskatsaus ja vaatii huomiota olevat laitteet.</p>

      <div className="alerts-grid">
        <div className="alerts-col-left">
          {/* Device Distribution Chart */}
          <section className="glass-panel alert-section chart-alert">
            <div className="alert-header">
              <PieChartIcon size={24} className="icon-info" />
              <h2>Laitteiston Jakauma (Käytössä)</h2>
            </div>
            <div className="chart-container" style={{ height: '300px', width: '100%', marginTop: '1rem' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={deviceCounts}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    onClick={onPieClick}
                    style={{ cursor: 'pointer' }}
                  >
                    {deviceCounts.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [`${value} kpl`, name]}
                    contentStyle={{ borderRadius: '8px', background: 'rgba(255, 255, 255, 0.9)', color: '#333' }}
                    itemStyle={{ color: '#333' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-sm text-gray-500 mt-2" style={{ color: '#666' }}>
              Klikkaa sektoria avataksesi laitetyypin listauksen.
            </p>
          </section>

          {/* Expiring AUE Devices Card */}
          <section className="glass-panel alert-section aue-alert">
            <div className="alert-header">
              <Clock size={24} className="icon-critical" />
              <h2>Takuu/AUE Umpeutuu (&lt; 30 pv)</h2>
              <span className="badge critical-badge">{expiringDevices.length}</span>
            </div>
            {expiringDevices.length === 0 ? (
              <p className="empty-state">Ei vanhenevia laitteita.</p>
            ) : (
              <ul className="device-list">
                {expiringDevices.map(d => (
                  <li key={d.Serial} className="device-item hover-clickable" onClick={() => handleDeviceClick(d)}>
                    <span className="device-serial">{d.Serial}</span>
                    <span className="device-detail">{d.Model}</span>
                    <span className="device-date">Exp: {formatDate(d.AutoUpdateExpiration || d.LeaseEnd)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Lifecycle Expiring Devices Card */}
          <section className="glass-panel alert-section aue-alert">
            <div className="alert-header">
              <Clock size={24} className="icon-warning" />
              <h2>Elinkaari Päättymässä (&lt; 6 kk)</h2>
              <span className="badge warning-badge">{lifecycleDevices.length}</span>
            </div>
            {lifecycleDevices.length === 0 ? (
              <p className="empty-state">Ei elinkaarensa päässä olevia laitteita.</p>
            ) : (
              <ul className="device-list">
                {lifecycleDevices.map(d => (
                  <li key={d.Serial} className="device-item hover-clickable" onClick={() => handleDeviceClick(d)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <span className="device-serial">{d.Serial}</span>
                      <span className="device-detail">{d.Model}</span>
                      <span className="device-date">Päättyy: {formatDate(d.LeaseEnd)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={(e) => handleQuickAction(d, '+1vuosi', e)}>
                        +1 vuosi
                      </button>
                      <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={(e) => handleQuickAction(d, 'varastoon', e)}>
                        Siirrä varastoon
                      </button>
                      <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--color-error)' }} onClick={(e) => handleQuickAction(d, 'poista', e)}>
                        Poista
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="alerts-col-right">
          {/* Inactive Devices Card */}
          <section className="glass-panel alert-section inactive-alert">
            <div className="alert-header">
              <AlertTriangle size={24} className="icon-warning" />
              <h2>Inaktiiviset (Yli 30 pv)</h2>
              <span className="badge warning-badge">{inactiveDevices.length}</span>
            </div>
            {inactiveDevices.length === 0 ? (
              <p className="empty-state">Ei inaktiivisia laitteita.</p>
            ) : (
              <ul className="device-list">
                {inactiveDevices.map(d => (
                  <li key={d.Serial} className="device-item hover-clickable" onClick={() => handleDeviceClick(d)}>
                    <span className="device-serial">{d.Serial}</span>
                    <span className="device-detail">{d.Model}</span>
                    <span className="device-date">Vrt: {formatDate(d.LastCheckIn)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {selectedDevice && (
        <DeviceEditModal
          device={selectedDevice}
          isOpen={isEditModalOpen}
          onClose={handleModalClose}
          onSaveSuccess={handleSaveSuccess}
        />
      )}
    </div>
  );
}
