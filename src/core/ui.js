// ============================================================
// Helpers de interfaz reutilizables: creación de elementos,
// toasts, confirmaciones, spinners y formateadores.
// ============================================================
import { appConfig } from '../firebase/init.js';
import { hoyISO, diasDe } from './metricas.js';

// Crea un elemento con atributos e hijos. Ej: el('button', {class:'btn'}, 'Guardar')
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v !== null && v !== undefined && v !== false) {
      node.setAttribute(k, v);
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

// Notificación temporal (arriba a la derecha)
export function toast(mensaje, tipo = 'info') {
  let cont = document.getElementById('toast-container');
  if (!cont) {
    cont = el('div', { id: 'toast-container', class: 'toast-container' });
    document.body.append(cont);
  }
  const t = el('div', { class: `toast toast--${tipo}` }, mensaje);
  cont.append(t);
  requestAnimationFrame(() => t.classList.add('toast--visible'));
  setTimeout(() => {
    t.classList.remove('toast--visible');
    setTimeout(() => t.remove(), 250);
  }, 3200);
}

// Diálogo de confirmación. Devuelve Promise<boolean>.
// variante 'eliminar' (default): Cancelar neutro, acción en rojo (peligro).
// variante 'guardar': Cancelar en rojo (descarta), acción en verde (confirma).
export function confirmar(mensaje, opciones = {}) {
  const { variante = 'eliminar', textoConfirmar, textoCancelar = 'Cancelar' } = opciones;
  const esGuardar = variante === 'guardar';
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'modal-overlay' });
    const cerrar = (val) => { overlay.remove(); resolve(val); };
    const box = el('div', { class: 'modal' }, [
      el('p', { class: 'modal__msg' }, mensaje),
      el('div', { class: 'modal__acciones' }, [
        el('button', { class: `btn ${esGuardar ? 'btn--danger' : 'btn--ghost'}`, onClick: () => cerrar(false) }, textoCancelar),
        el('button', { class: `btn ${esGuardar ? 'btn--exito' : 'btn--danger'}`, onClick: () => cerrar(true) }, textoConfirmar || (esGuardar ? 'Guardar' : 'Confirmar'))
      ])
    ]);
    overlay.append(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(false); });
    document.body.append(overlay);
  });
}

// Modal genérico reutilizable: fondo gris que bloquea la app hasta cerrar.
// `contenido` puede ser un nodo DOM, o una función (cerrar) => nodo.
//
// Por defecto es un modal "de formulario": no se cierra solo. Clickear afuera
// o apretar Escape pide confirmación si hay datos sin guardar (se detecta con
// un listener delegado de `input`/`change` sobre el contenido — los widgets
// custom como el mapa o el calendario deben disparar un evento `input` que
// burbujee cuando el usuario los toca). Mientras `setGuardando(true)` está
// activo (petición en curso), no se puede cerrar de ninguna forma.
//
// `cerrarConClickFuera: true` es para modales SIN riesgo de pérdida de datos
// (visores, confirmaciones): ahí click afuera y Escape cierran directo.
//
// Devuelve { overlay, cerrar, intentarCerrar, marcarSucio, setGuardando }.
//   - cerrar(): cierra sin preguntar (usalo después de guardar con éxito).
//   - intentarCerrar(): el flujo "seguro" — usalo en el botón Cancelar.
export function abrirModal(contenido, { ancho = false, cerrarConClickFuera = false } = {}) {
  const overlay = el('div', { class: 'modal-overlay' });
  let sucio = false;
  let guardando = false;
  let preguntando = false;

  function cerrar() {
    document.removeEventListener('keydown', alTeclear);
    overlay.remove();
  }

  async function intentarCerrar() {
    if (guardando || preguntando) return;
    if (!cerrarConClickFuera && sucio) {
      preguntando = true;
      const descartar = await confirmar('Hay datos sin guardar en este formulario. ¿Descartarlos?', {
        textoConfirmar: 'Descartar', textoCancelar: 'Seguir editando'
      });
      preguntando = false;
      if (!descartar) return;
    }
    cerrar();
  }

  const alTeclear = (e) => { if (e.key === 'Escape') intentarCerrar(); };
  document.addEventListener('keydown', alTeclear);
  overlay.addEventListener('click', (e) => {
    if (e.target !== overlay) return;
    if (cerrarConClickFuera) { if (!guardando) cerrar(); return; }
    intentarCerrar();
  });

  const box = typeof contenido === 'function' ? contenido(cerrar) : contenido;
  box.classList.add('modal');
  if (ancho) box.classList.add('modal--ancho');
  const marcarSucio = () => { sucio = true; };
  box.addEventListener('input', marcarSucio);
  box.addEventListener('change', marcarSucio);
  overlay.append(box);
  document.body.append(overlay);

  return {
    overlay, cerrar, intentarCerrar, marcarSucio,
    setGuardando(v) { guardando = !!v; }
  };
}

