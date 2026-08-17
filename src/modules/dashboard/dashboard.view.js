// ============================================================
// Dashboard (con permisos por rol).
//   - "Hoy", ocupación 7 días y próximas reservas: todos los roles.
//   - Saldos, ingresos/egresos, comparativa financiera y export: solo
//     roles con permiso verDinero (dueño / encargado).
// ============================================================
import { unidadesService } from '../../services/unidades.service.js';
import { reservasService } from '../../services/reservas.service.js';
import { movimientosService } from '../../services/movimientos.service.js';
import { cuentasService } from '../../services/cuentas.service.js';
import { el, spinner, money, fecha, toast } from '../../core/ui.js';
import { hoyISO, masDias, diasDe, periodoAnterior, metricasPeriodo, metricasOcupacion, variacion } from '../../core/metricas.js';
import { exportarReporte, exportarGraficosTorta } from '../../core/excel.js';
import { generarGraficosTortaPDF } from '../../core/pdf.js';
import { graficoTorta } from '../../core/graficos.js';
import { sesion } from '../../core/sesion.js';

const kpi = (valor, etiqueta, extra = null, tono = '') =>
  el('div', { class: `kpi ${tono}` }, [el('div', { class: 'kpi__valor' }, valor), el('div', { class: 'kpi__label' }, etiqueta), extra].filter(Boolean));

function chipVariacion(actual, anterior, buenoSiSube) {
  const v = variacion(actual, anterior);
  if (v === null) return el('span', { class: 'delta delta--good' }, 'nuevo');
  const flecha = v > 0 ? '↑' : v < 0 ? '↓' : '→';
  const bueno = v === 0 ? null : ((v > 0) === buenoSiSube);
  const clase = v === 0 ? 'delta--neutro' : (bueno ? 'delta--good' : 'delta--bad');
  return el('span', { class: `delta ${clase}` }, `${flecha} ${Math.abs(v)}% vs anterior`);
}

