import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase.js';

// Credenziali dell'account demo (pubbliche: l'account può vedere solo i dati demo)
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL;
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD;

export const isDemoUser = (user) => Boolean(user) && user.email === DEMO_EMAIL;

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function loginDemo() {
  return signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
}

export function logout() {
  return signOut(auth);
}

// Restituisce la funzione per smettere di ascoltare
export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
