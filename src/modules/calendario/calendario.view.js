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
import { diasDe, hoyISO, diaSemana, letraDia } from '../../core/metricas.js';
import { el, spinner, vacio, fecha, money, compararPiso } from '../../core/ui.js';
import { fechaCorta } from '../notificaciones/tabs/_comunes.js';
import { tramosDeMes } from '../../core/calendario-tape.js';

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
  // Filtro propio de "Movimientos del mes": independiente del filtro de
  // arriba, para poder mirar el tape chart de un edificio y a la vez
  // revisar movimientos de otro (o de todos).
  let filtroMovEdificio = '';
  let filtroMovUnidad = '';
  let movAbierta = false;

  // Las cuentas solo se piden si el usuario abre una reserva (ahorra lecturas).
  let cuentas = null;
  async function cuentasLazy() {
    if (!gestionarPagos) return [];
    if (!cuentas) cuentas = await cuentasService.getAll();
    return cuentas;
  }

  // Reservas del mes mostrado: se cachean por (año, mes) para no volver a
  // pedirlas cuando lo único que cambia es un filtro (edificio/unidad de
  // arriba, o el de "Movimientos del mes") — esos son puramente client-side,
  // no necesitan datos nuevos. `forzar: true` se usa después de tocar una
  // reserva (pago/estado), porque ahí sí hubo una escritura que este
  // array todavía no vio.
  let reservasCache = null; // { anio, mes, datos }
  async function reservasDelMes(primerDia, ultimoDia, forzar) {
    if (!forzar && reservasCache && reservasCache.anio === anio && reservasCache.mes === mes) {
      return reservasCache.datos;
    }
    const datos = (await reservasService.buscar([['fechaSalida', '>=', primerDia]]))
      .filter((r) => r.fechaEntrada <= ultimoDia && r.estado !== 'cancelada');
    reservasCache = { anio, mes, datos };
    return datos;
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

  // ---- Filtro de "Movimientos del mes" (independiente del de arriba) ----
  const selMovEdificio = el('select', {}, [
    el('option', { value: '' }, 'Todos los complejos'),
    ...edificios.map((ed) => el('option', { value: ed.id }, ed.nombre))
  ]);
  const selMovUnidad = el('select', {});
  function refrescarOpcionesMovUnidad() {
    const disponibles = filtroMovEdificio ? unidades.filter((u) => u.edificioId === filtroMovEdificio) : unidades;
    selMovUnidad.innerHTML = '';
    selMovUnidad.append(el('option', { value: '' }, 'Todos los departamentos'));
    disponibles.forEach((u) => selMovUnidad.append(el('option', { value: u.id }, u.nombre)));
    if (!disponibles.some((u) => u.id === filtroMovUnidad)) filtroMovUnidad = '';
    selMovUnidad.value = filtroMovUnidad;
  }
  refrescarOpcionesMovUnidad();
  // pintar() reconstruye toda la pantalla (cont.innerHTML = ''), lo que por
  // default manda el scroll al inicio de la página. Acá "Movimientos del
  // mes" vive más abajo, así que guardamos y restauramos el scroll para que
  // no salte al elegir un filtro (a diferencia del filtro de arriba, donde
  // sí tiene sentido volver a ver la grilla completa desde el principio).
  const pintarSinMoverScroll = () => {
    const y = window.scrollY;
    pintar().then(() => requestAnimationFrame(() => window.scrollTo(0, y)));
  };
  selMovEdificio.addEventListener('change', () => { filtroMovEdificio = selMovEdificio.value; refrescarOpcionesMovUnidad(); pintarSinMoverScroll(); });
  selMovUnidad.addEventListener('change', () => { filtroMovUnidad = selMovUnidad.value; pintarSinMoverScroll(); });
  const filtroMovBarra = el('div', { class: 'cal-filtro' }, [
    el('label', { class: 'form__campo' }, [el('span', {}, 'Complejo'), selMovEdificio]),
    el('label', { class: 'form__campo' }, [el('span', {}, 'Departamento'), selMovUnidad])
  ]);

  // Estado de pago, tolerante a reservas viejas sin el campo guardado.
  const pagoDe = (r) => r.estadoPago || estadoPagoDe(r.pagado, r.precioTotal);

  function banda(tramo) {
    const r = tramo.reserva;
    const nombre = (r.huesped?.nombre || '').trim() || 'Sin nombre';
    const clases = ['cal-banda'];
    if (tramo.vieneDeAntes) clases.push('cal-banda--desde-antes');
    if (tramo.sigueDespues) clases.push('cal-banda--hasta-despues');
    if (tramo.medioInicio) clases.push('cal-banda--medio-inicio');
    if (tramo.medioFin) clases.push('cal-banda--medio-fin');
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
      onClick: async () => abrirDetalleReserva(r, await cuentasLazy(), pintarForzado)
    }, contenido);
  }

  async function pintar({ forzar = false } = {}) {
    cont.innerHTML = '';
    cont.append(el('div', { class: 'card' }, spinner('Cargando mes…')));

    const mm = pad(mes);
    const diasEnMes = new Date(anio, mes, 0).getDate();
    const primerDia = `${anio}-${mm}-01`;
    const ultimoDia = `${anio}-${mm}-${pad(diasEnMes)}`;

    // Orden: por edificio/complejo/hotel (nombre), después por piso dentro
    // de cada uno; las unidades sueltas (sin edificio) van todas al final.
    const unidadesFiltradas = unidades
      .filter((u) => !filtroEdificio || u.edificioId === filtroEdificio)
      .filter((u) => !filtroUnidad || u.id === filtroUnidad)
      .sort((a, b) => {
        const edA = edificios.find((e) => e.id === a.edificioId);
        const edB = edificios.find((e) => e.id === b.edificioId);
        if (!edA && !edB) return (a.nombre || '').localeCompare(b.nombre || '', 'es');
        if (!edA) return 1;
        if (!edB) return -1;
        const cmpEd = (edA.nombre || '').localeCompare(edB.nombre || '', 'es');
        if (cmpEd !== 0) return cmpEd;
        return compararPiso((a.piso || '').trim(), (b.piso || '').trim());
      });

    // Reservas que solapan el mes (acotado + filtro cliente), cacheadas por mes
    const reservas = await reservasDelMes(primerDia, ultimoDia, forzar);

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
      const tramos = tramosDeMes(porUnidad[u.id] || [], dias, primerDia, ultimoDia);
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

      const nombreEdU = nombreEd(u.edificioId);
      const etiqueta = el('th', { class: 'cal-unidad', scope: 'row' }, [
        el('div', { class: 'cal-unidad__nombre' }, u.nombre),
        nombreEdU ? el('div', { class: 'cal-unidad__ed' }, nombreEdU) : null
      ].filter(Boolean));
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

    // ---- Movimientos del mes: entradas y salidas, agrupadas por día.
    // Plegada por default, con su propio filtro de complejo/departamento
    // (independiente del filtro del tape chart de arriba). Reusa `reservas`,
    // ya traído por la única consulta de este mes — no dispara ninguna
    // consulta nueva a Firestore.
    const unidadesParaMov = unidades
      .filter((u) => !filtroMovEdificio || u.edificioId === filtroMovEdificio)
      .filter((u) => !filtroMovUnidad || u.id === filtroMovUnidad);
    const reservasDelFiltro = reservas.filter((r) => unidadesParaMov.some((u) => u.id === r.unidadId));
    const movimientosMes = [];
    reservasDelFiltro.forEach((r) => {
      if (r.fechaEntrada >= primerDia && r.fechaEntrada <= ultimoDia) movimientosMes.push({ r, tipo: 'entra', dia: r.fechaEntrada });
      if (r.fechaSalida >= primerDia && r.fechaSalida <= ultimoDia) movimientosMes.push({ r, tipo: 'sale', dia: r.fechaSalida });
    });
    movimientosMes.sort((a, b) => a.dia.localeCompare(b.dia));

    const cuerpoMov = el('div', {});
    cuerpoMov.hidden = !movAbierta;
    const seccion = el('div', { class: `card card-plegable${movAbierta ? ' is-abierto' : ''}` });
    const tituloMov = el('button', { type: 'button', class: 'card-plegable__titulo' }, [
      'Movimientos del mes',
      el('span', { class: 'reserva-grupo__flecha' }, '▾')
    ]);
    tituloMov.addEventListener('click', () => {
      movAbierta = !movAbierta;
      cuerpoMov.hidden = !movAbierta;
      seccion.classList.toggle('is-abierto', movAbierta);
    });
    seccion.append(el('div', { class: 'finanzas-head' }, [tituloMov]), cuerpoMov);

    cuerpoMov.append(filtroMovBarra);
    if (!movimientosMes.length) {
      cuerpoMov.append(el('p', { class: 'muted' }, 'No hay entradas ni salidas en este mes.'));
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

      cuerpoMov.append(el('div', { class: 'notif-grupos' },
        [...porDia.entries()].map(([dia, items]) => el('div', {}, [
          el('div', { class: 'notif-grupo__fecha' }, fechaCorta(dia)),
          el('div', { class: 'notif-lista' }, items.map((m) => itemMovimientoMes(m, verDinero, esCercano)))
        ]))
      ));
    }
    cont.append(seccion);
  }

  // La usa el detalle de reserva al cerrar con cambios (pago/estado): ahí
  // sí hubo una escritura que el cache de reservasDelMes todavía no vio,
  // así que fuerza a releer aunque el mes mostrado no haya cambiado.
  const pintarForzado = () => pintar({ forzar: true });

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
