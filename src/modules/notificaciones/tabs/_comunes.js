// ============================================================
// Piezas compartidas por las tres vistas del panel.
// ============================================================
import { el, fecha, money } from '../../../core/ui.js';
import { sesion } from '../../../core/sesion.js';
import { notificacionesService } from '../../../core/notificaciones.service.js';

export const puedeVerDinero = () => sesion.puede('verDinero');

export function vacioNotif(titulo, ayuda) {
  return el('div', { class: 'notif-vacio' }, [el('strong', {}, titulo), ayuda || '']);
}

export function telefonoLink(huesped) {
  const tel = huesped?.telefono;
  if (!tel) return null;
  return el('a', { href: `tel:${String(tel).replace(/\s+/g, '')}` }, `📞 ${tel}`);
}

export function nombreDe(reserva) {
  return (reserva.huesped?.nombre || '').trim() || 'Sin nombre';
}

// "Lun 15 ago" — corto y legible en el panel
export function fechaCorta(iso) {
  try {
    const d = new Date(iso + 'T00:00:00');
    const txt = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  } catch { return fecha(iso); }
}

// Botón "ojo" para marcar/desmarcar un aviso como visto. Aplica de una el
// estado inicial (atenuado) sobre `itemEl` y lo actualiza al toque —
// así la campana baja en el momento, sin esperar a reabrir el panel.
export function botonOjo(avisoId, itemEl) {
  if (!avisoId) return null;
  const marcar = (visto) => {
    itemEl.classList.toggle('notif-item--visto', visto);
    btn.textContent = visto ? '🙈' : '👁';
    const titulo = visto ? 'Marcar como no visto' : 'Marcar como visto';
    btn.title = titulo;
    btn.setAttribute('aria-label', titulo);
  };
  const btn = el('button', {
    class: 'notif-item__ojo', type: 'button',
    onClick: (e) => {
      e.stopPropagation();
      notificacionesService.alternarVisto(avisoId);
      marcar(notificacionesService.estaVisto(avisoId));
    }
  }, '');
  marcar(notificacionesService.estaVisto(avisoId));
  return btn;
}

// Ids de ítems con el detalle expandido, a nivel de módulo: las 3 vistas se
// reconstruyen enteras cada vez que se abre el drawer (ver drawer.js), así
// que este Set es lo que hace sobrevivir el "abierto/cerrado" entre una
// apertura y otra del panel, sin gastar ni localStorage ni Firestore.
const expandidos = new Set();

// Agrega una flechita a `fila` que expande/colapsa un bloque de detalle
// dentro de `itemEl`. `id` tiene que ser estable entre re-renders (el
// avisoId ya cumple esto). Si no hay nada para mostrar, no agrega nada.
export function conDetalleExpandible(id, itemEl, fila, detalleNodos) {
  const contenido = (detalleNodos || []).filter(Boolean);
  if (!id || !contenido.length) return itemEl;

  const abierto = expandidos.has(id);
  const cuerpo = el('div', { class: 'notif-item__expandido' }, contenido);
  cuerpo.hidden = !abierto;
  if (abierto) itemEl.classList.add('is-abierto');

  const btn = el('button', {
    class: 'notif-item__toggle', type: 'button',
    'aria-label': 'Ver más detalle', 'aria-expanded': abierto ? 'true' : 'false',
    onClick: (e) => {
      e.stopPropagation();
      cuerpo.hidden = !cuerpo.hidden;
      itemEl.classList.toggle('is-abierto', !cuerpo.hidden);
      btn.setAttribute('aria-expanded', cuerpo.hidden ? 'false' : 'true');
      if (cuerpo.hidden) expandidos.delete(id); else expandidos.add(id);
    }
  }, el('span', { class: 'notif-item__flecha' }, '▾'));

  fila.append(btn);
  itemEl.append(cuerpo);
  return itemEl;
}

// Detalle adicional de una reserva para el bloque expandible: fechas
// completas, email y (si el rol ve dinero) total/pagado. Cada tab ya
// muestra en la fila principal lo más urgente (hora, monto, teléfono);
// esto es lo que hoy no se ve en ningún lado.
export function detalleReserva(r) {
  const filas = [];
  if (r.fechaEntrada && r.fechaSalida) {
    filas.push(el('div', {}, `${fecha(r.fechaEntrada)} → ${fecha(r.fechaSalida)}${r.noches ? ` · ${r.noches} noche(s)` : ''}`));
  }
  if (r.huesped?.email) filas.push(el('div', {}, `✉ ${r.huesped.email}`));
  if (puedeVerDinero()) {
    const total = Number(r.precioTotal) || 0;
    const pagado = Number(r.pagado) || 0;
    filas.push(el('div', {}, `Total ${money(total)} · Pagado ${money(pagado)}`));
  }
  return filas;
}

export function textoAtraso(dias) {
  if (dias > 1) return `Vencido hace ${dias} días`;
  if (dias === 1) return 'Vencido hace 1 día';
  if (dias === 0) return 'Vence hoy';
  return Math.abs(dias) === 1 ? 'Vence mañana' : `Vence en ${Math.abs(dias)} días`;
}
