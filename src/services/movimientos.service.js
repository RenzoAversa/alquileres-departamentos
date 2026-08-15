// ============================================================
// Movimientos financieros: ingresos, egresos y transferencias.
// Al crear/borrar un movimiento, ajusta el SALDO de la(s) cuenta(s)
// en la MISMA escritura en lote (writeBatch + increment). Esto:
//   - mantiene los saldos siempre correctos y atómicos
//   - evita tener que sumar todos los movimientos para saber cuánto hay
// ============================================================
import {
  collection, doc, writeBatch, increment, serverTimestamp,
  getDocs, query, where, orderBy
} from 'firebase/firestore';
import { db } from '../firebase/init.js';
import { BaseService } from './base.service.js';

class MovimientosService extends BaseService {
  constructor() { super('movimientos'); }

  // Aplica el efecto de un movimiento sobre los saldos.
  // signo = +1 al crear, -1 al revertir (borrar).
  _aplicarSaldo(batch, mov, signo) {
    const monto = (Number(mov.monto) || 0) * signo;
    if (mov.tipo === 'ingreso' && mov.cuentaId) {
      batch.update(doc(db, 'cuentas', mov.cuentaId), { saldo: increment(monto) });
    } else if (mov.tipo === 'egreso' && mov.cuentaId) {
      batch.update(doc(db, 'cuentas', mov.cuentaId), { saldo: increment(-monto) });
    } else if (mov.tipo === 'transferencia' && mov.cuentaOrigen && mov.cuentaDestino) {
      batch.update(doc(db, 'cuentas', mov.cuentaOrigen), { saldo: increment(-monto) });
      batch.update(doc(db, 'cuentas', mov.cuentaDestino), { saldo: increment(monto) });
    }
  }

  async crear(data) {
    const batch = writeBatch(db);
    const ref = doc(collection(db, 'movimientos'));
    batch.set(ref, { ...data, creadoEn: serverTimestamp() });
    this._aplicarSaldo(batch, data, +1);
    await batch.commit();
    return { id: ref.id, ...data };
  }

  async eliminar(mov) {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'movimientos', mov.id));
    this._aplicarSaldo(batch, mov, -1); // revierte el saldo
    await batch.commit();
  }

  // Movimientos (pagos) de una reserva
  getByReserva(reservaId) {
    return this.buscar([['reservaId', '==', reservaId]]);
  }

  // Movimientos de un mes (anio, mes 1-12), más nuevos primero.
  async getByMes(anio, mes) {
    const mm = String(mes).padStart(2, '0');
    const desde = `${anio}-${mm}-01`;
    const hasta = `${anio}-${mm}-31`;
    const snap = await getDocs(query(
      collection(db, 'movimientos'),
      where('fecha', '>=', desde),
      where('fecha', '<=', hasta),
      orderBy('fecha', 'desc')
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // Resumen del mes. Las transferencias NO cuentan como ingreso/egreso.
  async resumenMes(anio, mes) {
    const movs = await this.getByMes(anio, mes);
    const suma = (t) => movs.filter((m) => m.tipo === t)
      .reduce((a, m) => a + (Number(m.monto) || 0), 0);
    const ingresos = suma('ingreso');
    const egresos = suma('egreso');
    return { ingresos, egresos, neto: ingresos - egresos, movimientos: movs };
  }
}

export const movimientosService = new MovimientosService();
