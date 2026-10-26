import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase.js';

// Solo accesso ai dati: nessuna logica di interfaccia, nessuno stato React.
const collectionName = (demo) => (demo ? 'bookingsDemo' : 'bookings');
const withId = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });

// Prenotazioni con checkIn tra `from` e `to` (incluse). Un solo filtro di intervallo,
// sullo stesso campo dell'ordinamento: non servono indici aggiuntivi.
export async function getBookingsInRange(demo, from, to) {
  const q = query(
    collection(db, collectionName(demo)),
    where('checkIn', '>=', from),
    where('checkIn', '<=', to),
    orderBy('checkIn')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(withId);
}

// Tutte le prenotazioni di una camera (filtro di uguaglianza: nessun indice).
export async function getBookingsForRoom(demo, roomId) {
  const q = query(collection(db, collectionName(demo)), where('roomId', '==', roomId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(withId);
}

export async function hasBookingsForRoom(demo, roomId) {
  const q = query(collection(db, collectionName(demo)), where('roomId', '==', roomId), limit(1));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

export async function addBooking(demo, data) {
  const ref = await addDoc(collection(db, collectionName(demo)), data);
  return { id: ref.id, ...data };
}

export function updateBooking(demo, id, data) {
  return updateDoc(doc(db, collectionName(demo), id), data);
}

export function deleteBooking(demo, id) {
  return deleteDoc(doc(db, collectionName(demo), id));
}
