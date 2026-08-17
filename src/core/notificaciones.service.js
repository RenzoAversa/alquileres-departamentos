// ============================================================
// Servicio de notificaciones - Orquestador
//
// Responsabilidad: Coordinar state + engine + listener + UI
// Dependencias: notificaciones/state.js, .../engine.js, .../listener.js, metricas.js, ui.js
// Tamaño: ~250 líneas
//
// PUBLIC API:
//   init()              - Inicializar (llamar UNA vez al autenticarse)
//   getEstado()         - Obtener estado actual
//   getContadores()     - Solo contadores (para badge)
//   cleanup()           - Limpiar (al logout)
// ============================================================

import { notificacionesState, resetearState } from './notificaciones/state.js';
import { procesarReservas } from './notificaciones/engine.js';
import { activarListener, desactivarListener } from './notificaciones/listener.js';
import { estaVisto, alternarVisto, marcarTodosVistos, limpiarVistosViejos, resetearVistos } from './notificaciones/vistos.js';
import { hoyISO } from './metricas.js';
import { toast } from './ui.js';

export const notificacionesService = {
  // ===== PRIVADAS =====
  _unsubscribe: null,      // Función para desactivar listener
  _intervalId: null,       // ID del interval cada 60s
  _initPromise: null,      // Promise de inicialización
  
  // ===== PUBLIC API =====
  
  /**
   * Inicializar el sistema de notificaciones
   * 
   * IMPORTANTE: Llamar UNA sola vez al autenticarse
   * 
   * Pasos:
   * 1. Cargar del cache (localStorage)
   * 2. Activar listener Firestore (1 sola query, pero factura 1 lectura
   *    por cada documento que trae — ver core/notificaciones/listener.js)
   * 3. Procesar datos iniciales
   * 4. Iniciar interval cada 60s (sin queries)
   * 
   * @returns {Promise<void>}
   */
  async init() {
    // Evitar inicializar dos veces
    if (this._initPromise) {
      return this._initPromise;
    }
    
    this._initPromise = this._inicializarInterno();
    return this._initPromise;
  },
  
  /**
   * Obtener estado completo
   * @returns {Object} notificacionesState
   */
  getEstado() {
    return notificacionesState;
  },
  
  /**
   * Obtener solo los contadores (para badge)
   * @returns {Object} { hoy, proximos7d, porPagar }
   */
  getContadores() {
    return notificacionesState.contadores;
  },

  /**
   * ¿Este aviso ya fue visto? (preferencia local, por usuario)
   */
  estaVisto(avisoId) {
    return estaVisto(avisoId);
  },

  /**
   * Marca/desmarca un aviso individual y recalcula (así la campana
   * refleja el cambio al toque).
   */
  alternarVisto(avisoId) {
    alternarVisto(avisoId);
    this._procesarDatos();
  },

  /**
   * "Marcar todas como vistas": todo lo que está cargado ahora mismo en
   * el estado (Hoy + Próximos 7 días + Por cobrar).
   */
  marcarTodasVistas() {
    const ids = [
      ...notificacionesState.hoy.checkIn,
      ...notificacionesState.hoy.checkOut,
      ...notificacionesState.hoy.pagoPendiente,
      ...notificacionesState.proximos7d.checkIn,
      ...notificacionesState.proximos7d.checkOut,
      ...notificacionesState.porPagar
    ].map((x) => x.avisoId).filter(Boolean);
    marcarTodosVistos(ids);
    this._procesarDatos();
  },

  /**
   * Limpiar todo (logout, error crítico)
   * @returns {Promise<void>}
   */
  async cleanup() {
    // 1. Detener interval
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    
    // 2. Desactivar listener
    if (this._unsubscribe) {
      desactivarListener(this._unsubscribe);
      this._unsubscribe = null;
    }
    
    // 3. Limpiar localStorage
    try {
      localStorage.removeItem('notificaciones_cache');
    } catch (err) {
      console.warn('[notificaciones] Error limpiar localStorage:', err);
    }
    
    // 4. Resetear estado
    resetearState();

    // 5. Resetear promise de init
    this._initPromise = null;
  },

  /**
   * Cleanup completo PARA LOGOUT (no para el `beforeunload` de cada
   * refresh/cierre de pestaña, que también llama a cleanup()). Acá sí
   * hay que borrar los avisos vistos: son de ESTE usuario, y si se
   * desloguea y entra otro no debería heredar su estado.
   */
  async cleanupLogout() {
    await this.cleanup();
    resetearVistos();
  },

  // ===== PRIVADAS (implementación interna) =====
  
  async _inicializarInterno() {
    try {
      // 1. Cargar del cache (localStorage)
      this._cargarDelCache();

      // 1.b Avisos vistos de días anteriores ya no sirven: se descartan
      //     para que el localStorage no crezca sin control.
      limpiarVistosViejos();

      // 2. Activar listener Firestore
      //    (carga inicial: 1 lectura por documento del rango; cada cambio
      //    posterior en un documento de ese rango también factura 1
      //    lectura — no es gratis, ver core/notificaciones/listener.js)
      this._unsubscribe = await activarListener();
      
      // 3. Procesar datos iniciales
      this._procesarDatos();
      
      // 4. Interval cada 60s para recalcular
      //    (Sin queries, solo lógica local)
      this._intervalId = setInterval(() => {
        this._procesarDatos();
        this._verificarCambioDedía();
      }, 60000);
      
      // 5. Callback para cuando el listener notifica cambios
      notificacionesState._dispatchUpdate = () => this._procesarDatos();
    } catch (err) {
      console.error('✗ [notificaciones] Error inicializar:', err);
      toast('Error cargando notificaciones', 'alerta');
      await this.cleanup();
      throw err;
    }
  },
  
  /**
   * Procesa datos cacheados y actualiza state
   * Esta función se ejecuta:
   * - Al inicializar (init)
   * - Cada 60s (interval)
   * - Cuando el listener notifica cambios
   * 
   * NO HACE QUERIES a Firestore (función pura)
   */
  _procesarDatos() {
    try {
      const hoy = hoyISO();
      
      // Procesar datos cacheados (función pura)
      const resultado = procesarReservas(
        notificacionesState.reservasCacheadas,
        hoy
      );
      
      // Actualizar state
      notificacionesState.hoy = resultado.hoy;
      notificacionesState.proximos7d = resultado.proximos7d;
      notificacionesState.porPagar = resultado.porPagar;
      notificacionesState.contadores = resultado.contadores;
      notificacionesState.ultimoDíaProcesado = hoy;
      
      // Guardar en localStorage
      this._guardarEnCache();
      
      // Notificar a UI
      this._notificarUI();
    } catch (err) {
      console.error('[notificaciones] Error procesar datos:', err);
    }
  },
  
  /**
   * Detecta si cambió el día (pasó medianoche)
   * Si sí, recalcula para limpiar notificaciones de ayer
   */
  _verificarCambioDedía() {
    const hoy = hoyISO();
    if (notificacionesState.ultimoDíaProcesado !== hoy) {
      limpiarVistosViejos();
      this._procesarDatos();
    }
  },
  
  /**
   * Cargar datos del cache (localStorage)
   * Se ejecuta al init si hay datos guardados
   */
  _cargarDelCache() {
    try {
      const cached = localStorage.getItem('notificaciones_cache');
      if (cached) {
        const data = JSON.parse(cached);
        
        // Restaurar solo campos que se guardan
        if (data.hoy) notificacionesState.hoy = data.hoy;
        if (data.proximos7d) notificacionesState.proximos7d = data.proximos7d;
        if (data.porPagar) notificacionesState.porPagar = data.porPagar;
        if (data.contadores) notificacionesState.contadores = data.contadores;
        if (data.ultimoDíaProcesado) notificacionesState.ultimoDíaProcesado = data.ultimoDíaProcesado;
      }
    } catch (err) {
      console.warn('[notificaciones] Cache corrupto, ignorar:', err);
    }
  },
  
  /**
   * Guardar datos en localStorage para persistencia entre sesiones
   */
  _guardarEnCache() {
    try {
      const toCache = {
        hoy: notificacionesState.hoy,
        proximos7d: notificacionesState.proximos7d,
        porPagar: notificacionesState.porPagar,
        contadores: notificacionesState.contadores,
        ultimoDíaProcesado: notificacionesState.ultimoDíaProcesado
      };
      localStorage.setItem('notificaciones_cache', JSON.stringify(toCache));
    } catch (err) {
      console.warn('[notificaciones] Error guardar en localStorage:', err);
    }
  },
  
  /**
   * Notificar a la UI que hay cambios
   * Usa CustomEvent para desacoplamiento
   */
  _notificarUI() {
    try {
      window.dispatchEvent(new CustomEvent('notificaciones-updated', {
        detail: notificacionesState
      }));
    } catch (err) {
      console.error('[notificaciones] Error dispatch evento:', err);
    }
  }
};
