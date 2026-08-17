// ============================================================
// Listener de Firestore en tiempo real
//
// Responsabilidad: Activar listener para cambios en reservas
// Dependencias: firebase/firestore, metricas.js, state.js
// Tamaño: ~80 líneas
//
// OJO CON EL COSTO REAL (corregido tras medirlo — antes este comentario
// decía que costaba "1 lectura" y que los cambios eran gratis; las dos
// cosas son falsas):
//   - La carga inicial factura UNA LECTURA POR CADA DOCUMENTO que trae el
//     snapshot (con el rango de abajo, todas las reservas activas y
//     futuras: fácilmente varias decenas, no 1).
//   - Cada cambio posterior en un documento que entra en ese rango
//     (crear/editar/borrar una reserva) también factura una lectura por
//     ESE documento. No es gratis, aunque sí más barato que repreguntar
//     todo el rango de nuevo.
// Sigue siendo la forma más barata de mantener las notificaciones al día
// (se paga una sola vez por sesión, no en cada pantalla), pero no asumas
// costo cero al razonar sobre lecturas.
// ============================================================

import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/init.js';
import { notificacionesState } from './state.js';
import { hoyISO, masDias } from '../metricas.js';

// Cuánto esperar como máximo el primer snapshot real antes de dejar de
// bloquear a quien llamó a activarListener(). El listener sigue corriendo
// en segundo plano después de este punto — esto solo evita que alguien
// se quede esperando para siempre si Firestore tarda o la conexión falla.
const TIMEOUT_PRIMER_SNAPSHOT_MS = 6000;

/**
 * Activa un listener Firestore que escucha cambios en reservas.
 * Se ejecuta UNA sola vez al inicializar la app.
 *
 * Devuelve `{ unsubscribe, listo }` de forma SINCRÓNICA (no una promesa
 * de todo el objeto): `unsubscribe` está disponible de una, apenas se
 * registra el listener, para que quien nos llama pueda cortar la
 * suscripción en cualquier momento (ej. un logout rápido) sin importar
 * si el primer snapshot ya llegó o no. Si `unsubscribe` solo estuviera
 * disponible recién cuando `listo` resuelve, un logout que ocurra ANTES
 * de eso dejaría el listener corriendo en segundo plano para siempre
 * (fuga) — por eso van separados.
 *
 * `listo` es la promesa que sí espera al primer snapshot real (con los
 * datos ya en notificacionesState.reservasCacheadas), para que quien
 * hizo `await listo` pueda confiar en ese array de una. Esto corrige un
 * bug real: antes activarListener() resolvía de inmediato sin esperar
 * ningún dato, así que cualquier código que dependiera del listener
 * podía leer reservasCacheadas todavía vacío.
 *
 * Salvedad: si el primer snapshot tarda más de TIMEOUT_PRIMER_SNAPSHOT_MS
 * (Firestore lento, sin conexión), `listo` igual resuelve para no dejar a
 * nadie colgado — el listener sigue esperando en segundo plano, y
 * notificacionesState.primerSnapshotListo queda en `false` para que quien
 * llamó sepa que ese array puede no estar listo todavía y decida su
 * propio respaldo (ver notificaciones.service.js#getReservasRecientes).
 *
 * Costo real (ver cabecera del archivo): la carga inicial factura una
 * lectura por documento, y cada cambio posterior factura una lectura por
 * el documento que cambió. No es gratis, pero se paga una sola vez por
 * sesión en vez de en cada pantalla que necesita reservas recientes.
 *
 * @returns {{ unsubscribe: function, listo: Promise<void> }}
 */
export function activarListener() {
  // Rango: últimos 7 días + futuras (suficiente para próximos 7d)
  const desde = masDias(hoyISO(), -7);

  // Construir query con Firestore
  const reservasCol = collection(db, 'reservas');
  const q = query(
    reservasCol,
    where('fechaSalida', '>=', desde),
    orderBy('fechaSalida', 'asc')
  );

  let resuelto = false;
  let resolverListo, rechazarListo;
  const listo = new Promise((resolve, reject) => { resolverListo = resolve; rechazarListo = reject; });

  const timeoutId = setTimeout(() => {
    if (resuelto) return;
    resuelto = true;
    console.warn(`[notificaciones] El primer snapshot tardó más de ${TIMEOUT_PRIMER_SNAPSHOT_MS}ms; se deja de esperar (el listener sigue activo en segundo plano).`);
    resolverListo();
  }, TIMEOUT_PRIMER_SNAPSHOT_MS);

  // onSnapshot: Firestore listener. Carga inicial = 1 lectura POR
  // DOCUMENTO del resultado (no 1 lectura total). Cada cambio posterior
  // en un documento del rango factura 1 lectura por ese documento (no
  // es gratis, pero es más barato que re-consultar todo de nuevo).
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      // Snapshot changed → actualizar cache
      const reservas = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      notificacionesState.reservasCacheadas = reservas;
      notificacionesState.ultimaActualizacion = Date.now();
      notificacionesState.primerSnapshotListo = true;

      if (!resuelto) {
        resuelto = true;
        clearTimeout(timeoutId);
        resolverListo();
      }

      // Notificar al service que actualice UI
      if (notificacionesState._dispatchUpdate) {
        notificacionesState._dispatchUpdate();
      }
    },
    (error) => {
      // Error en el listener
      console.error('[notificaciones] Error en listener:', error);
      notificacionesState.listenerActivo = false;
      if (!resuelto) {
        // Todavía nadie tiene datos: que quien esperaba se entere y
        // decida su propio respaldo, en vez de quedarse colgado.
        resuelto = true;
        clearTimeout(timeoutId);
        rechazarListo(error);
      }
      // Si ya habíamos resuelto (con datos o por timeout), un error
      // posterior solo se loguea — no hay nadie esperando a quien avisar,
      // y reintentar queda para la próxima inicialización.
    }
  );

  notificacionesState.listenerActivo = true;

  return { unsubscribe, listo };
}

/**
 * Desactiva el listener (cleanup)
 * Se ejecuta al logout o error crítico
 */
export function desactivarListener(unsubscribe) {
  if (typeof unsubscribe === 'function') {
    try {
      unsubscribe();
      notificacionesState.listenerActivo = false;
    } catch (err) {
      console.error('✗ [notificaciones] Error desactivar listener:', err);
    }
  }
}
