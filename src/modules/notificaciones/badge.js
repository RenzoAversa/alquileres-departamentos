// ============================================================
// Campana de notificaciones para la barra superior.
// Siempre visible (así se puede consultar "Próximos" y "Por pagar"
// aunque hoy no haya nada); el punto rojo aparece solo si hay
// movimientos del día.
// ============================================================

import { el } from '../../core/ui.js';
import { notificacionesService } from '../../core/notificaciones.service.js';

export function crearBadgeNotificaciones() {
  const cuenta = el('span', { class: 'notif-campana__cuenta', 'aria-hidden': 'true' });
  const boton = el('button', {
    id: 'notif-campana',
    class: 'notif-campana',
    type: 'button',
    title: 'Notificaciones',
    'aria-label': 'Notificaciones',
    onClick: async () => {
      const { abrirDrawer } = await import('./drawer.js');
      abrirDrawer();
    }
  }, [
    el('span', { class: 'notif-campana__icono', 'aria-hidden': 'true' }, '🔔'),
    cuenta
  ]);

  const actualizar = () => pintarCuenta(boton, cuenta);
  window.addEventListener('notificaciones-updated', actualizar);
  actualizar();

  return boton;
}

function pintarCuenta(boton, cuenta) {
  try {
    const total = notificacionesService.getEstado().contadores.hoy.total || 0;
    const previo = Number(boton.dataset.total || 0);

    boton.dataset.total = String(total);
    boton.classList.toggle('notif-campana--con-avisos', total > 0);
    cuenta.textContent = total > 9 ? '9+' : String(total);
    boton.setAttribute(
      'aria-label',
      total > 0 ? `Notificaciones: ${total} de hoy` : 'Notificaciones'
    );

    // Late un instante solo cuando el número sube
    if (total > previo) {
      cuenta.classList.remove('notif-campana__cuenta--late');
      void cuenta.offsetWidth; // reinicia la animación
      cuenta.classList.add('notif-campana__cuenta--late');
    }
  } catch (err) {
    console.error('[notificaciones] No se pudo actualizar la campana:', err);
  }
}
