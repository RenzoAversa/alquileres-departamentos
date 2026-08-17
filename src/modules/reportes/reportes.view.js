// ============================================================
// Reportes de negocio (solo roles con permiso verDinero).
//   - Rentabilidad por unidad: ingresos - egresos imputados (movimientos
//     con unidadId), en un período elegible.
//   - Tendencias mensuales: ingresos y ocupación de los últimos 6/12 meses.
// Ahorro de lecturas: cada bloque hace UNA sola consulta a Firestore
// (acotada por fecha) y todos los cálculos por mes/unidad se hacen en
// memoria con las funciones puras de core/metricas.js.
// ============================================================
import { unidadesService } from '../../services/unidades.service.js';
import { edificiosService } from '../../services/edificios.service.js';
import { movimientosService } from '../../services/movimientos.service.js';
import { reservasService } from '../../services/reservas.service.js';
import { el, toast, spinner, vacio, money, fecha, botonRecargar, crearPaginado } from '../../core/ui.js';
import { hoyISO, masDias, diasDe, metricasPeriodo, rentabilidadPorUnidad, ultimosMeses } from '../../core/metricas.js';
import { graficoLineas, graficoBarrasApiladas } from '../../core/graficos.js';
import { exportarTendencias } from '../../core/excel.js';
import { generarTendenciasPDF } from '../../core/pdf.js';
import { sesion } from '../../core/sesion.js';
import { nodoVariacion } from './valores-mensuales.js';

