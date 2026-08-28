import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Camera, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { db } from '../firebase';
import type { Device } from '../types';
import { DeviceSchema } from '../schemas';
import './DeviceScanner.css';

export function DeviceScanner() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [deviceData, setDeviceData] = useState<Device | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);

  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const isScanning = useRef<boolean>(false);

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner().catch(console.error);
    };
  }, []);

  const stopScanner = async () => {
    if (html5QrCode.current && isScanning.current) {
      try {
        await html5QrCode.current.stop();
        isScanning.current = false;
        html5QrCode.current.clear();
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
  };

  const startScanner = async (cameraId?: string) => {
    setError(null);
    try {
      if (!html5QrCode.current) {
        html5QrCode.current = new Html5Qrcode("reader");
      } else if (isScanning.current) {
        await stopScanner();
      }
      
      let configToUse: any = cameraId;
      if (!cameraId) {
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
            const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('taka'));
            configToUse = backCam ? backCam.id : devices[0].id;
          } else {
            configToUse = { facingMode: "environment" };
          }
        } catch (camErr) {
          configToUse = { facingMode: "environment" };
        }
      }

      setCurrentCameraId(typeof configToUse === 'string' ? configToUse : null);

      await html5QrCode.current.start(
        configToUse,
        {
          fps: 10,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39
          ]
        } as any,
        async (decodedText) => {
          // Stop scanning once we get a result
          await stopScanner();
          setScanResult(decodedText.trim());
          await processScannedSerial(decodedText.trim());
        },
        () => {}
      );
      isScanning.current = true;
    } catch (err: unknown) {
      console.error(err);
      setError("Kameran käynnistys epäonnistui. Varmista, että olet antanut selaimelle luvan käyttää kameraa.");
    }
  };

  const toggleCamera = async () => {
    if (cameras.length <= 1 || !currentCameraId) return;
    const currentIndex = cameras.findIndex(c => c.id === currentCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    await startScanner(cameras[nextIndex].id);
  };

  const processScannedSerial = async (serial: string) => {
    setLoading(true);
    setError(null);
    setDeviceData(null);

    try {
      const docRef = doc(db, 'devices', serial);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const rawData = docSnap.data();
        try {
          const parsedData = DeviceSchema.parse(rawData);
          setDeviceData(parsedData as Device);
        } catch (validationErr: any) {
          console.error("Validation error:", validationErr);
          if (validationErr.errors) {
            setError(`Data puuttuu tai on viallista: ${validationErr.errors.map((e: any) => e.path.join('.') + ' ' + e.message).join(', ')}`);
          } else {
            throw validationErr;
          }
        }
      } else {
        setError(`Laitetta sarjanumerolla ${serial} ei löytynyt järjestelmästä.`);
      }
    } catch (err: any) {
      console.error(err);
      setError('Virhe laitetietojen noudossa tai validoinnissa. Data saattaa olla korruptoitunut.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCheckIn = async () => {
    if (!deviceData) return;
    setLoading(true);
    try {
      const docRef = doc(db, 'devices', deviceData.Serial);
      const now = new Date().toISOString();
      await updateDoc(docRef, { LastCheckIn: now });
      setDeviceData({ ...deviceData, LastCheckIn: now });
      alert('Inventaario (LastCheckIn) päivitetty onnistuneesti!');
    } catch (err: any) {
      console.error(err);
      setError('Virhe päivitettäessä laitetta. Tarkista oikeutesi.');
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setDeviceData(null);
    setError(null);
    startScanner();
  };

  return (
    <div className="device-scanner-page">
      <h1 className="page-title">Skanneri</h1>
      <p className="page-subtitle">Skannaa laitteen viivakoodi/QR-koodi inventointia varten.</p>

      <div className="scanner-container glass-panel">
        <div className={`scanner-viewport ${scanResult ? 'hidden' : ''}`} style={{position: 'relative'}}>
          <div id="reader"></div>
          {!scanResult && cameras.length > 1 && (
            <button 
              className="camera-toggle-btn" 
              onClick={toggleCamera}
              style={{
                position: 'absolute', 
                bottom: '10px', 
                left: '50%', 
                transform: 'translateX(-50%)',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'rgba(0,0,0,0.6)',
                color: 'white',
                border: 'none',
                borderRadius: '20px'
              }}
            >
              <RefreshCw size={20} />
              Vaihda kameraa
            </button>
          )}
        </div>
        
        {scanResult && (
          <div className="scan-result-panel">
            <div className="scan-result-header">
              <h2>Skannattu koodi:</h2>
              <span className="scanned-code font-mono">{scanResult}</span>
            </div>

            {loading ? (
              <div className="p-4 text-center">Haetaan tietoja tietokannasta...</div>
            ) : error ? (
              <div className="error-message">
                <XCircle size={24} />
                <p>{error}</p>
              </div>
            ) : deviceData ? (
              <div className="device-details">
                <div className="success-banner">
                  <CheckCircle size={24} />
                  <span>Laite tunnistettu!</span>
                </div>
                
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Malli</span>
                    <span className="detail-value">{deviceData.Model || 'Ei tiedossa'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Tila</span>
                    <span className={`status-badge ${deviceData.DeviceStatus?.toLowerCase() || 'unknown'}`}>
                      {deviceData.DeviceStatus || 'Ei tiedossa'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Edellinen inventointi</span>
                    <span className="detail-value">
                      {deviceData.LastCheckIn 
                        ? (() => {
                            const parts = deviceData.LastCheckIn.split('T')[0].split('-');
                            return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : deviceData.LastCheckIn;
                          })()
                        : 'Ei inventoitu'}
                    </span>
                  </div>
                </div>

                <div className="action-buttons">
                  <button className="btn-primary w-full" onClick={handleUpdateCheckIn}>
                    <Camera size={18} />
                    Päivitä inventointi (Nyt)
                  </button>
                </div>
              </div>
            ) : null}

            <button className="btn-secondary mt-4 w-full" onClick={resetScanner}>
              Skannaa uusi laite
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
