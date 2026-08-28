import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, QueryDocumentSnapshot, limit, getCountFromServer } from 'firebase/firestore';
import { AlertTriangle, Clock, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import type { Device } from '../types';
import './AlertsDashboard.css';
import { formatDate } from '../dateUtils';

// Helper to check if a date string is older than 30 days
const isOlderThan30Days = (dateString: string) => {
  const date = new Date(dateString);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return date < thirtyDaysAgo;
};

// Helper to check if a date is within the next 30 days (or already past)
const isExpiringWithin30Days = (dateString: string) => {
  const date = new Date(dateString);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return date <= thirtyDaysFromNow;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export function AlertsDashboard() {
  const [inactiveDevices, setInactiveDevices] = useState<Device[]>([]);
  const [expiringDevices, setExpiringDevices] = useState<Device[]>([]);
  const [deviceCounts, setDeviceCounts] = useState<{name: string, value: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        // Fetch Pie Chart Counts (Super fast and cheap using getCountFromServer)
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
        
        setDeviceCounts(countsData.filter(d => d.value > 0)); // Only show non-zero

        // Note: For now, we fetch up to 300 devices to find alerts so we don't blow up the read quota
        // In a real production app, we would use Firebase Functions or composite indexes for this
        const q = query(collection(db, 'devices'), where('DeviceStatus', '==', 'Käytössä'), limit(500));
        const querySnapshot = await getDocs(q);
        const devices: Device[] = [];
        querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
          devices.push(doc.data() as Device);
        });

        const inactive = devices.filter(d => isOlderThan30Days(d.LastCheckIn)).slice(0, 50);
        
        const expiring = devices.filter(d => {
          const expDate = d.AutoUpdateExpiration || d.LeaseEnd;
          return expDate && isExpiringWithin30Days(expDate);
        }).slice(0, 50);

        setInactiveDevices(inactive);
        setExpiringDevices(expiring);
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

  return (
    <div className="alerts-dashboard">
      <h1 className="page-title">Hälytykset ja Tilastot</h1>
      <p className="page-subtitle">Laitekannan yleiskatsaus ja vaatii huomiota olevat laitteet.</p>

      <div className="alerts-grid">
        
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
          <p className="text-center text-sm text-gray-500 mt-2" style={{color: '#666'}}>
            Klikkaa sektoria avataksesi laitetyypin listauksen.
          </p>
        </section>

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
                <li key={d.Serial} className="device-item">
                  <span className="device-serial">{d.Serial}</span>
                  <span className="device-detail">{d.Model}</span>
                  <span className="device-date">Vrt: {formatDate(d.LastCheckIn)}</span>
                </li>
              ))}
            </ul>
          )}
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
                <li key={d.Serial} className="device-item">
                  <span className="device-serial">{d.Serial}</span>
                  <span className="device-detail">{d.Model}</span>
                  <span className="device-date">Exp: {formatDate(d.AutoUpdateExpiration || d.LeaseEnd)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
