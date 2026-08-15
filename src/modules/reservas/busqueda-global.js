// ============================================================
// Búsqueda global de huésped/reserva, montada en el topbar.
//   - Solo se activa si el rol tiene acceso al módulo Reservas.
//   - Una sola consulta a Firestore por sesión de búsqueda (se
//     cachea en memoria); el filtrado es 100% en el cliente.
//   - Al elegir un resultado abre el mismo modal que ya usa el
//     listado de Reservas (pago/edición, o solo lectura según rol).
// ============================================================
import { reservasService } from '../../services/reservas.service.js';
import { unidadesService } from '../../services/unidades.service.js';
import { cuentasService } from '../../services/cuentas.service.js';
import { el, fecha, toast } from '../../core/ui.js';
import { sesion } from '../../core/sesion.js';
import { abrirDetalleReserva } from './detalle.js';
import { abrirEdicionReserva } from './editar.js';

const DEBOUNCE_MS = 300;

function coincide(r, q) {
  const texto = `${r.huesped?.nombre || ''} ${r.huesped?.telefono || ''} ${r.unidadNombre || ''}`.toLowerCase();
  return texto.includes(q);
}

export function montarBusquedaGlobal(contenedor) {
  if (!contenedor || !sesion.puedeModulo('reservas')) return;

  let reservasCache = null;
  let unidadesCache = null;
  let cuentasCache = null;
  let timer = null;

  const input = el('input', { type: 'search', class: 'busqueda-input', placeholder: 'Buscar huésped o reserva…' });
  const resultados = el('div', { class: 'busqueda-resultados' });
  resultados.hidden = true;
  const wrap = el('div', { class: 'busqueda-global' }, [input, resultados]);
  contenedor.append(wrap);

  async function obtenerReservas() {
    if (!reservasCache) reservasCache = await reservasService.getAll();
    return reservasCache;
  }

  function pintarResultados(lista, q) {
    resultados.innerHTML = '';
    resultados.hidden = false;
    if (!lista.length) {
      resultados.append(el('div', { class: 'busqueda-vacio' }, `Sin resultados para "${q}"`));
      return;
    }
    lista.forEach((r) => {
      resultados.append(el('div', {
        class: 'busqueda-item', tabIndex: 0, role: 'button',
        onClick: () => abrirResultado(r)
      }, [
        el('div', {}, [
          el('strong', {}, r.unidadNombre || 'Unidad'),
          el('span', { class: 'muted small' }, ` · ${r.huesped?.nombre || ''}`)
        ]),
        el('div', { class: 'muted small' }, `${fecha(r.fechaEntrada)} → ${fecha(r.fechaSalida)}`)
      ]));
    });
  }

  async function buscar() {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { resultados.hidden = true; resultados.innerHTML = ''; return; }
    const reservas = await obtenerReservas();
    pintarResultados(reservas.filter((r) => coincide(r, q)).slice(0, 8), q);
  }

  async function abrirResultado(r) {
    resultados.hidden = true;
    input.value = '';
    try {
      if (sesion.puede('gestionarPagos')) {
        if (!cuentasCache) cuentasCache = await cuentasService.getAll();
        abrirDetalleReserva(r, cuentasCache, () => { reservasCache = null; });
      } else if (sesion.puede('editarReservas')) {
        if (!unidadesCache) unidadesCache = await unidadesService.getAll();
        abrirEdicionReserva(r, unidadesCache, () => { reservasCache = null; });
      } else {
        toast(`${r.unidadNombre || 'Unidad'} · ${r.huesped?.nombre || ''} · ${fecha(r.fechaEntrada)} → ${fecha(r.fechaSalida)}`, 'info');
      }
    } catch (err) {
      console.error(err); toast('No se pudo abrir la reserva', 'alerta');
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(buscar, DEBOUNCE_MS);
  });
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) buscar(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { resultados.hidden = true; input.blur(); } });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) resultados.hidden = true; });
}
