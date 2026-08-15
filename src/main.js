// ============================================================
// main.js - Punto de entrada de la app autenticada.
// 1) Verifica sesión (guard). Sin sesión -> login.html
// 2) Carga el ROL del usuario (dueño / encargado / trabajador)
// 3) Arma el sidebar según feature flags + permisos del rol
// 4) Define solo las rutas permitidas y arranca el router
// ============================================================
import { appConfig } from './firebase/init.js';
import { watchAuth, logout } from './core/auth.js';
import { definirRutas, iniciarRouter } from './core/router.js';
import { cargarSesion, sesion } from './core/sesion.js';
import { aplicarTemaGuardado, alternarTema } from './core/tema.js';
import { montarBusquedaGlobal } from './modules/reservas/busqueda-global.js';
// Notificaciones
import { notificacionesService } from './core/notificaciones.service.js';
import { crearBadgeNotificaciones } from './modules/notificaciones/badge.js';

aplicarTemaGuardado();

const MODULOS = {
  dashboard:     { titulo: 'Panel',        icono: '◧', cargar: () => import('./modules/dashboard/dashboard.view.js') },
  edificios:     { titulo: 'Edificios',    icono: '▤', cargar: () => import('./modules/propiedades/edificios.view.js') },
  unidades:      { titulo: 'Departamentos',icono: '▦', cargar: () => import('./modules/propiedades/unidades.view.js') },
  reservas:      { titulo: 'Reservas',     icono: '▣', cargar: () => import('./modules/reservas/reservas.view.js') },
  disponibilidad:{ titulo: 'Buscar disponibilidad', icono: '⚲', cargar: () => import('./modules/disponibilidad/disponibilidad.view.js') },
  calendario:    { titulo: 'Calendario',   icono: '▥', cargar: () => import('./modules/calendario/calendario.view.js') },
  mapa:          { titulo: 'Mapa',         icono: '◎', cargar: () => import('./modules/mapa/mapa.view.js') },
  contabilidad:  { titulo: 'Finanzas',     icono: '▧', cargar: () => import('./modules/contabilidad/contabilidad.view.js') },
  reportes:      { titulo: 'Reportes',     icono: '▲', cargar: () => import('./modules/reportes/reportes.view.js') },
  configuracion: { titulo: 'Configuración',icono: '⚙', cargar: () => import('./modules/configuracion/configuracion.view.js') }
};

// Rutas por feature flag del cliente (orden del menú)
function rutasPorFlags() {
  const f = appConfig.features;
  const orden = [];
  if (f.dashboard) orden.push('dashboard');
  if (f.propiedades) orden.push('edificios', 'unidades');
  if (f.reservas) orden.push('reservas', 'disponibilidad');
  if (f.calendario) orden.push('calendario');
  if (f.mapa) orden.push('mapa');
  if (f.contabilidad) orden.push('contabilidad');
  if (f.contabilidad) orden.push('reportes'); // los reportes son financieros: dependen del mismo flag
  orden.push('configuracion');
  return orden;
}

// Rutas realmente disponibles = habilitadas por el cliente Y permitidas por el rol
function rutasDisponibles() {
  return rutasPorFlags().filter((r) => sesion.puedeModulo(r));
}

function construirShell(rutas) {
  document.documentElement.style.setProperty('--color-primario', appConfig.cliente.colorPrimario || '#2563eb');
  document.getElementById('marca-nombre').textContent = appConfig.cliente.nombre;
  document.getElementById('marca-nombre-top').textContent = appConfig.cliente.nombre;
  document.getElementById('marca-inicial').textContent = (appConfig.cliente.nombre || 'A').charAt(0).toUpperCase();
  // Usuario + rol
  document.getElementById('user-email').textContent = `${sesion.nombre || sesion.email} · ${sesion.rolLabel}`;

  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  rutas.forEach((ruta) => {
    const m = MODULOS[ruta];
    const a = document.createElement('a');
    a.href = `#/${ruta}`;
    a.dataset.ruta = ruta;
    a.className = 'nav__item';
    a.innerHTML = `<span class="nav__icono">${m.icono}</span><span>${m.titulo}</span>`;
    nav.append(a);
  });

  document.getElementById('btn-menu').onclick = () => document.body.classList.toggle('sidebar-abierto');
  document.getElementById('overlay').onclick = () => document.body.classList.remove('sidebar-abierto');
  document.getElementById('btn-logout').onclick = () => logout();

  const btnTema = document.getElementById('btn-tema');
  const actualizarIconoTema = () => { btnTema.textContent = document.documentElement.getAttribute('data-tema') === 'oscuro' ? '☀️' : '🌙'; };
  actualizarIconoTema();
  btnTema.onclick = () => { alternarTema(); actualizarIconoTema(); };

  montarBusquedaGlobal(document.getElementById('topbar-busqueda'));
  
  // Campana de notificaciones, al final de la barra superior
  const topbar = document.querySelector('.topbar');
  if (topbar) topbar.append(crearBadgeNotificaciones());
}

function definirYArrancar(rutas) {
  const inicio = rutas[0] || 'dashboard';
  const mapaRutas = {};
  rutas.forEach((ruta) => {
    mapaRutas[ruta] = async (cont) => {
      const mod = await MODULOS[ruta].cargar();
      await mod.render(cont);
    };
  });
  definirRutas(mapaRutas, inicio); // rutas no permitidas caen al inicio permitido
  iniciarRouter(document.getElementById('app-content'));
}

// Pantalla para cuentas autenticadas sin rol asignado
function pantallaSinAcceso() {
  const app = document.getElementById('app');
  app.hidden = false;
  app.innerHTML = `
    <div class="sin-acceso">
      <div class="sin-acceso__card">
        <div class="marca__logo" style="width:48px;height:48px;font-size:1.3rem">${(appConfig.cliente.nombre || 'A').charAt(0).toUpperCase()}</div>
        <h2>Cuenta sin permisos</h2>
        <p class="muted">Tu cuenta ingresó correctamente, pero todavía no tiene un rol asignado en este sistema. Pedile al dueño que te agregue desde Configuración.</p>
        <button class="btn btn--ghost" id="sa-logout">Cerrar sesión</button>
      </div>
    </div>`;
  document.getElementById('sa-logout').onclick = () => logout();
}

// ---- Cleanup de notificaciones al logout ----
window.addEventListener('beforeunload', async () => {
  await notificacionesService.cleanup();
});

// ---- Guard de autenticación + carga de rol ----
let iniciado = false;
watchAuth(async (user) => {
  if (!user) {
    await notificacionesService.cleanupLogout();
    location.replace('login.html');
    return;
  }
  if (iniciado) return;
  iniciado = true;

  await cargarSesion(user);
  document.getElementById('cargando-inicial').remove();

  if (!sesion.tieneAcceso()) { pantallaSinAcceso(); return; }

  document.getElementById('app').hidden = false;
  const rutas = rutasDisponibles();
  construirShell(rutas);
  definirYArrancar(rutas);
  
  // Inicializar notificaciones
  try {
    await notificacionesService.init();
  } catch (err) {
    console.error('Error inicializar notificaciones:', err);
  }
});

// Service Worker: habilita uso offline e "instalar app" en el celular.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .catch((err) => console.warn('No se pudo registrar el service worker', err));
  });
}
