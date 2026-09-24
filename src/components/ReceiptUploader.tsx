import { useState } from 'react';
import { UploadCloud, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db, vertexAI } from '../firebase';
import { getGenerativeModel } from 'firebase/ai';
import * as XLSX from 'xlsx';
import { DeviceAddModal } from './DeviceAddModal';

interface UpdateSummary {
  serial: string;
  model: string;
  updates: Record<string, any>;
  status: 'success' | 'error' | 'not-found';
  message?: string;
}

export function ReceiptUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<UpdateSummary[] | null>(null);
  const [addingSerial, setAddingSerial] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setSummary(null);
    }
  };

  const processReceipt = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      let parsedData: any[] = [];
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

      if (isExcel) {
        // Local Excel Parsing
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        parsedData = jsonData.map(row => {
          let serial = row['Serial'] || row['Sarjanumero'] || row['SN'] || row['Laitteen sarjanumero'];
          let leaseEnd = row['Vuokrauksen päättymispäivä'] || row['LeaseEnd'] || row['Lease End'];
          let leaseType = row['Elinkaari/Rahoitus-leasing'] || row['Leasing'] || row['LeaseType'];
          let purchaseDate = row['PurchaseDate'] || row['Hankintapäivä'] || row['Hankintapvm'];
          
          if (typeof leaseEnd === 'number') {
            const date = new Date(Math.round((leaseEnd - 25569) * 86400 * 1000));
            leaseEnd = date.toISOString();
          } else if (leaseEnd && typeof leaseEnd === 'string' && leaseEnd.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
            // "15.10.2023" -> "2023-10-15T00:00:00.000Z"
            const parts = leaseEnd.split('.');
            leaseEnd = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00.000Z`).toISOString();
          }

          if (typeof purchaseDate === 'number') {
            const date = new Date(Math.round((purchaseDate - 25569) * 86400 * 1000));
            purchaseDate = date.toISOString();
          } else if (purchaseDate && typeof purchaseDate === 'string' && purchaseDate.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
            const parts = purchaseDate.split('.');
            purchaseDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00.000Z`).toISOString();
          }

          return {
            Serial: serial?.toString().trim(),
            PurchaseDate: purchaseDate,
            LeaseType: leaseType,
            LeaseEnd: leaseEnd
          };
        }).filter(item => item.Serial); // Vain rivit joilla on sarjanumero

        if (parsedData.length === 0) {
          throw new Error("Excel-tiedostosta ei löytynyt yhtään riviä, jolla olisi 'Serial' tai 'Sarjanumero' -sarake.");
        }
      } else {
        // Vertex AI OCR Parsing for Images and PDFs
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result.split(',')[1]);
            } else {
              reject(new Error('Failed to read file.'));
            }
          };
          reader.onerror = error => reject(error);
          reader.readAsDataURL(file);
        });

        const model = getGenerativeModel(vertexAI, { 
          model: 'gemini-2.5-flash',
          generationConfig: {
            responseMimeType: "application/json",
          }
        });

        const prompt = `Olet IT-laiterekisterin tekoälyavustaja. Tehtäväsi on lukea oheinen kuitti/lasku/sopimus ja etsiä sieltä laitteiden sarjanumerot (Serial Number) ja laitteisiin liittyvät leasing/omistus-tiedot.
Palauta tulokset JSON-listana objekteista.
Jokaisella objektilla tulee olla seuraavat kentät (jos tieto löytyy kuitista):
- "Serial": Laitteen sarjanumero (merkkijono). Tämä on pakollinen, jos et löydä sarjanumeroa, älä palauta laitetta.
- "PurchaseDate": Hankintapäivämäärä ISO 8601 -muodossa (esim. "2023-10-01T00:00:00.000Z").
- "LeaseType": "Elinkaari", "Rahoitus" tai "Omistus" (Päättele tekstin perusteella. Jos tekstissä puhutaan leasingista tai elinkaaresta -> Elinkaari. Jos osamaksusta -> Rahoitus. Jos kertaostosta -> Omistus).
- "LeaseEnd": Vuokran tai elinkaaren päättymispäivä ISO 8601 -muodossa, jos se on mainittu kuitissa tai voidaan laskea suoraan (esim. 3 vuoden leasing -> PurchaseDate + 3v).

Palauta VAIN puhdas JSON-taulukko, ei mitään ylimääräistä tekstiä tai markdown-merkintöjä (esim. \`\`\`json). Esimerkki:
[
  {
    "Serial": "5CG1234567",
    "PurchaseDate": "2023-10-01T00:00:00.000Z",
    "LeaseType": "Elinkaari"
  }
]
`;

        const inlineData = {
          data: base64Data,
          mimeType: file.type
        };

        const result = await model.generateContent([prompt, { inlineData }]);
        const responseText = result.response.text();
        
        try {
          parsedData = JSON.parse(responseText.trim());
        } catch (e) {
          console.error("Failed to parse Gemini response", responseText);
          throw new Error("Tekoälyn palauttama vastaus ei ollut oikeassa muodossa (JSON).");
        }

        if (!Array.isArray(parsedData) || parsedData.length === 0) {
          throw new Error("Kuitti ei sisältänyt ymmärrettäviä laitteiden sarjanumeroita.");
        }
      }

      // 3. Update Firestore
      const updateSummaries: UpdateSummary[] = [];

      for (const item of parsedData) {
        if (!item.Serial) continue;

        const q = query(collection(db, 'devices'), where('Serial', '==', item.Serial));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          updateSummaries.push({
            serial: item.Serial,
            model: 'Tuntematon',
            updates: {},
            status: 'not-found',
            message: 'Laitetta ei löytynyt tietokannasta.'
          });
          continue;
        }

        const deviceDoc = querySnapshot.docs[0];
        const deviceRef = doc(db, 'devices', deviceDoc.id);
        const deviceData = deviceDoc.data();

        const updates: any = {};
        if (item.PurchaseDate) updates.PurchaseDate = item.PurchaseDate;
        if (item.LeaseType) updates.LeaseType = item.LeaseType;
        if (item.LeaseEnd) updates.LeaseEnd = item.LeaseEnd;

        if (Object.keys(updates).length > 0) {
          try {
            await updateDoc(deviceRef, updates);
            updateSummaries.push({
              serial: item.Serial,
              model: deviceData.Model || 'Tuntematon',
              updates,
              status: 'success'
            });
          } catch (e: any) {
            updateSummaries.push({
              serial: item.Serial,
              model: deviceData.Model || 'Tuntematon',
              updates,
              status: 'error',
              message: e.message
            });
          }
        }
      }

      setSummary(updateSummaries);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Tapahtui tuntematon virhe kuitin luvussa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="receipt-uploader">
      <div className="upload-container" style={{ border: '2px dashed #ccc', padding: '2rem', textAlign: 'center', borderRadius: '12px', background: 'rgba(255,255,255,0.05)' }}>
        <input 
          type="file" 
          accept="image/*,application/pdf,.xlsx,.xls" 
          onChange={handleFileChange}
          style={{ display: 'none' }}
          id="receipt-upload"
        />
        <label htmlFor="receipt-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <UploadCloud size={48} color="var(--color-primary)" />
          {file ? (
            <span style={{ fontWeight: 'bold' }}>{file.name}</span>
          ) : (
            <span>Klikkaa tästä ladataksesi kuitin (PDF/Kuva) tai Excel-laiteluettelon (.xlsx)</span>
          )}
        </label>
        
        {file && (
          <button 
            className="btn-primary" 
            style={{ marginTop: '1rem', padding: '0.5rem 2rem' }}
            onClick={processReceipt}
            disabled={loading}
          >
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Loader2 className="animate-spin" />
                <span>{file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? 'Luetaan Excel-tiedostoa...' : 'Analysoidaan kuittia tekoälyllä...'}</span>
              </div>
            ) : (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? 'Lue Excel ja Päivitä' : 'Analysoi ja Päivitä (AI)')}
          </button>
        )}
      </div>

      {error && (
        <div className="error-message" style={{ marginTop: '1rem', background: '#ffebee', color: '#c62828', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <XCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {summary && (
        <div className="summary-panel" style={{ marginTop: '2rem', background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Päivitysyhteenveto</h3>
          {summary.length === 0 ? (
            <p>Ei löydetty sarjanumeroita tai päivitettävää tietoa.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {summary.map((item, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px' }}>
                  {item.status === 'success' ? (
                    <CheckCircle color="var(--color-success)" />
                  ) : item.status === 'not-found' ? (
                    <FileText color="#999" />
                  ) : (
                    <XCircle color="var(--color-error)" />
                  )}
                  
                  <div>
                    <strong>{item.serial}</strong> ({item.model})
                    {item.status === 'success' && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Päivitetyt kentät:
                        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.25rem' }}>
                          {Object.entries(item.updates).map(([k, v]) => (
                            <li key={k}>{k}: {String(v)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {item.status !== 'success' && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--color-error)' }}>
                        {item.message}
                        {item.status === 'not-found' && (
                          <div style={{ marginTop: '0.75rem' }}>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                              onClick={() => setAddingSerial(item.serial)}
                            >
                              Lisää uusi laite (Käsin)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {addingSerial && (
        <DeviceAddModal 
          isOpen={!!addingSerial} 
          initialSerial={addingSerial} 
          onClose={() => setAddingSerial(null)} 
          onSaveSuccess={(newDevice) => {
             setSummary(prev => {
                if (!prev) return prev;
                return prev.map(i => 
                   i.serial === newDevice.Serial 
                     ? { ...i, status: 'success', model: newDevice.Model, message: undefined, updates: { 'Lisätty kantaan': 'Kyllä' } }
                     : i
                );
             });
             setAddingSerial(null);
          }}
        />
      )}
    </div>
  );
}
