import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, getDocs, getFirestore, writeBatch } from 'firebase/firestore';
import { DEMO_BOOKINGS, DEMO_ROOMS } from './demoData.js';

// Svuota le collezioni demo (roomsDemo e bookingsDemo) e le riempie con i dati di esempio.
// Non tocca MAI le collezioni reali. Va eseguito a mano, quando serve.
//
//   node scripts/seedDemo.js --dry-run                  (solo simulazione, non scrive nulla)
//   node --env-file=.env scripts/seedDemo.js            (con SEED_EMAIL e SEED_PASSWORD impostate)

const BATCH_SIZE = 400;

if (process.argv.includes('--dry-run')) {
  console.log(
    `Simulazione: verrebbero caricate ${DEMO_ROOMS.length} camere e ${DEMO_BOOKINGS.length} prenotazioni. Nessun dato è stato scritto.`
  );
  process.exit(0);
}

const { SEED_EMAIL, SEED_PASSWORD } = process.env;
if (!SEED_EMAIL || !SEED_PASSWORD) {
  console.error(
    'Imposta SEED_EMAIL e SEED_PASSWORD (email e password del personale) prima di lanciare lo script.'
  );
  process.exit(1);
}

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

async function clearCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    snapshot.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snapshot.size;
}

async function fillCollection(name, items) {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    items.slice(i, i + BATCH_SIZE).forEach((item) => batch.set(doc(db, name, item.id), item.data));
    await batch.commit();
  }
}

try {
  await signInWithEmailAndPassword(auth, SEED_EMAIL, SEED_PASSWORD);
  console.log('Accesso eseguito.');

  const removedBookings = await clearCollection('bookingsDemo');
  const removedRooms = await clearCollection('roomsDemo');
  console.log(`Eliminati ${removedRooms} camere e ${removedBookings} prenotazioni demo.`);

  await fillCollection('roomsDemo', DEMO_ROOMS);
  await fillCollection('bookingsDemo', DEMO_BOOKINGS);
  console.log(`Caricati ${DEMO_ROOMS.length} camere e ${DEMO_BOOKINGS.length} prenotazioni demo.`);

  await signOut(auth);
  process.exit(0);
} catch (err) {
  console.error('Operazione non riuscita:', err.code ?? err.message);
  process.exit(1);
}
