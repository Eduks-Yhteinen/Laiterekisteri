import { useEffect, useState, useRef } from 'react';
import { collection, getDocs, query, limit, startAfter, QueryDocumentSnapshot, where } from 'firebase/firestore';
import { Search, Camera, Laptop, Smartphone, HelpCircle, Edit, Copy, Check, ArrowUp, ArrowDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { DeviceScanner } from '../components/DeviceScanner';
import { DeviceEditModal } from '../components/DeviceEditModal';
import { DeviceAddModal } from '../components/DeviceAddModal';
import { useAuth } from '../hooks/useAuth';
import type { Device, DevicePII } from '../types';
import './DeviceList.css';

import { formatDate, isOlderThan30Days, isExpiringWithin30Days } from '../dateUtils';

const TABS = ['Kaikki', 'Windows', 'Apple', 'Android', 'Chromebook', 'Arkisto'];

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
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState(false);
  
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [quickRule, setQuickRule] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [serverSearchLoading, setServerSearchLoading] = useState(false);
  const searchedTermsRef = useRef<Set<string>>(new Set());

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
          q = query(collection(db, 'devices'), where('DeviceStatus', '!=', 'Poistettu'), limit(100));
        } else if (activeTab === 'Arkisto') {
          q = query(collection(db, 'devices'), where('DeviceStatus', '==', 'Poistettu'), limit(100));
        } else {
          // You cannot have multiple inequality filters in Firestore, so we might need client side filtering or composite index. 
          // Actually, if we just query DeviceType, we can filter out 'Poistettu' on the client to avoid complex index requirements.
          q = query(collection(db, 'devices'), where('DeviceType', '==', activeTab), limit(100));
        }

        const querySnapshot = await getDocs(q);
        const fetched: Device[] = [];
        querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
          const d = doc.data() as Device;
          if (activeTab !== 'Arkisto' && activeTab !== 'Kaikki' && d.DeviceStatus === 'Poistettu') return;
          fetched.push(d);
        });

        // * How does this work? (RBAC & PII Fetching)
        // If the user has an Admin role, we fetch the PII (Personal Identifiable Information) data.
        // We do this separately from the main device query to ensure Basic Users never even download this data.
        if ((role === 'Admin' || role === 'Global Admin') && fetched.length > 0) {
          try {
            // * How does this work? (Firestore 'in' Query Chunking)
            // Firestore 'in' query supports up to 30 elements, but we have up to 100 devices per page.
            // We split the requested serial numbers into chunks of 30, run parallel queries, and then combine the results.
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
  }, [activeTab, role]); // Re-run kun activeTab muuttuu

  const loadMore = async () => {
    if (!lastVisible) return;
    setLoadingMore(true);
    try {
      let q;
      if (activeTab === 'Kaikki') {
        q = query(collection(db, 'devices'), where('DeviceStatus', '!=', 'Poistettu'), startAfter(lastVisible), limit(100));
      } else if (activeTab === 'Arkisto') {
        q = query(collection(db, 'devices'), where('DeviceStatus', '==', 'Poistettu'), startAfter(lastVisible), limit(100));
      } else {
        q = query(collection(db, 'devices'), where('DeviceType', '==', activeTab), startAfter(lastVisible), limit(100));
      }

      const querySnapshot = await getDocs(q);
      const fetched: Device[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
        const d = doc.data() as Device;
        if (activeTab !== 'Arkisto' && activeTab !== 'Kaikki' && d.DeviceStatus === 'Poistettu') return;
        fetched.push(d);
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

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  let filteredDevices = devices.filter(d => 
    d.Serial.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.Model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.DeviceName && d.DeviceName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (quickRule === 'alerts') {
    filteredDevices = filteredDevices.filter(d => 
       isOlderThan30Days(d.LastCheckIn) || (d.AutoUpdateExpiration && isExpiringWithin30Days(d.AutoUpdateExpiration)) || (d.LeaseEnd && isExpiringWithin30Days(d.LeaseEnd))
    );
  } else if (quickRule === 'storage') {
    filteredDevices = filteredDevices.filter(d => d.DeviceStatus === 'Varastossa');
  }

  Object.keys(columnFilters).forEach(key => {
    const val = columnFilters[key].toLowerCase();
    if (val) {
       filteredDevices = filteredDevices.filter(d => {
          const field = (d as any)[key];
          return field ? String(field).toLowerCase().includes(val) : false;
       });
    }
  });

  if (sortConfig) {
    filteredDevices.sort((a, b) => {
      const aVal = (a as any)[sortConfig.key] || '';
      const bVal = (b as any)[sortConfig.key] || '';
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // * Palvelinpuolen haku: Jos paikallinen suodatus ei tuota tuloksia ja hakusana on riittävän pitkä,
  // yritetään hakea tietokannasta (esim. skannerin syöttämä sarjanumero, jota ei oltu vielä ladattu)
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length >= 3 && filteredDevices.length === 0 && !loading && !searchedTermsRef.current.has(term.toLowerCase())) {
      const searchServer = async () => {
        setServerSearchLoading(true);
        searchedTermsRef.current.add(term.toLowerCase()); // Estetään saman haun toistuminen
        
        try {
          // * How does this work? (Firestore Prefix Search)
          // We perform a prefix search by querying for strings between `term` and `term + '\uf8ff'`.
          // `\uf8ff` is a very high code point in Unicode, effectively matching any string that starts with `term`.
          // We query for both uppercase and original case since Firestore queries are case-sensitive.
          const qUpper = query(collection(db, 'devices'), where('Serial', '>=', term.toUpperCase()), where('Serial', '<=', term.toUpperCase() + '\uf8ff'), limit(5));
          const qExact = query(collection(db, 'devices'), where('Serial', '>=', term), where('Serial', '<=', term + '\uf8ff'), limit(5));
          
          const promises = [getDocs(qUpper), getDocs(qExact)];
          
          if (role === 'Admin' || role === 'Global Admin') {
            const qNameUpper = query(collection(db, 'device_pii'), where('DeviceName', '>=', term.toUpperCase()), where('DeviceName', '<=', term.toUpperCase() + '\uf8ff'), limit(5));
            const qNameExact = query(collection(db, 'device_pii'), where('DeviceName', '>=', term), where('DeviceName', '<=', term + '\uf8ff'), limit(5));
            promises.push(getDocs(qNameUpper), getDocs(qNameExact));
            
            // Jos hakusana on pelkkiä numeroita, yritetään myös yleisimmillä etuliitteillä
            if (/^\d+$/.test(term)) {
              const qNameC = query(collection(db, 'device_pii'), where('DeviceName', '>=', `C${term}`), where('DeviceName', '<=', `C${term}\uf8ff`), limit(5));
              const qNameW = query(collection(db, 'device_pii'), where('DeviceName', '>=', `W${term}`), where('DeviceName', '<=', `W${term}\uf8ff`), limit(5));
              promises.push(getDocs(qNameC), getDocs(qNameW));
            }
          }
          
          const results = await Promise.all(promises);
          const snapUpper = results[0];
          const snapExact = results[1];
          
          const fetchedMap = new Map<string, Device>();
          snapUpper.forEach(doc => fetchedMap.set(doc.id, doc.data() as Device));
          snapExact.forEach(doc => fetchedMap.set(doc.id, doc.data() as Device));
          
          const piiSerials = new Set<string>();
          for (let i = 2; i < results.length; i++) {
            results[i].forEach(doc => piiSerials.add(doc.data().Serial));
          }
          
          if (piiSerials.size > 0) {
            const serials = Array.from(piiSerials).filter(s => !fetchedMap.has(s));
            if (serials.length > 0) {
              const qDevicesBySerial = query(collection(db, 'devices'), where('Serial', 'in', serials));
              const snapDevices = await getDocs(qDevicesBySerial);
              snapDevices.forEach(doc => fetchedMap.set(doc.id, doc.data() as Device));
            }
          }
          
          const fetched = Array.from(fetchedMap.values());

          if (fetched.length > 0) {
            // Hae PII-tiedot jos käyttäjä on Admin
            if (role === 'Admin' || role === 'Global Admin') {
              const piiPromises = fetched.map(d => getDocs(query(collection(db, 'device_pii'), where('Serial', '==', d.Serial))));
              const piiSnaps = await Promise.all(piiPromises);
              
              piiSnaps.forEach((snap, index) => {
                if (!snap.empty) {
                  fetched[index].DeviceName = snap.docs[0].data().DeviceName;
                  fetched[index].PrimaryUser = snap.docs[0].data().PrimaryUser;
                }
              });
            }
            
            // Lisätään löydetyt laitteet paikalliseen tilaan, jolloin filteredDevices näyttää ne heti
            setDevices(prev => {
              const newDevices = [...prev];
              fetched.forEach(newDev => {
                if (!newDevices.some(d => d.Serial === newDev.Serial)) {
                  newDevices.unshift(newDev); // Lisätään alkuun
                }
              });
              return newDevices;
            });
          }
        } catch (e) {
          console.error("Server search fallback failed", e);
        } finally {
          setServerSearchLoading(false);
        }
      };

      const timeoutId = setTimeout(searchServer, 500); // Pieni viive, jotta käyttäjä ehtii kirjoittaa loppuun
      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, filteredDevices.length, loading, role]);

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
        <td data-label="Vuokranpäättyminen / AUE"><div className="skeleton" style={{ height: '20px', width: '90px' }}></div></td>
      </tr>
    ));
  };

  const renderSortableHeader = (title: string, key: string) => (
    <th onClick={() => handleSort(key)} className="sortable-header" style={{ cursor: 'pointer', verticalAlign: 'top' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span>{title}</span>
        {sortConfig?.key === key ? (
          sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
        ) : <span style={{ width: 14 }} />}
      </div>
      <input 
        type="text" 
        className="column-filter-input"
        placeholder="Suodata..." 
        value={columnFilters[key] || ''}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setColumnFilters(prev => ({ ...prev, [key]: e.target.value }))}
        style={{ width: '100%', padding: '2px 4px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
      />
    </th>
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

      <div className="quick-rules-container" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button 
          className={`btn-secondary ${quickRule === null ? 'active' : ''}`} 
          onClick={() => setQuickRule(null)}
          style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
        >
          Kaikki
        </button>
        <button 
          className={`btn-secondary ${quickRule === 'alerts' ? 'active' : ''}`} 
          onClick={() => setQuickRule('alerts')}
          style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
        >
          Vain hälytykset
        </button>
        <button 
          className={`btn-secondary ${quickRule === 'storage' ? 'active' : ''}`} 
          onClick={() => setQuickRule('storage')}
          style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
        >
          Varastossa
        </button>
      </div>

      {error ? (
        <div className="p-4 text-red-500">Virhe: {error}</div>
      ) : (
        <div className="table-container glass-panel">
          <table className="device-table">
            <thead>
              <tr>
                {renderSortableHeader('Sarjanumero', 'Serial')}
                {renderSortableHeader('Malli', 'Model')}
                {(role === 'Admin' || role === 'Global Admin') && (
                  <>
                    {renderSortableHeader('Nimi', 'DeviceName')}
                    {renderSortableHeader('Käyttäjä', 'PrimaryUser')}
                  </>
                )}
                {renderSortableHeader('Laitetyyppi', 'DeviceType')}
                {renderSortableHeader('Tila', 'DeviceStatus')}
                {renderSortableHeader('Viim. nähty', 'LastCheckIn')}
                {renderSortableHeader('Vuokranpäättyminen / AUE', 'AutoUpdateExpiration')}
                {(role === 'Admin' || role === 'Global Admin') && <th style={{ verticalAlign: 'top' }}>Toiminnot</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? renderSkeletonRows() : filteredDevices.map(d => (
                <tr key={d.Serial}>
                  <td data-label="Sarjanumero" className="font-semibold font-mono">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {d.Serial}
                      <button 
                        onClick={() => handleCopy(d.Serial, d.Serial)}
                        className="btn-icon-only"
                        title="Kopioi sarjanumero"
                        style={{ padding: '2px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#666' }}
                      >
                        {copiedId === d.Serial ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </td>
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
                  <td data-label="Vuokranpäättyminen / AUE">{formatDate(d.AutoUpdateExpiration || d.LeaseEnd)}</td>
                  {(role === 'Admin' || role === 'Global Admin') && (
                    <td data-label="Toiminnot">
                      {d.DeviceType === 'Windows' && (
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={() => setEditingDevice(d)}
                          title="Muokkaa laitetta"
                        >
                          <Edit size={16} />
                          Muokkaa
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!loading && filteredDevices.length === 0 && (
                <tr>
                  <td colSpan={role === 'Admin' || role === 'Global Admin' ? 9 : 6} className="text-center p-4">
                    {searchTerm ? (
                      <div className="empty-state">
                        <p>Laitetta <strong>{searchTerm}</strong> ei löytynyt.</p>
                        {serverSearchLoading && <p className="text-gray-500 text-sm mt-2">Etsitään palvelimelta...</p>}
                        {!serverSearchLoading && (
                          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setIsAddDeviceModalOpen(true)}>
                            + Lisää uusi laite numerolla {searchTerm}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span>Ei tuloksia valitulla välilehdellä.</span>
                    )}
                  </td>
                </tr>
              )}
              {hasMore && searchTerm === '' && (
                <tr>
                  <td colSpan={role === 'Admin' || role === 'Global Admin' ? 9 : 6} className="text-center p-4">
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

      {editingDevice && (
        <DeviceEditModal
          device={editingDevice}
          isOpen={true}
          onClose={() => setEditingDevice(null)}
          onSaveSuccess={(updated) => {
            setDevices(prev => prev.map(d => d.Serial === updated.Serial ? updated : d));
          }}
        />
      )}

      {isAddDeviceModalOpen && (
        <DeviceAddModal
          isOpen={true}
          initialSerial={searchTerm}
          onClose={() => setIsAddDeviceModalOpen(false)}
          onSaveSuccess={(newDev) => {
            setDevices(prev => [newDev, ...prev]);
            setSearchTerm(''); // Tyhjennä haku, jotta uusi laite näkyy
          }}
        />
      )}
    </div>
  );
}
