// Tests de reservasService.verificarDisponibilidad() / create() contra el
// Firestore/Auth emulator real (no un mock): usa el mismo `db`/`auth` que
// usa la app (src/firebase/init.js), conectados al emulador porque
// `firebase emulators:exec` (ver `npm run test:emulator`) ya deja seteadas
// FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST antes de arrancar
// Node. NO correr este archivo con `node --test` directo sin el emulador
// levantado — usar `npm run test:emulator`.
import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

import { auth, db } from '../../src/firebase/init.js';
import { reservasService } from '../../src/services/reservas.service.js';
import { unidadesService } from '../../src/services/unidades.service.js';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Este test necesita el emulador de Firestore. Corré `npm run test:emulator`, no `node --test` directo.');
}

const PROJECT_ID = 'alquileres-314f3';
const EMAIL = 'dueno-disponibilidad-test@x.com';
const PASSWORD = 'clave-test-123456';

let testEnv;
let unidadId;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  await testEnv.clearFirestore();

  // Alta de la cuenta de Auth (emulador) + su perfil 'dueño'. El seed del
  // perfil usa un contexto sin reglas: en producción ese paso equivale al
  // "promover al dueño a mano" de ONBOARDING.md, no algo que la app haga
  // por sí sola (ver AUDIT.md C1).
  await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD);
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'usuarios', EMAIL), { email: EMAIL, nombre: 'Dueño Test', rol: 'dueño', activo: true });
  });
  await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);

  const unidad = await unidadesService.create({
    nombre: 'Depto Test', capacidad: 2, precioNoche: 1000, edificioId: null, estado: 'activo'
  });
  unidadId = unidad.id;
});

after(async () => {
  await signOut(auth);
  await testEnv.cleanup();
});

// Cada reserva de prueba, ya con los campos que exige la regla de create
// (pagado:0, saldo==precioTotal, estadoPago:'sin_pagar' — ver
// firestore.rules).
function datosReserva(entrada, salida, extra = {}) {
  const total = 1000;
  return {
    unidadId, unidadNombre: 'Depto Test', edificioId: null,
    huesped: { nombre: 'Huésped test', telefono: '', email: '' },
    fechaEntrada: entrada, fechaSalida: salida, noches: 1,
    precioTotal: total, precioManual: false, pagado: 0, saldo: total, estadoPago: 'sin_pagar',
    estado: 'confirmada', canal: 'directo',
    ...extra
  };
}

async function limpiarReservasDeLaUnidad() {
  const existentes = await reservasService.getByUnidad(unidadId);
  for (const r of existentes) await reservasService.remove(r.id);
}

describe('verificarDisponibilidad()', () => {
  beforeEach(limpiarReservasDeLaUnidad);

  test('unidad sin reservas: libre', async () => {
    const libre = await reservasService.verificarDisponibilidad(unidadId, '2026-10-01', '2026-10-05');
    assert.equal(libre, true);
  });

  test('rango pedido cae completamente afuera de una reserva existente: libre', async () => {
    await reservasService.create(datosReserva('2026-10-10', '2026-10-15'));
    const libre = await reservasService.verificarDisponibilidad(unidadId, '2026-10-01', '2026-10-05');
    assert.equal(libre, true);
  });

  test('la entrada pedida cae DENTRO de una reserva existente: ocupado', async () => {
    await reservasService.create(datosReserva('2026-10-10', '2026-10-15'));
    // entra el 12 (dentro del 10-15), sale el 20
    const libre = await reservasService.verificarDisponibilidad(unidadId, '2026-10-12', '2026-10-20');
    assert.equal(libre, false);
  });

  test('la salida pedida cae DENTRO de una reserva existente: ocupado', async () => {
    await reservasService.create(datosReserva('2026-10-10', '2026-10-15'));
    // entra el 5, sale el 12 (dentro del 10-15)
    const libre = await reservasService.verificarDisponibilidad(unidadId, '2026-10-05', '2026-10-12');
    assert.equal(libre, false);
  });

  test('el rango pedido CONTIENE completamente a una reserva existente: ocupado', async () => {
    await reservasService.create(datosReserva('2026-10-10', '2026-10-12'));
    const libre = await reservasService.verificarDisponibilidad(unidadId, '2026-10-05', '2026-10-20');
    assert.equal(libre, false);
  });

  test('checkout el mismo día que un checkin (bordes que NO se pisan): libre', async () => {
    await reservasService.create(datosReserva('2026-10-10', '2026-10-15'));
    // la nueva entra justo el día que la otra sale: no comparten noche
    const libre = await reservasService.verificarDisponibilidad(unidadId, '2026-10-15', '2026-10-18');
    assert.equal(libre, true);
  });

  test('reserva cancelada no bloquea las fechas', async () => {
    const r = await reservasService.create(datosReserva('2026-10-10', '2026-10-15'));
    await reservasService.editar(r, { ...datosReserva('2026-10-10', '2026-10-15'), estado: 'cancelada' }, 1000);
    const libre = await reservasService.verificarDisponibilidad(unidadId, '2026-10-12', '2026-10-13');
    assert.equal(libre, true);
  });

  test('excluirId: editar una reserva a las mismas fechas que ya tiene no choca contra sí misma', async () => {
    const r = await reservasService.create(datosReserva('2026-10-10', '2026-10-15'));
    const libreSinExcluir = await reservasService.verificarDisponibilidad(unidadId, '2026-10-10', '2026-10-15');
    assert.equal(libreSinExcluir, false); // sin excluirId, choca contra sí misma
    const libreConExcluir = await reservasService.verificarDisponibilidad(unidadId, '2026-10-10', '2026-10-15', r.id);
    assert.equal(libreConExcluir, true); // excluyéndose a sí misma, libre
  });
});

