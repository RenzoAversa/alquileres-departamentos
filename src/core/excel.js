// ============================================================
// Exportador a Excel (.xlsx).
//   - Carga la librería on-demand (no pesa la app si no exportás).
//   - Genera TODO en el navegador (cero costo de servidor).
//   - Encabezados con color, anchos de columna y formato de miles,
//     para que los Excel se vean siempre bien y sin errores.
// Un solo reporte con varias hojas: Resumen, Movimientos, Reservas,
// Ocupación y Saldos, para el rango [desde, hasta].
// ============================================================
import { movimientosService } from '../services/movimientos.service.js';
import { reservasService } from '../services/reservas.service.js';
import { unidadesService } from '../services/unidades.service.js';
import { edificiosService } from '../services/edificios.service.js';
import { cuentasService } from '../services/cuentas.service.js';
import {
  resumenMovimientos, metricasOcupacion, nochesEnRango, diasDe
} from './metricas.js';
import { estadoPagoDe, ETIQUETAS_PAGO } from '../services/reservas.service.js';
import { toast } from './ui.js';

let promesa = null;
function cargarSheetJS() {
  if (window.XLSX) return Promise.resolve();
  if (promesa) return promesa;
  promesa = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    // xlsx-js-style: SheetJS con soporte de estilos (encabezados con color/negrita)
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar el exportador'));
    document.head.append(s);
  });
  return promesa;
}

// ---- Estilos ----
const BORDE = { style: 'thin', color: { rgb: 'E2E8F0' } };
const ESTILO_HEADER = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
  fill: { fgColor: { rgb: '2563EB' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE }
};
const ESTILO_TOTAL = { font: { bold: true }, border: { top: { style: 'thin', color: { rgb: 'CBD5E1' } } } };

const fmtFecha = (iso) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};

// Construye una hoja estilizada a partir de encabezados + filas.
function hoja(headers, filas, { moneyCols = [], anchos = null, total = null } = {}) {
  const XLSX = window.XLSX;
  const aoa = [headers, ...filas];
  if (total) aoa.push(total);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws['!ref']);

  ws['!cols'] = (anchos || headers.map(() => 18)).map((w) => ({ wch: w }));

  for (let C = 0; C <= range.e.c; C++) {
    const a = XLSX.utils.encode_cell({ r: 0, c: C });
    if (ws[a]) ws[a].s = ESTILO_HEADER;
  }
  const ultima = range.e.r;
  for (let R = 1; R <= ultima; R++) {
    const esTotal = total && R === ultima;
    for (let C = 0; C <= range.e.c; C++) {
      const a = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[a];
      if (!cell) continue;
      if (moneyCols.includes(C) && typeof cell.v === 'number') cell.z = '#,##0';
      if (esTotal) cell.s = { ...(cell.s || {}), ...ESTILO_TOTAL };
    }
  }
  return ws;
}

