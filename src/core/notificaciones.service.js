// ============================================================
// Servicio de notificaciones - Orquestador
//
// Responsabilidad: Coordinar state + engine + listener + UI
// Dependencias: notificaciones/state.js, .../engine.js, .../listener.js, metricas.js, ui.js
// Tamaño: ~250 líneas
//
// PUBLIC API:
//   init()                 - Inicializar (llamar UNA vez al autenticarse)
//   getEstado()             - Obtener estado actual
//   getContadores()         - Solo contadores (para badge)
//   getReservasRecientes()  - Reservas de fechaSalida >= hoy-7, para que
//                             otras pantallas (el Panel) las reusen en vez
//                             de pedirlas de nuevo (ver más abajo)
//   cleanup()               - Limpiar (al logout)
// ============================================================

import { notificacionesState, resetearState } from './notificaciones/state.js';
import { procesarReservas } from './notificaciones/engine.js';
import { activarListener, desactivarListener } from './notificaciones/listener.js';
import { estaVisto, alternarVisto, marcarTodosVistos, limpiarVistosViejos, resetearVistos } from './notificaciones/vistos.js';
import { hoyISO, masDias } from './metricas.js';
import { toast } from './ui.js';
import { reservasService } from '../services/reservas.service.js';

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
   * Reservas con fechaSalida >= hoy-7 (activas y futuras), ya frescas —
   * es el mismo rango que mantiene vivo el listener de notificaciones, así
   * que otras pantallas (el Panel) las reusan en vez de pedirlas de nuevo.
   *
   * Espera a que el listener esté inicializado (init() es idempotente: si
   * ya corrió, no hace nada de nuevo) y, si para entonces todavía no llegó
   * el primer snapshot real (timeout, sin conexión, error), NO devuelve el
   * array vacío por las dudas — hace ella misma una consulta directa como
   * respaldo. Nunca deja a quien la llama esperando para siempre ni le da
   * un dato que podría estar vacío solo por timing.
   *
   * @returns {Promise<Array>}
   */
  async getReservasRecientes() {
    try { await this.init(); } catch { /* init() ya logueó y limpió */ }
    if (notificacionesState.primerSnapshotListo) {
      return notificacionesState.reservasCacheadas;
    }
    return reservasService.buscar([['fechaSalida', '>=', masDias(hoyISO(), -7)]]);
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
    // 0. Invalida cualquier _inicializarInterno() en curso: si estaba a
    //    mitad de camino esperando el primer snapshot (o su timeout de
    //    6s) cuando se llamó a este cleanup(), esa espera puede resolver
    //    recién segundos después de este punto. Sin este token, esa
    //    continuación tardía repoblaría notificacionesState (y
    //    localStorage) con datos de la sesión que ya cerró — si para
    //    entonces ya entró OTRO usuario, vería por un instante avisos que
    //    no son suyos.
    this._token = (this._token || 0) + 1;

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
    // Token propio de esta inicialización: si cleanup() corre mientras
    // estamos esperando `listo` más abajo, bumpea this._token y esta
    // continuación se da cuenta y no sigue (ver cleanup() para el detalle).
    const miToken = (this._token = (this._token || 0) + 1);
    try {
      // 1. Cargar del cache (localStorage)
      this._cargarDelCache();

      // 1.b Avisos vistos de días anteriores ya no sirven: se descartan
      //     para que el localStorage no crezca sin control.
      limpiarVistosViejos();

      // 2. Activar listener Firestore. `unsubscribe` queda guardado DE UNA
      //    (sincrónico), antes de esperar nada: si justo ahora se llama a
      //    cleanup() (ej. un logout rápido), tiene que poder cortar la
      //    suscripción real aunque el primer snapshot todavía no haya
      //    llegado — si no, el listener quedaría corriendo en segundo
      //    plano para siempre (fuga). `listo` sí espera al primer snapshot
      //    real (o hasta 6s si Firestore no contesta, ver listener.js)
      //    antes de seguir, para que reservasCacheadas ya esté poblado.
      //    Costo: carga inicial = 1 lectura por documento del rango; cada
      //    cambio posterior en un documento de ese rango también factura
      //    1 lectura (no es gratis, ver core/notificaciones/listener.js).
      const { unsubscribe, listo } = activarListener();
      this._unsubscribe = unsubscribe;
      await listo;

      // Si mientras esperábamos `listo` alguien llamó a cleanup() (logout
      // rápido), este token ya no es el vigente: no seguir, no pisar el
      // estado de la sesión (o el usuario) que vino después.
      if (this._token !== miToken) return;

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
      if (this._token !== miToken) return; // idem: ya no es relevante
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
