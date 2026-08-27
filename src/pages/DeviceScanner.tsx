import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Camera, CheckCircle, XCircle } from 'lucide-react';
import { db } from '../firebase';
import type { Device } from '../types';
import { DeviceSchema } from '../schemas';
import './DeviceScanner.css';

export function DeviceScanner() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [deviceData, setDeviceData] = useState<Device | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Initialize scanner
    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      },
      false
    );
    scannerRef.current = scanner;

    scanner.render(onScanSuccess, onScanFailure);

    return () => {
      // Cleanup on unmount
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  const onScanSuccess = async (decodedText: string) => {
    // Stop scanning once we get a result
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    
    setScanResult(decodedText);
    await processScannedSerial(decodedText);
  };

  const onScanFailure = (_error: any) => {
    // Ignore frequent scan failures (e.g. no barcode found in frame)
  };

  const processScannedSerial = async (serial: string) => {
    setLoading(true);
    setError(null);
    setDeviceData(null);

    try {
      // 1. Fetch from Firestore
      const docRef = doc(db, 'devices', serial);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const rawData = docSnap.data();
        // 2. Validate with Zod
        const parsedData = DeviceSchema.parse(rawData);
        setDeviceData(parsedData as Device);
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
      await updateDoc(docRef, {
        LastCheckIn: now
      });
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
    
    // Reinitialize scanner
    if (scannerRef.current) {
      scannerRef.current.render(onScanSuccess, onScanFailure);
    }
  };

  return (
    <div className="device-scanner-page">
      <h1 className="page-title">Skanneri</h1>
      <p className="page-subtitle">Skannaa laitteen viivakoodi/QR-koodi inventointia varten.</p>

      <div className="scanner-container glass-panel">
        <div id="reader" className={scanResult ? 'hidden' : ''}></div>
        
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
                    <span className="detail-value">{deviceData.Model}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Tila</span>
                    <span className={`status-badge ${deviceData.provisionStatus.toLowerCase()}`}>
                      {deviceData.provisionStatus}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Edellinen inventointi</span>
                    <span className="detail-value">{deviceData.LastCheckIn.split('T')[0]}</span>
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
