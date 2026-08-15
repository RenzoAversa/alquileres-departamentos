// ============================================================
// Store mínimo en memoria con suscripción.
// Sirve de caché liviano para que los módulos compartan datos
// ya cargados sin volver a pegarle a Firestore (ahorra lecturas).
// ============================================================
const state = {};
const listeners = {};

export const store = {
  get(key) {
    return state[key];
  },
  set(key, value) {
    state[key] = value;
    (listeners[key] || []).forEach((fn) => fn(value));
  },
  subscribe(key, fn) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(fn);
    return () => {
      listeners[key] = listeners[key].filter((f) => f !== fn);
    };
  },
  clear() {
    Object.keys(state).forEach((k) => delete state[k]);
  }
};
