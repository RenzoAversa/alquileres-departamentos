// ============================================================
// Utilidades de geolocalización.
//   - cargarLeaflet(): carga la librería del mapa UNA sola vez y solo
//     cuando se necesita (no pesa la app si nunca abrís el mapa).
//   - geocodificar(): dirección -> coordenadas, con Nominatim (gratis).
// ============================================================

let promesaLeaflet = null;

// Carga diferida de Leaflet (CSS + JS) desde CDN. Devuelve una promesa
// que resuelve cuando `window.L` está disponible.
export function cargarLeaflet() {
  if (window.L) return Promise.resolve();
  if (promesaLeaflet) return promesaLeaflet;

  promesaLeaflet = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.append(css);

    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = () => resolve();
    js.onerror = () => reject(new Error('No se pudo cargar el mapa'));
    document.head.append(js);
  });
  return promesaLeaflet;
}

// Geocodificación: dirección -> { lat, lng, direccion }.
// Nominatim es el geocoder gratuito de OpenStreetMap. Se usa solo al
// tocar "Buscar" (no en cada tecla) para respetar su límite de uso.
export async function geocodificar(direccion) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(direccion)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
  if (!res.ok) throw new Error('Error de geocodificación');
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    direccion: data[0].display_name || direccion
  };
}