// Botón de acción estandarizado. variante: primary | ghost | danger | exito | accion
export function boton(texto, { variante = 'primary', tamano = '', tipo = 'button', icono = null, onClick } = {}) {
  const clases = ['btn', `btn--${variante}`];
  if (tamano) clases.push(`btn--${tamano}`);
  const hijos = [];
  if (icono) hijos.push(el('span', { class: 'btn__icono' }, icono));
  hijos.push(el('span', {}, texto));
  return el('button', { class: clases.join(' '), type: tipo, onClick }, hijos);
}

// Campo de formulario con label. `opciones.requerido` agrega el asterisco
// visual y la clase de estilo; no valida nada por sí solo — combinalo con
// `validarFormulario()` para la validación real.
//
// `opciones.tag` ('label' por default): un <label> sin `for` reenvía
// cualquier click en su "espacio muerto" (texto, huecos) al primer control
// enfocable de adentro. Para widgets custom con varios controles propios
// (el calendario de selector-fechas.js, el mapa) eso es un bug — un tap
// fuera de un control real dispara el primero (ej. el botón "‹" del
// calendario, moviendo el mes solo). Pasá `tag: 'div'` en esos casos.
export function campo(label, input, { requerido = false, tag = 'label' } = {}) {
  const textoLabel = requerido
    ? [label, el('span', { class: 'form__requerido', 'aria-hidden': 'true' }, ' *')]
    : label;
  return el(tag, { class: `form__campo${requerido ? ' form__campo--requerido' : ''}` }, [
    el('span', {}, textoLabel),
    input
  ]);
}

// Valida un formulario a mano (los widgets custom —mapa, calendario— no los
// valida el navegador). `campos`: [{ elemento, validar }], donde `validar()`
// devuelve un string con el error, o algo falsy si está OK.
//
// Marca visualmente el primer contenedor `.form__campo` ancestro de cada
// `elemento` con error, muestra el mensaje debajo, y hace scroll + foco al
// primero. El error se limpia solo cuando el usuario toca ese campo de nuevo
// (evento `input`/`change`, incluidos los que disparan los widgets custom).
// Devuelve la lista de errores encontrados (vacía si todo está OK).
export function validarFormulario(campos) {
  const errores = [];
  campos.forEach(({ elemento, validar }) => {
    // Si no está envuelto en campo(), el widget se marca a sí mismo (ej: el mapa).
    const cont = (elemento.closest && elemento.closest('.form__campo')) || elemento;
    limpiarError(cont, elemento);
    const mensaje = validar();
    if (mensaje) {
      errores.push({ elemento, mensaje });
      marcarError(cont, elemento, mensaje);
    }
  });
  if (errores.length) {
    const primero = errores[0].elemento;
    primero.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    primero.focus?.();
  }
  return errores;
}

