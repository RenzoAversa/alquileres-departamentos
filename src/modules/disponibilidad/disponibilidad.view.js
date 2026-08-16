// ============================================================
// Buscador de disponibilidad (la función estrella).
// Entrada + salida + huéspedes  ->  unidades libres + precio total.
// Eficiencia: trae las reservas UNA vez (acotadas por fecha) y las
// unidades una vez; calcula los solapamientos en el cliente en lugar
// de consultar disponibilidad unidad por unidad.
// ============================================================
import { unidadesService } from '../../services/unidades.service.js';
import { reservasService } from '../../services/reservas.service.js';
import { edificiosService } from '../../services/edificios.service.js';
import { el, toast, spinner, vacio, money, noches, fecha } from '../../core/ui.js';
import { navegar } from '../../core/router.js';
import { store } from '../../core/store.js';
import { hoyISO, masDias, diasDe, diasDelMes, diaSemana, letraDia } from '../../core/metricas.js';
import { crearSelectorFechas } from '../reservas/selector-fechas.js';
import { tramosDeMes } from '../../core/calendario-tape.js';
import { sesion } from '../../core/sesion.js';

const campo = (label, input) => el('label', { class: 'form__campo' }, [el('span', {}, label), input]);

// ¿La unidad está libre en [entrada, salida)? (misma lógica del servicio,
// pero sobre las reservas ya cargadas, sin ir de nuevo a la base)
function estaLibre(reservasUnidad, entrada, salida) {
  const e = new Date(entrada), s = new Date(salida);
  return !reservasUnidad.some((r) => {
    if (r.estado === 'cancelada') return false;
    const re = new Date(r.fechaEntrada), rs = new Date(r.fechaSalida);
    return (e >= re && e < rs) || (s > re && s <= rs) || (e <= re && s >= rs);
  });
}

// Recomendación de encaje: prioriza los departamentos donde reservar acá NO
// deja días muertos entre estadías. "Pega" = una reserva vecina termina
// justo cuando arranca la búsqueda, o arranca justo cuando termina (mismo
// criterio de "no pisa noches" que ya usa estaLibre, en el borde exacto).
// gapAntes/gapDespues quedan en null cuando no hay ninguna reserva vecina
// de ese lado entre los datos que ya trajimos (no hay hueco que medir).
function calcularEncaje(reservasUnidad, entrada, salida) {
  const activas = reservasUnidad.filter((r) => r.estado !== 'cancelada');
  const antes = activas.filter((r) => r.fechaSalida <= entrada);
  const despues = activas.filter((r) => r.fechaEntrada >= salida);
  const anterior = antes.reduce((max, r) => (!max || r.fechaSalida > max.fechaSalida ? r : max), null);
  const siguiente = despues.reduce((min, r) => (!min || r.fechaEntrada < min.fechaEntrada ? r : min), null);

  const pegaAntes = !!anterior && anterior.fechaSalida === entrada;
  const pegaDespues = !!siguiente && siguiente.fechaEntrada === salida;
  const gapAntes = anterior && !pegaAntes ? diasDe(anterior.fechaSalida, masDias(entrada, -1)) : null;
  const gapDespues = siguiente && !pegaDespues ? diasDe(salida, masDias(siguiente.fechaEntrada, -1)) : null;

  const tipo = pegaAntes && pegaDespues ? 'perfecto' : (pegaAntes || pegaDespues) ? 'un-lado' : 'sin-encaje';
  return { tipo, pegaAntes, pegaDespues, gapAntes, gapDespues };
}

const ORDEN_ENCAJE = { perfecto: 0, 'un-lado': 1, 'sin-encaje': 2 };

function etiquetaEncaje({ tipo, pegaAntes }) {
  if (tipo === 'perfecto') return { texto: 'Encaje perfecto', clase: 'badge--ok' };
  if (tipo === 'un-lado') {
    return pegaAntes
      ? { texto: 'Pega con la reserva anterior', clase: 'badge--warn' }
      : { texto: 'Pega con la reserva siguiente', clase: 'badge--warn' };
  }
  return { texto: 'Sin encaje', clase: 'badge--muted' };
}

