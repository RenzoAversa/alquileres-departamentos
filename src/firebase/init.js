// ============================================================
// Inicialización de Firebase (una sola vez para toda la app).
// Lee las claves desde la config del cliente.
// ============================================================
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { config } from '../../config/client.config.js';

export const app = initializeApp(config.firebase);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const appConfig = config;

// Conexión a los emuladores SOLO para los tests que corren en Node (ver
// tests/emulator/*.test.js, vía `npm run test:emulator`). `process` no
// existe en el navegador real, así que esto nunca se activa en producción
// — no hace falta separar config de test de config de prod para esto.
if (typeof process !== 'undefined' && process.env?.FIRESTORE_EMULATOR_HOST) {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(db, host, Number(port));
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  }
}