export async function exportarReporte({ desde, hasta }) {
  try {
    await cargarSheetJS();
  } catch {
    toast('No se pudo cargar el exportador. Revisá tu conexión.', 'alerta');
    return;
  }
  const XLSX = window.XLSX;

  // Datos acotados al período (pocas lecturas)
  const [movs, reservasRaw, unidades, edificios, cuentas] = await Promise.all([
    movimientosService.buscar([['fecha', '>=', desde], ['fecha', '<=', hasta]], ['fecha', 'asc']),
    reservasService.buscar([['fechaSalida', '>=', desde]]),
    unidadesService.getAll(),
    edificiosService.getAll(),
    cuentasService.getAll()
  ]);
  const reservas = reservasRaw.filter((r) => r.fechaEntrada <= hasta); // solapan el período
  const nombreEd = (id) => edificios.find((e) => e.id === id)?.nombre || 'Sin edificio';
  const nombreCta = (id) => cuentas.find((c) => c.id === id)?.nombre || '—';

  const fin = resumenMovimientos(movs, desde, hasta);
  const ocu = metricasOcupacion(reservas, unidades.length, desde, hasta);

  const wb = XLSX.utils.book_new();

  // ---- Hoja Resumen ----
  const pct = (n) => `${Math.round(n)}%`;
  const wsResumen = hoja(
    ['Indicador', 'Valor'],
    [
      ['Período', `${fmtFecha(desde)} a ${fmtFecha(hasta)}`],
      ['Días', diasDe(desde, hasta)],
      ['Ingresos', fin.ingresos],
      ['Gastos', fin.egresos],
      ['Resultado neto', fin.neto],
      ['Noches vendidas', ocu.nochesVendidas],
      ['Noches disponibles', ocu.nochesDisponibles],
      ['Ocupación', pct(ocu.ocupacion)],
      ['Reservas (check-in en el período)', ocu.reservas]
    ],
    { moneyCols: [1], anchos: [34, 22] }
  );
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  // ---- Hoja Movimientos ----
  const filasMov = movs.map((m) => [
    fmtFecha(m.fecha),
    m.tipo === 'ingreso' ? 'Ingreso' : m.tipo === 'egreso' ? 'Gasto' : 'Transferencia',
    m.categoria || '',
    m.tipo === 'transferencia' ? `${nombreCta(m.cuentaOrigen)} → ${nombreCta(m.cuentaDestino)}` : nombreCta(m.cuentaId),
    m.descripcion || '',
    m.tipo === 'egreso' ? -(Number(m.monto) || 0) : (Number(m.monto) || 0)
  ]);
  const totalMovs = movs.reduce((a, m) => a + (m.tipo === 'egreso' ? -(Number(m.monto) || 0) : (m.tipo === 'ingreso' ? (Number(m.monto) || 0) : 0)), 0);
  const wsMov = hoja(
    ['Fecha', 'Tipo', 'Categoría', 'Cuenta', 'Descripción', 'Monto'],
    filasMov,
    { moneyCols: [5], anchos: [12, 14, 16, 26, 34, 16], total: ['', '', '', '', 'Neto ingresos - gastos', totalMovs] }
  );
  XLSX.utils.book_append_sheet(wb, wsMov, 'Movimientos');

  // ---- Hoja Reservas ----
  const filasRes = reservas
    .slice()
    .sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada))
    .map((r) => {
      const total = Number(r.precioTotal) || 0;
      const pagado = Number(r.pagado) || 0;
      return [
        r.huesped?.nombre || '',
        r.unidadNombre || '',
        nombreEd(r.edificioId),
        fmtFecha(r.fechaEntrada),
        fmtFecha(r.fechaSalida),
        Number(r.noches) || 0,
        total,
        pagado,
        total - pagado,
        ETIQUETAS_PAGO[estadoPagoDe(pagado, total)].label,
        r.estado || '',
        r.canal || ''
      ];
    });
  const wsRes = hoja(
    ['Huésped', 'Unidad', 'Edificio', 'Entrada', 'Salida', 'Noches', 'Total', 'Pagado', 'Saldo', 'Estado pago', 'Estado', 'Canal'],
    filasRes,
    { moneyCols: [6, 7, 8], anchos: [22, 16, 18, 12, 12, 8, 14, 14, 14, 14, 13, 12] }
  );
  XLSX.utils.book_append_sheet(wb, wsRes, 'Reservas');

  // ---- Hoja Ocupación (por unidad) ----
  const dias = diasDe(desde, hasta);
  const filasOcu = unidades.map((u) => {
    const rs = reservas.filter((r) => r.unidadId === u.id);
    const noches = rs.reduce((a, r) => a + nochesEnRango(r, desde, hasta), 0);
    const ocupUnidad = dias ? Math.round((noches / dias) * 100) : 0;
    return [u.nombre, nombreEd(u.edificioId), noches, dias, `${ocupUnidad}%`];
  });
  const wsOcu = hoja(
    ['Unidad', 'Edificio', 'Noches vendidas', 'Noches disponibles', 'Ocupación'],
    filasOcu,
    { anchos: [18, 18, 18, 20, 14] }
  );
  XLSX.utils.book_append_sheet(wb, wsOcu, 'Ocupación');

  // ---- Hoja Saldos ----
  const filasCta = cuentas.map((c) => [c.nombre, c.tipo || '', Number(c.saldo) || 0]);
  const totalCta = cuentas.reduce((a, c) => a + (Number(c.saldo) || 0), 0);
  const wsCta = hoja(
    ['Cuenta', 'Tipo', 'Saldo actual'],
    filasCta,
    { moneyCols: [2], anchos: [22, 16, 18], total: ['', 'Total', totalCta] }
  );
  XLSX.utils.book_append_sheet(wb, wsCta, 'Saldos');

  XLSX.writeFile(wb, `reporte_${desde}_a_${hasta}.xlsx`);
  toast('Excel generado', 'ok');
}
