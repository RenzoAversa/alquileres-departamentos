// Tests de core/metricas.js: funciones puras de fechas/ocupación/ingresos
// compartidas entre Dashboard y el export a Excel. Sin Firebase, sin
// emulador — corren con `node --test tests/metricas.test.js`.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  hoyISO, diaSemana, letraDia, diasDelMes, masDias, diasDe, periodoAnterior,
  nochesEnRango, resumenMovimientos, metricasOcupacion, metricasPeriodo,
  variacion, rentabilidadPorUnidad, ultimosMeses, bucketsOcupacion
} from '../src/core/metricas.js';

describe('hoyISO', () => {
  test('devuelve una fecha ISO (YYYY-MM-DD) que coincide con el reloj local', () => {
    const iso = hoyISO();
    assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);
    const d = new Date();
    const esperado = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    assert.equal(iso, esperado);
  });
});

describe('diaSemana / letraDia', () => {
  test('2026-09-07 es lunes (1)', () => {
    assert.equal(diaSemana('2026-09-07'), 1);
    assert.equal(letraDia('2026-09-07'), 'L');
  });
  test('2026-09-06 es domingo (0)', () => {
    assert.equal(diaSemana('2026-09-06'), 0);
    assert.equal(letraDia('2026-09-06'), 'D');
  });
});

describe('diasDelMes', () => {
  test('febrero bisiesto (2028) tiene 29 días', () => {
    const dias = diasDelMes(2028, 2);
    assert.equal(dias.length, 29);
    assert.equal(dias[0], '2028-02-01');
    assert.equal(dias[28], '2028-02-29');
  });
  test('febrero no bisiesto (2026) tiene 28 días', () => {
    assert.equal(diasDelMes(2026, 2).length, 28);
  });
});

describe('masDias', () => {
  test('suma días cruzando fin de mes', () => {
    assert.equal(masDias('2026-01-30', 3), '2026-02-02');
  });
  test('resta días cruzando fin de año', () => {
    assert.equal(masDias('2026-01-02', -5), '2025-12-28');
  });
  test('cruza el cambio de horario de verano en Argentina sin desfasarse (fechas ancladas a UTC)', () => {
    // Argentina no tiene DST hoy, pero esta prueba deja registrado que el
    // cálculo es puramente en UTC (no debería importar el huso del que
    // corre el test).
    assert.equal(masDias('2026-03-01', 1), '2026-03-02');
  });
});

describe('diasDe', () => {
  test('rango de un solo día = 1', () => {
    assert.equal(diasDe('2026-05-10', '2026-05-10'), 1);
  });
  test('rango inclusivo de una semana = 7', () => {
    assert.equal(diasDe('2026-05-10', '2026-05-16'), 7);
  });
});

describe('periodoAnterior', () => {
  test('período de 7 días => el anterior también son 7 días, sin superponerse', () => {
    const p = periodoAnterior('2026-05-08', '2026-05-14');
    assert.deepEqual(p, { desde: '2026-05-01', hasta: '2026-05-07' });
  });
});

describe('nochesEnRango', () => {
  const base = { fechaEntrada: '2026-06-10', fechaSalida: '2026-06-15', estado: 'confirmada' };
  test('reserva completamente dentro del rango: todas las noches cuentan', () => {
    assert.equal(nochesEnRango(base, '2026-06-01', '2026-06-30'), 5);
  });
  test('rango que corta la reserva por la mitad: solo las noches que caen adentro', () => {
    assert.equal(nochesEnRango(base, '2026-06-12', '2026-06-30'), 3); // 12,13,14
  });
  test('la noche de salida (checkout) no cuenta', () => {
    assert.equal(nochesEnRango(base, '2026-06-15', '2026-06-20'), 0);
  });
  test('reserva cancelada no aporta noches', () => {
    assert.equal(nochesEnRango({ ...base, estado: 'cancelada' }, '2026-06-01', '2026-06-30'), 0);
  });
  test('rango totalmente afuera de la reserva: 0', () => {
    assert.equal(nochesEnRango(base, '2026-07-01', '2026-07-10'), 0);
  });
});

describe('resumenMovimientos', () => {
  const movs = [
    { tipo: 'ingreso', monto: 1000, fecha: '2026-05-05' },
    { tipo: 'ingreso', monto: 500, fecha: '2026-05-10' },
    { tipo: 'egreso', monto: 300, fecha: '2026-05-06' },
    { tipo: 'transferencia', monto: 200, fecha: '2026-05-06' }, // no debe sumar
    { tipo: 'ingreso', monto: 9999, fecha: '2026-04-01' } // fuera de rango
  ];
  test('suma ingresos/egresos dentro del rango; ignora transferencias y fechas afuera', () => {
    const r = resumenMovimientos(movs, '2026-05-01', '2026-05-31');
    assert.deepEqual(r, { ingresos: 1500, egresos: 300, neto: 1200 });
  });
});

