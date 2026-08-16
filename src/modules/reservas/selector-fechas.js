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
import { el, toast, confirmar, noches } from '../../core/ui.js';
import { hoyISO, masDias, diasDelMes, diaSemana } from '../../core/metricas.js';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Cuánto para atrás se puede cargar una reserva retroactiva: un tope
// generoso que evita errores groseros de tipeo (ej. año equivocado) sin
// molestar el uso real de "me olvidé de cargar esta reserva".
const DIAS_LIMITE_RETRO = 365;

export function crearSelectorFechas({ onCambio, excluirId = null } = {}) {
  let unidadId = null;
  const cache = new Map(); // unidadId -> reservas[]
  const hoy = hoyISO();
  const limiteRetro = masDias(hoy, -DIAS_LIMITE_RETRO);
  let [anioActual, mesActual] = hoy.split('-').map(Number);
  let entrada = null;
  let salida = null;
  // Permiso de "reserva retroactiva": arranca apagado, se prende con la
  // confirmación del usuario al tocar un día pasado, y dura toda la vida
  // de este selector (una instancia por apertura de modal, así que se
  // resetea solo la próxima vez que se abra el formulario).
  let modoRetro = false;
  let preguntandoRetro = false;

  const mensaje = el('p', { class: 'muted small' }, 'Elegí un departamento para ver su disponibilidad');
  const avisoRetro = el('div', { class: 'selector-fechas__aviso-retro', hidden: true }, 'Modo reserva previa activado');
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
  const calendario = el('div', { class: 'selector-fechas__cal', hidden: true }, [cabecera, avisoRetro, grillaSemana, grilla]);
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

  // Ocupación real de un día, sin importar si es pasado o futuro: la usan
  // tanto estadoDia() (para pintar/bloquear) como el desbloqueo retroactivo
  // (un día pasado sigue rechazándose si ya está ocupado).
  function estadoOcupacionDia(iso, reservas) {
    const esCheckin = reservas.some((r) => r.estado !== 'cancelada' && (!excluirId || r.id !== excluirId) && r.fechaEntrada === iso);
    const esCheckout = reservas.some((r) => r.estado !== 'cancelada' && (!excluirId || r.id !== excluirId) && r.fechaSalida === iso);
    if (esCheckin && esCheckout) return 'full';
    if (esCheckin) return 'checkin';
    if (esCheckout) return 'checkout';
    if (nocheOcupada(iso, reservas)) return 'ocupado';
    return 'libre';
  }

  function estadoDia(iso, reservas) {
    if (iso < hoy && !modoRetro) return 'pasado';
    return estadoOcupacionDia(iso, reservas);
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
    // Día pasado con el modo retroactivo todavía apagado: pedir confirmación
    // antes de desbloquear. La confirmación se pide ACÁ (al tocar el día),
    // no al guardar, para que el usuario sepa de entrada que puede cargarla.
    if (iso < hoy && !modoRetro) {
      if (preguntandoRetro) return; // ya hay un modal de confirmación abierto
      if (iso < limiteRetro) {
        toast('No se pueden cargar reservas de más de un año atrás', 'alerta');
        return;
      }
      preguntandoRetro = true;
      confirmar('¿Seguro que querés iniciar una reserva previa al día de hoy?', {
        variante: 'guardar', textoConfirmar: 'Sí, habilitar'
      }).then((ok) => {
        preguntandoRetro = false;
        if (!ok) return;
        modoRetro = true;
        pintarCalendario(); // repinta ya mismo el cartel y el estilo de los días pasados
        clickDia(iso, reservas); // reintenta el mismo click, ahora desbloqueado
      });
      return;
    }

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

  // Igual que con el header (ver comentario arriba): las celdas de día NUNCA
  // se destruyen una vez creadas, se reutilizan y solo se les actualiza
  // clase/texto/dataset. Si se recrean en cada pintarCalendario() (como antes),
  // un tap sobre un día puede resolver como ghost-click contra lo que quedó
  // en esa posición tras el rebuild — en mobile esto se veía como "elegir un
  // día te manda un mes para atrás".
  const poolCeldas = [];
  let reservasActual = [];

  function obtenerCelda(i) {
    if (poolCeldas[i]) return poolCeldas[i];
    const celda = el('button', { type: 'button', class: 'selector-fechas__dia selector-fechas__dia--vacio' }, '');
    celda.addEventListener('click', () => {
      const iso = celda.dataset.iso;
      if (!iso) return;
      clickDia(iso, reservasActual);
    });
    poolCeldas[i] = celda;
    grilla.append(celda);
    return celda;
  }

  function pintarCalendario() {
    if (!unidadId) { calendario.hidden = true; mensaje.hidden = false; return; }
    mensaje.hidden = true; calendario.hidden = false;
    avisoRetro.hidden = !modoRetro;
    reservasActual = cache.get(unidadId) || [];

    tituloMes.textContent = `${MESES[mesActual - 1]} ${anioActual}`;

    const dias = diasDelMes(anioActual, mesActual);
    const primerDow = diaSemana(dias[0]);
    const totalCeldas = primerDow + dias.length;

    for (let i = 0; i < totalCeldas; i++) {
      const celda = obtenerCelda(i);
      celda.style.display = '';
      if (i < primerDow) {
        celda.className = 'selector-fechas__dia selector-fechas__dia--vacio';
        celda.textContent = '';
        celda.disabled = false;
        delete celda.dataset.iso;
        continue;
      }
      const iso = dias[i - primerDow];
      const estado = estadoDia(iso, reservasActual);
      const clases = ['selector-fechas__dia', `selector-fechas__dia--${estado}`];
      // Día pasado pero desbloqueado por el modo retroactivo: se pinta con
      // su color real de ocupación, pero distinguible de un día futuro.
      if (iso < hoy && estado !== 'pasado') clases.push('is-pasado-habilitado');
      if (entrada && iso === entrada) clases.push('is-entrada');
      if (salida && iso === salida) clases.push('is-salida');
      if (entrada && !salida && iso > entrada) clases.push('is-en-rango-tentativo');
      if (entrada && salida && iso > entrada && iso < salida) clases.push('is-en-rango');
      celda.className = clases.join(' ');
      celda.textContent = String(Number(iso.slice(8)));
      // OJO: nunca poner celda.disabled = true acá. Un <button disabled> no
      // dispara 'click' (ni real ni sintético), así que un día "pasado" jamás
      // podría abrir la confirmación para desbloquearlo. El bloqueo real vive
      // en clickDia(); acá solo se pinta el cursor "not-allowed" por CSS,
      // igual que ya se hacía con los días ocupados/full.
      celda.disabled = false;
      celda.dataset.iso = iso;
    }
    // Celdas del pool que sobran este mes (meses de 5 semanas vs 6): se ocultan
    // pero no se destruyen, quedan listas para reusarse el próximo mes que las necesite.
    for (let i = totalCeldas; i < poolCeldas.length; i++) poolCeldas[i].style.display = 'none';
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
    // Para editar una reserva que YA es retroactiva (se cargó con fecha
    // pasada): no tiene sentido volver a pedir confirmación por datos que
    // ya existen, así que esto prende el modo sin pasar por el modal.
    activarModoRetroSinConfirmar() { modoRetro = true; pintarCalendario(); },
    reset() { entrada = null; salida = null; pintarCalendario(); pintarResumen(); emitCambio(); }
  };
}
