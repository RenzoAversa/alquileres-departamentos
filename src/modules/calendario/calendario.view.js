// ============================================================
// Calendario mensual por unidad (tape chart estilo PMS).
//   - Filas = unidades, columnas = días del mes.
//   - Cada reserva se dibuja como UNA banda continua que abarca
//     sus noches (colspan), con el nombre del huésped adentro.
//   - Cabos redondeados = entra / sale en este mes.
//     Cabo recto = la estadía viene de antes o sigue después.
//   - Riel inferior de color = estado de pago (solo si ve dinero).
// Eficiencia: trae solo las reservas que solapan el mes (consulta
// acotada por fechaSalida, índice de un campo = automático).
// ============================================================
import { unidadesService } from '../../services/unidades.service.js';
import { edificiosService } from '../../services/edificios.service.js';
import { reservasService, estadoPagoDe } from '../../services/reservas.service.js';
import { cuentasService } from '../../services/cuentas.service.js';
import { abrirDetalleReserva } from '../reservas/detalle.js';
import { sesion } from '../../core/sesion.js';
import { masDias, diasDe, hoyISO, diaSemana, letraDia } from '../../core/metricas.js';
import { el, spinner, vacio, fecha, money } from '../../core/ui.js';
import { fechaCorta } from '../notificaciones/tabs/_comunes.js';

const pad = (n) => String(n).padStart(2, '0');

