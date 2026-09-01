import { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Device } from '../types';
import './DeviceEditModal.css';

interface DeviceEditModalProps {
  device: Device;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (updatedDevice: Device) => void;
}

export function DeviceEditModal({ device, isOpen, onClose, onSaveSuccess }: DeviceEditModalProps) {
  const [deviceName, setDeviceName] = useState(device.DeviceName || '');
  const [primaryUser, setPrimaryUser] = useState(device.PrimaryUser || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const functions = getFunctions();
      const updateIntuneDevice = httpsCallable(functions, 'updateIntuneDevice');
      
      await updateIntuneDevice({
        deviceId: device.DeviceID,
        serialNumber: device.Serial,
        deviceName: deviceName.trim(),
        primaryUser: primaryUser.trim(),
      });

      onSaveSuccess({
        ...device,
        DeviceName: deviceName.trim(),
        PrimaryUser: primaryUser.trim(),
      });
      onClose();
    } catch (err: any) {
      console.error('Error updating device:', err);
      setError(err.message || 'Laitteen päivitys epäonnistui.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel edit-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Muokkaa Laitetta (Intune)</h2>
          <button className="close-btn" onClick={onClose} disabled={isSaving} aria-label="Sulje modal">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-alert">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label>Sarjanumero (Vain luku)</label>
            <input type="text" value={device.Serial} disabled className="input-disabled" />
            <small className="help-text">Sarjanumeroa ei voi muuttaa.</small>
          </div>

          <div className="form-group">
            <label>Laitteen Nimi</label>
            <input 
              type="text" 
              value={deviceName} 
              onChange={e => setDeviceName(e.target.value)} 
              disabled={isSaving}
              placeholder="Esim. EDU-LAP-001"
            />
          </div>

          <div className="form-group">
            <label>Käyttäjä (Sähköposti)</label>
            <input 
              type="email" 
              value={primaryUser} 
              onChange={e => setPrimaryUser(e.target.value)} 
              disabled={isSaving}
              placeholder="Esim. matti.meikalainen@edu.lappeenranta.fi"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={isSaving}>Peruuta</button>
          <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={isSaving}>
            <Save size={18} />
            {isSaving ? 'Tallennetaan...' : 'Tallenna'}
          </button>
        </div>
      </div>
    </div>
  );
}
