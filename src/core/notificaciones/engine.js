// ============================================================
// Engine de notificaciones - Lógica pura
//
// Responsabilidad: Procesar datos cacheados → notificaciones
//                 Sin Firestore, sin escrituras (lee localStorage vía
//                 vistos.js solo para saber qué ya se vio)
// Dependencias: metricas.js, notificaciones/vistos.js
// Tamaño: ~180 líneas
// ============================================================

import { masDias } from '../metricas.js';
import { estaVisto } from './vistos.js';

// Un pago vencido hace mucho no es "novedad de hoy": pasados estos días
// desde el check-in, deja de contar en la pestaña "Hoy" (sigue completo
// y ordenado por urgencia en "Por cobrar", que es donde vive lo crónico).
const DIAS_COBRO_RECIENTE = 3;

// Id determinístico del aviso: no cambia entre recálculos (el engine corre
// cada 60s), así el estado de "visto" en localStorage no se pierde solo.
function idAviso(tipo, reservaId, fecha) {
  return `${tipo}:${reservaId}:${fecha}`;
}

/**
 * Procesa reservas cacheadas y genera notificaciones organizadas
 * 
 * @param {Array} reservas - Array de reservas desde Firestore cache
 * @param {string} hoy - Fecha en formato ISO (YYYY-MM-DD)
 * @returns {Object} Notificaciones organizadas por categoría + contadores
 * 
 * IMPORTANTE: Esta función es PURA (sin queries, sin side effects)
 * Se ejecuta cada 60s sin costo en Firestore
 */
export function procesarReservas(reservas, hoy) {
  if (!Array.isArray(reservas)) {
    console.warn('procesarReservas: reservas no es array', reservas);
    return crearResultadoVacio();
  }

  // Filtrar notificaciones por categoría
  const checkInHoy = filtrarCheckInHoy(reservas, hoy);
  const checkOutHoy = filtrarCheckOutHoy(reservas, hoy);
  const pagoPendienteHoy = filtrarPagoPendienteHoy(reservas, hoy);
  
  const checkInProximos = filtrarCheckInProximos(reservas, hoy);
  const checkOutProximos = filtrarCheckOutProximos(reservas, hoy);
  
  const porPagar = filtrarPorPagar(reservas, hoy);
  
  // Contador de "Hoy": solo lo NO VISTO (si no, la campana no baja nunca
  // aunque el usuario ya haya mirado todo — ver notificaciones/vistos.js).
  const itemsHoy = [...checkInHoy, ...checkOutHoy, ...pagoPendienteHoy];
  const noVistosHoy = itemsHoy.filter(x => !estaVisto(x.avisoId)).length;

  // Calcular contadores
  const contadores = {
    hoy: {
      total: noVistosHoy,
      totalBruto: itemsHoy.length,
      checkIn: checkInHoy.length,
      checkOut: checkOutHoy.length,
      pagoPendiente: pagoPendienteHoy.length
    },
    proximos7d: {
      total: checkInProximos.length + checkOutProximos.length,
      checkIn: checkInProximos.length,
      checkOut: checkOutProximos.length
    },
    porPagar: {
      total: porPagar.length,
      vencidos: porPagar.filter(p => p.diasVencido > 0).length
    }
  };
  
  return {
    hoy: {
      checkIn: checkInHoy,
      checkOut: checkOutHoy,
      pagoPendiente: pagoPendienteHoy
    },
    proximos7d: {
      checkIn: checkInProximos,
      checkOut: checkOutProximos
    },
    porPagar: porPagar,
    contadores: contadores
  };
}

// ===== FILTROS (Funciones puras) =====

/**
 * Reservas con check-in hoy
 */
function filtrarCheckInHoy(reservas, hoy) {
  return reservas
    .filter(r => r.fechaEntrada === hoy && r.estado !== 'cancelada')
    .sort((a, b) => (a.horaEntrada || '00:00').localeCompare(b.horaEntrada || '00:00'))
    .map(r => ({ ...enriquecerReserva(r, hoy), avisoId: idAviso('checkin', r.id, r.fechaEntrada) }));
}

/**
 * Reservas con check-out hoy
 */
function filtrarCheckOutHoy(reservas, hoy) {
  return reservas
    .filter(r => r.fechaSalida === hoy && r.estado !== 'cancelada')
    .sort((a, b) => a.fechaSalida.localeCompare(b.fechaSalida))
    .map(r => ({ ...enriquecerReserva(r, hoy), avisoId: idAviso('checkout', r.id, r.fechaSalida) }));
}