describe('create(): rechaza el alta si al escribir ya hay solapamiento (relectura transaccional)', () => {
  beforeEach(limpiarReservasDeLaUnidad);

  test('crear sobre un rango ya ocupado (secuencial, no simultáneo) es rechazado con FECHAS_OCUPADAS', async () => {
    await reservasService.create(datosReserva('2026-11-01', '2026-11-05'));
    await assert.rejects(
      () => reservasService.create(datosReserva('2026-11-03', '2026-11-06')),
      (err) => {
        assert.equal(err.codigo, 'FECHAS_OCUPADAS');
        assert.ok(err.message.length > 0);
        return true;
      }
    );
  });

  test('crear sobre un rango libre funciona normalmente', async () => {
    await reservasService.create(datosReserva('2026-11-10', '2026-11-12'));
    const nueva = await reservasService.create(datosReserva('2026-11-12', '2026-11-15'));
    assert.ok(nueva.id);
  });
});

// Escenario explícito del pedido de la Fase 2b: N intentos de reservar la
// misma unidad/fechas EN PARALELO — con el documento de lock
// (unidades/{id}/_lock/reservas) forzando contención real, se espera que
// gane exactamente UNA en todos los casos, no solo en el secuencial.
describe('doble-reserva concurrente (H2) — contención vía unidades/{id}/_lock/reservas', () => {
  beforeEach(limpiarReservasDeLaUnidad);

  function assertGanaUnaSola(resultados) {
    const exitosas = resultados.filter((r) => r.status === 'fulfilled');
    const rechazadas = resultados.filter((r) => r.status === 'rejected');
    assert.equal(exitosas.length, 1, `se esperaba exactamente 1 alta exitosa, hubo ${exitosas.length} de ${resultados.length}`);
    assert.equal(rechazadas.length, resultados.length - 1);
    for (const r of rechazadas) assert.equal(r.reason.codigo, 'FECHAS_OCUPADAS', `una rechazada dio un error distinto de FECHAS_OCUPADAS: ${r.reason}`);
    return exitosas[0];
  }

  test('dos altas para el mismo rango, arrancadas con un tick de diferencia — gana una sola', async () => {
    const a = reservasService.create(datosReserva('2026-12-01', '2026-12-05', { huesped: { nombre: 'A' } }));
    await Promise.resolve();
    const b = reservasService.create(datosReserva('2026-12-02', '2026-12-04', { huesped: { nombre: 'B' } }));
    assertGanaUnaSola(await Promise.allSettled([a, b]));
  });

  test('dos altas lanzadas en el MISMO tick (Promise.all, sin ningún stagger) — gana una sola', async () => {
    const resultados = await Promise.allSettled([
      reservasService.create(datosReserva('2026-12-20', '2026-12-25', { huesped: { nombre: 'A' } })),
      reservasService.create(datosReserva('2026-12-21', '2026-12-23', { huesped: { nombre: 'B' } }))
    ]);
    assertGanaUnaSola(resultados);
  });

  test('5 altas concurrentes para rangos que se solapan entre sí — gana una sola', async () => {
    const resultados = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        reservasService.create(datosReserva('2027-01-10', '2027-01-15', { huesped: { nombre: `Concurrente ${i}` } }))
      )
    );
    assertGanaUnaSola(resultados);
  });

  test('10 altas concurrentes para rangos que se solapan entre sí — gana una sola', async () => {
    const resultados = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        reservasService.create(datosReserva('2027-02-10', '2027-02-15', { huesped: { nombre: `Concurrente ${i}` } }))
      )
    );
    assertGanaUnaSola(resultados);
    // La unidad queda con exactamente una reserva real (no 10, no 0) —
    // sigue viéndose ocupada para cualquiera que pregunte después.
    const reservasFinales = await reservasService.getByUnidad(unidadId);
    assert.equal(reservasFinales.length, 1);
    const libre = await reservasService.verificarDisponibilidad(unidadId, '2027-02-10', '2027-02-15');
    assert.equal(libre, false);
  });
});
