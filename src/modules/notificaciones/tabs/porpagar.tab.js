// ============================================================
// Vista "Por cobrar": reservas con saldo, las vencidas primero.
// ============================================================
import { el, money } from '../../../core/ui.js';
import { puedeVerDinero, vacioNotif, telefonoLink, nombreDe, textoAtraso, botonOjo } from './_comunes.js';

export function crearVistaPorPagar(items = [], contadores = {}) {
  if (!puedeVerDinero()) {
    return vacioNotif('Sin acceso', 'Tu rol no tiene permiso para ver información de dinero.');
  }
  if (!items.length) {
    return vacioNotif('Todo cobrado', 'Ninguna reserva activa tiene saldo pendiente.');
  }

  const total = items.reduce((suma, r) => suma + (Number(r.saldo) || 0), 0);
  const vencidas = items.filter((r) => (r.diasVencido ?? 0) > 0);
  const proximas = items.filter((r) => (r.diasVencido ?? 0) <= 0);

  return el('div', {}, [
    el('div', { class: 'notif-resumen' }, [
      el('div', {}, [
        el('span', { class: 'notif-resumen__label' }, 'Saldo pendiente'),
        el('strong', { class: 'notif-resumen__monto' }, money(total))
      ]),
      el('div', { class: 'notif-resumen__detalle' },
        `${items.length} reserva(s)${contadores.vencidos ? ` · ${contadores.vencidos} vencida(s)` : ''}`)
    ]),
    el('div', { class: 'notif-lista-tabs' }, [
      seccion('Vencidas', vencidas, 'vencido', 'notif-seccion__titulo--alerta'),
      seccion('Por vencer', proximas, 'proximo', 'notif-seccion__titulo--aviso')
    ].filter(Boolean))
  ]);
}

function seccion(titulo, items, variante, claseTitulo) {
  if (!items.length) return null;
  return el('div', { class: 'notif-seccion' }, [
    el('h4', { class: claseTitulo }, `${titulo} · ${items.length}`),
    el('div', { class: 'notif-lista' }, items.map((r) => item(r, variante)))
  ]);
}

function item(r, variante) {
  const tel = telefonoLink(r.huesped);
  const fila = el('div', { class: 'notif-item__fila' }, [
    el('span', { class: 'notif-item__unidad' }, [
      r.unidadNombre || 'Unidad',
      el('span', { class: 'notif-item__huesped' }, ` · ${nombreDe(r)}`)
    ]),
    el('span', { class: 'notif-item__monto' }, money(r.saldo || 0))
  ]);
  const nodo = el('div', { class: `notif-item notif-item--${variante}` }, [
    fila,
    el('div', { class: 'notif-item__datos' }, [
      tel,
      el('span', { class: variante === 'vencido' ? 'notif-item__atraso' : 'notif-item__aviso' }, textoAtraso(r.diasVencido ?? 0))
    ].filter(Boolean))
  ]);
  const ojo = botonOjo(r.avisoId, nodo);
  if (ojo) fila.append(ojo);
  return nodo;
}
