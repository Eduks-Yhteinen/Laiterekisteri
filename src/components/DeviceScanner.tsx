import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { z } from 'zod';
import './DeviceScanner.css';

interface DeviceScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

// Zod schema for serial number validation
// Serial numbers usually don't have spaces, special characters, and are of reasonable length
const serialNumberSchema = z.string()
  .min(3, "Koodi on liian lyhyt")
  .max(50, "Koodi on liian pitkä")
  .regex(/^[a-zA-Z0-9\-_ ]+$/, "Koodi sisältää kiellettyjä merkkejä");

export function DeviceScanner({ isOpen, onClose, onScanSuccess }: DeviceScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);
  const html5QrCode = useRef<Html5Qrcode | null>(null);
  
  // Track if scanner is actively running
  const isScanning = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (html5QrCode.current && isScanning.current) {
        html5QrCode.current.stop().then(() => {
            isScanning.current = false;
            html5QrCode.current?.clear();
        }).catch(console.error);
      }
      setHasPermission(false);
      setError(null);
      return;
    }
    
    // Check if cameras are available when modal opens
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length) {
        setCameras(devices);
      }
    }).catch(err => {
      console.warn("Kameroiden hakeminen epäonnistui etukäteen:", err);
    });

  }, [isOpen]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (html5QrCode.current && isScanning.current) {
        html5QrCode.current.stop().then(() => {
            isScanning.current = false;
            html5QrCode.current?.clear();
        }).catch(console.error);
      }
    };
  }, []);

  const stopScanner = async () => {
    if (html5QrCode.current && isScanning.current) {
      try {
        await html5QrCode.current.stop();
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
      isScanning.current = false;
      try {
        html5QrCode.current.clear();
      } catch(e) {}
    }
  };

  const startScanner = async (cameraId?: string) => {
    setError(null);
    try {
      // Create instance if it doesn't exist
      if (!html5QrCode.current) {
        html5QrCode.current = new Html5Qrcode("reader");
      } else if (isScanning.current) {
        await stopScanner(); // stop previous before starting new
      }
      let configToUse: any = cameraId;
      
      if (!cameraId) {
        try {
          // First try to get explicit camera list (this will prompt for permission if needed)
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
            const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('taka'));
            configToUse = backCam ? backCam.id : devices[0].id;
          } else {
            // Fallback if no devices found but no error thrown
            configToUse = { facingMode: "environment" };
          }
        } catch (camErr) {
          console.warn("getCameras failed, falling back to facingMode constraints:", camErr);
          // If getCameras fails (e.g., some browsers block it before getUserMedia),
          // fallback to standard constraints.
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
        (decodedText) => {
          // Validation on success
          const result = serialNumberSchema.safeParse(decodedText);
          if (result.success) {
            // Haptic feedback if supported
            if (window.navigator && window.navigator.vibrate) {
              window.navigator.vibrate(200);
            }
            stopScanner();
            onScanSuccess(result.data.trim());
            onClose();
          } else {
            console.warn("Skannattu koodi ei ole validi sarjanumero:", decodedText, result.error);
            setError(`Tuntematon koodi: ${decodedText.substring(0, 20)}...`);
            // Clear the error after a few seconds
            setTimeout(() => setError(null), 3000);
          }
        },
        () => {
          // parse errors are normal (no qr code found in frame)
        }
      );
      isScanning.current = true;
      setHasPermission(true);
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

  if (!isOpen) return null;

  return (
    <div className="scanner-modal-overlay">
      <div className="scanner-modal-content">
        <div className="scanner-header">
          <h2>Skannaa laite</h2>
          <button className="icon-btn close-btn" onClick={() => { stopScanner(); onClose(); }}>
            <X size={24} />
          </button>
        </div>

        <div className="scanner-body">
          {!hasPermission ? (
            <div className="permission-prompt">
              <div className="privacy-info">
                <AlertTriangle size={32} className="privacy-icon" />
                <h3>Tietosuojailmoitus</h3>
                <p>
                  Laiterekisteri tarvitsee kameran käyttöoikeuden <strong>pelkästään laitteiden viivakoodien ja QR-koodien lukemista varten</strong>. 
                </p>
                <p>
                  Kameran kuvaa ei tallenneta laitteellesi, eikä sitä koskaan lähetetä eteenpäin palvelimelle. Kuvan analysointi tapahtuu 100% paikallisesti tässä selaimessa.
                </p>
              </div>
              <button 
                className="btn btn-primary btn-large grant-btn" 
                onClick={() => {
                  setHasPermission(true);
                  setTimeout(() => {
                    startScanner();
                  }, 100);
                }}
              >
                <Camera size={20} /> Anna lupa ja avaa kamera
              </button>
              {error && <p className="error-text">{error}</p>}
            </div>
          ) : (
            <div className="scanner-active-view">
              <div id="reader" className="scanner-reader"></div>
              {error && <p className="error-text">{error}</p>}
              
              <div className="scanner-actions">
                {cameras.length > 1 && (
                  <button className="btn btn-secondary toggle-cam-btn" onClick={toggleCamera}>
                    <RefreshCw size={20} /> Vaihda kameraa
                  </button>
                )}
                <button className="btn btn-outline cancel-btn" onClick={() => { stopScanner(); onClose(); }}>
                  Syötä käsin
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
