import { useEffect, useState } from 'react';
import { collection, getDocs, query, limit, startAfter, QueryDocumentSnapshot, where } from 'firebase/firestore';
import { Search, Camera, Laptop, Smartphone, HelpCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { DeviceScanner } from '../components/DeviceScanner';
import { useAuth } from '../hooks/useAuth';
import type { Device, DevicePII } from '../types';
import './DeviceList.css';

import { formatDate } from '../dateUtils';

const TABS = ['Kaikki', 'Windows', 'Apple', 'Android', 'Chromebook'];

export function DeviceList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('type') || 'Kaikki';
  const { role } = useAuth();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // * Tämä efekti hakee laitteet tietokannasta heti, kun komponentti ladataan
  // tai kun välilehti (activeTab) vaihtuu.
  useEffect(() => {
    const fetchDevices = async () => {
      setLoading(true);
      setError(null);
      try {
        let q;
        // ! TIETOSUOJA (Privacy by Design)
        // Kuten huomaat, haemme tässä Vain 'devices' -kokoelmaa.
        // Emme koskaan hae 'device_pii' -kokoelmaa tähän yleiseen listaan,
        // jotta emme turhaan siirrä henkilötietoja selaimeen.
        
        // * Rajoitetaan kerralla haettava määrä sataan (limit 100),
        // jotta selain ei jumiudu, jos laitteita on kymmeniä tuhansia (Paginointi).
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

        // * RBAC: Fetch PII data only if user is Admin or Global Admin
        if ((role === 'Admin' || role === 'Global Admin') && fetched.length > 0) {
          try {
            // Firestore 'in' query supports up to 30 elements, but we have up to 100.
            // Best approach for the frontend is to split into chunks of 30.
            const chunks: string[][] = [];
            for (let i = 0; i < fetched.length; i += 30) {
              chunks.push(fetched.slice(i, i + 30).map(d => d.Serial));
            }
            
            const piiPromises = chunks.map(chunk => 
              getDocs(query(collection(db, 'device_pii'), where('Serial', 'in', chunk)))
            );
            
            const piiSnapshots = await Promise.all(piiPromises);
            const piiMap = new Map<string, DevicePII>();
            
            piiSnapshots.forEach(snap => {
              snap.forEach(doc => {
                const data = doc.data() as DevicePII;
                piiMap.set(data.Serial, data);
              });
            });
            
            fetched.forEach(device => {
              const pii = piiMap.get(device.Serial);
              if (pii) {
                device.DeviceName = pii.DeviceName;
                device.PrimaryUser = pii.PrimaryUser;
              }
            });
          } catch (piiErr) {
            console.error('Failed to fetch PII data:', piiErr);
          }
        }

        setDevices(fetched);
        
        // * Otetaan talteen viimeinen dokumentti paginointia (Lataa lisää -nappia) varten
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
  }, [activeTab]); // Re-run kun activeTab muuttuu

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

      // * RBAC for loadMore
      if ((role === 'Admin' || role === 'Global Admin') && fetched.length > 0) {
        try {
          const chunks: string[][] = [];
          for (let i = 0; i < fetched.length; i += 30) {
            chunks.push(fetched.slice(i, i + 30).map(d => d.Serial));
          }
          
          const piiPromises = chunks.map(chunk => 
            getDocs(query(collection(db, 'device_pii'), where('Serial', 'in', chunk)))
          );
          
          const piiSnapshots = await Promise.all(piiPromises);
          const piiMap = new Map<string, DevicePII>();
          
          piiSnapshots.forEach(snap => {
            snap.forEach(doc => {
              const data = doc.data() as DevicePII;
              piiMap.set(data.Serial, data);
            });
          });
          
          fetched.forEach(device => {
            const pii = piiMap.get(device.Serial);
            if (pii) {
              device.DeviceName = pii.DeviceName;
              device.PrimaryUser = pii.PrimaryUser;
            }
          });
        } catch (piiErr) {
          console.error('Failed to fetch PII data:', piiErr);
        }
      }

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

  const getDeviceIcon = (type: string | undefined) => {
    switch (type?.toLowerCase()) {
      case 'windows':
      case 'apple':
      case 'chromebook':
        return <Laptop size={16} className="text-gray-500 mr-2" style={{ marginRight: '6px' }} />;
      case 'android':
        return <Smartphone size={16} className="text-gray-500 mr-2" style={{ marginRight: '6px' }} />;
      default:
        return <HelpCircle size={16} className="text-gray-500 mr-2" style={{ marginRight: '6px' }} />;
    }
  };

  const renderSkeletonRows = () => {
    return Array.from({ length: 5 }).map((_, i) => (
      <tr key={i}>
        <td data-label="Sarjanumero"><div className="skeleton" style={{ height: '20px', width: '120px' }}></div></td>
        <td data-label="Malli"><div className="skeleton" style={{ height: '20px', width: '150px' }}></div></td>
        {(role === 'Admin' || role === 'Global Admin') && (
          <>
            <td data-label="Nimi"><div className="skeleton" style={{ height: '20px', width: '100px' }}></div></td>
            <td data-label="Käyttäjä"><div className="skeleton" style={{ height: '20px', width: '120px' }}></div></td>
          </>
        )}
        <td data-label="Laitetyyppi"><div className="skeleton" style={{ height: '20px', width: '100px' }}></div></td>
        <td data-label="Tila"><div className="skeleton" style={{ height: '24px', width: '60px', borderRadius: '12px' }}></div></td>
        <td data-label="Viim. nähty"><div className="skeleton" style={{ height: '20px', width: '90px' }}></div></td>
        <td data-label="Takuu / AUE"><div className="skeleton" style={{ height: '20px', width: '90px' }}></div></td>
      </tr>
    ));
  };

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

      {error ? (
        <div className="p-4 text-red-500">Virhe: {error}</div>
      ) : (
        <div className="table-container glass-panel">
          <table className="device-table">
            <thead>
              <tr>
                <th>Sarjanumero</th>
                <th>Malli</th>
                {(role === 'Admin' || role === 'Global Admin') && (
                  <>
                    <th>Nimi</th>
                    <th>Käyttäjä</th>
                  </>
                )}
                <th>Laitetyyppi</th>
                <th>Tila</th>
                <th>Viim. nähty</th>
                <th>Takuu / AUE</th>
              </tr>
            </thead>
            <tbody>
              {loading ? renderSkeletonRows() : filteredDevices.map(d => (
                <tr key={d.Serial}>
                  <td data-label="Sarjanumero" className="font-semibold font-mono">{d.Serial}</td>
                  <td data-label="Malli">{d.Model}</td>
                  {(role === 'Admin' || role === 'Global Admin') && (
                    <>
                      <td data-label="Nimi">{d.DeviceName || '-'}</td>
                      <td data-label="Käyttäjä">{d.PrimaryUser || '-'}</td>
                    </>
                  )}
                  <td data-label="Laitetyyppi">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {getDeviceIcon(d.DeviceType)}
                      {d.DeviceType || '-'}
                    </div>
                  </td>
                  <td data-label="Tila">
                    <span className={`status-badge ${d.DeviceStatus?.toLowerCase() || 'unknown'}`}>
                      {d.DeviceStatus}
                    </span>
                  </td>
                  <td data-label="Viim. nähty">{formatDate(d.LastCheckIn)}</td>
                  <td data-label="Takuu / AUE">{formatDate(d.AutoUpdateExpiration || d.LeaseEnd)}</td>
                </tr>
              ))}
              {!loading && filteredDevices.length === 0 && (
                <tr>
                  <td colSpan={role === 'Admin' || role === 'Global Admin' ? 8 : 6} className="text-center p-4">
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
                  <td colSpan={role === 'Admin' || role === 'Global Admin' ? 8 : 6} className="text-center p-4">
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
