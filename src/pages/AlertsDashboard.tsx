import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, QueryDocumentSnapshot } from 'firebase/firestore';
import { AlertTriangle, Clock } from 'lucide-react';
import { db } from '../firebase';
import type { Device } from '../types';
import './AlertsDashboard.css';

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

export function AlertsDashboard() {
  const [inactiveDevices, setInactiveDevices] = useState<Device[]>([]);
  const [expiringDevices, setExpiringDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const q = query(collection(db, 'devices'), where('provisionStatus', '==', 'ACTIVE'));
        const querySnapshot = await getDocs(q);
        const devices: Device[] = [];
        querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
          devices.push(doc.data() as Device);
        });

        const inactive = devices.filter(d => isOlderThan30Days(d.LastCheckIn));
        const expiring = devices.filter(d => d.AutoUpdateExpiration && isExpiringWithin30Days(d.AutoUpdateExpiration));

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

  if (loading) return <div className="p-4">Ladataan hälytyksiä...</div>;
  if (error) return <div className="p-4 text-red-500">Virhe: {error}</div>;

  return (
    <div className="alerts-dashboard">
      <h1 className="page-title">Hälytykset (Alerts)</h1>
      <p className="page-subtitle">Vaatii huomiota: Inaktiiviset ja elinkaarensa päässä olevat laitteet.</p>

      <div className="alerts-grid">
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
                  <span className="device-date">Vrt: {d.LastCheckIn.split('T')[0]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Expiring AUE Devices Card */}
        <section className="glass-panel alert-section aue-alert">
          <div className="alert-header">
            <Clock size={24} className="icon-critical" />
            <h2>AUE Umpeutuu (&lt; 30 pv)</h2>
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
                  <span className="device-date">AUE: {d.AutoUpdateExpiration?.split('T')[0]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
