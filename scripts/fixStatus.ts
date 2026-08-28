import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, query, where } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "laiterekisteri-791ee",
  appId: "1:763929128230:web:fff971849473c53f8da5e7",
  storageBucket: "laiterekisteri-791ee.firebasestorage.app",
  apiKey: "AIzaSyCaUi9k-N8Aagszc77j7D_-j1HB1-IgsZU",
  authDomain: "laiterekisteri-791ee.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixStatus() {
  console.log("Etsitään korjattavia laitteita...");
  const q = query(collection(db, 'devices'), where('DeviceStatus', '==', 'KA ytA ssA '));
  const snapshot = await getDocs(q);
  
  console.log(`Löytyi ${snapshot.size} laitetta, korjataan...`);
  
  const batches = [];
  let batch = writeBatch(db);
  let count = 0;
  
  snapshot.forEach(doc => {
    batch.update(doc.ref, { DeviceStatus: 'Käytössä' });
    count++;
    if (count >= 400) {
      batches.push(batch);
      batch = writeBatch(db);
      count = 0;
    }
  });
  
  if (count > 0) {
    batches.push(batch);
  }
  
  for (const b of batches) {
    await b.commit();
  }
  
  console.log("Kaikki korjattu!");
  process.exit(0);
}

fixStatus().catch(console.error);
