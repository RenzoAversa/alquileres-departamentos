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

/**
 * Activa un listener Firestore que escucha cambios en reservas
 * Se ejecuta UNA sola vez al inicializar la app
 *
 * Costo real (ver cabecera del archivo): la carga inicial factura una
 * lectura por documento, y cada cambio posterior factura una lectura por
 * el documento que cambió. No es gratis, pero se paga una sola vez por
 * sesión en vez de en cada pantalla que necesita reservas recientes.
 *
 * @returns {function} Función unsubscribe para detener el listener
 */
export async function activarListener() {
  try {
    // Rango: últimos 7 días + futuras (suficiente para próximos 7d)
    const desde = masDias(hoyISO(), -7);

    // Construir query con Firestore
    const reservasCol = collection(db, 'reservas');
    const q = query(
      reservasCol,
      where('fechaSalida', '>=', desde),
      orderBy('fechaSalida', 'asc')
    );

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

        // Notificar al service que actualice UI
        if (notificacionesState._dispatchUpdate) {
          notificacionesState._dispatchUpdate();
        }
      },
      (error) => {
        // Error en el listener
        console.error('[notificaciones] Error en listener:', error);
        notificacionesState.listenerActivo = false;
        
        // No tirar aquí; se reintentar en próxima inicialización
      }
    );
    
    notificacionesState.listenerActivo = true;

    return unsubscribe;
  } catch (err) {
    console.error('✗ [notificaciones] Error activar listener:', err);
    notificacionesState.listenerActivo = false;
    throw err;
  }
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
