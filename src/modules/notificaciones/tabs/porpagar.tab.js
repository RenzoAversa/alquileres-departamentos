// ============================================================
// Vista "Por cobrar": reservas con saldo, las vencidas primero.
// ============================================================
import { el, money } from '../../../core/ui.js';
import { sesion } from '../../../core/sesion.js';
import { cuentasService } from '../../../services/cuentas.service.js';
import { abrirDetalleReserva } from '../../reservas/detalle.js';
import { cerrarDrawer } from '../drawer.js';
import { puedeVerDinero, vacioNotif, telefonoLink, nombreDe, textoAtraso, botonOjo, conDetalleExpandible, detalleReserva } from './_comunes.js';

// Cuentas: solo se piden si alguien realmente toca "Pagar" (ahorra lecturas).
let cuentasCache = null;
async function cuentasLazy() {
  if (!cuentasCache) cuentasCache = await cuentasService.getAll();
  return cuentasCache;
}

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
  const puedeCobrar = sesion.puede('gestionarPagos');
  const tel = telefonoLink(r.huesped);
  const fila = el('div', { class: 'notif-item__fila' }, [
    el('span', { class: 'notif-item__unidad' }, [
      r.unidadNombre || 'Unidad',
      el('span', { class: 'notif-item__huesped' }, ` · ${nombreDe(r)}`)
    ]),
    el('span', { class: 'notif-item__monto' }, money(r.saldo || 0))
  ]);
  const datos = el('div', { class: 'notif-item__datos' }, [
    tel,
    el('span', { class: variante === 'vencido' ? 'notif-item__atraso' : 'notif-item__aviso' }, textoAtraso(r.diasVencido ?? 0))
  ].filter(Boolean));
  const nodo = el('div', { class: `notif-item notif-item--${variante}` }, [fila, datos]);

  if (puedeCobrar) {
    const btnPagar = el('button', {
      class: 'btn btn--primary btn--sm', type: 'button',
      onClick: async (e) => {
        e.stopPropagation();
        // Cerrar el panel de notificaciones antes de abrir el modal de pago:
        // si se queda abierto de fondo, el modal se ve superpuesto encima
        // de la lista, se ve mal y confunde.
        const cuentas = await cuentasLazy();
        cerrarDrawer();
        await abrirDetalleReserva(r, cuentas);
      }
    }, 'Pagar');
    nodo.append(el('div', { class: 'notif-item__acciones' }, [btnPagar]));
  }

  const ojo = botonOjo(r.avisoId, nodo);
  if (ojo) fila.append(ojo);
  return conDetalleExpandible(r.avisoId || r.id, nodo, fila, detalleReserva(r));
}
