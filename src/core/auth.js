// ============================================================
// Autenticación. Envuelve Firebase Auth con una API simple.
// ============================================================
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../firebase/init.js';

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

// Ejecuta el callback cada vez que cambia el estado de sesión.
// Devuelve la función para dejar de escuchar.
export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function currentUser() {
  return auth.currentUser;
}
