// ============================================================
// Reservas: disponibilidad + gestión de PAGOS.
// Un pago = un movimiento de ingreso (afecta el saldo de la cuenta)
// vinculado a la reserva. Al registrar/anular un pago se actualiza,
// en la MISMA escritura en lote y de forma atómica:
//   1) el movimiento (ledger de caja)
//   2) el saldo de la cuenta (increment)
//   3) el estado de pago de la reserva (pagado / saldo / estadoPago)
// ============================================================
import {
  collection, doc, writeBatch, increment, serverTimestamp, updateDoc, runTransaction
} from 'firebase/firestore';
import { db } from '../firebase/init.js';
import { BaseService } from './base.service.js';
import { movimientosService } from './movimientos.service.js';

// Estado de pago derivado de lo pagado vs el total
export function estadoPagoDe(pagado, total) {
  const p = Number(pagado) || 0;
  const t = Number(total) || 0;
  if (p <= 0) return 'sin_pagar';
  if (p >= t && t > 0) return 'pagado';
  if (p >= t && t === 0) return 'pagado';
  return 'parcial';
}

// Etiquetas + clase de color para la UI
export const ETIQUETAS_PAGO = {
  sin_pagar: { label: 'Sin pagar', clase: 'badge--alerta' },
  parcial:   { label: 'Pago parcial', clase: 'badge--warn' },
  pagado:    { label: 'Pagado', clase: 'badge--ok' }
};

// Estados operativos de la reserva
export const ESTADOS_RESERVA = ['pendiente', 'confirmada', 'finalizada', 'cancelada'];

class ReservasService extends BaseService {
  constructor() { super('reservas'); }

  getByUnidad(unidadId) {
    return this.buscar([['unidadId', '==', unidadId]]);
  }

  // Noches entre dos fechas ISO (sin dependencias de UI)
  _noches(entrada, salida) {
    return Math.max(0, Math.round((new Date(salida) - new Date(entrada)) / 86400000));
  }

  // Editar una reserva: recalcula noches/total y reajusta el estado de
  // pago según lo YA pagado (los pagos existentes no se tocan).
  // `cambios`: { unidadId, unidadNombre, edificioId, huesped, fechaEntrada, fechaSalida, canal }
  // `precioTotal`: ya calculado por el llamador (contempla tarifas por temporada).
  async editar(reserva, cambios, precioTotal) {
    const noches = this._noches(cambios.fechaEntrada, cambios.fechaSalida);
    const total = Number(precioTotal) || 0;
    const pagado = Number(reserva.pagado) || 0;
    const datos = {
      ...cambios,
      noches,
      precioTotal: total,
      saldo: total - pagado,
      estadoPago: estadoPagoDe(pagado, total),
      actualizadoEn: serverTimestamp()
    };
    await updateDoc(doc(db, 'reservas', reserva.id), datos);
    return { ...reserva, ...datos };
  }

  // Disponibilidad: detecta solapamiento de fechas para una unidad.
  async verificarDisponibilidad(unidadId, entrada, salida, excluirId = null) {
    const reservas = await this.getByUnidad(unidadId);
    const e = new Date(entrada);
    const s = new Date(salida);
    return !reservas.some((r) => {
      if (excluirId && r.id === excluirId) return false;
      if (r.estado === 'cancelada') return false;
      const re = new Date(r.fechaEntrada);
      const rs = new Date(r.fechaSalida);
      return (e >= re && e < rs) || (s > re && s <= rs) || (e <= re && s >= rs);
    });
  }