// Mini calendario del mes de `entrada`, con las reservas de esta unidad
// dibujadas igual que el tape chart de Calendario: mismas bandas continuas,
// mismo medio-día en check-in/check-out (tramosDeMes + clases .cal-*). No
// se agrega ningún estilo de calendario nuevo, solo una versión de una
// fila sola (sin columna de departamento, ya la dice el título de la card).
//
// El rango buscado (entrada→salida) se dibuja como una banda más, en verde
// (cal-banda--busqueda), tratándola igual que una reserva real para que
// tramosDeMes() calcule sus cabos y su medio-día — así se ve exactamente
// dónde encaja contra las reservas vecinas (azules).
function miniCalendario(reservasUnidad, entrada, salida) {
  const [anio, mes] = entrada.split('-').map(Number);
  const dias = diasDelMes(anio, mes);
  const primerDia = dias[0];
  const ultimoDia = dias[dias.length - 1];
  const hoy = hoyISO();

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
  const thead = el('thead', {}, el('tr', {}, headDias));

  const tramosReservas = tramosDeMes(reservasUnidad.filter((r) => r.estado !== 'cancelada'), dias, primerDia, ultimoDia);
  const tramoBusqueda = tramosDeMes([{ fechaEntrada: entrada, fechaSalida: salida, esBusqueda: true }], dias, primerDia, ultimoDia);
  const tramos = [...tramosReservas, ...tramoBusqueda];
  const porInicio = new Map();
  tramos.forEach((t) => { if (!porInicio.has(t.inicio)) porInicio.set(t.inicio, t); });

  const celdas = [];
  let i = 0;
  while (i < dias.length) {
    const tramo = porInicio.get(i);
    if (tramo && i + tramo.largo <= dias.length) {
      celdas.push(el('td', { class: 'cal-celda cal-celda--estadia', colspan: tramo.largo }, bandaMini(tramo)));
      i += tramo.largo;
    } else {
      const ds = diaSemana(dias[i]);
      const finde = ds === 0 || ds === 6;
      celdas.push(el('td', { class: `cal-celda${finde ? ' cal-finde' : ''}` }));
      i++;
    }
  }
  const tabla = el('table', { class: 'cal cal--mini', style: `--cal-dias:${dias.length}` }, [thead, el('tbody', {}, el('tr', {}, celdas))]);
  return el('div', { class: 'cal-scroll' }, el('div', { class: 'cal-lienzo' }, tabla));
}

function bandaMini(tramo) {
  const r = tramo.reserva;
  const esBusqueda = !!r.esBusqueda;
  const nombre = esBusqueda ? 'Tu reserva' : ((r.huesped?.nombre || '').trim() || 'Sin nombre');
  const clases = ['cal-banda', 'cal-banda--mini'];
  if (esBusqueda) clases.push('cal-banda--busqueda');
  if (tramo.vieneDeAntes) clases.push('cal-banda--desde-antes');
  if (tramo.sigueDespues) clases.push('cal-banda--hasta-despues');
  if (tramo.medioInicio) clases.push('cal-banda--medio-inicio');
  if (tramo.medioFin) clases.push('cal-banda--medio-fin');
  return el('div', {
    class: clases.join(' '),
    title: `${nombre} · ${fecha(r.fechaEntrada)} → ${fecha(r.fechaSalida)}`
  }, el('span', { class: 'cal-banda__nombre' }, nombre));
}

// Reservas activas (no canceladas) de la unidad que se cruzan con el rango
// buscado, con cuántas noches de ese rango toma cada una.
function reservasQuePisan(reservasUnidad, entrada, salida) {
  return reservasUnidad
    .filter((r) => r.estado !== 'cancelada' && r.fechaEntrada < salida && r.fechaSalida > entrada)
    .map((r) => {
      const desde = r.fechaEntrada > entrada ? r.fechaEntrada : entrada;
      const hasta = r.fechaSalida < salida ? r.fechaSalida : salida;
      return { reserva: r, diasTomados: diasDe(desde, masDias(hasta, -1)) };
    })
    .sort((a, b) => a.reserva.fechaEntrada.localeCompare(b.reserva.fechaEntrada));
}

// Tramos libre/ocupado noche a noche dentro del rango buscado, para poder
// decir "libre del 10 al 12, ocupado del 12 al 15" cuando el choque es
// solo parcial (en vez de tratar todo el rango como un bloque ocupado).
function segmentosOcupacion(reservasUnidad, entrada, salida) {
  const activas = reservasUnidad.filter((r) => r.estado !== 'cancelada');
  const ocupadaEn = (dia) => activas.some((r) => r.fechaEntrada <= dia && dia < r.fechaSalida);
  const segmentos = [];
  let d = entrada;
  while (d < salida) {
    const ocupado = ocupadaEn(d);
    const ultimo = segmentos[segmentos.length - 1];
    if (ultimo && ultimo.ocupado === ocupado) ultimo.hasta = masDias(d, 1);
    else segmentos.push({ ocupado, desde: d, hasta: masDias(d, 1) });
    d = masDias(d, 1);
  }
  return segmentos;
}

const MOTIVO_INFO = {
  inactiva: { texto: 'Inactiva', clase: 'badge--muted' },
  capacidad: { texto: 'Capacidad insuficiente', clase: 'badge--warn' },
  ocupada: { texto: 'Ocupada', clase: 'badge--alerta' }
};

