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
import { el, spinner, money, fecha, rangoFechas } from '../../core/ui.js';
import { hoyISO, masDias, diasDe, periodoAnterior, metricasPeriodo, metricasOcupacion, bucketsOcupacion, variacion } from '../../core/metricas.js';
import { exportarReporte, exportarGraficosTorta } from '../../core/excel.js';
import { generarGraficosTortaPDF } from '../../core/pdf.js';
import { graficoTorta } from '../../core/graficos.js';
import { sesion } from '../../core/sesion.js';
import { notificacionesService } from '../../core/notificaciones.service.js';
import { abrirDetalleReserva } from '../reservas/detalle.js';
import { irACalendario } from '../calendario/ir-a-calendario.js';
import { abrirSelectorFechas } from '../reservas/selector-fechas.js';

const kpi = (valor, etiqueta, extra = null, tono = '') =>
  el('div', { class: `kpi ${tono}` }, [el('div', { class: 'kpi__valor' }, valor), el('div', { class: 'kpi__label' }, etiqueta), extra].filter(Boolean));

function chipVariacion(actual, anterior, buenoSiSube) {
  const v = variacion(actual, anterior);
  // Sin período anterior con el que comparar (v === null): no hay nada
  // que anunciar, así que no se muestra ninguna etiqueta — mostrar "nuevo"
  // en verde se leía como si fuera buena noticia, cuando solo significa
  // que no hay base de comparación. Distinto del caso "ambos períodos en
  // cero" (v === 0, ese sí compara y da "→ 0% vs anterior").
  if (v === null) return null;
  const flecha = v > 0 ? '↑' : v < 0 ? '↓' : '→';
  const bueno = v === 0 ? null : ((v > 0) === buenoSiSube);
  const clase = v === 0 ? 'delta--neutro' : (bueno ? 'delta--good' : 'delta--bad');
  return el('span', { class: `delta ${clase}` }, `${flecha} ${Math.abs(v)}% vs anterior`);
}

