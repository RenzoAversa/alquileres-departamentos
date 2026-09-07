// Configuración: datos de la cuenta, módulos y (solo dueño) gestión de
// usuarios + backup manual.
import { appConfig } from '../../firebase/init.js';
import { logout } from '../../core/auth.js';
import { el, toast, confirmar, botonRecargar, crearPaginado, descargarJSON } from '../../core/ui.js';
import { hoyISO } from '../../core/metricas.js';
import { sesion, ROLES } from '../../core/sesion.js';
import { usuariosService } from '../../services/usuarios.service.js';
import { edificiosService } from '../../services/edificios.service.js';
import { unidadesService } from '../../services/unidades.service.js';
import { reservasService } from '../../services/reservas.service.js';
import { cuentasService } from '../../services/cuentas.service.js';
import { movimientosService } from '../../services/movimientos.service.js';

const fila = (k, v) => el('div', { class: 'lista__item' }, [el('span', { class: 'muted' }, k), el('strong', {}, v)]);
const campo = (label, input) => el('label', { class: 'form__campo' }, [el('span', {}, label), input]);
const selectRoles = (valor) => {
  const s = el('select', {});
  Object.entries(ROLES).forEach(([k, label]) => s.append(el('option', { value: k, selected: (valor === k) || undefined }, label)));
  return s;
};

// Nombre de archivo a partir del nombre del cliente: sin espacios/acentos,
// para que sea un nombre de archivo válido en cualquier sistema operativo.
function slug(s) {
  return (s || 'cliente')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'cliente';
}

// Backup crudo: TODAS las colecciones, documento por documento, tal cual
// están en Firestore. No es el reporte de core/excel.js (que es un resumen
// curado para leer) — esto es para poder reconstruir los datos si hiciera
// falta, no para leerlo cómodo.
async function descargarBackup(btn) {
  btn.disabled = true; btn.textContent = 'Generando…';
  try {
    const [edificios, unidades, reservas, cuentas, movimientos, usuarios] = await Promise.all([
      edificiosService.getAll(),
      unidadesService.getAll(),
      reservasService.getAll(),
      cuentasService.getAll(),
      movimientosService.getAll(),
      usuariosService.getAll()
    ]);
    const backup = {
      generadoEn: new Date().toISOString(),
      cliente: appConfig.cliente.nombre,
      edificios, unidades, reservas, cuentas, movimientos, usuarios
    };
    descargarJSON(`backup-${slug(appConfig.cliente.nombre)}-${hoyISO()}.json`, backup);
    toast('Backup descargado', 'ok');
  } catch (err) {
    console.error(err);
    toast('No se pudo generar el backup', 'alerta');
  } finally {
    btn.disabled = false; btn.textContent = 'Descargar backup completo';
  }
}

