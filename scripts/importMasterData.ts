import { initializeApp } from 'firebase/app';
import { getFirestore, writeBatch, doc } from 'firebase/firestore';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const firebaseConfig = {
  projectId: "laiterekisteri-791ee",
  appId: "1:763929128230:web:fff971849473c53f8da5e7",
  storageBucket: "laiterekisteri-791ee.firebasestorage.app",
  apiKey: "AIzaSyCaUi9k-N8Aagszc77j7D_-j1HB1-IgsZU",
  authDomain: "laiterekisteri-791ee.firebaseapp.com",
  messagingSenderId: "763929128230"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const jsonDir = join(process.cwd(), 'Laiterekisteri/Sharepoint .json files');

// Helper to fix garbled characters
function sanitize(str: string): string {
  if (!str) return '';
  return str.replace(/A A /g, 'ä')
            .replace(/A ytA ssA /g, 'äytössä')
            .replace(/KierrA tetty/g, 'Kierrätetty')
            .replace(/A /g, 'ä')
            .trim();
}

// Convert Excel Serial Date to ISO String (Excel epoch is 1899-12-30)
function excelToISO(serial: number): string {
  const date = new Date((serial - 25569) * 86400 * 1000);
  return date.toISOString();
}

// Ensure date is valid ISO
function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  // if it's a number (Excel date)
  if (!isNaN(Number(dateStr))) {
    return excelToISO(Number(dateStr));
  }
  // DD.MM.YYYY HH:mm format
  if (dateStr.includes('.')) {
    const parts = dateStr.split(' ')[0].split('.');
    if (parts.length === 3) {
      const parsed = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
      if (!isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
}

function mapStatus(rawStatus: string): 'Käytössä' | 'Varastossa' | 'Huollossa' | 'Rikkoutunut' | 'Kadonnut' {
  const s = sanitize(rawStatus).toLowerCase();
  if (s.includes('käytössä') || s.includes('käytös') || s === 'active') return 'Käytössä';
  if (s.includes('kierrätetty') || s.includes('palautettu') || s.includes('lunastus') || s === 'disabled' || s === 'deprovisioned') return 'Varastossa';
  if (s.includes('varasto')) return 'Varastossa';
  if (s.includes('huolto')) return 'Huollossa';
  if (s.includes('rikkoutunut') || s.includes('rikki')) return 'Rikkoutunut';
  if (s.includes('kadonnut')) return 'Kadonnut';
  return 'Käytössä';
}

async function runImport() {
  console.log("🚀 Starting Data Import...");
  let totalDevices = 0;
  const batches: any[] = [];
  let currentBatch = writeBatch(db);
  let opCount = 0;

  function addToBatch(docRef: any, data: any) {
    currentBatch.set(docRef, data, { merge: true });
    opCount++;
    if (opCount >= 450) { // Firestore limit is 500, keeping it safe
      batches.push(currentBatch);
      currentBatch = writeBatch(db);
      opCount = 0;
    }
  }

  const files = [
    { name: 'Master_DaaS.json', type: 'DaaS' },
    { name: 'Master_WIN.json', type: 'Windows' },
    { name: 'Master_Android.json', type: 'Android' },
    { name: 'Master_Apple.json', type: 'Apple' },
    { name: 'Master_Chrome.json', type: 'Chromebook' }
  ];

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  for (const file of files) {
    console.log(`\n📄 Processing ${file.name}...`);
    try {
      const data = JSON.parse(readFileSync(join(jsonDir, file.name), 'utf8'));
      let processed = 0;
      let skipped = 0;

      for (const item of data) {
        // Extract Serial
        let serial = item.Sarjanumero || item.Serial || item.serialNumber || item['Serial number'] || '';
        serial = sanitize(serial);

        // Strict Seppo rules: Discard invalid serials
        if (!serial || serial === '0' || serial === 'NoID' || serial.trim() === '') {
          skipped++;
          continue;
        }

        let defaultType = file.type;
        if (file.type === 'DaaS') {
          defaultType = 'Chromebook';
          const rawModel = item.Tuote || item.Model || item.model || '';
          if (rawModel.toLowerCase().includes('samsung') || rawModel.toLowerCase().includes('galaxy')) {
            defaultType = 'Android';
          }
        }

        // Base Device Data
        let deviceData: any = {
          Serial: serial,
          Model: sanitize(item.Tuote || item.Model || item.model || 'Unknown'),
          DeviceType: item.DeviceType ? sanitize(item.DeviceType) : defaultType,
          DeviceStatus: mapStatus(item['Laitteen tila'] || item.DeviceStatus || item.provisionStatus || 'Käytössä'),
          LastCheckIn: parseDate(item['Tilauspäivä'] || item.LastCheckIn || item.lastSyncDateTime || item.mostRecentActivity),
        };

        if (item.autoUpdateExpiration) {
          deviceData.AutoUpdateExpiration = parseDate(item.autoUpdateExpiration);
        }

        // Extra DaaS/Win data
        if (item['Palvelulaite jatkokaudella'] || item.LeaseStatus || item.LeaseType) {
           deviceData.LeaseType = sanitize(item.LeaseType || 'DaaS');
           deviceData.LeaseStatus = sanitize(item['Laitteen tila'] || item.LeaseStatus || '');
           if (item['Päättyy'] || item.LeaseEnd) {
             deviceData.LeaseEnd = parseDate(item['Päättyy'] || item.LeaseEnd);
           }
        }

        // Save Public Device
        const deviceRef = doc(db, 'devices', serial);
        addToBatch(deviceRef, deviceData);

        // PII Data Extraction (Strict Data Minimization)
        const kupa = item.Kustannuspaikka || '';
        
        let foundEmail = '';
        for (const key of Object.keys(item)) {
          if (key.includes('sähköposti') || key.includes('sähköposti')) {
             foundEmail = item[key];
          }
        }

        if (foundEmail || kupa) {
          const piiData = {
            UserEmail: sanitize(foundEmail).toLowerCase(),
            Kustannuspaikka: sanitize(kupa)
          };
          const piiRef = doc(db, 'device_pii', serial);
          addToBatch(piiRef, piiData);
        }

        processed++;
        totalDevices++;
      }
      console.log(`✅ Processed ${processed} devices (Skipped ${skipped} invalid/duplicate).`);

    } catch (e) {
      console.error(`❌ Error parsing ${file.name}:`, e);
    }
  }

  // Commit remaining
  if (opCount > 0) {
    batches.push(currentBatch);
  }

  console.log(`\n⏳ Committing ${batches.length} batches to Firestore...`);
  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`  -> Committed batch ${i + 1}/${batches.length}`);
    await delay(500); // Wait 500ms between batches
  }
  
  console.log(`\n🎉 Import Complete! Total valid devices imported: ${totalDevices}`);
  process.exit(0);
}

runImport().catch((e) => {
  console.error(e);
  process.exit(1);
});
