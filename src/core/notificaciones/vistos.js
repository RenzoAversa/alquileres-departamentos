// ============================================================
// Avisos "vistos" por el usuario actual.
//
// Es una preferencia LOCAL (no vale gastar escrituras de Firestore en
// esto): se guarda en localStorage, con una clave por usuario para que
// al desloguearse y entrar otro no herede el estado del anterior.
//
// Cada aviso tiene un id determinístico "tipo:reservaId:fecha" (armado
// en notificaciones/engine.js) para que no cambie entre recálculos —
// el engine corre cada 60s, así que si el id no fuera estable todo
// volvería a aparecer como no visto todo el tiempo.
// ============================================================
import { sesion } from '../sesion.js';
import { hoyISO } from '../metricas.js';

function claveStorage() {
  const quien = sesion.uid || sesion.email || 'anon';
  return `notif_vistos_${quien}`;
}

function leer() {
  try {
    const raw = localStorage.getItem(claveStorage());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function guardar(mapa) {
  try { localStorage.setItem(claveStorage(), JSON.stringify(mapa)); } catch { /* localStorage lleno o bloqueado: no es crítico */ }
}

export function estaVisto(id) {
  if (!id) return false;
  return !!leer()[id];
}

export function marcarVisto(id) {
  if (!id) return;
  const mapa = leer();
  mapa[id] = true;
  guardar(mapa);
}

export function marcarNoVisto(id) {
  if (!id) return;
  const mapa = leer();
  delete mapa[id];
  guardar(mapa);
}

export function alternarVisto(id) {
  if (estaVisto(id)) marcarNoVisto(id);
  else marcarVisto(id);
}

export function marcarTodosVistos(ids) {
  const mapa = leer();
  (ids || []).forEach((id) => { if (id) mapa[id] = true; });
  guardar(mapa);
}

// Descarta ids de avisos de fechas anteriores a hoy (la fecha va como
// tercer segmento del id, "tipo:reservaId:fecha"). Si no se limpiara,
// el localStorage crecería sin control con el uso diario.
export function limpiarVistosViejos() {
  const hoy = hoyISO();
  const mapa = leer();
  let cambio = false;
  Object.keys(mapa).forEach((id) => {
    const fecha = id.split(':')[2];
    if (fecha && fecha < hoy) { delete mapa[id]; cambio = true; }
  });
  if (cambio) guardar(mapa);
}

// Al desloguearse: son vistos de ESTE usuario, no deben quedar para el próximo.
export function resetearVistos() {
  try { localStorage.removeItem(claveStorage()); } catch { /* no-op */ }
}