export async function render(container) {
  const verDinero = sesion.puede('verDinero');
  const gestionarPagos = sesion.puede('gestionarPagos');
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

  // Carga: unidades + reservas recientes siempre; cuentas solo si ve dinero.
  // Las reservas recientes se reusan del listener de notificaciones (mismo
  // rango fechaSalida >= hoy-7, y ya viene garantizado fresco o con su
  // propio respaldo si el listener no llegó a tiempo — ver
  // notificacionesService.getReservasRecientes()), en vez de pedirlas de
  // nuevo acá.
  const promesas = [
    unidadesService.getAll(),
    notificacionesService.getReservasRecientes()
  ];
  if (verDinero) promesas.push(cuentasService.getAll());
  const res = await Promise.all(promesas);
  const unidades = res[0];
  const reservasRecientes = res[1];
  const cuentas = verDinero ? (res[2] || []) : [];

  // Cuentas para "Ver / Pagar" de Próximas reservas: si ya las trajimos
  // arriba (verDinero), se reusan sin pedir nada de nuevo. Si algún rol
  // llegara a tener gestionarPagos sin verDinero, se piden recién ahí
  // (mismo patrón de carga diferida que reservas.view.js/calendario.view.js).
  let cuentasCache = verDinero ? cuentas : null;
  async function cuentasLazy() {
    if (!gestionarPagos) return [];
    if (!cuentasCache) cuentasCache = await cuentasService.getAll();
    return cuentasCache;
  }

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

  // ---- Ocupación: sigue el período elegido en la Comparativa (ver más
  // abajo). Arranca en 7 días (mismo rango que reservasRecientes, así el
  // primer pintado es instantáneo) y se recalcula, con los MISMOS datos que
  // ya trajo la Comparativa (sin consultas nuevas), cada vez que cambia el
  // período — ver cargarDatos() más abajo.
  let periodo = { desde: masDias(hoy, -6), hasta: hoy, nombre: '7d' };

  function sufijoPeriodo(p) {
    if (p.nombre === 'hoy') return 'hoy';
    if (p.nombre === '7d') return 'últimos 7 días';
    if (p.nombre === '30d') return 'últimos 30 días';
    const [, m1, d1] = p.desde.split('-');
    const [, m2, d2] = p.hasta.split('-');
    return `${d1}/${m1} a ${d2}/${m2}`;
  }

  // Agrupa según el largo del período (día / semana / mes, ver
  // bucketsOcupacion) para que un rango de 30+ días no termine con una
  // barra por día, ilegible en mobile. Con más de 7 barras se usa el mismo
  // modificador de scroll horizontal que Reportes (barras--valores).
  function pintarOcupacion(reservas) {
    contOcu.innerHTML = '';
    const buckets = bucketsOcupacion(periodo.desde, periodo.hasta);
    const barras = buckets.map((b) => {
      const pct = Math.round(metricasOcupacion(reservas, activas.length, b.desde, b.hasta).ocupacion);
      return el('div', { class: 'barra' }, [
        el('div', { class: 'barra__valor' }, `${pct}%`),
        el('div', { class: 'barra__col' }, el('div', { class: 'barra__fill', style: `height:${pct}%` })),
        el('div', { class: 'barra__label' }, b.label)
      ]);
    });
    const claseBarras = buckets.length > 7 ? 'barras barras--valores' : 'barras';
    contOcu.append(el('div', { class: 'card' }, [
      el('h3', {}, `Ocupación · ${sufijoPeriodo(periodo)}`),
      el('div', { class: claseBarras }, barras)
    ]));
  }

  // ---- Ocupación por departamento (visible para todos los roles) ----
  function pintarOcupacionPorUnidad(reservas) {
    contOcuUnidad.innerHTML = '';
    const ocupacionPorUnidad = activas
      .map((u) => {
        const propias = reservas.filter((r) => r.unidadId === u.id);
        const m = metricasOcupacion(propias, 1, periodo.desde, periodo.hasta);
        return { label: u.nombre, valor: Math.round(m.ocupacion) };
      })
      .filter((d) => d.valor > 0)
      .sort((a, b) => b.valor - a.valor);
    const headerOcu = el('div', { class: 'comp-header' }, [el('h3', {}, `Ocupación por departamento · ${sufijoPeriodo(periodo)}`)]);
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
    // ESE departamento en el período elegido, independiente de los demás
    // (no es una parte de un total). Con una torta un 100% se leía como
    // "domina el gráfico"; con barras no hay esa ambigüedad. Reusa
    // .occ-row/.occ-bar, ya definidas en el CSS para esto y sin usar.
    const filasOcupacion = ocupacionPorUnidad.length
      ? el('div', {}, ocupacionPorUnidad.map((d) => el('div', { class: 'occ-row' }, [
          el('span', { class: 'occ-row__label' }, d.label),
          el('div', { class: 'occ-bar' }, el('div', { class: 'occ-bar__fill', style: `width:${d.valor}%` })),
          el('span', { class: 'occ-row__val' }, `${d.valor}%`)
        ])))
      : el('p', { class: 'muted small' }, 'No hay ocupación registrada en este período.');

    contOcuUnidad.append(el('div', { class: 'card' }, [headerOcu, filasOcupacion]));
  }

  pintarOcupacion(reservasRecientes);
  pintarOcupacionPorUnidad(reservasRecientes);

  // ---- Ingresos por cuenta (solo con permiso) ----
  // Sigue el período elegido en la Comparativa (igual que Ocupación, ver
  // más abajo): se repinta en cargarDatos() con el MISMO array de
  // movimientos que ya trae para los KPIs, sin pedir nada nuevo a
  // Firestore. Se calcula sobre los movimientos de ingreso reales (no
  // sobre el total de las reservas), así refleja en qué cuenta entró la
  // plata de verdad.
  let datosCuentaExport = [];
  function pintarCanal(movs) {
    contCanal.innerHTML = '';
    if (!verDinero) return;
    const movsPeriodo = movs.filter((m) => m.fecha >= periodo.desde && m.fecha <= periodo.hasta);
    const porCuenta = {};
    movsPeriodo.filter((m) => m.tipo === 'ingreso').forEach((m) => {
      const id = m.cuentaId || 'sin_cuenta';
      porCuenta[id] = (porCuenta[id] || 0) + (Number(m.monto) || 0);
    });
    const nombreCuenta = (id) => cuentas.find((c) => c.id === id)?.nombre || 'Sin cuenta';
    datosCuentaExport = Object.entries(porCuenta).map(([id, valor]) => ({ label: nombreCuenta(id), valor }));
    contCanal.append(el('div', { class: 'card' }, [
      el('h3', {}, `Ingresos por cuenta · ${sufijoPeriodo(periodo)}`),
      graficoTorta(datosCuentaExport, { formatoValor: (n) => money(n), titulo: `Ingresos por cuenta · ${sufijoPeriodo(periodo)}` })
    ]));
  }

  // ---- Movimientos de la carga inicial ----
  // Se piden UNA vez, con el rango más amplio que necesita la Comparativa
  // de abajo (período elegido + su período anterior equivalente). Si
  // después cambiás el período, cargarDatos() vuelve a consultar Firestore
  // (rango distinto) — ver ahí.
  const prevInicial = periodoAnterior(periodo.desde, periodo.hasta);
  let movimientosCacheInicial = verDinero
    ? await movimientosService.buscar([['fecha', '>=', prevInicial.desde], ['fecha', '<=', periodo.hasta]], ['fecha', 'asc'])
    : null;

  // ---- Comparativa por período ----
  // (la variable `periodo` ya se declaró más arriba, la comparte con Ocupación)
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

    // Rango personalizado: un botón que abre el calendario propio en un
    // modal, en vez de dos <input type=date> nativos. permitirPasado: acá
    // el pasado es un caso normal ("mes pasado", "trimestre anterior"), no
    // algo que deba pedir confirmación como en Reservas. Elegir un rango en
    // el modal ya aplica (no hace falta un botón "Aplicar" aparte).
    const btnRango = el('button', {
      class: `chip-periodo ${periodo.nombre === 'custom' ? 'is-active' : ''}`, type: 'button',
      onClick: async () => {
        const rango = await abrirSelectorFechas({ desde: periodo.desde, hasta: periodo.hasta, permitirPasado: true });
        if (!rango) return;
        periodo = { nombre: 'custom', desde: rango.desde, hasta: rango.hasta };
        pintarComparativa(); cargarDatos();
      }
    }, rangoFechas(periodo.desde, periodo.hasta));

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
      el('div', { class: 'periodo-chips' }, [...botones, btnRango])
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

    // La primera vez (período default) reusa los movimientos ya traídos
    // arriba en vez de volver a pedir el mismo rango; los cambios de
    // período posteriores sí necesitan una consulta nueva (rango distinto).
    let movs, reservas;
    if (movimientosCacheInicial) {
      movs = movimientosCacheInicial;
      movimientosCacheInicial = null;
      reservas = await reservasService.buscar([['fechaSalida', '>=', prev.desde]]);
    } else {
      // Reservas siempre (ocupación); movimientos solo si ve dinero
      const cargas = [reservasService.buscar([['fechaSalida', '>=', prev.desde]])];
      if (verDinero) cargas.unshift(movimientosService.buscar([['fecha', '>=', prev.desde], ['fecha', '<=', periodo.hasta]], ['fecha', 'asc']));
      const r = await Promise.all(cargas);
      movs = verDinero ? r[0] : [];
      reservas = verDinero ? r[1] : r[0];
    }

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

    // Ocupación e Ingresos por cuenta siguen el período de la Comparativa:
    // se repintan acá con los MISMOS arrays que se acaban de traer arriba
    // (rango período + período anterior), sin pedir nada nuevo a Firestore.
    pintarOcupacion(reservas);
    pintarOcupacionPorUnidad(reservas);
    pintarCanal(movs);
  }

  pintarComparativa();
  await cargarDatos();

  // ---- Próximas reservas ----
  const proximas = reservasRecientes
    .filter((r) => r.estado !== 'cancelada' && r.fechaEntrada >= hoy)
    .sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada))
    .slice(0, 5);
  function filaProxima(r) {
    const acciones = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' }, [
      el('span', { class: 'badge badge--info' }, `${fecha(r.fechaEntrada)} → ${fecha(r.fechaSalida)}`),
      el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => irACalendario(r) }, 'Ver en calendario')
    ]);
    if (gestionarPagos) {
      acciones.append(el('button', {
        class: 'btn btn--primary btn--sm', type: 'button',
        onClick: async () => abrirDetalleReserva(r, await cuentasLazy(), null)
      }, 'Ver / Pagar'));
    }
    // Mismo criterio que en Reservas: el huésped es el dato principal
    // (negrita), el departamento queda secundario.
    const nombreHuesped = (r.huesped?.nombre || '').trim() || 'Sin nombre';
    return el('div', { class: 'lista__item' }, [
      el('div', {}, [el('strong', {}, nombreHuesped), el('span', { class: 'muted' }, ` · ${r.unidadNombre || 'Unidad'}`)]),
      acciones
    ]);
  }

  contProx.innerHTML = '';
  contProx.append(el('div', { class: 'card' }, [
    el('h3', {}, 'Próximas reservas'),
    proximas.length
      ? el('div', {}, proximas.map((r) => filaProxima(r)))
      : el('p', { class: 'muted' }, 'No hay próximas reservas cargadas.')
  ]));
}
