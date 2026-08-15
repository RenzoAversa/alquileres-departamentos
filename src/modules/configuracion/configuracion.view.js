// Configuración: datos de la cuenta, módulos y (solo dueño) gestión de usuarios.
import { appConfig } from '../../firebase/init.js';
import { logout } from '../../core/auth.js';
import { el, toast, confirmar, botonRecargar, crearPaginado } from '../../core/ui.js';
import { sesion, ROLES } from '../../core/sesion.js';
import { usuariosService } from '../../services/usuarios.service.js';

const fila = (k, v) => el('div', { class: 'lista__item' }, [el('span', { class: 'muted' }, k), el('strong', {}, v)]);
const campo = (label, input) => el('label', { class: 'form__campo' }, [el('span', {}, label), input]);
const selectRoles = (valor) => {
  const s = el('select', {});
  Object.entries(ROLES).forEach(([k, label]) => s.append(el('option', { value: k, selected: (valor === k) || undefined }, label)));
  return s;
};

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
      'Nota: además de asignar el rol acá, la cuenta de acceso (email + contraseña) se crea en la consola de Firebase → Authentication.'));

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

  // ---- Módulos activos ----
  const flags = Object.entries(appConfig.features).map(([k, v]) =>
    el('div', { class: 'lista__item' }, [el('span', {}, k), el('span', { class: `badge ${v ? 'badge--ok' : ''}` }, v ? 'Activo' : 'Off')]));
  container.append(el('div', { class: 'card' }, [el('h3', {}, 'Módulos'), ...flags]));

  // ---- Salir ----
  container.append(el('div', { class: 'card' }, [el('button', { class: 'btn btn--danger', onClick: () => logout() }, 'Cerrar sesión')]));
}