function marcarError(cont, elemento, mensaje) {
  elemento.classList?.add('input--error');
  cont?.classList.add('form__campo--error');
  let msgEl = cont?.querySelector('.form__error');
  if (!msgEl) {
    msgEl = el('span', { class: 'form__error' });
    cont?.append(msgEl);
  }
  msgEl.textContent = mensaje;
  const limpiar = () => limpiarError(cont, elemento);
  elemento.addEventListener('input', limpiar, { once: true });
  elemento.addEventListener('change', limpiar, { once: true });
}

function limpiarError(cont, elemento) {
  elemento.classList?.remove('input--error');
  cont?.classList.remove('form__campo--error');
  cont?.querySelector('.form__error')?.remove();
}

// Botón "Recargar" con animación mientras `onRecargar` está en curso.
export function botonRecargar(onRecargar, { titulo = 'Recargar' } = {}) {
  const btn = el('button', { class: 'btn btn--ghost btn--sm btn--recargar', type: 'button', title: titulo }, [
    el('span', { class: 'icono-recargar' }, '↻'),
    el('span', {}, titulo)
  ]);
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.add('is-recargando');
    try {
      await onRecargar();
    } finally {
      btn.classList.remove('is-recargando');
      btn.disabled = false;
    }
  });
  return btn;
}

// Paginación reutilizable en memoria: recibe todos los items ya cargados y
// se encarga de renderizar la página actual + controles. `renderItem(item)`
// debe devolver un nodo DOM. Uso:
//   const pag = crearPaginado({ contenedor, renderItem, porPagina: 20 });
//   pag.setItems(lista);
export function crearPaginado({ contenedor, renderItem, porPagina = 20, mensajeVacio = 'No hay elementos.' }) {
  let items = [];
  let pagina = 1;
  const listaEl = el('div', {});
  const controles = el('div', { class: 'paginado' });
  contenedor.append(listaEl, controles);

  function totalPaginas() { return Math.max(1, Math.ceil(items.length / porPagina)); }

  function pintar() {
    const tp = totalPaginas();
    if (pagina > tp) pagina = tp;
    listaEl.innerHTML = '';
    if (!items.length) {
      listaEl.append(vacio(mensajeVacio));
      controles.innerHTML = '';
      return;
    }
    const desde = (pagina - 1) * porPagina;
    items.slice(desde, desde + porPagina).forEach((it) => listaEl.append(renderItem(it)));

    controles.innerHTML = '';
    if (tp <= 1) return;
    controles.append(
      el('button', { class: 'btn btn--ghost btn--sm', type: 'button', disabled: pagina === 1, onClick: () => { pagina--; pintar(); } }, '‹ Anterior'),
      el('span', { class: 'paginado__info' }, `Página ${pagina} de ${tp} · ${items.length} en total`),
      el('button', { class: 'btn btn--ghost btn--sm', type: 'button', disabled: pagina === tp, onClick: () => { pagina++; pintar(); } }, 'Siguiente ›')
    );
  }

  return {
    setItems(nuevos) { items = nuevos || []; pagina = 1; pintar(); },
    refrescar: pintar
  };
}

// Bloque de carga
export function spinner(texto = 'Cargando…') {
  return el('div', { class: 'loading' }, [
    el('div', { class: 'loading__spinner' }),
    el('span', {}, texto)
  ]);
}

// Estado vacío (invitación a actuar)
export function vacio(mensaje, textoBoton, onClick) {
  const acciones = [];
  if (textoBoton && onClick) {
    acciones.push(el('button', { class: 'btn btn--primary', onClick }, textoBoton));
  }
  return el('div', { class: 'vacio' }, [el('p', {}, mensaje), ...acciones]);
}

// ----- Formateadores -----
export function money(n, moneda = appConfig.moneda) {
  const num = Number(n) || 0;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: moneda, maximumFractionDigits: 0
  }).format(num);
}

