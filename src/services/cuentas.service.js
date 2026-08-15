// ============================================================
// Cuentas / medios de pago (Efectivo, Transferencia, Mercado Pago…).
// Cada cuenta guarda su SALDO actual, que se actualiza solo en cada
// movimiento (ver movimientos.service.js). Así, mostrar cuánta plata
// hay en cada lado = leer estos pocos documentos (barato).
// ============================================================
import { BaseService } from './base.service.js';

class CuentasService extends BaseService {
  constructor() { super('cuentas'); }

  // Al crear una cuenta, el saldo arranca igual al saldo inicial.
  async create(data) {
    const inicial = Number(data.saldoInicial) || 0;
    return super.create({ ...data, saldoInicial: inicial, saldo: inicial, activa: true });
  }

  // Cuentas iniciales sugeridas para un cliente nuevo.
  async crearIniciales() {
    const base = [
      { nombre: 'Efectivo', tipo: 'efectivo' },
      { nombre: 'Transferencia', tipo: 'banco' },
      { nombre: 'Mercado Pago', tipo: 'billetera' }
    ];
    for (const c of base) {
      await this.create({ ...c, saldoInicial: 0, moneda: 'ARS' });
    }
  }
}

export const cuentasService = new CuentasService();
