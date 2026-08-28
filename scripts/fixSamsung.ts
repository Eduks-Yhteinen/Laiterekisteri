import { initializeApp } from 'firebase/app';
import { getFirestore, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';

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

async function fixSamsungDevices() {
  console.log("Fetching devices...");
  
  // Actually we need to query everything since firestore doesn't support 'contains' queries
  // Or we can query by DeviceType == 'Chromebook'
  const q = query(collection(db, 'devices'), where('DeviceType', '==', 'Chromebook'));
  const snapshot = await getDocs(q);
  
  const batches: any[] = [];
  let currentBatch = writeBatch(db);
  let opCount = 0;
  let fixedCount = 0;
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.Model && (data.Model.toLowerCase().includes('samsung') || data.Model.toLowerCase().includes('galaxy'))) {
      currentBatch.update(doc.ref, { DeviceType: 'Android' });
      opCount++;
      fixedCount++;
      
      if (opCount >= 450) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    }
  });
  
  if (opCount > 0) {
    batches.push(currentBatch);
  }
  
  console.log(`Found ${fixedCount} devices to fix. Committing...`);
  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`Committed batch ${i + 1}/${batches.length}`);
  }
  
  console.log("Done!");
  process.exit(0);
}

fixSamsungDevices().catch(console.error);
