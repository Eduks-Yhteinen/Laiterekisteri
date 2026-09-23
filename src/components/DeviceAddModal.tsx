import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Device } from '../types';
import { UserAutocomplete, type UserAutocompleteRef } from './UserAutocomplete';
import './DeviceEditModal.css'; // Reusing CSS

interface DeviceAddModalProps {
  isOpen: boolean;
  initialSerial?: string;
  onClose: () => void;
  onSaveSuccess: (newDevice: Device) => void;
}

export function DeviceAddModal({ isOpen, initialSerial = '', onClose, onSaveSuccess }: DeviceAddModalProps) {
  const [serial, setSerial] = useState(initialSerial);
  const [model, setModel] = useState('');
  const [deviceType, setDeviceType] = useState('Windows');
  const [deviceName, setDeviceName] = useState('');
  const [primaryUser, setPrimaryUser] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autocompleteRef = React.useRef<UserAutocompleteRef>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!serial.trim()) {
      setError('Sarjanumero on pakollinen.');
      return;
    }
    if (!deviceType) {
      setError('Laitetyyppi on pakollinen.');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const serialTrimmed = serial.trim().toUpperCase();
      
      // Tarkistetaan onko laite jo olemassa
      const deviceRef = doc(db, 'devices', serialTrimmed);
      const snap = await getDoc(deviceRef);
      if (snap.exists()) {
        setError(`Laite sarjanumerolla ${serialTrimmed} on jo olemassa.`);
        setIsSaving(false);
        return;
      }
      
      const newDevice: Device = {
        Serial: serialTrimmed,
        DeviceID: serialTrimmed, // or generate UUID
        Model: model.trim(),
        DeviceType: deviceType,
        DeviceStatus: 'Käytössä',
        provisionStatus: 'ACTIVE',
        Kustannuspaikka: costCenter.trim(),
        LeaseStatus: 'Kyllä',
        LeaseType: 'Elinkaari',
        LeaseEnd: null,
        AutoUpdateExpiration: null,
        LastCheckIn: new Date().toISOString(),
      };
      
      await setDoc(deviceRef, newDevice);
      
      // Tallenna PII erikseen (tämä vaatii Admin/Global Admin oikeudet)
      if (deviceName.trim() || primaryUser.trim()) {
        const piiRef = doc(db, 'device_pii', serialTrimmed);
        await setDoc(piiRef, {
          Serial: serialTrimmed,
          DeviceName: deviceName.trim(),
          PrimaryUser: primaryUser.trim()
        });
        
        newDevice.DeviceName = deviceName.trim();
        newDevice.PrimaryUser = primaryUser.trim();
      }

      onSaveSuccess(newDevice);
      onClose();
    } catch (err: any) {
      console.error('Error adding device:', err);
      setError(err.message || 'Laitteen lisäys epäonnistui. Tarkista käyttöoikeudet.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel edit-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Lisää Uusi Laite</h2>
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
            <label>Sarjanumero <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              value={serial} 
              onChange={e => setSerial(e.target.value)} 
              disabled={isSaving}
              placeholder="Esim. PF3ABC12"
            />
          </div>

          <div className="form-group">
            <label>Malli</label>
            <input 
              type="text" 
              value={model} 
              onChange={e => setModel(e.target.value)} 
              disabled={isSaving}
              placeholder="Esim. HP ProBook 450 G8"
            />
          </div>

          <div className="form-group">
            <label>Laitetyyppi <span className="text-red-500">*</span></label>
            <select 
              value={deviceType} 
              onChange={e => setDeviceType(e.target.value)} 
              disabled={isSaving}
              className="w-full p-2 border rounded"
            >
              <option value="">-- Valitse tyyppi --</option>
              <option value="Windows">Windows</option>
              <option value="Apple">Apple</option>
              <option value="Android">Android</option>
              <option value="Chromebook">Chromebook</option>
            </select>
          </div>

          <div className="form-group">
            <label>Kustannuspaikka</label>
            <input 
              type="text" 
              value={costCenter} 
              onChange={e => setCostCenter(e.target.value)} 
              disabled={isSaving}
              placeholder="Esim. 1234560000"
            />
          </div>

          <div className="form-group">
            <label>Laitteen Nimi (PII)</label>
            <input 
              type="text" 
              value={deviceName} 
              onChange={e => setDeviceName(e.target.value)} 
              disabled={isSaving}
              placeholder="Esim. EDU-LAP-001"
            />
          </div>

          <div className="form-group">
            <label>Käyttäjä (Sähköposti - PII)</label>
            <UserAutocomplete 
              ref={autocompleteRef}
              value={primaryUser} 
              onChange={setPrimaryUser} 
              disabled={isSaving} 
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={isSaving}>Peruuta</button>
          <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={isSaving || !serial.trim() || !deviceType}>
            <Save size={18} />
            {isSaving ? 'Tallennetaan...' : 'Lisää laite'}
          </button>
        </div>
      </div>
    </div>
  );
}
