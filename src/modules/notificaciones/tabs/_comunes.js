// ============================================================
// Piezas compartidas por las tres vistas del panel.
// ============================================================
import { el, fecha } from '../../../core/ui.js';
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

export function textoAtraso(dias) {
  if (dias > 1) return `Vencido hace ${dias} días`;
  if (dias === 1) return 'Vencido hace 1 día';
  if (dias === 0) return 'Vence hoy';
  return Math.abs(dias) === 1 ? 'Vence mañana' : `Vence en ${Math.abs(dias)} días`;
}
