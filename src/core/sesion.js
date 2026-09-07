// ============================================================
// Roles, permisos y sesión del usuario actual.
//   - Cada usuario (doc en `usuarios`, id = email) tiene un rol.
//   - Roles: dueño, encargado, trabajador (+ sin_asignar por defecto,
//     y "visitante" que se sumará con la web pública).
//   - Bootstrap: TODO usuario nuevo entra como "sin_asignar" — nadie puede
//     auto-asignarse un rol (firestore.rules lo exige: el alta del propio
//     doc solo se permite con rol 'sin_asignar'). El dueño de un cliente
//     nuevo se promueve a mano, una única vez, desde la consola de
//     Firestore (ver ONBOARDING.md); después administra el resto de los
//     roles desde Configuración. Ver AUDIT.md, hallazgo C1.
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
    // Autoalta del propio perfil: firestore.rules solo permite crearlo con
    // rol 'sin_asignar' (nadie se autoasigna un rol). Si la escritura
    // falla igual (ej. sin conexión), el fallback local también queda en
    // 'sin_asignar' — nunca hay que asumir más acceso del que Firestore
    // puede respaldar.
    const nombre = email.split('@')[0] || 'usuario';
    try { perfil = await usuariosService.crear(email, nombre, 'sin_asignar'); }
    catch { perfil = { email, nombre, rol: 'sin_asignar' }; }
  }

  sesion.uid = user.uid;
  sesion.email = email;
  sesion.nombre = perfil.nombre || '';
  sesion.rol = perfil.rol || 'sin_asignar';
  sesion.rolLabel = def(sesion.rol).label;
  return sesion;
}
