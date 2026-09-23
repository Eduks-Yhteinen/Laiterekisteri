import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Device } from '../types';

/**
 * MOCK: Hakee laitteen tiedot Google Administa ja erottelee PII-tiedot (Etu- ja Sukunimi)
 * erilliseen device_pii kokoelmaan.
 */
export async function syncGoogleAdminDevice(serial: string, orgUnitPath: string, recentUsers: string) {
  try {
    // 1. Päättele CostCenter orgUnitPath-tiedosta (Esim: "/Koulut/Mäntykangas" -> "Mäntykangas")
    const parts = orgUnitPath.split('/');
    const costCenter = parts.length > 0 ? parts[parts.length - 1] : 'Tuntematon';

    // 2. Päivitä CostCenter laitteen pääkokoelmaan
    const deviceRef = doc(db, 'devices', serial);
    const deviceSnap = await getDoc(deviceRef);
    
    if (deviceSnap.exists()) {
      await updateDoc(deviceRef, {
        CostCenter: costCenter,
        LastSyncDate: new Date().toISOString()
      });
    }

    // 3. Pura recentUsers firstName ja lastName kentiksi
    // Oletetaan että recentUsers on esim. "Matti Meikäläinen (matti.meikalainen@koulu.fi)" tai vain sähköposti
    let firstName = '';
    let lastName = '';
    
    if (recentUsers && recentUsers.includes('@')) {
      // Yksinkertainen sähköpostin tai nimen erottelu
      const namePart = recentUsers.split('(')[0].trim();
      if (namePart && namePart.includes(' ')) {
        const names = namePart.split(' ');
        firstName = names[0];
        lastName = names.slice(1).join(' ');
      } else {
        const emailPrefix = recentUsers.split('@')[0];
        const emailNames = emailPrefix.split('.');
        if (emailNames.length >= 2) {
          firstName = emailNames[0];
          lastName = emailNames.slice(1).join(' ');
        } else {
          firstName = emailPrefix;
        }
      }
    }

    // 4. Tallenna PII erilliseen kokoelmaan, johon vain globaalit adminit ja opettajat pääsevät käsiksi!
    const piiRef = doc(db, 'device_pii', serial);
    await setDoc(piiRef, {
      firstName,
      lastName,
      email: recentUsers,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return { success: true, costCenter, firstName, lastName };
  } catch (error) {
    console.error("Virhe Google Admin -synkronoinnissa:", error);
    return { success: false, error };
  }
}