  // Registrar un pago: crea el ingreso, suma al saldo de la cuenta y
  // actualiza el estado de pago de la reserva. Todo atómico.
  // Usa una transacción (en vez de un writeBatch directo) porque acá SÍ
  // importa evitar la carrera de 2 pestañas/dispositivos pagando la misma
  // reserva al mismo tiempo: la transacción relee el documento fresco y
  // rechaza el pago si, para cuando se resuelve, la reserva ya está
  // totalmente paga o el monto ya no entra en el saldo real. Cuesta 1
  // lectura extra por pago (aceptable: los pagos no son una operación
  // frecuente).
  async registrarPago(reserva, { monto, cuentaId, fecha, nota = '' }) {
    const m = Number(monto) || 0;
    const reservaRef = doc(db, 'reservas', reserva.id);
    const movRef = doc(collection(db, 'movimientos'));
    let resultado;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(reservaRef);
      if (!snap.exists()) throw new Error('La reserva ya no existe.');
      const actual = snap.data();
      const total = Number(actual.precioTotal) || 0;
      const pagadoActual = Number(actual.pagado) || 0;
      const saldoActual = total - pagadoActual;

      if (saldoActual <= 0) {
        const err = new Error('Esta reserva ya está totalmente paga.');
        err.codigo = 'PAGO_COMPLETO';
        throw err;
      }
      if (m > saldoActual + 0.001) {
        const err = new Error(`El pago no puede superar el saldo real (${saldoActual}).`);
        err.codigo = 'MONTO_EXCEDE_SALDO';
        throw err;
      }

      const nuevoPagado = pagadoActual + m;

      // 1) Movimiento (ingreso vinculado a la reserva)
      tx.set(movRef, {
        tipo: 'ingreso',
        categoria: 'ingreso_reserva',
        monto: m,
        moneda: reserva.moneda || 'ARS',
        fecha,
        cuentaId,
        reservaId: reserva.id,
        unidadId: reserva.unidadId || null,
        descripcion: `Pago reserva ${reserva.unidadNombre || ''} — ${reserva.huesped?.nombre || ''}`.trim(),
        nota,
        creadoEn: serverTimestamp()
      });

      // 2) Saldo de la cuenta
      tx.update(doc(db, 'cuentas', cuentaId), { saldo: increment(m) });

      // 3) Estado de pago de la reserva
      const saldoNuevo = total - nuevoPagado;
      const estadoPago = estadoPagoDe(nuevoPagado, total);
      tx.update(reservaRef, {
        pagado: nuevoPagado,
        saldo: saldoNuevo,
        estadoPago,
        actualizadoEn: serverTimestamp()
      });
      resultado = { pagado: nuevoPagado, saldo: saldoNuevo, estadoPago, total };
    });

    return { id: movRef.id, monto: m, cuentaId, fecha, ...resultado };
  }

  // Anular un pago (revierte todo)
  async anularPago(reserva, movimiento) {
    const m = Number(movimiento.monto) || 0;
    const total = Number(reserva.precioTotal) || 0;
    const nuevoPagado = Math.max(0, (Number(reserva.pagado) || 0) - m);

    const batch = writeBatch(db);
    batch.delete(doc(db, 'movimientos', movimiento.id));
    batch.update(doc(db, 'cuentas', movimiento.cuentaId), { saldo: increment(-m) });
    batch.update(doc(db, 'reservas', reserva.id), {
      pagado: nuevoPagado,
      saldo: total - nuevoPagado,
      estadoPago: estadoPagoDe(nuevoPagado, total),
      actualizadoEn: serverTimestamp()
    });
    await batch.commit();
  }

  // Eliminar una reserva: si tiene pagos registrados, revierte el saldo de
  // cada cuenta afectada y borra esos movimientos en la misma escritura,
  // para no dejar en Finanzas movimientos "Pago de reserva" huérfanos
  // (sin reserva a la que pertenecer, e imposibles de borrar desde ahí).
  async remove(id) {
    const pagos = await movimientosService.getByReserva(id);
    const batch = writeBatch(db);
    for (const mov of pagos) {
      batch.delete(doc(db, 'movimientos', mov.id));
      const m = Number(mov.monto) || 0;
      if (mov.cuentaId) batch.update(doc(db, 'cuentas', mov.cuentaId), { saldo: increment(-m) });
    }
    batch.delete(doc(db, 'reservas', id));
    await batch.commit();
    return true;
  }
}

export const reservasService = new ReservasService();