export async function render(container) {
  container.append(el('h1', { class: 'page-title' }, 'Configuración'));

  // ---- Cuenta ----
  container.append(el('div', { class: 'card' }, [
    el('h3', {}, 'Cuenta'),
    fila('Cliente', appConfig.cliente.nombre),
    fila('Usuario', sesion.email || '—'),
    fila('Rol', sesion.rolLabel),
    fila('Proyecto Firebase', appConfig.firebase.projectId),
    fila('Moneda', appConfig.moneda)
  ]));

  // ---- Gestión de usuarios (solo dueño) ----
  if (sesion.puede('gestionarUsuarios')) {
    const headerUsuarios = el('div', { class: 'finanzas-head' }, [
      el('h3', {}, 'Usuarios y roles'),
      botonRecargar(() => cargarUsuarios())
    ]);
    const cardUsuarios = el('div', { class: 'card' }, [headerUsuarios]);
    container.append(cardUsuarios);

    // Alta
    const inEmail = el('input', { type: 'email', placeholder: 'email@ejemplo.com', required: true });
    const inNombre = el('input', { type: 'text', placeholder: 'Nombre' });
    const selRol = selectRoles('trabajador');
    const form = el('form', { class: 'form', style: 'margin-bottom:16px' }, [
      el('div', { class: 'form__fila' }, [campo('Email', inEmail), campo('Nombre', inNombre), campo('Rol', selRol)]),
      el('button', { class: 'btn btn--primary btn--sm', type: 'submit' }, 'Agregar usuario')
    ]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = inEmail.value.trim().toLowerCase();
      if (!email) return;
      try {
        await usuariosService.crear(email, inNombre.value || email.split('@')[0], selRol.value);
        toast('Usuario agregado', 'ok');
        form.reset(); selRol.value = 'trabajador';
        cargarUsuarios();
      } catch (err) { console.error(err); toast('No se pudo agregar', 'alerta'); }
    });
    cardUsuarios.append(form);
    cardUsuarios.append(el('p', { class: 'muted small', style: 'margin-bottom:12px' },
      'Nota: Antes de agregar usuario, avisar a Renzo.'));

    const listaCont = el('div', {});
    cardUsuarios.append(listaCont);
    const paginadoUsuarios = crearPaginado({
      contenedor: listaCont,
      porPagina: 20,
      mensajeVacio: 'No hay usuarios cargados.',
      renderItem: (u) => renderUsuario(u)
    });

    function renderUsuario(u) {
      const esYo = (u.email || u.id) === sesion.email;
      const selCambio = selectRoles(u.rol);
      selCambio.disabled = esYo; // no cambiar tu propio rol (evita perder al dueño)
      selCambio.addEventListener('change', async () => {
        try { await usuariosService.cambiarRol(u.email || u.id, selCambio.value); toast('Rol actualizado', 'ok'); }
        catch (err) { console.error(err); toast('No se pudo actualizar', 'alerta'); selCambio.value = u.rol; }
      });
      const acciones = el('div', { style: 'display:flex;align-items:center;gap:8px' }, [selCambio]);
      if (!esYo) {
        acciones.append(el('button', {
          class: 'btn btn--ghost btn--sm', type: 'button',
          onClick: async () => {
            if (await confirmar(`¿Quitar el acceso de ${u.email || u.id}?`)) {
              try { await usuariosService.eliminar(u.email || u.id); toast('Usuario eliminado', 'ok'); cargarUsuarios(); }
              catch (err) { console.error(err); toast('No se pudo eliminar', 'alerta'); }
            }
          }
        }, 'Quitar'));
      }
      return el('div', { class: 'lista__item' }, [
        el('div', {}, [
          el('strong', {}, u.nombre || (u.email || u.id)),
          el('div', { class: 'muted small' }, (u.email || u.id) + (esYo ? ' · vos' : ''))
        ]),
        acciones
      ]);
    }

    async function cargarUsuarios() {
      let usuarios = [];
      try { usuarios = await usuariosService.listar(); }
      catch (err) { console.error(err); toast('No se pudieron cargar los usuarios', 'alerta'); return; }
      usuarios.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
      paginadoUsuarios.setItems(usuarios);
    }
    cargarUsuarios();
  }

  // ---- Backup manual (solo dueño, mismo criterio que Usuarios y roles) ----
  if (sesion.puede('gestionarUsuarios')) {
    const btnBackup = el('button', { class: 'btn btn--ghost', type: 'button' }, 'Descargar backup completo');
    btnBackup.addEventListener('click', () => descargarBackup(btnBackup));
    container.append(el('div', { class: 'card' }, [
      el('h3', {}, 'Backup'),
      el('p', { class: 'muted small' }, 'Descarga un archivo .json con todos los datos tal cual están en la base (edificios, departamentos, reservas, cuentas, movimientos y usuarios). Es un respaldo crudo, no un reporte para leer — para eso está "Exportar a Excel".'),
      btnBackup
    ]));
  }

  // ---- Módulos activos ----
  const flags = Object.entries(appConfig.features).map(([k, v]) =>
    el('div', { class: 'lista__item' }, [el('span', {}, k), el('span', { class: `badge ${v ? 'badge--ok' : ''}` }, v ? 'Activo' : 'Off')]));
  container.append(el('div', { class: 'card' }, [el('h3', {}, 'Módulos'), ...flags]));

  // ---- Salir ----
  container.append(el('div', { class: 'card' }, [el('button', { class: 'btn btn--danger', onClick: () => logout() }, 'Cerrar sesión')]));
}