// Tarjeta plegable (misma clase .card-plegable que ya usa Calendario para
// "Movimientos del mes"), cerrada por default. Distingue el motivo real de
// descarte en vez de tratar "inactiva"/"capacidad"/"ocupada" todas igual.
function tarjetaOcupada({ unidad, ed, rs, motivo }, { entrada, salida, huespedes, verDinero }) {
  const info = MOTIVO_INFO[motivo];
  let abierta = false;
  const cuerpo = el('div', { class: 'disponibilidad-ocupada__cuerpo' });
  cuerpo.hidden = true;

  if (motivo === 'inactiva') {
    cuerpo.append(el('p', { class: 'muted small' }, 'Esta unidad está marcada como inactiva.'));
  } else if (motivo === 'capacidad') {
    cuerpo.append(el('p', { class: 'muted small' }, `Capacidad para ${unidad.capacidad || 1} pers., se buscaron ${huespedes}.`));
  } else {
    const segmentos = segmentosOcupacion(rs, entrada, salida);
    if (segmentos.length > 1) {
      const texto = segmentos.map((s) => `${s.ocupado ? 'Ocupado' : 'Libre'} del ${fecha(s.desde)} al ${fecha(s.hasta)}`).join(' · ');
      cuerpo.append(el('p', { class: 'muted small' }, texto));
    }
    reservasQuePisan(rs, entrada, salida).forEach(({ reserva, diasTomados }) => {
      cuerpo.append(el('div', { class: 'lista__item' }, [
        el('div', {}, [
          el('strong', {}, reserva.huesped?.nombre || 'Sin nombre'),
          el('div', { class: 'muted small' }, `${fecha(reserva.fechaEntrada)} → ${fecha(reserva.fechaSalida)} · ${diasTomados} día(s) del rango buscado`)
        ]),
        verDinero ? el('div', { class: 'muted small' }, money(reserva.precioTotal || 0)) : null
      ]));
    });
  }

  const tarjeta = el('div', { class: 'card card-plegable' });
  const titulo = el('button', { type: 'button', class: 'card-plegable__titulo' }, [
    el('span', { style: 'flex:1' }, `${unidad.nombre}${ed ? ' · ' + ed.nombre : ''}`),
    el('span', { class: `badge ${info.clase}` }, info.texto),
    el('span', { class: 'reserva-grupo__flecha' }, '▾')
  ]);
  titulo.addEventListener('click', () => {
    abierta = !abierta;
    cuerpo.hidden = !abierta;
    tarjeta.classList.toggle('is-abierto', abierta);
  });
  tarjeta.append(titulo, cuerpo);
  return tarjeta;
}

