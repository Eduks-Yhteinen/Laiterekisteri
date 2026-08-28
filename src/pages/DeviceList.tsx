import { useEffect, useState } from 'react';
import { collection, getDocs, query, limit, startAfter, QueryDocumentSnapshot, where } from 'firebase/firestore';
import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { db } from '../firebase';
import { DeviceScanner } from '../components/DeviceScanner';
import type { Device } from '../types';
import './DeviceList.css';

import { formatDate } from '../dateUtils';

const TABS = ['Kaikki', 'Windows', 'Apple', 'Android', 'Chromebook'];

export function DeviceList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('type') || 'Kaikki';

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    const fetchDevices = async () => {
      setLoading(true);
      setError(null);
      try {
        let q;
        if (activeTab === 'Kaikki') {
          q = query(collection(db, 'devices'), limit(100));
        } else {
          q = query(collection(db, 'devices'), where('DeviceType', '==', activeTab), limit(100));
        }

        const querySnapshot = await getDocs(q);
        const fetched: Device[] = [];
        querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
          fetched.push(doc.data() as Device);
        });
        setDevices(fetched);
        
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        setLastVisible(lastDoc || null);
        setHasMore(querySnapshot.docs.length === 100);
      } catch (err: any) {
        console.error('Error fetching devices:', err);
        setError(err.message || 'Error fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, [activeTab]); // Re-run when activeTab changes

  const loadMore = async () => {
    if (!lastVisible) return;
    setLoadingMore(true);
    try {
      let q;
      if (activeTab === 'Kaikki') {
        q = query(collection(db, 'devices'), startAfter(lastVisible), limit(100));
      } else {
        q = query(collection(db, 'devices'), where('DeviceType', '==', activeTab), startAfter(lastVisible), limit(100));
      }

      const querySnapshot = await getDocs(q);
      const fetched: Device[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
        fetched.push(doc.data() as Device);
      });
      setDevices(prev => [...prev, ...fetched]);
      
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc || null);
      setHasMore(querySnapshot.docs.length === 100);
    } catch (err: any) {
      console.error('Error fetching more devices:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'Kaikki') {
      searchParams.delete('type');
    } else {
      searchParams.set('type', tab);
    }
    setSearchParams(searchParams);
  };

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
          <button className="scan-button-desktop" onClick={() => setIsScannerOpen(true)} title="Skannaa viivakoodi">
            <Camera size={20} />
            <span>Skannaa</span>
          </button>
        </div>
      </div>

      <div className="tabs-container">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => handleTabChange(tab)}
          >
            {tab}
          </button>
        ))}
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
                <th>Sarjanumero</th>
                <th>Malli</th>
                <th>Laitetyyppi</th>
                <th>Tila</th>
                <th>Viim. nähty</th>
                <th>Takuu / AUE</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map(d => (
                <tr key={d.Serial}>
                  <td className="font-semibold">{d.Serial}</td>
                  <td>{d.Model}</td>
                  <td>{d.DeviceType || '-'}</td>
                  <td>
                    <span className={`status-badge ${d.DeviceStatus?.toLowerCase() || 'unknown'}`}>
                      {d.DeviceStatus}
                    </span>
                  </td>
                  <td>{formatDate(d.LastCheckIn)}</td>
                  <td>{formatDate(d.AutoUpdateExpiration || d.LeaseEnd)}</td>
                </tr>
              ))}
              {filteredDevices.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center p-4">
                    {searchTerm ? (
                      <div className="empty-state">
                        <p>Laitetta <strong>{searchTerm}</strong> ei löytynyt.</p>
                        <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => alert('Uuden laitteen lisäys tulossa (arvo: ' + searchTerm + ')')}>
                          + Lisää uusi laite numerolla {searchTerm}
                        </button>
                      </div>
                    ) : (
                      <span>Ei tuloksia valitulla välilehdellä.</span>
                    )}
                  </td>
                </tr>
              )}
              {hasMore && searchTerm === '' && (
                <tr>
                  <td colSpan={6} className="text-center p-4">
                    <button 
                      onClick={loadMore} 
                      disabled={loadingMore} 
                      className="btn-secondary" 
                      style={{ padding: '0.5rem 2rem', marginTop: '1rem' }}
                    >
                      {loadingMore ? 'Ladataan...' : 'Näytä lisää laitteita'}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Mobile Floating Action Button */}
      <button className="fab-scan-button" onClick={() => setIsScannerOpen(true)} aria-label="Skannaa laite">
        <Camera size={24} />
      </button>

      <DeviceScanner 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScanSuccess={(code) => setSearchTerm(code)} 
      />
    </div>
  );
}