export async function render(container) {
  const verDinero = sesion.puede('verDinero');
  const gestionarPagos = sesion.puede('gestionarPagos');

  container.append(el('h1', { class: 'page-title' }, 'Calendario'));

  const ahora = new Date();
  let anio = ahora.getFullYear();
  let mes = ahora.getMonth() + 1; // 1-12
  let filtroEdificio = '';
  let filtroUnidad = '';

  // Las cuentas solo se piden si el usuario abre una reserva (ahorra lecturas).
  let cuentas = null;
  async function cuentasLazy() {
    if (!gestionarPagos) return [];
    if (!cuentas) cuentas = await cuentasService.getAll();
    return cuentas;
  }

  const cont = el('div', {});
  container.append(cont);
  cont.append(el('div', { class: 'card' }, spinner('Cargando calendario…')));

  const unidades = await unidadesService.getAll();
  const edificios = await edificiosService.getAll();
  const nombreEd = (id) => edificios.find((e) => e.id === id)?.nombre;

  // ---- Filtro de unidad / edificio ----
  const selEdificio = el('select', {}, [
    el('option', { value: '' }, 'Todos los edificios'),
    ...edificios.map((ed) => el('option', { value: ed.id }, ed.nombre))
  ]);
  const selUnidad = el('select', {});
  function refrescarOpcionesUnidad() {
    const disponibles = filtroEdificio ? unidades.filter((u) => u.edificioId === filtroEdificio) : unidades;
    selUnidad.innerHTML = '';
    selUnidad.append(el('option', { value: '' }, 'Todos los departamentos'));
    disponibles.forEach((u) => selUnidad.append(el('option', { value: u.id }, u.nombre)));
    if (!disponibles.some((u) => u.id === filtroUnidad)) filtroUnidad = '';
    selUnidad.value = filtroUnidad;
  }
  refrescarOpcionesUnidad();
  selEdificio.addEventListener('change', () => { filtroEdificio = selEdificio.value; refrescarOpcionesUnidad(); pintar(); });
  selUnidad.addEventListener('change', () => { filtroUnidad = selUnidad.value; pintar(); });
  const filtroBarra = el('div', { class: 'cal-filtro' }, [
    el('label', { class: 'form__campo' }, [el('span', {}, 'Edificio'), selEdificio]),
    el('label', { class: 'form__campo' }, [el('span', {}, 'Departamento'), selUnidad])
  ]);

  // Estado de pago, tolerante a reservas viejas sin el campo guardado.
  const pagoDe = (r) => r.estadoPago || estadoPagoDe(r.pagado, r.precioTotal);

  // Convierte las reservas de una unidad en tramos dibujables dentro del mes.
  function tramosDe(reservas, dias, primerDia, ultimoDia) {
    const indice = new Map(dias.map((d, i) => [d, i]));
    return reservas
      .map((r) => {
        const ultimaNoche = masDias(r.fechaSalida, -1); // el día de salida no ocupa noche
        const desde = r.fechaEntrada < primerDia ? primerDia : r.fechaEntrada;
        const hasta = ultimaNoche > ultimoDia ? ultimoDia : ultimaNoche;
        if (hasta < desde) return null; // no deja ninguna noche en este mes
        const i0 = indice.get(desde);
        const i1 = indice.get(hasta);
        if (i0 == null || i1 == null) return null;
        return {
          reserva: r,
          inicio: i0,
          largo: i1 - i0 + 1,
          vieneDeAntes: r.fechaEntrada < primerDia,
          sigueDespues: ultimaNoche > ultimoDia
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.inicio - b.inicio);
  }

  function banda(tramo) {
    const r = tramo.reserva;
    const nombre = (r.huesped?.nombre || '').trim() || 'Sin nombre';
    const clases = ['cal-banda'];
    if (tramo.vieneDeAntes) clases.push('cal-banda--desde-antes');
    if (tramo.sigueDespues) clases.push('cal-banda--hasta-despues');
    if (verDinero) clases.push(`cal-banda--${pagoDe(r)}`);

    const detalle = [
      `${fecha(r.fechaEntrada)} → ${fecha(r.fechaSalida)}`,
      `${r.noches || tramo.largo} noche(s)`,
      verDinero ? money(r.precioTotal || 0) : null,
      verDinero && (r.saldo || 0) > 0 ? `Debe ${money(r.saldo)}` : null
    ].filter(Boolean).join(' · ');

    const contenido = [el('span', { class: 'cal-banda__nombre' }, nombre)];
    if (tramo.largo >= 4) {
      contenido.push(el('span', { class: 'cal-banda__noches' }, `${r.noches || tramo.largo}n`));
    }

    return el('button', {
      class: clases.join(' '),
      type: 'button',
      title: `${nombre} · ${detalle}`,
      'aria-label': `${nombre}, ${detalle}`,
      onClick: async () => abrirDetalleReserva(r, await cuentasLazy(), pintar)
    }, contenido);
  }

  async function pintar() {
    cont.innerHTML = '';
    cont.append(el('div', { class: 'card' }, spinner('Cargando mes…')));

    const mm = pad(mes);
    const diasEnMes = new Date(anio, mes, 0).getDate();
    const primerDia = `${anio}-${mm}-01`;
    const ultimoDia = `${anio}-${mm}-${pad(diasEnMes)}`;

    const unidadesFiltradas = unidades
      .filter((u) => !filtroEdificio || u.edificioId === filtroEdificio)
      .filter((u) => !filtroUnidad || u.id === filtroUnidad);

    // Reservas que solapan el mes (acotado + filtro cliente)
    const reservas = (await reservasService.buscar([['fechaSalida', '>=', primerDia]]))
      .filter((r) => r.fechaEntrada <= ultimoDia && r.estado !== 'cancelada');

    const porUnidad = {};
    reservas.forEach((r) => { (porUnidad[r.unidadId] = porUnidad[r.unidadId] || []).push(r); });

    cont.innerHTML = '';

    // ---- Encabezado con navegación ----
    const nombreMes = new Date(anio, mes - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    const irMes = (delta) => {
      const d = new Date(anio, mes - 1 + delta, 1);
      anio = d.getFullYear(); mes = d.getMonth() + 1; pintar();
    };
    const header = el('div', { class: 'cal-header' }, [
      el('div', { class: 'cal-nav' }, [
        el('button', { class: 'cal-nav__btn', type: 'button', 'aria-label': 'Mes anterior', onClick: () => irMes(-1) }, '‹'),
        el('h3', { class: 'cal-nav__mes' }, nombreMes),
        el('button', { class: 'cal-nav__btn', type: 'button', 'aria-label': 'Mes siguiente', onClick: () => irMes(1) }, '›')
      ]),
      el('button', {
        class: 'btn btn--ghost btn--sm', type: 'button',
        onClick: () => { const h = new Date(); anio = h.getFullYear(); mes = h.getMonth() + 1; pintar(); }
      }, 'Hoy')
    ]);

    // ---- Leyenda ----
    const itemLeyenda = (clase, texto) => el('span', { class: 'cal-leyenda__item' }, [
      el('span', { class: `cal-muestra ${clase}` }), texto
    ]);
    const leyenda = el('div', { class: 'cal-leyenda' }, [
      itemLeyenda('cal-muestra--estadia', 'Estadía'),
      ...(verDinero ? [
        itemLeyenda('cal-muestra--pagado', 'Pagada'),
        itemLeyenda('cal-muestra--parcial', 'Pago parcial'),
        itemLeyenda('cal-muestra--sin-pagar', 'Sin pagar')
      ] : []),
      itemLeyenda('cal-muestra--hoy', 'Hoy')
    ]);

    if (!unidades.length) {
      cont.append(el('div', { class: 'card' }, [header, vacio('Cargá departamentos para ver el calendario.')]));
      return;
    }
    if (!unidadesFiltradas.length) {
      cont.append(el('div', { class: 'card' }, [header, filtroBarra, vacio('Ningún departamento coincide con el filtro elegido.')]));
      return;
    }

    // ---- Grilla ----
    const hoy = hoyISO();
    const dias = [];
    for (let d = 1; d <= diasEnMes; d++) dias.push(`${anio}-${mm}-${pad(d)}`);
    const indiceHoy = dias.indexOf(hoy);

    // Encabezado de días
    const thCorner = el('th', { class: 'cal-esq' }, 'Departamento');
    const headDias = dias.map((iso) => {
      const ds = diaSemana(iso);
      const clases = ['cal-dia'];
      if (ds === 0 || ds === 6) clases.push('cal-finde');
      if (iso === hoy) clases.push('cal-dia--hoy');
      return el('th', { class: clases.join(' '), scope: 'col' }, [
        el('div', { class: 'cal-dia__sem' }, letraDia(iso)),
        el('div', { class: 'cal-dia__num' }, String(parseInt(iso.slice(-2), 10)))
      ]);
    });
    const thead = el('thead', {}, el('tr', {}, [thCorner, ...headDias]));

    // Filas por unidad: se recorren los días y se emite una celda ancha por estadía
    const filas = unidadesFiltradas.map((u) => {
      const tramos = tramosDe(porUnidad[u.id] || [], dias, primerDia, ultimoDia);
      const porInicio = new Map();
      tramos.forEach((t) => { if (!porInicio.has(t.inicio)) porInicio.set(t.inicio, t); });

      const celdas = [];
      let i = 0;
      while (i < dias.length) {
        const tramo = porInicio.get(i);
        if (tramo && i + tramo.largo <= dias.length) {
          celdas.push(el('td', { class: 'cal-celda cal-celda--estadia', colspan: tramo.largo }, banda(tramo)));
          i += tramo.largo;
        } else {
          const ds = diaSemana(dias[i]);
          const finde = ds === 0 || ds === 6;
          celdas.push(el('td', { class: `cal-celda${finde ? ' cal-finde' : ''}` }));
          i++;
        }
      }

      const etiqueta = el('th', { class: 'cal-unidad', scope: 'row' }, [
        el('div', { class: 'cal-unidad__nombre' }, u.nombre),
        el('div', { class: 'cal-unidad__ed' }, nombreEd(u.edificioId) || 'Sin edificio')
      ]);
      return el('tr', {}, [etiqueta, ...celdas]);
    });

    const tabla = el('table', { class: 'cal', style: `--cal-dias:${diasEnMes}` }, [thead, el('tbody', {}, filas)]);
    const lienzo = el('div', { class: 'cal-lienzo' }, [
      tabla,
      // Guía vertical del día de hoy (solo si el mes en pantalla lo contiene)
      indiceHoy >= 0 ? el('div', { class: 'cal-guia-hoy', style: `--cal-i:${indiceHoy}`, 'aria-hidden': 'true' }) : null
    ].filter(Boolean));

    cont.append(el('div', { class: 'card' }, [
      header,
      filtroBarra,
      leyenda,
      el('div', { class: 'cal-scroll' }, lienzo),
      el('p', { class: 'cal-pista' }, 'Tocá una estadía para ver el detalle de la reserva.')
    ]));

    // ---- Movimientos del mes: entradas y salidas, agrupadas por día ----
    const reservasDelFiltro = reservas.filter((r) => unidadesFiltradas.some((u) => u.id === r.unidadId));
    const movimientosMes = [];
    reservasDelFiltro.forEach((r) => {
      if (r.fechaEntrada >= primerDia && r.fechaEntrada <= ultimoDia) movimientosMes.push({ r, tipo: 'entra', dia: r.fechaEntrada });
      if (r.fechaSalida >= primerDia && r.fechaSalida <= ultimoDia) movimientosMes.push({ r, tipo: 'sale', dia: r.fechaSalida });
    });
    movimientosMes.sort((a, b) => a.dia.localeCompare(b.dia));

    const seccion = el('div', { class: 'card' }, [el('h3', {}, 'Movimientos del mes')]);
    if (!movimientosMes.length) {
      seccion.append(el('p', { class: 'muted' }, 'No hay entradas ni salidas en este mes.'));
    } else {
      // Mes lejano del actual: las etiquetas relativas ("Entra en 3 días") pierden sentido.
      const distanciaAlMes = hoy < primerDia ? diasDe(hoy, primerDia) - 1
        : hoy > ultimoDia ? diasDe(ultimoDia, hoy) - 1
        : 0;
      const esCercano = distanciaAlMes <= 30;

      const porDia = new Map();
      movimientosMes.forEach((m) => {
        if (!porDia.has(m.dia)) porDia.set(m.dia, []);
        porDia.get(m.dia).push(m);
      });

      seccion.append(el('div', { class: 'notif-grupos' },
        [...porDia.entries()].map(([dia, items]) => el('div', {}, [
          el('div', { class: 'notif-grupo__fecha' }, fechaCorta(dia)),
          el('div', { class: 'notif-lista' }, items.map((m) => itemMovimientoMes(m, verDinero, esCercano)))
        ]))
      ));
    }
    cont.append(seccion);
  }

  // Etiqueta relativa de ESTE movimiento puntual (entrada o salida), no del
  // estado general de la reserva: antes reutilizaba etiquetaEstadoTemporal(r),
  // que da el mismo texto sin importar la fila, y la fila de "Sale" terminaba
  // mostrando el estado de la entrada (ej. "Entra mañana" en la fila de Sale).
  function etiquetaRelativaDia(dia, tipo) {
    const hoy = hoyISO();
    const verbo = tipo === 'entra' ? 'Entra' : 'Sale';
    if (dia < hoy) return { texto: tipo === 'entra' ? 'Entró' : 'Salió', color: 'var(--texto-muted)' };
    const dias = diasDe(hoy, dia) - 1;
    const texto = dias === 0 ? `${verbo} hoy` : dias === 1 ? `${verbo} mañana` : `${verbo} en ${dias} días`;
    return { texto, color: dias <= 1 ? (tipo === 'entra' ? 'var(--color-primario)' : 'var(--ok)') : 'var(--texto-muted)' };
  }

  function itemMovimientoMes(m, verDinero, esCercano) {
    const { r, tipo, dia } = m;
    const colorMarca = tipo === 'entra' ? 'var(--ok)' : 'var(--color-primario)';
    const marca = tipo === 'entra' ? 'Entra' : 'Sale';
    const estado = esCercano ? etiquetaRelativaDia(dia, tipo) : null;

    return el('div', { class: 'lista__item' }, [
      el('div', {}, [
        el('div', { class: 'reserva-linea' }, [
          el('strong', {}, r.unidadNombre || 'Unidad'),
          el('span', { class: 'small', style: `color:${colorMarca}` }, marca),
          estado ? el('span', { class: 'small', style: `color:${estado.color}` }, estado.texto) : null
        ].filter(Boolean)),
        el('span', { class: 'muted small' }, r.huesped?.nombre || ''),
        verDinero ? el('div', { class: 'muted small' }, money(r.precioTotal || 0)) : null
      ].filter(Boolean))
    ]);
  }

  await pintar();
}
