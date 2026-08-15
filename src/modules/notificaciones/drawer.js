// ============================================================
// Panel lateral de notificaciones con tres vistas:
// Hoy · Próximos 7 días · Por cobrar
// ============================================================

import { el } from '../../core/ui.js';
import { notificacionesService } from '../../core/notificaciones.service.js';
import { crearVistaHoy } from './tabs/hoy.tab.js';
import { crearVistaProximos } from './tabs/proximos.tab.js';
import { crearVistaPorPagar } from './tabs/porpagar.tab.js';

let abierto = false;
let limpiarTeclado = null;

export function abrirDrawer() {
  if (abierto) return;

  const estado = notificacionesService.getEstado();
  const c = estado.contadores;

  const vistas = [
    { id: 'hoy', label: 'Hoy', n: c.hoy.total, nodo: crearVistaHoy(estado.hoy) },
    { id: 'proximos', label: '7 días', n: c.proximos7d.total, nodo: crearVistaProximos(estado.proximos7d) },
    { id: 'porpagar', label: 'Por cobrar', n: c.porPagar.total, nodo: crearVistaPorPagar(estado.porPagar, c.porPagar) }
  ];

  const solapas = el('div', { class: 'notif-panel__solapas', role: 'tablist' },
    vistas.map((v, i) => el('button', {
      class: `notif-solapa${i === 0 ? ' is-active' : ''}`,
      type: 'button', role: 'tab', 'data-vista': v.id,
      'aria-selected': i === 0 ? 'true' : 'false',
      onClick: (ev) => cambiarVista(ev.currentTarget)
    }, [v.label, v.n ? el('span', { class: 'notif-solapa__n' }, ` ${v.n}`) : null].filter(Boolean)))
  );

  const cuerpo = el('div', { class: 'notif-panel__cuerpo' },
    vistas.map((v, i) => el('div', {
      class: `notif-panel__vista${i === 0 ? ' is-active' : ''}`,
      id: `notif-vista-${v.id}`, role: 'tabpanel'
    }, v.nodo))
  );

  const hayAlgo = vistas.some((v) => v.n > 0);
  const btnMarcarTodas = el('button', {
    class: 'btn btn--ghost btn--sm', type: 'button', hidden: !hayAlgo,
    onClick: () => {
      notificacionesService.marcarTodasVistas();
      refrescarDrawer();
    }
  }, 'Marcar todas como vistas');

  const panel = el('aside', {
    class: 'notif-panel', role: 'dialog', 'aria-label': 'Notificaciones', 'aria-modal': 'true'
  }, [
    el('div', { class: 'notif-panel__cabecera' }, [
      el('h2', {}, 'Notificaciones'),
      el('div', { style: 'display:flex;align-items:center;gap:8px' }, [
        btnMarcarTodas,
        el('button', { class: 'notif-panel__cerrar', type: 'button', 'aria-label': 'Cerrar', onClick: cerrarDrawer }, '✕')
      ])
    ]),
    solapas,
    cuerpo
  ]);

  const fondo = el('div', { class: 'notif-panel__fondo', onClick: cerrarDrawer });

  document.body.append(fondo, panel);
  document.body.style.overflow = 'hidden';
  abierto = true;

  const alTeclear = (ev) => { if (ev.key === 'Escape') cerrarDrawer(); };
  document.addEventListener('keydown', alTeclear);
  limpiarTeclado = () => document.removeEventListener('keydown', alTeclear);

  panel.querySelector('.notif-panel__cerrar')?.focus();
}

// Refresco instantáneo (sin la animación de cierre): saca el panel actual
// y lo vuelve a abrir ya con datos frescos. Usado tras "marcar todas
// vistas" y tras pagar una reserva desde "Por cobrar", para no tener que
// cerrar y volver a abrir el panel a mano para ver el cambio reflejado.
export function refrescarDrawer() {
  document.querySelector('.notif-panel')?.remove();
  document.querySelector('.notif-panel__fondo')?.remove();
  if (limpiarTeclado) { limpiarTeclado(); limpiarTeclado = null; }
  abierto = false;
  abrirDrawer();
}

export function cerrarDrawer() {
  if (!abierto) return;
  abierto = false;

  const panel = document.querySelector('.notif-panel');
  const fondo = document.querySelector('.notif-panel__fondo');
  panel?.classList.add('notif-panel--saliendo');
  fondo?.classList.add('notif-panel__fondo--saliendo');
  setTimeout(() => { panel?.remove(); fondo?.remove(); }, 200);

  if (limpiarTeclado) { limpiarTeclado(); limpiarTeclado = null; }
  document.body.style.overflow = '';
  document.getElementById('notif-campana')?.focus();
}

function cambiarVista(boton) {
  const panel = boton.closest('.notif-panel');
  panel.querySelectorAll('.notif-solapa').forEach((b) => {
    const activa = b === boton;
    b.classList.toggle('is-active', activa);
    b.setAttribute('aria-selected', activa ? 'true' : 'false');
  });
  const id = boton.getAttribute('data-vista');
  panel.querySelectorAll('.notif-panel__vista').forEach((v) => {
    v.classList.toggle('is-active', v.id === `notif-vista-${id}`);
  });
  panel.querySelector('.notif-panel__cuerpo').scrollTop = 0;
}
