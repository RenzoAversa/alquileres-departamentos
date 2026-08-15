// ============================================================
// Buscador de disponibilidad (la función estrella).
// Entrada + salida + huéspedes  ->  unidades libres + precio total.
// Eficiencia: trae las reservas UNA vez (acotadas por fecha) y las
// unidades una vez; calcula los solapamientos en el cliente en lugar
// de consultar disponibilidad unidad por unidad.
// ============================================================
import { unidadesService } from '../../services/unidades.service.js';
import { reservasService } from '../../services/reservas.service.js';
import { edificiosService } from '../../services/edificios.service.js';
import { el, toast, spinner, vacio, money, noches } from '../../core/ui.js';
import { navegar } from '../../core/router.js';
import { store } from '../../core/store.js';
import { hoyISO, masDias } from '../../core/metricas.js';

const campo = (label, input) => el('label', { class: 'form__campo' }, [el('span', {}, label), input]);

// ¿La unidad está libre en [entrada, salida)? (misma lógica del servicio,
// pero sobre las reservas ya cargadas, sin ir de nuevo a la base)
function estaLibre(reservasUnidad, entrada, salida) {
  const e = new Date(entrada), s = new Date(salida);
  return !reservasUnidad.some((r) => {
    if (r.estado === 'cancelada') return false;
    const re = new Date(r.fechaEntrada), rs = new Date(r.fechaSalida);
    return (e >= re && e < rs) || (s > re && s <= rs) || (e <= re && s >= rs);
  });
}

export async function render(container) {
  container.append(el('h1', { class: 'page-title' }, 'Buscar disponibilidad'));

  const inEntrada = el('input', { name: 'entrada', type: 'date', required: true, value: hoyISO() });
  const inSalida = el('input', { name: 'salida', type: 'date', required: true, value: masDias(hoyISO(), 2) });
  const inHuespedes = el('input', { name: 'huespedes', type: 'number', min: '1', value: '1' });

  const form = el('form', { class: 'card form' }, [
    el('div', { class: 'form__fila' }, [campo('Entrada', inEntrada), campo('Salida', inSalida), campo('Huéspedes', inHuespedes)]),
    el('button', { class: 'btn btn--primary', type: 'submit' }, 'Buscar disponibles')
  ]);
  container.append(form);

  const resultados = el('div', {});
  container.append(resultados);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const entrada = inEntrada.value;
    const salida = inSalida.value;
    const huespedes = parseInt(inHuespedes.value) || 1;

    if (new Date(salida) <= new Date(entrada)) {
      toast('La salida debe ser posterior a la entrada', 'alerta');
      return;
    }

    resultados.innerHTML = '';
    resultados.append(spinner('Buscando…'));

    // Datos frescos (unidades/edificios son pocos documentos).
    // Reservas acotadas: solo las que podrían solapar (terminan en/después de la entrada).
    const [unidades, edificios, reservas] = await Promise.all([
      unidadesService.getAll(),
      edificiosService.getAll(),
      reservasService.buscar([['fechaSalida', '>=', entrada]])
    ]);

    const n = noches(entrada, salida);
    const candidatas = unidades
      .filter((u) => u.estado !== 'inactivo' && (Number(u.capacidad) || 1) >= huespedes)
      .map((u) => {
        const rs = reservas.filter((r) => r.unidadId === u.id);
        return { unidad: u, libre: estaLibre(rs, entrada, salida) };
      })
      .filter((x) => x.libre);

    resultados.innerHTML = '';

    if (!candidatas.length) {
      resultados.append(vacio(`No hay unidades libres para ${huespedes} huésped(es) en esas fechas.`));
      return;
    }

    const seccion = el('div', { class: 'card' }, [
      el('h3', {}, `${candidatas.length} disponible(s) · ${n} noche(s)`)
    ]);

    candidatas
      .sort((a, b) => (a.unidad.precioNoche || 0) - (b.unidad.precioNoche || 0))
      .forEach(({ unidad }) => {
        const ed = edificios.find((x) => x.id === unidad.edificioId);
        const total = n * (unidad.precioNoche || 0);
        seccion.append(el('div', { class: 'lista__item' }, [
          el('div', {}, [
            el('strong', {}, unidad.nombre),
            el('span', { class: 'muted' }, ` · ${ed ? ed.nombre : 'Sin edificio'} · ${unidad.capacidad} pers.`),
            el('div', { class: 'muted small' }, `${money(unidad.precioNoche)} / noche`)
          ]),
          el('div', { style: 'display:flex;align-items:center;gap:12px' }, [
            el('div', { style: 'text-align:right' }, [
              el('div', { style: 'font-weight:700' }, money(total)),
              el('div', { class: 'muted small' }, 'total')
            ]),
            el('button', {
              class: 'btn btn--primary btn--sm',
              onClick: () => {
                // Pasa la preselección a Reservas vía el store
                store.set('reservaPreset', {
                  unidadId: unidad.id, entrada, salida, huespedes
                });
                navegar('reservas');
              }
            }, 'Reservar')
          ])
        ]));
      });

    resultados.append(seccion);
  });
}
