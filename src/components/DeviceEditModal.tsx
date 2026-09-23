import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Device, DeviceStatus } from '../types';
import { UserAutocomplete, type UserAutocompleteRef } from './UserAutocomplete';
import { formatDate } from '../dateUtils';
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
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(device.DeviceStatus || 'Käytössä');
  const [leaseType, setLeaseType] = useState(device.LeaseType || 'Elinkaari');
  const [purchaseDate, setPurchaseDate] = useState(device.PurchaseDate ? device.PurchaseDate.split('T')[0] : '');
  const [receiptUrl, setReceiptUrl] = useState(device.ReceiptUrl || '');
  const [poistonSyy, setPoistonSyy] = useState(device.PoistonSyy || '');
  const [poistoPaiva, setPoistoPaiva] = useState(device.PoistoPaiva ? device.PoistoPaiva.split('T')[0] : '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autocompleteRef = React.useRef<UserAutocompleteRef>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    if (deviceStatus === 'Poistettu' && (!poistonSyy || !poistoPaiva)) {
      setError('Poiston syy ja päivämäärä ovat pakollisia poistetuille laitteille.');
      setIsSaving(false);
      return;
    }

    try {
      // 1. Calculate LeaseEnd if Elinkaari and PurchaseDate exists
      let newLeaseEnd = device.LeaseEnd;
      if (leaseType === 'Elinkaari' && purchaseDate) {
        const pd = new Date(purchaseDate);
        pd.setFullYear(pd.getFullYear() + 5);
        newLeaseEnd = pd.toISOString();
      }

      // 2. Update Firestore `devices`
      const updateData: Partial<Device> = {
        DeviceStatus: deviceStatus,
        LeaseType: leaseType,
        PurchaseDate: purchaseDate ? new Date(purchaseDate).toISOString() : undefined,
        ReceiptUrl: receiptUrl,
        LeaseEnd: newLeaseEnd,
      };

      if (deviceStatus === 'Poistettu') {
        updateData.PoistonSyy = poistonSyy;
        updateData.PoistoPaiva = new Date(poistoPaiva).toISOString();
      }

      await updateDoc(doc(db, 'devices', device.Serial), updateData);

      // 3. Update PII in Firestore
      if (deviceName.trim() !== device.DeviceName || primaryUser.trim() !== device.PrimaryUser) {
        await setDoc(doc(db, 'device_pii', device.Serial), {
          Serial: device.Serial,
          DeviceName: deviceName.trim(),
          PrimaryUser: primaryUser.trim()
        }, { merge: true });
      }

      // 4. Update Intune (Optional/Best Effort if device ID exists)
      if (device.DeviceID && (deviceName.trim() !== device.DeviceName || primaryUser.trim() !== device.PrimaryUser)) {
        try {
          const functions = getFunctions();
          const updateIntuneDevice = httpsCallable(functions, 'updateIntuneDevice');
          await updateIntuneDevice({
            deviceId: device.DeviceID,
            serialNumber: device.Serial,
            deviceName: deviceName.trim(),
            primaryUser: primaryUser.trim(),
          });
        } catch (intuneErr) {
          console.warn('Intune päivitys epäonnistui, mutta tiedot tallennettiin paikallisesti:', intuneErr);
          // Emme heitä virhettä, koska paikallinen päivitys onnistui
        }
      }

      onSaveSuccess({
        ...device,
        ...updateData,
        DeviceName: deviceName.trim(),
        PrimaryUser: primaryUser.trim(),
      } as Device);
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
            <UserAutocomplete 
              ref={autocompleteRef}
              value={primaryUser} 
              onChange={setPrimaryUser} 
              disabled={isSaving} 
            />
            <span className="help-text">Etsi käyttäjää nimellä tai sähköpostilla</span>
          </div>

          <div className="form-group">
            <label>Tila</label>
            <select 
              value={deviceStatus} 
              onChange={e => setDeviceStatus(e.target.value as DeviceStatus)} 
              disabled={isSaving}
              className="w-full p-2 border rounded"
            >
              <option value="Käytössä">Käytössä</option>
              <option value="Varastossa">Varastossa</option>
              <option value="Huollossa">Huollossa</option>
              <option value="Rikkoutunut">Rikkoutunut</option>
              <option value="Kadonnut">Kadonnut</option>
              <option value="Poistettu">Poistettu</option>
            </select>
          </div>

          {deviceStatus === 'Poistettu' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded my-2">
              <div className="form-group mb-2">
                <label>Poiston Syy <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={poistonSyy} 
                  onChange={e => setPoistonSyy(e.target.value)} 
                  disabled={isSaving}
                  placeholder="Esim. Myyty kumppanille"
                />
              </div>
              <div className="form-group mb-0">
                <label>Poistopäivämäärä <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  value={poistoPaiva} 
                  onChange={e => setPoistoPaiva(e.target.value)} 
                  disabled={isSaving}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Vuokran Tyyppi</label>
            <select 
              value={leaseType} 
              onChange={e => setLeaseType(e.target.value)} 
              disabled={isSaving}
              className="w-full p-2 border rounded"
            >
              <option value="Elinkaari">Elinkaari</option>
              <option value="Rahoitus">Rahoitus</option>
              <option value="Omistus">Omistus</option>
            </select>
          </div>

          <div className="form-group">
            <label>Hankintapäivä</label>
            <input 
              type="date" 
              value={purchaseDate} 
              onChange={e => setPurchaseDate(e.target.value)} 
              disabled={isSaving}
            />
            {leaseType === 'Elinkaari' && purchaseDate && (
              <small className="help-text">
                Elinkaari päättyy: {formatDate(new Date(new Date(purchaseDate).setFullYear(new Date(purchaseDate).getFullYear() + 5)).toISOString())}
              </small>
            )}
          </div>

          <div className="form-group">
            <label>Laskun URL / Tunniste</label>
            <input 
              type="text" 
              value={receiptUrl} 
              onChange={e => setReceiptUrl(e.target.value)} 
              disabled={isSaving}
              placeholder="https://..."
            />
            {receiptUrl && receiptUrl.startsWith('http') && (
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 mt-1 inline-block">
                Avaa linkki uuteen välilehteen
              </a>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={isSaving}>Peruuta</button>
          <button className="btn-secondary" onClick={() => autocompleteRef.current?.search()} disabled={isSaving || primaryUser.trim().length < 3}>
            Etsi
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={isSaving}>
            <Save size={18} />
            {isSaving ? 'Tallennetaan...' : 'Tallenna'}
          </button>
        </div>
      </div>
    </div>
  );
}
