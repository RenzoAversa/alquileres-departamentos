// ============================================================
// Roles, permisos y sesión del usuario actual.
//   - Cada usuario (doc en `usuarios`, id = email) tiene un rol.
//   - Roles: dueño, encargado, trabajador (+ sin_asignar por defecto,
//     y "visitante" que se sumará con la web pública).
//   - Bootstrap: el PRIMER usuario de un cliente nuevo queda como dueño;
//     los demás entran como "sin_asignar" hasta que el dueño les da un rol.
// ============================================================
import { usuariosService } from '../services/usuarios.service.js';

const TODOS = ['dashboard', 'edificios', 'unidades', 'reservas', 'disponibilidad', 'calendario', 'mapa', 'contabilidad', 'reportes', 'configuracion'];

// Definición de cada rol: etiqueta, módulos visibles y permisos de acción.
const DEFINICION = {
  dueño:       { label: 'Dueño',       modulos: TODOS, caps: { verDinero: true, gestionarPagos: true, eliminar: true, editarReservas: true, gestionarUsuarios: true, gestionarPropiedades: true } },
  encargado:   { label: 'Encargado',   modulos: TODOS, caps: { verDinero: true, gestionarPagos: true, eliminar: true, editarReservas: true, gestionarUsuarios: false, gestionarPropiedades: true } },
  trabajador:  { label: 'Trabajador',  modulos: ['dashboard', 'reservas', 'disponibilidad', 'calendario', 'configuracion'], caps: {} },
  sin_asignar: { label: 'Sin asignar', modulos: [], caps: {} }
};

// Roles asignables desde Configuración (excluye sin_asignar)
export const ROLES = { dueño: 'Dueño', encargado: 'Encargado', trabajador: 'Trabajador' };

function def(rol) { return DEFINICION[rol] || DEFINICION.sin_asignar; }

// Objeto de sesión (singleton mutable) usado en toda la app
export const sesion = {
  uid: null,
  email: '',
  nombre: '',
  rol: 'sin_asignar',
  rolLabel: 'Sin asignar',
  puede(cap) { return !!def(this.rol).caps[cap]; },
  puedeModulo(modulo) { return def(this.rol).modulos.includes(modulo); },
  tieneAcceso() { return def(this.rol).modulos.length > 0; }
};

export async function cargarSesion(user) {
  const email = (user.email || '').trim().toLowerCase();
  let perfil = null;
  try { perfil = await usuariosService.getById(email); } catch { perfil = null; }

  if (!perfil) {
    let equipo = [];
    try { equipo = await usuariosService.listar(); } catch { equipo = []; }
    const rol = equipo.length === 0 ? 'dueño' : 'sin_asignar';
    const nombre = email.split('@')[0] || 'usuario';
    try { perfil = await usuariosService.crear(email, nombre, rol); }
    catch { perfil = { email, nombre, rol }; }
  }

  sesion.uid = user.uid;
  sesion.email = email;
  sesion.nombre = perfil.nombre || '';
  sesion.rol = perfil.rol || 'sin_asignar';
  sesion.rolLabel = def(sesion.rol).label;
  return sesion;
}
