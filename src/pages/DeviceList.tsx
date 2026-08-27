import { useEffect, useState } from 'react';
import { collection, getDocs, query, limit, QueryDocumentSnapshot } from 'firebase/firestore';
import { Search } from 'lucide-react';
import { db } from '../firebase';
import type { Device } from '../types';
import './DeviceList.css';

export function DeviceList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        // Fetch up to 100 devices initially
        const q = query(collection(db, 'devices'), limit(100));
        const querySnapshot = await getDocs(q);
        const fetched: Device[] = [];
        querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
          fetched.push(doc.data() as Device);
        });
        setDevices(fetched);
      } catch (err: any) {
        console.error('Error fetching devices:', err);
        setError(err.message || 'Error fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, []);

  const filteredDevices = devices.filter(d => 
    d.Serial.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.Model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="device-list-page">
      <div className="page-header">
        <h1 className="page-title">Laitekanta</h1>
        <div className="search-bar">
          <Search size={20} className="search-icon" />
          <input 
            type="text" 
            placeholder="Etsi sarjanumerolla tai mallilla..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-4">Ladataan laitteita...</div>
      ) : error ? (
        <div className="p-4 text-red-500">Virhe: {error}</div>
      ) : (
        <div className="table-container glass-panel">
          <table className="device-table">
            <thead>
              <tr>
                <th>Serial</th>
                <th>Malli</th>
                <th>Tila</th>
                <th>Vrt.</th>
                <th>AUE</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map(d => (
                <tr key={d.Serial}>
                  <td className="font-semibold">{d.Serial}</td>
                  <td>{d.Model}</td>
                  <td>
                    <span className={`status-badge ${d.provisionStatus.toLowerCase()}`}>
                      {d.provisionStatus}
                    </span>
                  </td>
                  <td>{d.LastCheckIn?.split('T')[0]}</td>
                  <td>{d.AutoUpdateExpiration?.split('T')[0] || '-'}</td>
                </tr>
              ))}
              {filteredDevices.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center p-4">Ei tuloksia.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