export function fecha(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Fecha en formato relativo a hoy: "Ayer" / "Hoy" / "Mañana" / día de la
// semana (2 a 6 días) / "16 ago" (resto del año) / "16 ago 2027" (otro año).
export function fechaRelativa(iso) {
  if (!iso) return '';
  const hoy = hoyISO();
  const diff = iso >= hoy ? diasDe(hoy, iso) - 1 : -(diasDe(iso, hoy) - 1);
  if (diff === -1) return 'Ayer';
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff >= 2 && diff <= 6) {
    const dow = new Date(iso + 'T00:00:00Z').getUTCDay();
    return DIAS_SEMANA[dow];
  }
  const [a, m, d] = iso.split('-');
  const anioHoy = hoy.slice(0, 4);
  const base = `${Number(d)} ${MESES_ABR[Number(m) - 1]}`;
  return a === anioHoy ? base : `${base} ${a}`;
}

// Rango legible para botones/resúmenes de período: "11 ago – 17 ago" si
// ambas puntas caen en el año actual (el caso común, no hace falta repetir
// el año), "28 dic 2025 – 3 ene 2026" si alguna cae en otro año.
export function rangoFechas(desde, hasta) {
  if (!desde || !hasta) return '';
  const anioHoy = hoyISO().slice(0, 4);
  const [a1, m1, d1] = desde.split('-');
  const [a2, m2, d2] = hasta.split('-');
  const mismoAnioActual = a1 === anioHoy && a2 === anioHoy;
  const parte = (a, m, d) => `${Number(d)} ${MESES_ABR[Number(m) - 1]}${mismoAnioActual ? '' : ' ' + a}`;
  return `${parte(a1, m1, d1)} – ${parte(a2, m2, d2)}`;
}

// Etiqueta de estado temporal de una reserva ({ estado, fechaEntrada, fechaSalida }),
// calculada contra hoyISO(). Usada en la lista de Reservas y en el Calendario.
export function etiquetaEstadoTemporal(r) {
  if (r.estado === 'cancelada') return null;
  const hoy = hoyISO();
  if (hoy < r.fechaEntrada) {
    const dias = diasDe(hoy, r.fechaEntrada) - 1;
    const texto = dias === 0 ? 'Entra hoy' : dias === 1 ? 'Entra mañana' : `Entra en ${dias} días`;
    return { texto, color: dias <= 1 ? 'var(--color-primario)' : 'var(--texto-muted)' };
  }
  if (hoy < r.fechaSalida) {
    const dias = diasDe(hoy, r.fechaSalida) - 1;
    const texto = dias === 0 ? 'En curso · sale hoy' : dias === 1 ? 'En curso · sale mañana' : `En curso · sale en ${dias} días`;
    return { texto, color: 'var(--ok)' };
  }
  return { texto: 'Finalizada', color: 'var(--texto-muted)' };
}

export function noches(entradaISO, salidaISO) {
  const ms = new Date(salidaISO) - new Date(entradaISO);
  return Math.max(0, Math.round(ms / 86400000));
}

// Compara "pisos" en texto libre (usado en Departamentos y Calendario): si
// ambos son puramente numéricos, orden numérico; si no, alfabético con
// soporte numérico embebido (ej. "Torre A - 3" antes que "Torre A - 10").
export function compararPiso(a, b) {
  const na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb) && String(na) === a.trim() && String(nb) === b.trim()) return na - nb;
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}

// Miniatura de foto (URL externa, sin Storage). Si no hay URL o la imagen
// no carga, muestra un placeholder en vez de romper el layout.
export function miniatura(url, alt = '') {
  if (!url) return el('div', { class: 'miniatura miniatura--vacia' }, '🏠');
  const img = el('img', { src: url, alt, loading: 'lazy', class: 'miniatura' });
  img.addEventListener('error', () => { img.replaceWith(el('div', { class: 'miniatura miniatura--vacia' }, '🏠')); }, { once: true });
  return img;
}