export async function render(container) {
  container.append(el('h1', { class: 'page-title' }, 'Buscar disponibilidad'));

  // Mismo calendario que Reservas, solo que acá todavía no hay una unidad
  // elegida: arranca sin ocupación marcada (mostrarSinUnidad) y sin ningún
  // rango preseleccionado, para que el usuario elija las fechas a buscar.
  const selectorFechas = crearSelectorFechas({ mostrarSinUnidad: true });

  const inHuespedes = el('input', { name: 'huespedes', type: 'number', min: '1', value: '1' });
  const campoHuespedes = campo('Huéspedes', inHuespedes);
  campoHuespedes.classList.add('disponibilidad-campo-huespedes');

  // div, no campo()/<label>: un <label> sin `for` reenvía cualquier click
  // en su "espacio muerto" (el texto del resumen, por ejemplo) al primer
  // control enfocable de adentro -el botón "‹" del calendario-, haciendo
  // que un tap fuera de un día retroceda el mes solo. El calendario ya
  // maneja su propio foco por día, no necesita el forwarding de <label>.
  const campoFechas = el('div', { class: 'form__campo' }, [el('span', {}, 'Fechas'), selectorFechas.element]);

  const form = el('form', { class: 'card form' }, [
    campoFechas,
    campoHuespedes,
    el('button', { class: 'btn btn--primary', type: 'submit' }, 'Buscar disponibles')
  ]);
  container.append(form);

  const resultados = el('div', {});
  container.append(resultados);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { entrada, salida } = selectorFechas.getRango();
    const huespedes = parseInt(inHuespedes.value) || 1;

    if (!entrada || !salida) {
      toast('Elegí la fecha de entrada y de salida', 'alerta');
      return;
    }

    resultados.innerHTML = '';
    resultados.append(spinner('Buscando…'));

    // Datos frescos (unidades/edificios son pocos documentos). Reservas
    // acotadas desde el 1º del mes de la entrada (no solo desde "entrada"):
    // ese margen hace falta para dibujar el mini calendario del mes
    // completo y para detectar reservas que ya terminaron antes de la
    // entrada al calcular el encaje. Sigue siendo UNA sola consulta.
    const primerDiaMes = `${entrada.slice(0, 7)}-01`;
    const [unidades, edificios, reservas] = await Promise.all([
      unidadesService.getAll(),
      edificiosService.getAll(),
      reservasService.buscar([['fechaSalida', '>=', primerDiaMes]])
    ]);

    const n = noches(entrada, salida);
    const verDinero = sesion.puede('verDinero');

    // Un solo pase por todas las unidades, distinguiendo el motivo real de
    // descarte (antes se pisaban los tres: inactiva, capacidad insuficiente
    // y ocupada quedaban todas igual de "no aparece").
    const todas = unidades.map((u) => {
      const rs = reservas.filter((r) => r.unidadId === u.id);
      const inactiva = u.estado === 'inactivo';
      const capacidadInsuficiente = !inactiva && (Number(u.capacidad) || 1) < huespedes;
      const libre = !inactiva && !capacidadInsuficiente && estaLibre(rs, entrada, salida);
      const motivo = inactiva ? 'inactiva' : capacidadInsuficiente ? 'capacidad' : (!libre ? 'ocupada' : null);
      return { unidad: u, rs, libre, motivo };
    });

    const disponibles = todas
      .filter((x) => x.libre)
      .map((x) => ({ ...x, encaje: calcularEncaje(x.rs, entrada, salida) }))
      // Encaje perfecto primero, después de un lado, después sin encaje;
      // dentro de cada grupo, el más barato primero.
      .sort((a, b) => ORDEN_ENCAJE[a.encaje.tipo] - ORDEN_ENCAJE[b.encaje.tipo] || (a.unidad.precioNoche || 0) - (b.unidad.precioNoche || 0));
    const ocupados = todas.filter((x) => !x.libre);

    resultados.innerHTML = '';

    if (!disponibles.length && !ocupados.length) {
      resultados.append(vacio('Todavía no hay departamentos cargados.'));
      return;
    }

    if (disponibles.length) {
      const seccion = el('div', {}, [el('h3', {}, `${disponibles.length} disponible(s) · ${n} noche(s)`)]);

      disponibles.forEach(({ unidad, rs, encaje }) => {
        const ed = edificios.find((x) => x.id === unidad.edificioId);
        const total = n * (unidad.precioNoche || 0);
        const etiqueta = etiquetaEncaje(encaje);

        const gaps = [];
        if (encaje.gapAntes) gaps.push(`quedan ${encaje.gapAntes} día(s) libres antes`);
        if (encaje.gapDespues) gaps.push(`quedan ${encaje.gapDespues} día(s) libres después`);

        seccion.append(el('div', { class: 'card disponibilidad-tarjeta' }, [
          el('div', { class: 'disponibilidad-tarjeta__header' }, [
            el('div', {}, [
              el('strong', {}, unidad.nombre),
              el('span', { class: 'muted' }, ` · ${ed ? ed.nombre : 'Sin edificio'} · ${unidad.capacidad} pers.`),
              el('div', { class: 'muted small' }, `${money(unidad.precioNoche)} / noche`)
            ]),
            el('span', { class: `badge ${etiqueta.clase}` }, etiqueta.texto)
          ]),
          miniCalendario(rs, entrada, salida),
          gaps.length ? el('p', { class: 'muted small disponibilidad-gaps' }, gaps.join(' · ')) : null,
          el('div', { class: 'disponibilidad-tarjeta__pie' }, [
            el('div', { style: 'text-align:right' }, [
              el('div', { style: 'font-weight:700' }, money(total)),
              el('div', { class: 'muted small' }, 'total')
            ]),
            el('button', {
              class: 'btn btn--primary btn--sm',
              onClick: () => {
                // Pasa la preselección a Reservas vía el store
                store.set('reservaPreset', { unidadId: unidad.id, entrada, salida, huespedes });
                navegar('reservas');
              }
            }, 'Reservar')
          ])
        ]));
      });

      resultados.append(seccion);
    } else {
      resultados.append(vacio(`No hay unidades libres para ${huespedes} huésped(es) en esas fechas.`));
    }

    if (ocupados.length) {
      const seccionOcupados = el('div', {}, [el('h3', {}, `${ocupados.length} no disponible(s)`)]);
      ocupados.forEach((x) => {
        const ed = edificios.find((e2) => e2.id === x.unidad.edificioId);
        seccionOcupados.append(tarjetaOcupada({ ...x, ed }, { entrada, salida, huespedes, verDinero }));
      });
      resultados.append(seccionOcupados);
    }
  });
}
