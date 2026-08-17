// ============================================================
// Caché en memoria (vía core/store.js) para colecciones que casi no
// cambian: edificios, unidades. Envuelve getAll()/create()/update()/
// remove() de un servicio existente, sin tocar sus otros métodos
// (getById, buscar, los específicos de cada uno...), que se siguen
// resolviendo tal cual contra el servicio real.
//
// La invalidación queda CENTRALIZADA acá a propósito, no repartida por
// cada pantalla que crea/edita/borra: toda escritura pasa por create()/
// update()/remove() de este wrapper, así que es imposible que una
// pantalla se olvide de invalidar. Si en el futuro se agrega un método
// de escritura nuevo a alguno de estos servicios, hay que envolverlo
// acá también (o el caché quedará viejo).
//
// NO usar con reservas ni movimientos: son los datos que más cambian y
// los que más importa que estén siempre al día.
//
// TAMPOCO usar con `cuentas` — y esto NO es un olvido, quedó afuera a
// propósito: su campo `saldo` se actualiza con increment() directo desde
// movimientos.service.js (pagos, transferencias) y reservas.service.js
// (registrarPago/anularPago), escrituras que nunca pasan por
// cuentasService.update(). Si `cuentas` pasara por este wrapper, el saldo
// mostrado quedaría viejo después de cualquier pago hecho en OTRA
// pantalla, y nada de lo que hay acá se enteraría para invalidarlo. Para
// cachearla de verdad habría que meter la invalidación también en esos
// otros dos servicios — evaluado y descartado: no vale la pena arriesgar
// el dato de plata por 4 lecturas.
//
// LÍMITE DEL CACHÉ — leer antes de tocar TTL_MS: este caché vive en
// memoria de ESTA pestaña (core/store.js), no se sincroniza ni con otras
// pestañas del mismo navegador ni con otros dispositivos. Si alguien crea
// un edificio desde su celular, la compu de al lado con esta pantalla ya
// abierta NO se entera sola — la escritura solo invalida el caché de LA
// PESTAÑA QUE ESCRIBIÓ (ver invalidar() más abajo), instantáneo ahí.
// TTL_MS es el techo que le pone un límite de tiempo a cuán vieja puede
// quedar esa OTRA sesión: cada colección cacheada se vuelve a leer sola
// como máximo cada TTL_MS, sin que nadie tenga que tocar F5. Si algún día
// hay que subirlo o bajarlo, es la única constante que hace falta tocar.
import { store } from '../core/store.js';

const TTL_MS = 5 * 60 * 1000; // 5 minutos

// Todas las claves cacheadas por conCache(), para poder invalidarlas
// juntas al volver a esta pestaña (ver el listener de visibilitychange
// más abajo) sin que cada llamada a conCache() registre su propio
// listener por separado.
const clavesCacheadas = new Set();
let listenerVisibilidadListo = false;

function asegurarListenerVisibilidad() {
  if (listenerVisibilidadListo || typeof document === 'undefined') return;
  listenerVisibilidadListo = true;
  document.addEventListener('visibilitychange', () => {
    // Solo al VOLVER a esta pestaña (no al ocultarla): invalida todo lo
    // cacheado para que el próximo getAll() traiga datos frescos en vez
    // de esperar a que venza el TTL. Invalidar acá no cuesta una lectura
    // por sí solo — recién se lee de nuevo si esa pantalla vuelve a
    // pedir esa colección.
    if (document.visibilityState !== 'visible') return;
    clavesCacheadas.forEach((clave) => store.set(clave, null));
  });
}

export function conCache(servicio, coleccion) {
  const clave = `cache:${coleccion}`;
  clavesCacheadas.add(clave);
  asegurarListenerVisibilidad();

  // La instancia original queda como prototipo del wrapper: cualquier
  // método que no se sobreescriba acá abajo (getById, buscar, y los
  // propios de cada servicio como getByEdificio) se resuelve tal cual
  // contra `servicio`, con su `this` real — no hace falta reimplementar
  // ni reexportar nada a mano.
  const wrapper = Object.create(servicio);

  wrapper.getAll = async function () {
    const cacheado = store.get(clave);
    const vencido = !cacheado || (Date.now() - cacheado.ts > TTL_MS);
    if (vencido) {
      const datos = await servicio.getAll();
      store.set(clave, { datos, ts: Date.now() });
      return [...datos];
    }
    // Copia liviana en cada llamada: si algún llamador hace .sort()/
    // .push() sobre lo que recibe, que no corrompa el array cacheado que
    // comparten las demás pantallas.
    return [...cacheado.datos];
  };

  // store.set(clave, null) alcanza para invalidar sin esperar el TTL: el
  // chequeo de arriba (`!cacheado`) ya lo trata como vencido, sin importar
  // hace cuánto se guardó. Así, en la pestaña que hizo la escritura, el
  // próximo getAll() siempre trae el dato nuevo al toque.
  function invalidar() { store.set(clave, null); }

  wrapper.create = async function (data) {
    const r = await servicio.create(data);
    invalidar();
    return r;
  };
  wrapper.update = async function (id, data) {
    const r = await servicio.update(id, data);
    invalidar();
    return r;
  };
  wrapper.remove = async function (id) {
    const r = await servicio.remove(id);
    invalidar();
    return r;
  };

  return wrapper;
}
