// ============================================================
// Mapa general de propiedades, con filtro de disponibilidad.
//   - Cada unidad con coordenadas es un pin.
//   - Filtro por fechas: pinta verde las libres y rojo las ocupadas,
//     y muestra el conteo.
//   - Popup con nombre, edificio, precio y estado en esas fechas.
// ============================================================
import { unidadesService } from '../../services/unidades.service.js';
import { edificiosService } from '../../services/edificios.service.js';
import { reservasService } from '../../services/reservas.service.js';
import { cargarLeaflet } from '../../core/geo.js';
import { el, spinner, money, miniatura, rangoFechas } from '../../core/ui.js';
import { store } from '../../core/store.js';
import { navegar } from '../../core/router.js';
import { appConfig } from '../../firebase/init.js';
import { hoyISO, masDias } from '../../core/metricas.js';
import { abrirSelectorFechas } from '../reservas/selector-fechas.js';

const MOSTRAR_FOTOS = !!appConfig.features.fotos;

const campo = (label, input) => el('label', { class: 'form__campo' }, [el('span', {}, label), input]);

function pinIcon(estado = 'base') {
  return L.divIcon({
    className: 'map-pin-wrap',
    html: `<span class="map-pin map-pin--${estado}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14]
  });
}

function libreEn(reservasUnidad, entrada, salida) {
  const e = new Date(entrada), s = new Date(salida);
  return !reservasUnidad.some((r) => {
    if (r.estado === 'cancelada') return false;
    const re = new Date(r.fechaEntrada), rs = new Date(r.fechaSalida);
    return (e >= re && e < rs) || (s > re && s <= rs) || (e <= re && s >= rs);
  });
}

export async function render(container) {
  container.append(el('h1', { class: 'page-title' }, 'Mapa'));

  const cargando = el('div', { class: 'card' }, spinner('Cargando propiedades…'));
  container.append(cargando);

  // Datos + Leaflet en paralelo
  const [unidades, edificios] = await Promise.all([
    unidadesService.getAll(),
    edificiosService.getAll()
  ]);
  try {
    await cargarLeaflet();
  } catch {
    cargando.innerHTML = '';
    cargando.append(el('p', { class: 'muted' }, 'No se pudo cargar el mapa. Revisá tu conexión.'));
    return;
  }
  cargando.remove();

  const nombreEdificio = (id) => edificios.find((e) => e.id === id)?.nombre;
  const conUbic = unidades.filter((u) => u.ubicacion?.lat && u.ubicacion?.lng);
  const sinUbic = unidades.filter((u) => !(u.ubicacion?.lat && u.ubicacion?.lng));

  // ----- Barra de filtro de disponibilidad -----
  // Acá las fechas son para buscar disponibilidad futura (igual que
  // "Buscar disponibilidad"), así que el pasado se queda bloqueado con la
  // misma confirmación de Reservas (permitirPasado en false, el default)
  // en vez del modo libre de Panel/Reportes.
  let entrada = hoyISO();
  let salida = masDias(hoyISO(), 2);
  const btnRango = el('button', { class: 'btn btn--ghost' }, rangoFechas(entrada, salida));
  btnRango.addEventListener('click', async () => {
    const rango = await abrirSelectorFechas({ desde: entrada, hasta: salida });
    if (!rango) return;
    entrada = rango.desde; salida = rango.hasta;
    btnRango.textContent = rangoFechas(entrada, salida);
  });
  const btnFiltrar = el('button', { class: 'btn btn--primary', type: 'button' }, 'Ver disponibles');
  const btnLimpiar = el('button', { class: 'btn btn--ghost', type: 'button' }, 'Limpiar');
  const resultadoFiltro = el('span', { class: 'muted small' }, '');
  const leyenda = el('div', { class: 'map-leyenda', hidden: true }, [
    el('span', { class: 'map-leyenda__item' }, [el('span', { class: 'map-dot map-dot--libre' }), 'Libre']),
    el('span', { class: 'map-leyenda__item' }, [el('span', { class: 'map-dot map-dot--ocupado' }), 'Ocupada']),
    resultadoFiltro
  ]);

  const barra = el('div', { class: 'card' }, [
    el('div', { class: 'map-filtro' }, [
      campo('Fechas', btnRango),
      el('div', { class: 'map-filtro__acciones' }, [btnFiltrar, btnLimpiar])
    ]),
    leyenda
  ]);
  container.append(barra);

  // ----- Contenedor del mapa -----
  const mapDiv = el('div', { class: 'map-full' });
  container.append(el('div', { class: 'card card--sinpad' }, mapDiv));

  const map = L.map(mapDiv).setView([-38.0055, -57.5426], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
  }).addTo(map);

  if (!conUbic.length) {
    container.append(el('div', { class: 'card' }, el('p', { class: 'muted' },
      'Todavía no hay propiedades con ubicación. Cargá la ubicación al crear un edificio o un departamento suelto.')));
  }

  // Separar levemente unidades que comparten exactamente las mismas coords
  const vistos = {};
  const marcadores = conUbic.map((u) => {
    let { lat, lng } = u.ubicacion;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const n = (vistos[key] = (vistos[key] || 0) + 1) - 1;
    if (n > 0) { lat += 0.00012 * n; lng += 0.00012 * n; } // ~13m por unidad repetida

    const m = L.marker([lat, lng], { icon: pinIcon('base') }).addTo(map);
    m._unidad = u;
    m.bindPopup(popupNodo(u, null));
    return m;
  });

  // Ajustar la vista a todos los pines
  if (marcadores.length) {
    const grupo = L.featureGroup(marcadores);
    map.fitBounds(grupo.getBounds().pad(0.2), { maxZoom: 15 });
  }
  setTimeout(() => map.invalidateSize(), 120);

  function popupNodo(u, estado) {
    const ed = nombreEdificio(u.edificioId);
    const hijos = [];
    if (MOSTRAR_FOTOS && u.foto) hijos.push(el('div', { class: 'pop-foto' }, miniatura(u.foto, u.nombre)));
    hijos.push(
      el('div', { class: 'pop-nombre' }, u.nombre),
      el('div', { class: 'pop-sub' }, `${ed ? ed : 'Departamento suelto'} · ${u.capacidad || '?'} pers.`),
      el('div', { class: 'pop-precio' }, `${money(u.precioNoche || 0)} / noche`)
    );
    if (estado === 'libre') {
      hijos.push(el('div', { class: 'pop-estado pop-estado--libre' }, 'Libre en esas fechas'));
      hijos.push(el('button', {
        class: 'btn btn--primary btn--sm btn--full', type: 'button', style: 'margin-top:6px',
        onClick: () => {
          store.set('reservaPreset', { unidadId: u.id, entrada, salida });
          navegar('reservas');
        }
      }, 'Reservar'));
    }
    if (estado === 'ocupado') hijos.push(el('div', { class: 'pop-estado pop-estado--ocupado' }, 'Ocupada en esas fechas'));
    return el('div', { class: 'pop' }, hijos);
  }

  // ----- Acciones del filtro -----
  btnFiltrar.addEventListener('click', async () => {
    btnFiltrar.disabled = true; btnFiltrar.textContent = 'Buscando…';
    // Reservas acotadas (solo las que podrían solapar)
    const reservas = await reservasService.buscar([['fechaSalida', '>=', entrada]]);
    let libres = 0;
    marcadores.forEach((m) => {
      const u = m._unidad;
      const rs = reservas.filter((r) => r.unidadId === u.id);
      const libre = libreEn(rs, entrada, salida);
      if (libre) libres++;
      m.setIcon(pinIcon(libre ? 'libre' : 'ocupado'));
      m.setPopupContent(popupNodo(u, libre ? 'libre' : 'ocupado'));
    });

    leyenda.hidden = false;
    resultadoFiltro.textContent = `${libres} de ${marcadores.length} libres`;
    btnFiltrar.disabled = false; btnFiltrar.textContent = 'Ver disponibles';
  });

  btnLimpiar.addEventListener('click', () => {
    marcadores.forEach((m) => { m.setIcon(pinIcon('base')); m.setPopupContent(popupNodo(m._unidad, null)); });
    leyenda.hidden = true;
    resultadoFiltro.textContent = '';
  });

  // ----- Unidades sin ubicación -----
  if (sinUbic.length) {
    container.append(el('div', { class: 'card' }, [
      el('h3', {}, 'Sin ubicación cargada'),
      el('p', { class: 'muted small' }, 'Estas unidades no aparecen en el mapa. Editalas para agregar su ubicación.'),
      el('div', {}, sinUbic.map((u) =>
        el('div', { class: 'lista__item' }, [
          el('strong', {}, u.nombre),
          el('span', { class: 'muted small' }, nombreEdificio(u.edificioId) || 'Sin edificio')
        ])))
    ]));
  }
}