export async function render(container) {
  container.append(el('h1', { class: 'page-title' }, 'Reportes'));

  if (!sesion.puede('verDinero')) {
    container.append(el('div', { class: 'card' }, vacio('No tenés permiso para ver reportes financieros.')));
    return;
  }

  const contRent = el('div', {});
  const contTend = el('div', {});
  container.append(contRent, contTend);
  contRent.append(el('div', { class: 'card' }, spinner('Cargando reportes…')));

  const [unidades, edificios] = await Promise.all([unidadesService.getAll(), edificiosService.getAll()]);
  const nombreEd = (id) => edificios.find((e) => e.id === id)?.nombre;

  pintarRentabilidad();
  pintarTendencias();

  // ================= Rentabilidad por unidad =================
  function pintarRentabilidad() {
    contRent.innerHTML = '';
    let periodo = { nombre: '30d', desde: masDias(hoyISO(), -29), hasta: hoyISO() };

    const header = el('div', { class: 'finanzas-head' }, [
      el('h3', {}, 'Rentabilidad por propiedad'),
      botonRecargar(() => cargar())
    ]);

    const presets = [
      { nombre: '30d', label: '30 días', desde: masDias(hoyISO(), -29), hasta: hoyISO() },
      { nombre: '90d', label: '90 días', desde: masDias(hoyISO(), -89), hasta: hoyISO() },
      { nombre: 'anio', label: 'Este año', desde: `${new Date().getFullYear()}-01-01`, hasta: hoyISO() }
    ];
    const chips = el('div', { class: 'periodo-chips' });
    const inDesde = el('input', { type: 'date', value: periodo.desde });
    const inHasta = el('input', { type: 'date', value: periodo.hasta });
    const btnAplicar = el('button', { class: 'chip-periodo', type: 'button' }, 'Aplicar');
    const sub = el('p', { class: 'muted small' }, '');

    function pintarChips() {
      chips.innerHTML = '';
      presets.forEach((p) => chips.append(el('button', {
        class: `chip-periodo ${periodo.nombre === p.nombre ? 'is-active' : ''}`, type: 'button',
        onClick: () => { periodo = { ...p }; pintarChips(); cargar(); }
      }, p.label)));
      btnAplicar.classList.toggle('is-active', periodo.nombre === 'custom');
    }
    btnAplicar.addEventListener('click', () => {
      if (new Date(inHasta.value) < new Date(inDesde.value)) { toast('El hasta debe ser posterior al desde', 'alerta'); return; }
      periodo = { nombre: 'custom', desde: inDesde.value, hasta: inHasta.value };
      pintarChips(); cargar();
    });
    pintarChips();

    const selectores = el('div', { class: 'periodo-barra' }, [
      chips,
      el('div', { class: 'periodo-custom' }, [inDesde, el('span', { class: 'muted' }, 'a'), inHasta, btnAplicar])
    ]);

    const listaCont = el('div', {});
    contRent.append(el('div', { class: 'card' }, [header, selectores, sub, listaCont]));

    const paginado = crearPaginado({
      contenedor: listaCont,
      porPagina: 20,
      mensajeVacio: 'No hay movimientos imputados a unidades en este período.',
      renderItem: (r) => renderFila(r)
    });

    function renderFila(r) {
      const nombreEdR = nombreEd(r.unidad.edificioId);
      return el('div', { class: 'lista__item' }, [
        el('div', {}, [
          el('strong', {}, r.unidad.nombre),
          nombreEdR ? el('span', { class: 'muted small' }, ` · ${nombreEdR}`) : null
        ].filter(Boolean)),
        el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' }, [
          el('span', { class: 'badge badge--ok' }, `+${money(r.ingresos)}`),
          el('span', { class: 'badge badge--alerta' }, `−${money(r.egresos)}`),
          el('strong', { class: r.neto >= 0 ? 'txt-ok' : 'txt-alerta' }, money(r.neto))
        ])
      ]);
    }

    async function cargar() {
      sub.textContent = `${fecha(periodo.desde)} a ${fecha(periodo.hasta)} · ${diasDe(periodo.desde, periodo.hasta)} día(s)`;
      const movimientos = await movimientosService.buscar([
        ['fecha', '>=', periodo.desde], ['fecha', '<=', periodo.hasta]
      ]);
      const filas = rentabilidadPorUnidad(movimientos, unidades, periodo.desde, periodo.hasta)
        .filter((r) => r.ingresos > 0 || r.egresos > 0)
        .sort((a, b) => b.neto - a.neto);
      paginado.setItems(filas);
    }
    cargar();
  }

  // ================= Tendencias mensuales =================
  function pintarTendencias() {
    contTend.innerHTML = '';
    let cantMeses = 6;
    let datosActuales = [];

    const btnExportar = el('button', { class: 'btn btn--ghost btn--sm', type: 'button' }, 'Exportar a Excel');
    btnExportar.addEventListener('click', async () => {
      btnExportar.disabled = true; btnExportar.textContent = 'Generando…';
      await exportarTendencias(datosActuales, `tendencias_${cantMeses}m_${hoyISO()}.xlsx`);
      btnExportar.disabled = false; btnExportar.textContent = 'Exportar a Excel';
    });
    const btnExportarPDF = el('button', { class: 'btn btn--ghost btn--sm', type: 'button' }, 'Exportar a PDF');
    btnExportarPDF.addEventListener('click', async () => {
      btnExportarPDF.disabled = true; btnExportarPDF.textContent = 'Generando…';
      await generarTendenciasPDF(datosActuales, { cantMeses, nombreArchivo: `tendencias_${cantMeses}m_${hoyISO()}.pdf` });
      btnExportarPDF.disabled = false; btnExportarPDF.textContent = 'Exportar a PDF';
    });
    const header = el('div', { class: 'finanzas-head' }, [
      el('h3', {}, 'Tendencias mensuales'),
      el('div', { style: 'display:flex;gap:8px' }, [btnExportar, btnExportarPDF, botonRecargar(() => cargar())])
    ]);
    const chips = el('div', { class: 'periodo-chips' });
    function pintarChips() {
      chips.innerHTML = '';
      [[6, '6 meses'], [12, '12 meses']].forEach(([n, label]) => chips.append(el('button', {
        class: `chip-periodo ${cantMeses === n ? 'is-active' : ''}`, type: 'button',
        onClick: () => { cantMeses = n; pintarChips(); cargar(); }
      }, label)));
    }
    pintarChips();

    // barras--valores: modificador propio de Reportes (más alto, con scroll
    // horizontal en mobile), para no afectar el widget de "Ocupación · los
    // últimos 7 días" del Dashboard, que reusa las mismas clases base.
    const graficoIngresos = el('div', { class: 'barras barras--valores' }, spinner('Calculando…'));
    const graficoOcupacion = el('div', { class: 'barras barras--valores' });
    const contEvolucion = el('div', {});
    const contApiladas = el('div', {});

    contTend.append(el('div', { class: 'card' }, [
      header,
      el('div', { class: 'periodo-barra' }, [chips]),
      el('h4', { class: 'reportes-subtitulo' }, 'Ingresos por mes'),
      graficoIngresos,
      el('h4', { class: 'reportes-subtitulo' }, 'Ocupación por mes'),
      graficoOcupacion,
      el('h4', { class: 'reportes-subtitulo' }, 'Evolución mensual'),
      contEvolucion,
      el('h4', { class: 'reportes-subtitulo' }, 'Ingresos vs gastos por mes'),
      contApiladas
    ]));

    async function cargar() {
      graficoIngresos.innerHTML = '';
      graficoIngresos.append(spinner('Calculando…'));
      graficoOcupacion.innerHTML = '';

      const meses = ultimosMeses(cantMeses);
      const desde = meses[0].desde;
      const hasta = meses[meses.length - 1].hasta;

      // Una sola consulta para todo el rango; el resto es cálculo en memoria.
      const [movimientos, reservas] = await Promise.all([
        movimientosService.buscar([['fecha', '>=', desde], ['fecha', '<=', hasta]]),
        reservasService.buscar([['fechaSalida', '>=', desde]])
      ]);

      const activas = unidades.filter((u) => u.estado !== 'inactivo').length;
      const datos = meses.map((m) => ({ ...m, ...metricasPeriodo(movimientos, reservas, activas, m.desde, m.hasta) }));
      datosActuales = datos;

      const maxIngreso = Math.max(1, ...datos.map((d) => d.ingresos));
      graficoIngresos.innerHTML = '';
      datos.forEach((d, i) => {
        const pct = Math.round((d.ingresos / maxIngreso) * 100);
        const anterior = i > 0 ? datos[i - 1].ingresos : null;
        graficoIngresos.append(el('div', { class: 'barra' }, [
          el('div', { class: 'barra__valor' }, money(d.ingresos)),
          el('div', { class: 'barra__col' }, el('div', { class: 'barra__fill barra__fill--ok', style: `height:${pct}%` })),
          el('div', { class: 'barra__label' }, d.label),
          anterior != null ? nodoVariacion(d.ingresos, anterior) : null
        ]));
      });

      datos.forEach((d, i) => {
        const pct = Math.round(d.ocupacion);
        const anterior = i > 0 ? datos[i - 1].ocupacion : null;
        graficoOcupacion.append(el('div', { class: 'barra' }, [
          el('div', { class: 'barra__valor' }, `${pct}%`),
          el('div', { class: 'barra__col' }, el('div', { class: 'barra__fill', style: `height:${Math.min(100, pct)}%` })),
          el('div', { class: 'barra__label' }, d.label),
          // Sin porcentaje sobre porcentaje: acá la variación es en puntos,
          // no "variación % de la ocupación %" (confunde más de lo que aclara).
          anterior != null ? nodoVariacion(d.ocupacion, anterior, (n) => `${Math.round(n)}%`, { mostrarPct: false }) : null
        ]));
      });

      // ---- Evolución mensual (líneas): ingresos / gastos / neto ----
      const etiquetas = datos.map((d) => d.label);
      contEvolucion.innerHTML = '';
      contEvolucion.append(graficoLineas([
        { nombre: 'Ingresos', valores: datos.map((d) => d.ingresos), color: 'var(--ok)' },
        { nombre: 'Gastos', valores: datos.map((d) => d.egresos), color: 'var(--alerta)' },
        { nombre: 'Neto', valores: datos.map((d) => d.neto), color: 'var(--color-primario)' }
      ], { etiquetas, formatoValor: (n) => money(n), titulo: 'Evolución mensual: ingresos, gastos y neto' }));

      // ---- Ingresos vs gastos por mes (barras apiladas) ----
      contApiladas.innerHTML = '';
      contApiladas.append(graficoBarrasApiladas(datos.map((d) => ({
        label: d.label,
        segmentos: [
          { nombre: 'Ingresos', valor: d.ingresos, color: 'var(--ok)' },
          { nombre: 'Gastos', valor: d.egresos, color: 'var(--alerta)' }
        ]
      })), { formatoValor: (n) => money(n), titulo: 'Ingresos vs gastos por mes' }));
    }
    cargar();
  }
}
