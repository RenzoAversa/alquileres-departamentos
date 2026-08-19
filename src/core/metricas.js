// ============================================================
// Cálculos de métricas y períodos (funciones puras y testeables).
// Se usan tanto en el Dashboard como en el exportador de Excel, así
// los números SIEMPRE coinciden. Fechas manejadas en UTC para evitar
// desfasajes por zona horaria / horario de verano.
// ============================================================

const DIA_MS = 86400000;
const parse = (iso) => new Date(iso + 'T00:00:00Z');

// Fecha de HOY según el reloj local del dispositivo (no UTC): usar
// toISOString() acá desfasaba un día entero en husos horarios negativos
// (ej. Argentina, UTC-3) durante la noche, porque la hora UTC ya había
// cruzado la medianoche del día siguiente.
export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const LETRA_DIA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

// Día de la semana (0=domingo) de una fecha ISO, en UTC (sin desfasajes).
export function diaSemana(iso) {
  return parse(iso).getUTCDay();
}

export function letraDia(iso) {
  return LETRA_DIA[diaSemana(iso)];
}

// Todas las fechas ISO de un mes calendario (1..último día).
export function diasDelMes(anio, mes) {
  const mm = String(mes).padStart(2, '0');
  const total = new Date(anio, mes, 0).getDate();
  const dias = [];
  for (let d = 1; d <= total; d++) dias.push(`${anio}-${mm}-${String(d).padStart(2, '0')}`);
  return dias;
}

export function masDias(iso, d) {
  const dt = parse(iso);
  dt.setUTCDate(dt.getUTCDate() + d);
  return dt.toISOString().slice(0, 10);
}

// Cantidad de días de un rango inclusivo [desde, hasta]
export function diasDe(desde, hasta) {
  return Math.round((parse(hasta) - parse(desde)) / DIA_MS) + 1;
}

// Período inmediatamente anterior del mismo largo
export function periodoAnterior(desde, hasta) {
  const len = diasDe(desde, hasta);
  return { desde: masDias(desde, -len), hasta: masDias(desde, -1) };
}

// Noches de una reserva que caen dentro de [desde, hasta] inclusive.
// La reserva ocupa las noches [entrada, salida) (salida NO se cuenta).
export function nochesEnRango(reserva, desde, hasta) {
  if (reserva.estado === 'cancelada') return 0;
  const e = parse(reserva.fechaEntrada);
  const s = parse(reserva.fechaSalida);           // exclusivo
  const d0 = parse(desde);
  const d1 = parse(hasta); d1.setUTCDate(d1.getUTCDate() + 1); // exclusivo
  const ini = Math.max(e, d0);
  const fin = Math.min(s, d1);
  return Math.max(0, Math.round((fin - ini) / DIA_MS));
}

// Ingresos / egresos / neto de los movimientos con fecha en [desde, hasta]
export function resumenMovimientos(movimientos, desde, hasta) {
  const enRango = movimientos.filter((m) => m.fecha >= desde && m.fecha <= hasta);
  const suma = (t) => enRango.filter((m) => m.tipo === t).reduce((a, m) => a + (Number(m.monto) || 0), 0);
  const ingresos = suma('ingreso');
  const egresos = suma('egreso');
  return { ingresos, egresos, neto: ingresos - egresos };
}

// Métricas de reservas/ocupación para [desde, hasta]
export function metricasOcupacion(reservas, cantUnidades, desde, hasta) {
  const dias = diasDe(desde, hasta);
  const nochesDisponibles = Math.max(0, cantUnidades) * dias;
  const nochesVendidas = reservas.reduce((a, r) => a + nochesEnRango(r, desde, hasta), 0);
  const ocupacion = nochesDisponibles ? (nochesVendidas / nochesDisponibles) * 100 : 0;
  // "reservas" del período = check-ins dentro del rango
  const reservasEnRango = reservas.filter(
    (r) => r.estado !== 'cancelada' && r.fechaEntrada >= desde && r.fechaEntrada <= hasta
  ).length;
  return { nochesVendidas, nochesDisponibles, ocupacion, reservas: reservasEnRango };
}

// Todas las métricas de un período, en un solo objeto
export function metricasPeriodo(movimientos, reservas, cantUnidades, desde, hasta) {
  const fin = resumenMovimientos(movimientos, desde, hasta);
  const ocu = metricasOcupacion(reservas, cantUnidades, desde, hasta);
  return { ...fin, ...ocu, desde, hasta };
}

