// ============================================================
// Vista "Hoy": quién entra, quién sale y qué falta cobrar.
// ============================================================
import { el, money } from '../../../core/ui.js';
import { puedeVerDinero, vacioNotif, telefonoLink, nombreDe, textoAtraso, botonOjo } from './_comunes.js';

export function crearVistaHoy(datos) {
  const { checkIn = [], checkOut = [], pagoPendiente = [] } = datos || {};
  const verDinero = puedeVerDinero();
  const pagos = verDinero ? pagoPendiente : [];

  if (!checkIn.length && !checkOut.length && !pagos.length) {
    return vacioNotif('Día tranquilo', 'No hay entradas, salidas ni cobros pendientes para hoy.');
  }

  return el('div', { class: 'notif-lista-tabs' }, [
    seccion('Entran hoy', checkIn, (r) => itemMovimiento(r, 'entra')),
    seccion('Salen hoy', checkOut, (r) => itemMovimiento(r, 'sale')),
    verDinero ? seccion('Falta cobrar', pagos, itemCobro, 'notif-seccion__titulo--alerta') : null
  ].filter(Boolean));
}

function seccion(titulo, items, render, claseTitulo = '') {
  if (!items.length) return null;
  return el('div', { class: 'notif-seccion' }, [
    el('h4', { class: claseTitulo }, `${titulo} · ${items.length}`),
    el('div', { class: 'notif-lista' }, items.map(render))
  ]);
}

function itemMovimiento(r, tipo) {
  const fila = el('div', { class: 'notif-item__fila' }, [
    el('span', { class: 'notif-item__unidad' }, [
      r.unidadNombre || 'Unidad',
      el('span', { class: 'notif-item__huesped' }, ` · ${nombreDe(r)}`)
    ]),
    el('span', { class: 'notif-item__marca' }, tipo === 'entra' ? `Entrada ${r.horaEntrada || '15:00'}` : `Salida ${r.horaSalida || '10:00'}`)
  ]);
  const item = el('div', { class: `notif-item notif-item--${tipo}` }, [
    fila,
    datos([
      telefonoLink(r.huesped),
      el('span', {}, `${r.noches || '?'} noche(s)`)
    ])
  ]);
  const ojo = botonOjo(r.avisoId, item);
  if (ojo) fila.append(ojo);
  return item;
}

function itemCobro(r) {
  const fila = el('div', { class: 'notif-item__fila' }, [
    el('span', { class: 'notif-item__unidad' }, [
      r.unidadNombre || 'Unidad',
      el('span', { class: 'notif-item__huesped' }, ` · ${nombreDe(r)}`)
    ]),
    el('span', { class: 'notif-item__monto' }, money(r.saldo || 0))
  ]);
  const item = el('div', { class: 'notif-item notif-item--vencido' }, [
    fila,
    datos([
      telefonoLink(r.huesped),
      el('span', { class: 'notif-item__atraso' }, textoAtraso(r.diasVencido ?? 0))
    ])
  ]);
  const ojo = botonOjo(r.avisoId, item);
  if (ojo) fila.append(ojo);
  return item;
}

function datos(partes) {
  const limpias = partes.filter(Boolean);
  return limpias.length ? el('div', { class: 'notif-item__datos' }, limpias) : null;
}
