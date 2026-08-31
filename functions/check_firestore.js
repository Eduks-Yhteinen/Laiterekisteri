const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "laiterekisteri-791ee"
});

async function run() {
  const db = admin.firestore();
  
  console.log("Checking 'devices' collection...");
  const devicesSnapshot = await db.collection("devices").limit(5).get();
  console.log(`Found ${devicesSnapshot.size} devices.`);
  devicesSnapshot.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });

  console.log("\nChecking 'device_pii' collection...");
  const piiSnapshot = await db.collection("device_pii").limit(5).get();
  console.log(`Found ${piiSnapshot.size} PII records.`);
  piiSnapshot.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });
}

run().catch(console.error);
