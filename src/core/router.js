// ============================================================
// Router SPA basado en hash (#/ruta). Sin dependencias.
// Cada ruta apunta a una función render(container) async.
// ============================================================
let rutas = {};
let contenedor = null;
let rutaDefault = 'dashboard';

export function definirRutas(mapa, porDefecto = 'dashboard') {
  rutas = mapa;
  rutaDefault = porDefecto;
}

export function rutaActual() {
  return (location.hash.replace(/^#\//, '') || rutaDefault).split('?')[0];
}

export function navegar(ruta) {
  location.hash = `#/${ruta}`;
}

async function resolver() {
  const nombre = rutaActual();
  const render = rutas[nombre] || rutas[rutaDefault];

  // Marcar link activo en el sidebar
  document.querySelectorAll('[data-ruta]').forEach((a) => {
    a.classList.toggle('is-active', a.dataset.ruta === nombre);
  });

  if (!contenedor) return;
  contenedor.innerHTML = '';
  try {
    await render(contenedor);
  } catch (err) {
    console.error('Error al renderizar la ruta', nombre, err);
    contenedor.innerHTML = `<div class="card"><p>Ocurrió un error al cargar esta sección.</p></div>`;
  }
  // En mobile, cerrar el menú al navegar
  document.body.classList.remove('sidebar-abierto');
  contenedor.scrollTop = 0;
}

export function iniciarRouter(elContenido) {
  contenedor = elContenido;
  window.addEventListener('hashchange', resolver);
  resolver();
}
