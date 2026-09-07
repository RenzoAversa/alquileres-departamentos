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

// Origen del bloqueo de fechas: preparación para sincronización iCal
// (Booking.com/Airbnb) y bloqueos manuales del dueño (ver AUDIT.md, fase 2).
// Todavía no se usa en ningún lado más que acá: hoy toda reserva se crea
// 'interna' (única vía de alta que existe). Los documentos creados antes de
// este campo no lo tienen — origenDe() los trata como 'interna', que es lo
// que efectivamente son.
export const ORIGENES_RESERVA = ['interna', 'manual', 'booking_ics', 'airbnb_ics'];
export function origenDe(reserva) { return reserva?.origen || 'interna'; }

// Solapamiento puro entre un rango [entrada, salida) y una reserva
// existente. Sin dependencias de UI ni de Firestore — la usan tanto el
// chequeo rápido de la UI (verificarDisponibilidad) como la relectura
// transaccional de create() de acá abajo, así los dos nunca pueden
// quedar desalineados.
function _solapa(r, entrada, salida) {
  if (r.estado === 'cancelada') return false;
  const e = new Date(entrada), s = new Date(salida);
  const re = new Date(r.fechaEntrada), rs = new Date(r.fechaSalida);
  return (e >= re && e < rs) || (s > re && s <= rs) || (e <= re && s >= rs);
}

class ReservasService extends BaseService {
  constructor() { super('reservas'); }

  // Alta de una reserva nueva, con el chequeo de solapamiento reforzado
  // dentro de una transacción (ver AUDIT.md hallazgo H2).
  //
  // CONTENCIÓN ARTIFICIAL: Firestore solo aborta una transacción cuando
  // detecta que OTRA escribió un documento que la primera había LEÍDO. Acá
  // cada alta crea un documento de reserva NUEVO (id propio) — si la
  // transacción SOLO releyera las reservas existentes, dos altas
  // concurrentes para la misma unidad podrían leer exactamente el mismo
  // estado (sin escribirlo) y cada una escribir su propio doc nuevo sin
  // que Firestore vea ningún conflicto entre ellas: las dos commitean y
  // termina habiendo doble reserva real, transacción o no. Por eso la
  // transacción también lee y escribe `unidades/{unidadId}/_lock/reservas`
  // (documento chico, dedicado, NO es el doc de la unidad en sí — no
  // dispara los listeners de UI que sí escuchan `unidades/{unidadId}`).
  // Dos altas concurrentes para la misma unidad ahora sí compiten por
  // escribir ese mismo documento de lock: Firestore aborta y reintenta
  // automáticamente una de las dos (runTransaction ya reintenta solo), y
  // en el reintento la relectura de reservas de más abajo ve la reserva
  // de la otra ya commiteada, así que ahí sí se rechaza por solapamiento.
  async create(data) {
    const { unidadId, fechaEntrada, fechaSalida } = data;
    const nuevoRef = doc(this.col);
    const lockRef = unidadId ? doc(db, 'unidades', unidadId, '_lock', 'reservas') : null;

    await runTransaction(db, async (tx) => {
      // Todas las lecturas antes que cualquier escritura (exigencia de
      // Firestore). El get() del lock va primero: es el que hace que dos
      // transacciones concurrentes para la misma unidad efectivamente
      // choquen entre sí (ver comentario de arriba).
      if (lockRef) await tx.get(lockRef);

      // La búsqueda de candidatas queda DENTRO del callback (no es una
      // lectura vía tx.get(), así que no participa del tracking de
      // conflictos de la transacción) para que, si Firestore reintenta
      // esta función por el conflicto del lock, la lista de candidatas
      // también se vuelva a traer fresca en cada intento.
      const candidatas = unidadId ? await this.getByUnidad(unidadId) : [];
      // Relectura puntual DENTRO de la transacción: recién acá el dato es
      // el que Firestore usa para decidir si hay conflicto de verdad.
      const frescas = await Promise.all(
        candidatas.map((r) => tx.get(doc(db, 'reservas', r.id)))
      );
      const ocupado = frescas.some((snap) => snap.exists() && _solapa(snap.data(), fechaEntrada, fechaSalida));
      if (ocupado) {
        const err = new Error('Esa unidad se acaba de reservar en esas fechas (lo hizo otra persona recién). Elegí otro rango o volvé a buscar disponibilidad.');
        err.codigo = 'FECHAS_OCUPADAS';
        throw err;
      }

      tx.set(nuevoRef, { origen: 'interna', ...data, creadoEn: serverTimestamp() });
      if (lockRef) tx.set(lockRef, { ultimaEscritura: serverTimestamp(), ultimaReservaId: nuevoRef.id }, { merge: true });
    });

    return { id: nuevoRef.id, origen: 'interna', ...data };
  }

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
    return !reservas.some((r) => {
      if (excluirId && r.id === excluirId) return false;
      return _solapa(r, entrada, salida);
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
