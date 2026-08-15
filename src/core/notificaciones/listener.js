// ============================================================
// Listener de Firestore en tiempo real
//
// Responsabilidad: Activar listener para cambios en reservas
// Dependencias: firebase/firestore, metricas.js, state.js
// Tamaño: ~80 líneas
// 
// IMPORTANTE: Este listener se activa UNA sola vez
// Los cambios en Firestore NO cuestan queries adicionales (gratis)
// ============================================================

import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/init.js';
import { notificacionesState } from './state.js';
import { hoyISO, masDias } from '../metricas.js';

/**
 * Activa un listener Firestore que escucha cambios en reservas
 * Se ejecuta UNA sola vez al inicializar la app
 * 
 * Los cambios en el listener NO cuestan queries adicionales
 * (Firestore cobra por lecturas/escrituras, no por cambios en listeners)
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
    
    // onSnapshot: Firestore listener
    // - Primer call: traer datos actuales (cuesta 1 lectura)
    // - Cambios posteriores: notificaciones en tiempo real (GRATIS)
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