export async function render(container) {
  const verDinero = sesion.puede('verDinero');
  container.append(el('h1', { class: 'page-title' }, 'Panel'));

  const contSaldos = el('div', {});
  const contHoy = el('div', {});
  const contComp = el('div', {});
  const contOcu = el('div', {});
  const contOcuUnidad = el('div', {});
  const contCanal = el('div', {});
  const contProx = el('div', {});
  container.append(contSaldos, contHoy, contComp, contOcu, contOcuUnidad, contCanal, contProx);
  contHoy.append(el('div', { class: 'card' }, spinner('Cargando panel…')));

  const hoy = hoyISO();

  // Carga: unidades + reservas recientes siempre; cuentas solo si ve dinero
  const promesas = [
    unidadesService.getAll(),
    reservasService.buscar([['fechaSalida', '>=', masDias(hoy, -7)]])
  ];
  if (verDinero) promesas.push(cuentasService.getAll());
  const res = await Promise.all(promesas);
  const unidades = res[0];
  const reservasRecientes = res[1];
  const cuentas = verDinero ? (res[2] || []) : [];

  // ---- Saldos por cuenta (solo con permiso) ----
  contSaldos.innerHTML = '';
  if (verDinero && cuentas.length) {
    contSaldos.append(el('div', { class: 'card' }, [
      el('h3', {}, 'Plata disponible'),
      el('div', { class: 'kpi-grid' }, cuentas.map((c) => kpi(money(c.saldo, c.moneda), c.nombre)))
    ]));
  }

  // ---- Panel de HOY ----
  const activas = unidades.filter((u) => u.estado !== 'inactivo');
  const ocupadasHoy = reservasRecientes.filter((r) => r.estado !== 'cancelada' && r.fechaEntrada <= hoy && r.fechaSalida > hoy).length;
  const ocupHoyPct = activas.length ? Math.round((ocupadasHoy / activas.length) * 100) : 0;
  const checkinsHoy = reservasRecientes.filter((r) => r.estado !== 'cancelada' && r.fechaEntrada === hoy).length;
  const checkoutsHoy = reservasRecientes.filter((r) => r.estado !== 'cancelada' && r.fechaSalida === hoy).length;

  contHoy.innerHTML = '';
  contHoy.append(el('div', { class: 'card' }, [
    el('h3', {}, 'Hoy'),
    el('div', { class: 'kpi-grid' }, [
      kpi(`${ocupHoyPct}%`, 'Ocupación'),
      kpi(String(activas.length - ocupadasHoy), 'Libres', null, 'kpi--ok'),
      kpi(String(checkinsHoy), 'Ingreso de inquilinos'),
      kpi(String(checkoutsHoy), 'Egreso de inquilinos')
    ])
  ]));

  // ---- Ocupación últimos 7 días ----
  contOcu.innerHTML = '';
  const barras = [];
  for (let i = 6; i >= 0; i--) {
    const d = masDias(hoy, -i);
    const ocup = reservasRecientes.filter((r) => r.estado !== 'cancelada' && r.fechaEntrada <= d && r.fechaSalida > d).length;
    const pct = activas.length ? Math.round((ocup / activas.length) * 100) : 0;
    const [, mm, dd] = d.split('-');
    barras.push(el('div', { class: 'barra' }, [
      el('div', { class: 'barra__valor' }, `${pct}%`),
      el('div', { class: 'barra__col' }, el('div', { class: 'barra__fill', style: `height:${pct}%` })),
      el('div', { class: 'barra__label' }, `${dd}/${mm}`)
    ]));
  }
  contOcu.append(el('div', { class: 'card' }, [el('h3', {}, 'Ocupación · últimos 7 días'), el('div', { class: 'barras' }, barras)]));

  // ---- Ocupación por departamento (torta, visible para todos los roles) ----
  contOcuUnidad.innerHTML = '';
  let ocupacionPorUnidad = [];
  {
    const desdeOcu = masDias(hoy, -6);
    ocupacionPorUnidad = activas
      .map((u) => {
        const propias = reservasRecientes.filter((r) => r.unidadId === u.id);
        const m = metricasOcupacion(propias, 1, desdeOcu, hoy);
        return { label: u.nombre, valor: Math.round(m.ocupacion) };
      })
      .filter((d) => d.valor > 0)
      .sort((a, b) => b.valor - a.valor);
    const headerOcu = el('div', { class: 'comp-header' }, [el('h3', {}, 'Ocupación por departamento · últimos 7 días')]);
    const hojasGraficos = () => [
      { nombre: 'Ocupación por departamento', items: ocupacionPorUnidad, formatoValor: (n) => `${n}%` },
      ...(verDinero && datosCuentaExport.length ? [{ nombre: 'Ingresos por cuenta', items: datosCuentaExport, esMoneda: true, formatoValor: money }] : [])
    ];
    const btnExportarGraficos = el('button', { class: 'btn btn--ghost btn--sm', type: 'button' }, 'Exportar a Excel');
    btnExportarGraficos.addEventListener('click', async () => {
      btnExportarGraficos.disabled = true; btnExportarGraficos.textContent = 'Generando…';
      await exportarGraficosTorta(hojasGraficos(), `graficos_panel_${hoy}.xlsx`);
      btnExportarGraficos.disabled = false; btnExportarGraficos.textContent = 'Exportar a Excel';
    });
    const btnExportarGraficosPDF = el('button', { class: 'btn btn--ghost btn--sm', type: 'button' }, 'Exportar a PDF');
    btnExportarGraficosPDF.addEventListener('click', async () => {
      btnExportarGraficosPDF.disabled = true; btnExportarGraficosPDF.textContent = 'Generando…';
      await generarGraficosTortaPDF(hojasGraficos(), `graficos_panel_${hoy}.pdf`);
      btnExportarGraficosPDF.disabled = false; btnExportarGraficosPDF.textContent = 'Exportar a PDF';
    });
    headerOcu.append(btnExportarGraficos, btnExportarGraficosPDF);

    // Barras por departamento en vez de torta: cada % es la ocupación de
    // ESE departamento en los últimos 7 días, independiente de los demás
    // (no es una parte de un total). Con una torta un 100% se leía como
    // "domina el gráfico"; con barras no hay esa ambigüedad. Reusa
    // .occ-row/.occ-bar, ya definidas en el CSS para esto y sin usar.
    const filasOcupacion = ocupacionPorUnidad.length
      ? el('div', {}, ocupacionPorUnidad.map((d) => el('div', { class: 'occ-row' }, [
          el('span', { class: 'occ-row__label' }, d.label),
          el('div', { class: 'occ-bar' }, el('div', { class: 'occ-bar__fill', style: `width:${d.valor}%` })),
          el('span', { class: 'occ-row__val' }, `${d.valor}%`)
        ])))
      : el('p', { class: 'muted small' }, 'No hay ocupación registrada en los últimos 7 días.');

    contOcuUnidad.append(el('div', { class: 'card' }, [headerOcu, filasOcupacion]));
  }

  // ---- Ingresos por cuenta (solo con permiso) ----
  // Se calcula sobre los movimientos de ingreso reales (no sobre el total
  // de las reservas), así refleja en qué cuenta entró la plata de verdad.
  // El filtro por fecha es de un solo campo (sin combinar con otra
  // igualdad) para no requerir un índice compuesto en Firestore.
  contCanal.innerHTML = '';
  let datosCuentaExport = [];
  if (verDinero) {
    const desdeIngresos = masDias(hoy, -6);
    const movsPeriodo = await movimientosService.buscar([
      ['fecha', '>=', desdeIngresos],
      ['fecha', '<=', hoy]
    ]);
    const porCuenta = {};
    movsPeriodo.filter((m) => m.tipo === 'ingreso').forEach((m) => {
      const id = m.cuentaId || 'sin_cuenta';
      porCuenta[id] = (porCuenta[id] || 0) + (Number(m.monto) || 0);
    });
    const nombreCuenta = (id) => cuentas.find((c) => c.id === id)?.nombre || 'Sin cuenta';
    datosCuentaExport = Object.entries(porCuenta).map(([id, valor]) => ({ label: nombreCuenta(id), valor }));
    contCanal.append(el('div', { class: 'card' }, [
      el('h3', {}, 'Ingresos por cuenta'),
      graficoTorta(datosCuentaExport, { formatoValor: (n) => money(n), titulo: 'Ingresos por cuenta · últimos 7 días' })
    ]));
  }

  // ---- Comparativa por período ----
  let periodo = { desde: masDias(hoy, -6), hasta: hoy, nombre: '7d' };

  function pintarComparativa() {
    contComp.innerHTML = '';
    const presets = [
      { nombre: 'hoy', label: 'Hoy', desde: hoy, hasta: hoy },
      { nombre: '7d', label: '7 días', desde: masDias(hoy, -6), hasta: hoy },
      { nombre: '30d', label: '30 días', desde: masDias(hoy, -29), hasta: hoy }
    ];
    const botones = presets.map((p) =>
      el('button', {
        class: `chip-periodo ${periodo.nombre === p.nombre ? 'is-active' : ''}`, type: 'button',
        onClick: () => { periodo = { ...p }; pintarComparativa(); cargarDatos(); }
      }, p.label));

    const inDesde = el('input', { type: 'date', value: periodo.desde });
    const inHasta = el('input', { type: 'date', value: periodo.hasta });
    const btnAplicar = el('button', {
      class: `chip-periodo ${periodo.nombre === 'custom' ? 'is-active' : ''}`, type: 'button',
      onClick: () => {
        if (new Date(inHasta.value) < new Date(inDesde.value)) { toast('El hasta debe ser posterior al desde', 'alerta'); return; }
        periodo = { nombre: 'custom', desde: inDesde.value, hasta: inHasta.value };
        pintarComparativa(); cargarDatos();
      }
    }, 'Aplicar');

    const header = el('div', { class: 'comp-header' }, [el('h3', {}, 'Comparativa')]);
    if (verDinero) {
      const btnExportar = el('button', { class: 'btn btn--primary', type: 'button' }, 'Exportar a Excel');
      btnExportar.addEventListener('click', async () => {
        btnExportar.disabled = true; btnExportar.textContent = 'Generando…';
        await exportarReporte({ desde: periodo.desde, hasta: periodo.hasta });
        btnExportar.disabled = false; btnExportar.textContent = 'Exportar a Excel';
      });
      header.append(btnExportar);
    }

    const selectores = el('div', { class: 'periodo-barra' }, [
      el('div', { class: 'periodo-chips' }, botones),
      el('div', { class: 'periodo-custom' }, [inDesde, el('span', { class: 'muted' }, 'a'), inHasta, btnAplicar])
    ]);
    const sub = el('p', { class: 'muted small' },
      `${fecha(periodo.desde)} a ${fecha(periodo.hasta)} · ${diasDe(periodo.desde, periodo.hasta)} día(s), comparado con el período anterior equivalente`);
    const grid = el('div', { class: 'kpi-grid', id: 'comp-grid' }, spinner('Calculando…'));
    contComp.append(el('div', { class: 'card' }, [header, selectores, sub, grid]));
  }

  async function cargarDatos() {
    const grid = document.getElementById('comp-grid');
    if (grid) { grid.innerHTML = ''; grid.append(spinner('Calculando…')); }
    const prev = periodoAnterior(periodo.desde, periodo.hasta);

    // Reservas siempre (ocupación); movimientos solo si ve dinero
    const cargas = [reservasService.buscar([['fechaSalida', '>=', prev.desde]])];
    if (verDinero) cargas.unshift(movimientosService.buscar([['fecha', '>=', prev.desde], ['fecha', '<=', periodo.hasta]], ['fecha', 'asc']));
    const r = await Promise.all(cargas);
    const movs = verDinero ? r[0] : [];
    const reservas = verDinero ? r[1] : r[0];

    const act = metricasPeriodo(movs, reservas, activas.length, periodo.desde, periodo.hasta);
    const ant = metricasPeriodo(movs, reservas, activas.length, prev.desde, prev.hasta);

    const g = document.getElementById('comp-grid');
    if (!g) return;
    g.innerHTML = '';
    if (verDinero) {
      g.append(
        kpi(money(act.ingresos), 'Ingresos', chipVariacion(act.ingresos, ant.ingresos, true), 'kpi--ok'),
        kpi(money(act.egresos), 'Gastos', chipVariacion(act.egresos, ant.egresos, false), 'kpi--alerta'),
        kpi(money(act.neto), 'Resultado', chipVariacion(act.neto, ant.neto, true), act.neto >= 0 ? 'kpi--ok' : 'kpi--alerta')
      );
    }
    g.append(
      kpi(`${Math.round(act.ocupacion)}%`, 'Ocupación', chipVariacion(act.ocupacion, ant.ocupacion, true)),
      kpi(String(act.reservas), 'Reservas', chipVariacion(act.reservas, ant.reservas, true))
    );
  }

  pintarComparativa();
  await cargarDatos();

  // ---- Próximas reservas ----
  const proximas = reservasRecientes
    .filter((r) => r.estado !== 'cancelada' && r.fechaEntrada >= hoy)
    .sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada))
    .slice(0, 5);
  contProx.innerHTML = '';
  contProx.append(el('div', { class: 'card' }, [
    el('h3', {}, 'Próximas reservas'),
    proximas.length
      ? el('div', {}, proximas.map((r) => el('div', { class: 'lista__item' }, [
          el('div', {}, [el('strong', {}, r.unidadNombre || 'Unidad'), el('span', { class: 'muted' }, ` · ${r.huesped?.nombre || ''}`)]),
          el('span', { class: 'badge badge--info' }, `${fecha(r.fechaEntrada)} → ${fecha(r.fechaSalida)}`)
        ])))
      : el('p', { class: 'muted' }, 'No hay próximas reservas cargadas.')
  ]));
}
