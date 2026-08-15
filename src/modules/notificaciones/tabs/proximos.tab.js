// ============================================================
// Vista "7 días": 2 secciones separadas — quién entra próximamente y
// quién sale próximamente —, cada una ordenada por fecha (el dato ya
// viene separado y ordenado así desde engine.js, no hace falta reprocesar).
// ============================================================
import { el } from '../../../core/ui.js';
import { vacioNotif, telefonoLink, nombreDe, fechaCorta, botonOjo, conDetalleExpandible, detalleReserva } from './_comunes.js';

export function crearVistaProximos(datos) {
  const { checkIn = [], checkOut = [] } = datos || {};

  if (!checkIn.length && !checkOut.length) {
    return vacioNotif('Nada en los próximos 7 días', 'No hay entradas ni salidas agendadas.');
  }

  return el('div', { class: 'notif-lista-tabs' }, [
    seccion('Entran próximamente', checkIn, 'entra'),
    seccion('Salen próximamente', checkOut, 'sale')
  ].filter(Boolean));
}

function seccion(titulo, items, tipo) {
  if (!items.length) return null;
  return el('div', { class: 'notif-seccion' }, [
    el('h4', {}, `${titulo} · ${items.length}`),
    el('div', { class: 'notif-grupos' }, agruparPorDia(items, tipo))
  ]);
}

// Los items de un mismo tipo (checkIn o checkOut) ya vienen ordenados por
// fecha desde engine.js — acá solo se agrupan visualmente por día.
function agruparPorDia(items, tipo) {
  const porDia = new Map();
  items.forEach((r) => {
    const dia = tipo === 'entra' ? r.fechaEntrada : r.fechaSalida;
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(r);
  });
  return [...porDia.entries()].map(([dia, rs]) => el('div', {}, [
    el('div', { class: 'notif-grupo__fecha' }, fechaCorta(dia)),
    el('div', { class: 'notif-lista' }, rs.map((r) => item(r, tipo)))
  ]));
}

function item(r, tipo) {
  const tel = telefonoLink(r.huesped);
  const fila = el('div', { class: 'notif-item__fila' }, [
    el('span', { class: 'notif-item__unidad' }, [
      r.unidadNombre || 'Unidad',
      el('span', { class: 'notif-item__huesped' }, ` · ${nombreDe(r)}`)
    ]),
    el('span', { class: 'notif-item__marca' }, tipo === 'entra' ? 'Entra' : 'Sale')
  ]);
  const nodo = el('div', { class: `notif-item notif-item--${tipo}` }, [
    fila,
    tel ? el('div', { class: 'notif-item__datos' }, [tel]) : null
  ].filter(Boolean));
  const ojo = botonOjo(r.avisoId, nodo);
  if (ojo) fila.append(ojo);
  return conDetalleExpandible(r.avisoId || `${r.id}:${tipo}`, nodo, fila, detalleReserva(r));
}
