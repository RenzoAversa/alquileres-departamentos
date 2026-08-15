// ============================================================
// Estado singleton para notificaciones
// 
// Responsabilidad: Definir la estructura de datos única
// Dependencias: Ninguna ✓
// Tamaño: ~50 líneas
// ============================================================

/**
 * Estado global de notificaciones
 * Se actualiza cada 60s sin hacer queries a Firestore
 */
export const notificacionesState = {
  // ===== CACHE (datos de Firestore) =====
  reservasCacheadas: [],
  
  // ===== NOTIFICACIONES PROCESADAS =====
  hoy: {
    checkIn: [],      // Quién entra hoy
    checkOut: [],     // Quién sale hoy
    pagoPendiente: [] // Quién debe pagar (vencido)
  },
  
  proximos7d: {
    checkIn: [],      // Check-in próximos 7 días
    checkOut: []      // Check-out próximos 7 días
  },
  
  porPagar: [],       // Todas las reservas con saldo > 0 (ordenadas por urgencia)
  
  // ===== METADATA =====
  ultimaActualizacion: null,  // timestamp de cuándo se procesó
  ultimoDíaProcesado: null,   // fecha del último procesamiento
  listenerActivo: false,      // ¿está activo el listener de Firestore?
  
  // ===== CONTADORES (para badge) =====
  contadores: {
    hoy: { 
      total: 0,           // Total eventos hoy
      checkIn: 0,         // Check-ins hoy
      checkOut: 0,        // Check-outs hoy
      pagoPendiente: 0    // Pagos vencidos hoy
    },
    proximos7d: { 
      total: 0,           // Total eventos próximos 7d
      checkIn: 0,         // Check-ins próximos 7d
      checkOut: 0         // Check-outs próximos 7d
    },
    porPagar: { 
      total: 0,           // Total reservas con saldo pendiente
      vencidos: 0         // Cuántos están vencidos
    }
  },
  
  // ===== CALLBACK (para notificar al service) =====
  _dispatchUpdate: null  // Función que se llama cuando hay cambios
};

/**
 * Resetea el estado a valores iniciales
 * Se usa al logout o cleanup
 */
export function resetearState() {
  notificacionesState.reservasCacheadas = [];
  notificacionesState.hoy = { checkIn: [], checkOut: [], pagoPendiente: [] };
  notificacionesState.proximos7d = { checkIn: [], checkOut: [] };
  notificacionesState.porPagar = [];
  notificacionesState.ultimaActualizacion = null;
  notificacionesState.ultimoDíaProcesado = null;
  notificacionesState.listenerActivo = false;
  notificacionesState.contadores = {
    hoy: { total: 0, checkIn: 0, checkOut: 0, pagoPendiente: 0 },
    proximos7d: { total: 0, checkIn: 0, checkOut: 0 },
    porPagar: { total: 0, vencidos: 0 }
  };
}
