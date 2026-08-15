// ============================================================
// BaseService: CRUD genérico sobre una colección de Firestore.
// TODOS los servicios de entidades heredan de acá. Si algún día
// cambiás de backend o pasás a multi-tenant, tocás SOLO este archivo.
// ============================================================
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/init.js';

export class BaseService {
  constructor(nombreColeccion) {
    this.nombre = nombreColeccion;
    this.col = collection(db, nombreColeccion);
  }

  _mapDoc(d) {
    return { id: d.id, ...d.data() };
  }

  async getAll() {
    const snap = await getDocs(this.col);
    return snap.docs.map((d) => this._mapDoc(d));
  }

  async getById(id) {
    const snap = await getDoc(doc(db, this.nombre, id));
    return snap.exists() ? this._mapDoc(snap) : null;
  }

  async create(data) {
    const ref = await addDoc(this.col, {
      ...data,
      creadoEn: serverTimestamp()
    });
    return { id: ref.id, ...data };
  }

  async update(id, data) {
    await updateDoc(doc(db, this.nombre, id), {
      ...data,
      actualizadoEn: serverTimestamp()
    });
    return { id, ...data };
  }

  async remove(id) {
    await deleteDoc(doc(db, this.nombre, id));
    return true;
  }

  // Escucha cambios en tiempo real. Devuelve la función unsubscribe.
  listen(callback) {
    return onSnapshot(this.col, (snap) => {
      callback(snap.docs.map((d) => this._mapDoc(d)));
    });
  }

  // Consulta con filtros. filtros: [['campo','==',valor], ...]
  async buscar(filtros = [], orden = null) {
    const clausulas = filtros.map((f) => where(f[0], f[1], f[2]));
    if (orden) clausulas.push(orderBy(orden[0], orden[1] || 'asc'));
    const snap = await getDocs(query(this.col, ...clausulas));
    return snap.docs.map((d) => this._mapDoc(d));
  }
}
