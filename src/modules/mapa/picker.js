// ============================================================
// Selector de ubicación reutilizable (para el alta de edificios y
// departamentos). Flujo:
//   1) el cliente escribe la dirección y toca "Buscar"
//   2) el mapa se centra y pone el pin donde la supone
//   3) el cliente arrastra el pin (o hace clic) para ajustarlo
// Uso:
//   const picker = crearSelectorUbicacion({ lat, lng, direccion });
//   contenedor.append(picker.element);
//   await picker.montar();               // después de estar en el DOM
//   const { lat, lng, direccion } = picker.getValor();
// ============================================================
import { cargarLeaflet, geocodificar } from '../../core/geo.js';
import { el, toast } from '../../core/ui.js';

const CENTRO_DEFAULT = [-38.0055, -57.5426]; // Mar del Plata (solo como vista inicial)

export function crearSelectorUbicacion({ lat = null, lng = null, direccion = '' } = {}) {
  const coords = { lat, lng };

  const inputDireccion = el('input', {
    type: 'text', placeholder: 'Escribí la dirección…', value: direccion, autocomplete: 'off'
  });
  const btnBuscar = el('button', { type: 'button', class: 'btn btn--ghost btn--sm' }, 'Buscar');
  const mapDiv = el('div', { class: 'map-picker' }, el('div', { class: 'map-cargando' }, 'Cargando mapa…'));

  const element = el('div', { class: 'map-picker-wrap' }, [
    el('span', { class: 'form__campo-label' }, 'Ubicación'),
    el('div', { class: 'map-picker-search' }, [inputDireccion, btnBuscar]),
    mapDiv,
    el('p', { class: 'muted small' }, 'Buscá la dirección y arrastrá el pin para ajustar la ubicación exacta.')
  ]);

  let map = null, marker = null;

  function setPin(la, ln, centrar = true, zoom = 16) {
    coords.lat = la; coords.lng = ln;
    if (!map) return;
    marker.setLatLng([la, ln]);
    if (centrar) map.setView([la, ln], zoom);
    // Burbujea para que abrirModal() detecte "hay datos sin guardar".
    mapDiv.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function initMap() {
    mapDiv.innerHTML = '';
    const start = (coords.lat && coords.lng) ? [coords.lat, coords.lng] : CENTRO_DEFAULT;
    map = L.map(mapDiv).setView(start, coords.lat ? 16 : 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(map);

    marker = L.marker(start, { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      coords.lat = p.lat; coords.lng = p.lng;
      mapDiv.dispatchEvent(new Event('input', { bubbles: true }));
    });
    map.on('click', (e) => setPin(e.latlng.lat, e.latlng.lng, false));

    // Leaflet necesita recalcular tamaño si el contenedor recién apareció
    setTimeout(() => map.invalidateSize(), 120);
  }

  async function buscar() {
    const q = inputDireccion.value.trim();
    if (!q) { toast('Escribí una dirección primero', 'alerta'); return; }
    btnBuscar.disabled = true; btnBuscar.textContent = 'Buscando…';
    try {
      const r = await geocodificar(q);
      if (!r) { toast('No encontré esa dirección. Podés poner el pin a mano.', 'alerta'); return; }
      setPin(r.lat, r.lng, true, 16);
    } catch {
      toast('No se pudo buscar la dirección', 'alerta');
    } finally {
      btnBuscar.disabled = false; btnBuscar.textContent = 'Buscar';
    }
  }
  btnBuscar.addEventListener('click', buscar);
  inputDireccion.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); buscar(); }
  });

  return {
    element,
    async montar() {
      try {
        await cargarLeaflet();
        initMap();
      } catch {
        mapDiv.innerHTML = '<div class="map-cargando">No se pudo cargar el mapa.</div>';
      }
    },
    // Reposiciona el pin desde afuera (ej: al elegir un edificio, heredar su ubicación)
    setUbicacion(la, ln) { if (la && ln) setPin(la, ln, true, 16); },
    getValor() {
      return { lat: coords.lat, lng: coords.lng, direccion: inputDireccion.value.trim() };
    }
  };
}
