// ============================================================
// Mini calendario de selección de fechas para el alta/edición de
// reservas. Muestra la ocupación real de la unidad elegida y deja
// elegir entrada/salida con dos clicks. Reusable entre alta y edición.
//
//   const sel = crearSelectorFechas({ onCambio, excluirId });
//   sel.setUnidad(unidadId);          // trae y cachea sus reservas
//   sel.element                        // nodo para insertar en el form
//   sel.getRango()                     // { entrada, salida }
// ============================================================
import { reservasService } from '../../services/reservas.service.js';
import { el, toast, noches } from '../../core/ui.js';
import { hoyISO, masDias, diasDelMes, diaSemana } from '../../core/metricas.js';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function crearSelectorFechas({ onCambio, excluirId = null } = {}) {
  let unidadId = null;
  const cache = new Map(); // unidadId -> reservas[]
  const hoy = hoyISO();
  let [anioActual, mesActual] = hoy.split('-').map(Number);
  let entrada = null;
  let salida = null;

  const mensaje = el('p', { class: 'muted small' }, 'Elegí un departamento para ver su disponibilidad');
  // Los botones de navegación y el título del mes se crean UNA sola vez: si se
  // recrean en cada pintarCalendario() (como antes), un tap sobre un día queda
  // mid-rebuild y el navegador puede resolver el click sintético (ghost click,
  // típico en mobile sin touch-action) contra el botón "‹" que quedó justo
  // encima, hciendo que el mes retroceda solo al elegir una fecha.
  const btnPrev = el('button', { type: 'button', class: 'btn btn--ghost btn--sm' }, '‹');
  const btnNext = el('button', { type: 'button', class: 'btn btn--ghost btn--sm' }, '›');
  const tituloMes = el('strong', {}, '');
  btnPrev.addEventListener('click', () => { cambiarMes(-1); });
  btnNext.addEventListener('click', () => { cambiarMes(1); });
  const cabecera = el('div', { class: 'selector-fechas__header' }, [btnPrev, tituloMes, btnNext]);
  const grillaSemana = el('div', { class: 'selector-fechas__semana' },
    ['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d) => el('span', {}, d)));
  const grilla = el('div', { class: 'selector-fechas__grid' });
  const calendario = el('div', { class: 'selector-fechas__cal', hidden: true }, [cabecera, grillaSemana, grilla]);
  const resumen = el('div', { class: 'selector-fechas__resumen muted small' }, '');
  const element = el('div', { class: 'selector-fechas' }, [mensaje, calendario, resumen]);

  function emitCambio() {
    const n = (entrada && salida) ? noches(entrada, salida) : 0;
    if (onCambio) onCambio({ entrada, salida, noches: n });
  }

  function pintarResumen() {
    if (!entrada && !salida) { resumen.textContent = 'Elegí la fecha de entrada.'; return; }
    if (entrada && !salida) { resumen.textContent = `Entrada: ${fechaLegible(entrada)} · elegí la salida.`; return; }
    const n = noches(entrada, salida);
    resumen.textContent = `${fechaLegible(entrada)} → ${fechaLegible(salida)} · ${n} noche(s)`;
  }

  function fechaLegible(iso) {
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }

  // ¿La noche que arranca en `iso` está ocupada por alguna reserva? (excluye canceladas y excluirId)
  function nocheOcupada(iso, reservas) {
    return reservas.some((r) => {
      if (r.estado === 'cancelada') return false;
      if (excluirId && r.id === excluirId) return false;
      return r.fechaEntrada <= iso && iso < r.fechaSalida;
    });
  }

  function estadoDia(iso, reservas) {
    if (iso < hoy) return 'pasado';
    const esCheckin = reservas.some((r) => r.estado !== 'cancelada' && (!excluirId || r.id !== excluirId) && r.fechaEntrada === iso);
    const esCheckout = reservas.some((r) => r.estado !== 'cancelada' && (!excluirId || r.id !== excluirId) && r.fechaSalida === iso);
    if (esCheckin && esCheckout) return 'full';
    if (esCheckin) return 'checkin';
    if (esCheckout) return 'checkout';
    if (nocheOcupada(iso, reservas)) return 'ocupado';
    return 'libre';
  }

  // ¿Hay alguna noche ocupada dentro de [desde, hasta)?
  function rangoPisaOcupado(desde, hasta, reservas) {
    let d = desde;
    while (d < hasta) {
      if (nocheOcupada(d, reservas)) return true;
      d = masDias(d, 1);
    }
    return false;
  }

  function clickDia(iso, reservas) {
    const estado = estadoDia(iso, reservas);
    if (estado === 'pasado' || estado === 'ocupado' || estado === 'full') return;

    if (!entrada || (entrada && salida)) {
      // Empezar selección nueva
      if (estado !== 'libre' && estado !== 'checkout') { toast('Esa fecha no está disponible como entrada', 'alerta'); return; }
      entrada = iso; salida = null;
    } else if (iso <= entrada) {
      // Reiniciar desde la fecha clickeada
      if (estado !== 'libre' && estado !== 'checkout') { toast('Esa fecha no está disponible como entrada', 'alerta'); return; }
      entrada = iso; salida = null;
    } else {
      if (rangoPisaOcupado(entrada, iso, reservas)) {
        toast('Ese rango pisa noches ya ocupadas, elegí otra salida', 'alerta');
        salida = null;
      } else {
        salida = iso;
      }
    }
    pintarCalendario();
    pintarResumen();
    emitCambio();
    // Burbujea para que abrirModal() detecte "hay datos sin guardar".
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function pintarCalendario() {
    if (!unidadId) { calendario.hidden = true; mensaje.hidden = false; return; }
    mensaje.hidden = true; calendario.hidden = false;
    const reservas = cache.get(unidadId) || [];

    tituloMes.textContent = `${MESES[mesActual - 1]} ${anioActual}`;

    grilla.innerHTML = '';
    const dias = diasDelMes(anioActual, mesActual);
    const primerDow = diaSemana(dias[0]);
    for (let i = 0; i < primerDow; i++) grilla.append(el('span', { class: 'selector-fechas__dia selector-fechas__dia--vacio' }, ''));

    dias.forEach((iso) => {
      const estado = estadoDia(iso, reservas);
      const clases = ['selector-fechas__dia', `selector-fechas__dia--${estado}`];
      if (entrada && iso === entrada) clases.push('is-entrada');
      if (salida && iso === salida) clases.push('is-salida');
      if (entrada && !salida && iso > entrada) clases.push('is-en-rango-tentativo');
      if (entrada && salida && iso > entrada && iso < salida) clases.push('is-en-rango');
      const celda = el('button', { type: 'button', class: clases.join(' '), disabled: estado === 'pasado' }, String(Number(iso.slice(8))));
      celda.addEventListener('click', () => clickDia(iso, reservas));
      grilla.append(celda);
    });
  }

  function cambiarMes(delta) {
    mesActual += delta;
    if (mesActual < 1) { mesActual = 12; anioActual--; }
    if (mesActual > 12) { mesActual = 1; anioActual++; }
    pintarCalendario();
  }

  async function setUnidad(id) {
    unidadId = id || null;
    entrada = null; salida = null;
    if (!unidadId) { pintarCalendario(); pintarResumen(); emitCambio(); return; }
    if (!cache.has(unidadId)) {
      cache.set(unidadId, await reservasService.getByUnidad(unidadId));
    }
    const hoyDate = hoy.split('-').map(Number);
    anioActual = hoyDate[0]; mesActual = hoyDate[1];
    pintarCalendario();
    pintarResumen();
    emitCambio();
  }

  function setRangoInicial(e, s) {
    entrada = e || null;
    salida = s || null;
    if (entrada) { const [a, m] = entrada.split('-').map(Number); anioActual = a; mesActual = m; }
    pintarCalendario();
    pintarResumen();
  }

  pintarResumen();

  return {
    element,
    setUnidad,
    setRangoInicial,
    getRango: () => ({ entrada, salida }),
    reset() { entrada = null; salida = null; pintarCalendario(); pintarResumen(); emitCambio(); }
  };
}
