// ============================================================
// Inicialización de Firebase (una sola vez para toda la app).
// Lee las claves desde la config del cliente.
// ============================================================
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { config } from '../../config/client.config.js';

export const app = initializeApp(config.firebase);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const appConfig = config;