describe('metricasOcupacion', () => {
  const reservas = [
    { fechaEntrada: '2026-06-01', fechaSalida: '2026-06-06', estado: 'confirmada' }, // 5 noches
    { fechaEntrada: '2026-06-10', fechaSalida: '2026-06-12', estado: 'confirmada' }, // 2 noches
    { fechaEntrada: '2026-06-15', fechaSalida: '2026-06-20', estado: 'cancelada' }   // no cuenta
  ];
  test('ocupación = noches vendidas / (unidades * días del período)', () => {
    const m = metricasOcupacion(reservas, 2, '2026-06-01', '2026-06-30'); // 30 días * 2 unidades = 60 noches disponibles
    assert.equal(m.nochesVendidas, 7);
    assert.equal(m.nochesDisponibles, 60);
    assert.equal(Math.round(m.ocupacion * 100) / 100, Math.round((7 / 60) * 10000) / 100);
    assert.equal(m.reservas, 2); // 2 check-ins en el rango, la cancelada no cuenta
  });
  test('sin unidades, ocupación es 0 (no divide por cero)', () => {
    const m = metricasOcupacion(reservas, 0, '2026-06-01', '2026-06-30');
    assert.equal(m.nochesDisponibles, 0);
    assert.equal(m.ocupacion, 0);
  });
});

describe('metricasPeriodo', () => {
  test('combina resumen de movimientos + ocupación en un solo objeto', () => {
    const movs = [{ tipo: 'ingreso', monto: 1000, fecha: '2026-06-05' }];
    const reservas = [{ fechaEntrada: '2026-06-01', fechaSalida: '2026-06-04', estado: 'confirmada' }];
    const m = metricasPeriodo(movs, reservas, 1, '2026-06-01', '2026-06-30');
    assert.equal(m.ingresos, 1000);
    assert.equal(m.nochesVendidas, 3);
    assert.equal(m.desde, '2026-06-01');
    assert.equal(m.hasta, '2026-06-30');
  });
});

describe('variacion', () => {
  test('sube 20%', () => assert.equal(variacion(120, 100), 20));
  test('baja 25%', () => assert.equal(variacion(75, 100), -25));
  test('anterior 0 y actual > 0 => null ("nuevo")', () => assert.equal(variacion(50, 0), null));
  test('anterior 0 y actual 0 => 0', () => assert.equal(variacion(0, 0), 0));
  // De perder 100 a perder 50 es una MEJORA del 50% (variación positiva),
  // aunque los valores en sí sigan siendo negativos.
  test('anterior negativo usa valor absoluto en el denominador', () => assert.equal(variacion(-50, -100), 50));
});

describe('rentabilidadPorUnidad', () => {
  test('agrupa ingresos/egresos por unidadId dentro del rango', () => {
    const unidades = [{ id: 'u1', nombre: 'Depto 1' }, { id: 'u2', nombre: 'Depto 2' }];
    const movs = [
      { unidadId: 'u1', tipo: 'ingreso', monto: 1000, fecha: '2026-06-05' },
      { unidadId: 'u1', tipo: 'egreso', monto: 200, fecha: '2026-06-06' },
      { unidadId: 'u2', tipo: 'ingreso', monto: 500, fecha: '2026-06-05' },
      { unidadId: 'u1', tipo: 'ingreso', monto: 9999, fecha: '2026-01-01' }, // afuera del rango
      { tipo: 'ingreso', monto: 300, fecha: '2026-06-05' } // sin unidadId, no se imputa a ninguna
    ];
    const r = rentabilidadPorUnidad(movs, unidades, '2026-06-01', '2026-06-30');
    assert.equal(r.length, 2);
    assert.deepEqual(r[0], { unidad: unidades[0], ingresos: 1000, egresos: 200, neto: 800 });
    assert.deepEqual(r[1], { unidad: unidades[1], ingresos: 500, egresos: 0, neto: 500 });
  });
});

describe('ultimosMeses', () => {
  test('devuelve N meses, el más viejo primero, terminando en el mes de referencia', () => {
    const meses = ultimosMeses(3, new Date(2026, 2, 15)); // marzo 2026 (mes=2, 0-indexado)
    assert.equal(meses.length, 3);
    assert.deepEqual(meses.map((m) => `${m.anio}-${m.mes}`), ['2026-1', '2026-2', '2026-3']);
    assert.equal(meses[0].desde, '2026-01-01');
    assert.equal(meses[0].hasta, '2026-01-31');
    assert.equal(meses[2].hasta, '2026-03-31');
  });
});

describe('bucketsOcupacion', () => {
  test('rango corto (<=10 días): un bucket por día', () => {
    const b = bucketsOcupacion('2026-06-01', '2026-06-05');
    assert.equal(b.length, 5);
    assert.equal(b[0].desde, '2026-06-01');
    assert.equal(b[0].hasta, '2026-06-01');
  });
  test('rango mediano (11-60 días): buckets semanales, el último no se pasa del final', () => {
    const b = bucketsOcupacion('2026-06-01', '2026-06-20'); // 20 días
    assert.ok(b.length > 1 && b.length <= 3);
    assert.equal(b[b.length - 1].hasta, '2026-06-20');
    assert.equal(b[0].desde, '2026-06-01');
  });
  test('rango largo (>60 días): un bucket por mes calendario', () => {
    const b = bucketsOcupacion('2026-01-15', '2026-04-10'); // ~85 días
    assert.equal(b.length, 4); // ene(parcial), feb, mar, abr(parcial)
    assert.equal(b[0].desde, '2026-01-15');
    assert.equal(b[0].hasta, '2026-01-31');
    assert.equal(b[3].desde, '2026-04-01');
    assert.equal(b[3].hasta, '2026-04-10');
  });
  test('los buckets cubren el rango completo sin huecos ni superposición', () => {
    const b = bucketsOcupacion('2026-01-15', '2026-04-10');
    for (let i = 1; i < b.length; i++) {
      assert.equal(masDias(b[i - 1].hasta, 1), b[i].desde);
    }
  });
});
