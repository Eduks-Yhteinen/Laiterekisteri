/**
 * Varmuuskopiointiskripti (NAS)
 * Tämä scripti hakee Firebase Admin SDK:ta käyttäen kokoelmien "devices" ja "device_pii" sisällön,
 * ja tallentaa sen NAS-asemalle (E:\AI_projektit\Laiterekisteri\backups).
 * Skripti poistaa myös yli 60 päivää vanhat varmuuskopiot.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// 1. Alusta Admin SDK Service Accountilla
// HUOM: Service Account -avainta ei pidä laittaa versionhallintaan!
let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
} catch (e) {
  console.error("Virhe: serviceAccountKey.json puuttuu 'scripts'-kansiosta.");
  console.error("Varmista, että olet ladannut sen Firebasesta ja tallentanut oikeaan paikkaan.");
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = getFirestore();

// Asetetaan kohde NAS-palvelimelle
const NAS_BASE_DIR = 'E:\\AI_projektit\\Laiterekisteri\\backups';
const RETENTION_DAYS = 60;

function cleanupOldBackups(backupBaseDir) {
  if (!fs.existsSync(backupBaseDir)) return;
  
  console.log(`Tarkistetaan vanhat varmuuskopiot (yli ${RETENTION_DAYS} päivää vanhat)...`);
  const files = fs.readdirSync(backupBaseDir);
  const now = new Date().getTime();
  const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
  
  let deletedCount = 0;
  files.forEach(file => {
    const filePath = path.join(backupBaseDir, file);
    const stats = fs.statSync(filePath);
    
    // Tarkista vain hakemistot
    if (stats.isDirectory()) {
      const dirAge = now - stats.mtime.getTime();
      if (dirAge > retentionMs) {
        console.log(`Poistetaan vanha varmuuskopio: ${file}`);
        fs.rmSync(filePath, { recursive: true, force: true });
        deletedCount++;
      }
    }
  });
  
  if (deletedCount === 0) {
    console.log("Ei poistettavia vanhoja varmuuskopioita.");
  }
}

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const backupDir = path.join(NAS_BASE_DIR, timestamp);

  console.log(`Aloitetaan varmuuskopiointi kansioon: ${backupDir}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  try {
    // 2. Varmuuskopioidaan "devices" kokoelma
    console.log('Haetaan kokoelma: devices...');
    const devicesSnap = await db.collection('devices').get();
    const devicesData = {};
    devicesSnap.forEach(doc => {
      devicesData[doc.id] = doc.data();
    });
    fs.writeFileSync(path.join(backupDir, 'devices.json'), JSON.stringify(devicesData, null, 2));

    // 3. Varmuuskopioidaan "device_pii" kokoelma
    console.log('Haetaan kokoelma: device_pii...');
    const piiSnap = await db.collection('device_pii').get();
    const piiData = {};
    piiSnap.forEach(doc => {
      piiData[doc.id] = doc.data();
    });
    fs.writeFileSync(path.join(backupDir, 'device_pii.json'), JSON.stringify(piiData, null, 2));

    console.log('Varmuuskopiointi suoritettu onnistuneesti!');
    
    // 4. Siivotaan vanhat varmuuskopiot
    cleanupOldBackups(NAS_BASE_DIR);
    
    process.exit(0);
  } catch (error) {
    console.error('Virhe varmuuskopioinnissa:', error);
    process.exit(1);
  }
}

// Aja varmuuskopiointi (jos skriptiä ajetaan node-komennolla)
if (require.main === module) {
  runBackup(); 
}

module.exports = { runBackup };