/**
 * Pagos vencidos "recientes" (la reserva ya empezó o es hoy, y no hace
 * demasiado que arrancó — ver DIAS_COBRO_RECIENTE). Lo crónico vive
 * completo en "Por cobrar", no acá.
 */
function filtrarPagoPendienteHoy(reservas, hoy) {
  return reservas
    .filter(r =>
      r.saldo > 0 &&
      r.estado !== 'cancelada' &&
      r.fechaEntrada <= hoy &&  // Reserva ya empezó o es hoy
      calcularDíasVencido(r.fechaEntrada, hoy) <= DIAS_COBRO_RECIENTE
    )
    .map(r => ({
      ...enriquecerReserva(r, hoy),
      diasVencido: calcularDíasVencido(r.fechaEntrada, hoy),
      avisoId: idAviso('cobro', r.id, hoy)
    }))
    .sort((a, b) => b.diasVencido - a.diasVencido); // Más vencidos primero
}

/**
 * Check-in próximos 7 días
 */
function filtrarCheckInProximos(reservas, hoy) {
  const hasta7d = masDias(hoy, 6);
  return reservas
    .filter(r =>
      r.fechaEntrada > hoy &&
      r.fechaEntrada <= hasta7d &&
      r.estado !== 'cancelada'
    )
    .sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada))
    .map(r => ({ ...enriquecerReserva(r, hoy), avisoId: idAviso('checkin', r.id, r.fechaEntrada) }));
}

/**
 * Check-out próximos 7 días
 */
function filtrarCheckOutProximos(reservas, hoy) {
  const hasta7d = masDias(hoy, 6);
  return reservas
    .filter(r =>
      r.fechaSalida > hoy &&
      r.fechaSalida <= hasta7d &&
      r.estado !== 'cancelada'
    )
    .sort((a, b) => a.fechaSalida.localeCompare(b.fechaSalida))
    .map(r => ({ ...enriquecerReserva(r, hoy), avisoId: idAviso('checkout', r.id, r.fechaSalida) }));
}

/**
 * Todas las reservas con saldo pendiente (ordenadas por urgencia).
 * El id de aviso usa `hoy`: es el mismo aviso que el de "Hoy > Falta
 * cobrar" cuando corresponde, y cada día es, a propósito, un recordatorio
 * nuevo (ver notificaciones/vistos.js).
 */
function filtrarPorPagar(reservas, hoy) {
  return reservas
    .filter(r => r.saldo > 0 && r.estado !== 'cancelada')
    .map(r => ({
      ...enriquecerReserva(r, hoy),
      diasVencido: calcularDíasVencido(r.fechaEntrada, hoy),
      avisoId: idAviso('cobro', r.id, hoy)
    }))
    .sort((a, b) => {
      // Ordenar: vencidos primero (días positivos), luego próximos a vencer
      if (a.diasVencido !== b.diasVencido) {
        return b.diasVencido - a.diasVencido;
      }
      // Si tienen igual vencimiento, ordenar por fecha de entrada
      return a.fechaEntrada.localeCompare(b.fechaEntrada);
    });
}

// ===== HELPERS (Funciones puras) =====

/**
 * Enriquece una reserva con datos adicionales útiles para UI
 */
function enriquecerReserva(reserva, hoy) {
  return {
    ...reserva,
    diasDesdeEntrada: calcularDíasVencido(reserva.fechaEntrada, hoy)
  };
}

/**
 * Calcula cuántos días pasaron desde una fecha hasta hoy
 * Retorna: positivo = hace X días | negativo = en X días | 0 = hoy
 */
function calcularDíasVencido(fechaEntrada, hoy) {
  try {
    const entrada = new Date(fechaEntrada + 'T00:00:00Z');
    const ahora = new Date(hoy + 'T00:00:00Z');
    const diff = ahora - entrada;
    const días = Math.floor(diff / (1000 * 60 * 60 * 24));
    return días;
  } catch (err) {
    console.error('calcularDíasVencido: error', { fechaEntrada, hoy, err });
    return 0;
  }
}

/**
 * Retorna un resultado vacío (estructura correcta con arrays vacíos)
 */
function crearResultadoVacio() {
  return {
    hoy: { checkIn: [], checkOut: [], pagoPendiente: [] },
    proximos7d: { checkIn: [], checkOut: [] },
    porPagar: [],
    contadores: {
      hoy: { total: 0, checkIn: 0, checkOut: 0, pagoPendiente: 0 },
      proximos7d: { total: 0, checkIn: 0, checkOut: 0 },
      porPagar: { total: 0, vencidos: 0 }
    }
  };
}