// Variación porcentual (para las flechas del dashboard)
export function variacion(actual, anterior) {
  if (!anterior) return actual ? null : 0; // null = "nuevo" (antes era 0)
  return Math.round(((actual - anterior) / Math.abs(anterior)) * 100);
}

// Rentabilidad por unidad en [desde, hasta]: ingresos - egresos imputados
// (movimientos con `unidadId`, incluye los pagos de reserva que ya lo traen).
// Recibe los movimientos YA cargados (una sola consulta) para no pegarle
// de nuevo a Firestore por cada unidad.
export function rentabilidadPorUnidad(movimientos, unidades, desde, hasta) {
  const enRango = movimientos.filter((m) => m.unidadId && m.fecha >= desde && m.fecha <= hasta);
  return unidades.map((u) => {
    const propios = enRango.filter((m) => m.unidadId === u.id);
    const ingresos = propios.filter((m) => m.tipo === 'ingreso').reduce((a, m) => a + (Number(m.monto) || 0), 0);
    const egresos = propios.filter((m) => m.tipo === 'egreso').reduce((a, m) => a + (Number(m.monto) || 0), 0);
    return { unidad: u, ingresos, egresos, neto: ingresos - egresos };
  });
}

// Últimos `n` meses calendario (el más viejo primero), con su rango de
// fechas ISO y una etiqueta corta para gráficos ("ago '26").
export function ultimosMeses(n, refFecha = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(refFecha.getFullYear(), refFecha.getMonth() - i, 1);
    const anio = d.getFullYear();
    const mes = d.getMonth() + 1;
    const mm = String(mes).padStart(2, '0');
    const ultimoDia = new Date(anio, mes, 0).getDate();
    out.push({
      anio, mes,
      desde: `${anio}-${mm}-01`,
      hasta: `${anio}-${mm}-${String(ultimoDia).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
    });
  }
  return out;
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function finDeMes(iso) {
  const [anio, mes] = iso.split('-').map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
}

function inicioMesSiguiente(iso) {
  const [anio, mes] = iso.split('-').map(Number);
  const anioSig = mes === 12 ? anio + 1 : anio;
  const mesSig = mes === 12 ? 1 : mes + 1;
  return `${anioSig}-${String(mesSig).padStart(2, '0')}-01`;
}

function labelDiaMes(iso) {
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${MESES_CORTOS[parseInt(m, 10) - 1]}`;
}

function labelRangoSemana(desde, hasta) {
  const [, m1, d1] = desde.split('-');
  const [, m2, d2] = hasta.split('-');
  if (m1 === m2) return `${parseInt(d1, 10)}-${parseInt(d2, 10)} ${MESES_CORTOS[parseInt(m1, 10) - 1]}`;
  return `${labelDiaMes(desde)}-${labelDiaMes(hasta)}`;
}

function labelMes(iso) {
  const [a, m] = iso.split('-');
  return `${MESES_CORTOS[parseInt(m, 10) - 1]} '${a.slice(2)}`;
}

// Divide [desde, hasta] en "buckets" para graficar ocupación a lo largo de
// un período de cualquier largo, sin que un rango de 30+ días termine
// mostrando una barra por día (ilegible en mobile):
//   - hasta 10 días: un bucket por día
//   - 11 a 60 días:  un bucket por semana (7 días, el último puede ser más corto)
//   - más de 60 días: un bucket por mes calendario (el primero y el último
//     pueden ser parciales si el rango no arranca/termina en 1° de mes)
// Cada bucket trae su propio [desde, hasta] listo para pasarle a
// metricasOcupacion(), y un label corto para el eje del gráfico.
export function bucketsOcupacion(desde, hasta) {
  const dias = diasDe(desde, hasta);

  if (dias <= 10) {
    const out = [];
    for (let i = 0; i < dias; i++) {
      const d = masDias(desde, i);
      out.push({ desde: d, hasta: d, label: labelDiaMes(d) });
    }
    return out;
  }

  if (dias <= 60) {
    const out = [];
    let cur = desde;
    while (cur <= hasta) {
      const finSemana = masDias(cur, 6);
      const fin = finSemana > hasta ? hasta : finSemana;
      out.push({ desde: cur, hasta: fin, label: labelRangoSemana(cur, fin) });
      cur = masDias(fin, 1);
    }
    return out;
  }

  const out = [];
  let cur = desde;
  while (cur <= hasta) {
    const finMes = finDeMes(cur);
    const fin = finMes > hasta ? hasta : finMes;
    out.push({ desde: cur, hasta: fin, label: labelMes(cur) });
    cur = inicioMesSiguiente(cur);
  }
  return out;
}
