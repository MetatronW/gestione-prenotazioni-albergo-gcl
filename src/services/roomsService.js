import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

// Solo accesso ai dati: nessuna logica di interfaccia, nessuno stato React.
// `demo` sceglie la collezione: l'account demo non tocca mai i dati reali.
const collectionName = (demo) => (demo ? 'roomsDemo' : 'rooms');
const withId = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });

export async function getRooms(demo) {
  const snapshot = await getDocs(collection(db, collectionName(demo)));
  return snapshot.docs.map(withId);
}

export async function addRoom(demo, data) {
  const ref = await addDoc(collection(db, collectionName(demo)), data);
  return { id: ref.id, ...data };
}

export function updateRoom(demo, id, data) {
  return updateDoc(doc(db, collectionName(demo), id), data);
}

export function deleteRoom(demo, id) {
  return deleteDoc(doc(db, collectionName(demo), id));
}
