import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  console.log("=== INGREDIENTS ===");
  const ingSnap = await getDocs(collection(db, 'ingredients'));
  ingSnap.forEach(doc => {
    console.log(`ID: ${doc.id}, Data: ${JSON.stringify(doc.data())}`);
  });

  console.log("\n=== ITEMS (First 30) ===");
  const itemSnap = await getDocs(collection(db, 'items'));
  let count = 0;
  itemSnap.forEach(doc => {
    if (count++ < 30) {
      console.log(`ID: ${doc.id}, Name: ${doc.data().name}, Category: ${doc.data().category}`);
    }
  });
  console.log(`Total items size: ${itemSnap.size}`);
}

run().catch(console.error);
