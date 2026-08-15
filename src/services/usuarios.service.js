// ============================================================
// Usuarios del equipo. Doc id = email (en minúsculas), así el dueño
// puede pre-cargar a alguien por email antes de que inicie sesión.
// La cuenta de acceso (email + contraseña) se crea en Firebase Auth.
// ============================================================
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/init.js';
import { BaseService } from './base.service.js';

const idDe = (email) => (email || '').trim().toLowerCase();

class UsuariosService extends BaseService {
  constructor() { super('usuarios'); }

  listar() { return this.getAll(); }

  async crear(email, nombre, rol) {
    const id = idDe(email);
    const data = { email: id, nombre: nombre || id.split('@')[0], rol: rol || 'trabajador', activo: true };
    await setDoc(doc(db, 'usuarios', id), { ...data, creadoEn: serverTimestamp() });
    return { id, ...data };
  }

  cambiarRol(email, rol) {
    return updateDoc(doc(db, 'usuarios', idDe(email)), { rol, actualizadoEn: serverTimestamp() });
  }

  eliminar(email) {
    return deleteDoc(doc(db, 'usuarios', idDe(email)));
  }
}

export const usuariosService = new UsuariosService();
