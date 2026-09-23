import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * MOCK: Hakee laitteen tiedot Microsoft Intunesta ja erottelee CostCenterin.
 * Reitti Intunessa on tyypillisesti: Profile -> Properties -> Department
 */
export async function syncIntuneDevice(serial: string, mockDepartmentProfile: string) {
  try {
    // 1. Haetaan CostCenter Intunen tiedoista (mock)
    const costCenter = mockDepartmentProfile || 'Tuntematon';

    // 2. Päivitä CostCenter laitteen pääkokoelmaan
    const deviceRef = doc(db, 'devices', serial);
    const deviceSnap = await getDoc(deviceRef);
    
    if (deviceSnap.exists()) {
      await updateDoc(deviceRef, {
        CostCenter: costCenter,
        LastSyncDate: new Date().toISOString(),
        ManagementTool: 'Intune' // Tieto siitä, mistä laite synkronointiin
      });
    } else {
      return { success: false, error: 'Laitetta ei löytynyt rekisteristä.' };
    }

    return { success: true, costCenter };
  } catch (error) {
    console.error("Virhe Intune -synkronoinnissa:", error);
    return { success: false, error };
  }
}
