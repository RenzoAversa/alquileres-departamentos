// ============================================================
// Vista "7 días": entradas y salidas agrupadas por fecha.
// ============================================================
import { el } from '../../../core/ui.js';
import { vacioNotif, telefonoLink, nombreDe, fechaCorta, botonOjo } from './_comunes.js';

export function crearVistaProximos(datos) {
  const { checkIn = [], checkOut = [] } = datos || {};

  const movimientos = [
    ...checkIn.map((r) => ({ r, tipo: 'entra', dia: r.fechaEntrada })),
    ...checkOut.map((r) => ({ r, tipo: 'sale', dia: r.fechaSalida }))
  ].sort((a, b) => a.dia.localeCompare(b.dia));

  if (!movimientos.length) {
    return vacioNotif('Nada en los próximos 7 días', 'No hay entradas ni salidas agendadas.');
  }

  const porDia = new Map();
  movimientos.forEach((m) => {
    if (!porDia.has(m.dia)) porDia.set(m.dia, []);
    porDia.get(m.dia).push(m);
  });

  return el('div', { class: 'notif-grupos' },
    [...porDia.entries()].map(([dia, items]) => el('div', {}, [
      el('div', { class: 'notif-grupo__fecha' }, fechaCorta(dia)),
      el('div', { class: 'notif-lista' }, items.map(({ r, tipo }) => item(r, tipo)))
    ]))
  );
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
  return nodo;
}
