// Test de reglas para firestore.rules > usuarios/{email} > allow read
// (Fase 2b, punto 1): confirma que el propio perfil se puede leer siempre,
// y que leer el perfil de otra persona ahora requiere un rol asignado
// (esStaff()) — antes alcanzaba con estar autenticado, sin importar el rol.
//
// Usa @firebase/rules-unit-testing directo (no la app ni Auth real): es la
// forma correcta de testear SOLO las reglas, con contextos de auth
// fabricados. Necesita el emulador de Firestore — correr con
// `npm run test:emulator`, no `node --test` directo.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Este test necesita el emulador de Firestore. Corré `npm run test:emulator`, no `node --test` directo.');
}

// Project id propio (distinto del resto de los tests) para que los datos
// de este archivo no se pisen con los de reservas-disponibilidad.test.js
// si el runner los corre contra el mismo emulador a la vez.
const PROJECT_ID = 'alquileres-314f3-rules-test';

const SIN_ASIGNAR = 'sinasignar@x.com';
const TRABAJADOR = 'trabajador@x.com';
const DUENO = 'dueno@x.com';

let testEnv;
let dbSinAsignar, dbTrabajador, dbDueno, dbAnonimo;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  // Seed una sola vez (todos los tests de este archivo son lecturas, nada
  // muta estos docs).
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', SIN_ASIGNAR), { email: SIN_ASIGNAR, nombre: 'Sin Asignar', rol: 'sin_asignar', activo: true });
    await setDoc(doc(db, 'usuarios', TRABAJADOR), { email: TRABAJADOR, nombre: 'Trabajador', rol: 'trabajador', activo: true });
    await setDoc(doc(db, 'usuarios', DUENO), { email: DUENO, nombre: 'Dueño', rol: 'dueño', activo: true });
  });

  // Un solo contexto (y una sola instancia de Firestore) por identidad,
  // creado UNA vez y reusado por todos los tests: crear un contexto nuevo
  // en cada test (el patrón "de manual") resultó en un error intermitente
  // del SDK ("Firestore has already been started and its settings can no
  // longer be changed") a partir de la 2ª/3ª app de test creada en la
  // misma corrida — ver nota en el resumen de la tarea. Con un contexto
  // fijo por identidad el problema no aparece.
  dbSinAsignar = testEnv.authenticatedContext('uid-sa', { email: SIN_ASIGNAR }).firestore();
  dbTrabajador = testEnv.authenticatedContext('uid-t', { email: TRABAJADOR }).firestore();
  dbDueno = testEnv.authenticatedContext('uid-d', { email: DUENO }).firestore();
  dbAnonimo = testEnv.unauthenticatedContext().firestore();
});

after(async () => {
  await testEnv.cleanup();
});

describe('usuarios/{email} > allow read', () => {
  test('una cuenta sin_asignar puede leer SU PROPIO perfil (lo necesita el bootstrap)', async () => {
    await assertSucceeds(getDoc(doc(dbSinAsignar, 'usuarios', SIN_ASIGNAR)));
  });

  test('una cuenta sin_asignar NO puede leer el perfil de otra persona', async () => {
    await assertFails(getDoc(doc(dbSinAsignar, 'usuarios', TRABAJADOR)));
    await assertFails(getDoc(doc(dbSinAsignar, 'usuarios', DUENO)));
  });

  test('un trabajador (rol asignado = esStaff) SÍ puede leer el perfil de otra persona', async () => {
    await assertSucceeds(getDoc(doc(dbTrabajador, 'usuarios', DUENO)));
    await assertSucceeds(getDoc(doc(dbTrabajador, 'usuarios', SIN_ASIGNAR)));
  });

  test('el dueño puede leer cualquier perfil', async () => {
    await assertSucceeds(getDoc(doc(dbDueno, 'usuarios', TRABAJADOR)));
  });

  test('sin autenticar no se puede leer ningún perfil', async () => {
    await assertFails(getDoc(doc(dbAnonimo, 'usuarios', DUENO)));
  });
});
