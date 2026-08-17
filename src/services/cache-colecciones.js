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
// ============================================================
import { store } from '../core/store.js';

export function conCache(servicio, coleccion) {
  const clave = `cache:${coleccion}`;
  // La instancia original queda como prototipo del wrapper: cualquier
  // método que no se sobreescriba acá abajo (getById, buscar, y los
  // propios de cada servicio como getByEdificio) se resuelve tal cual
  // contra `servicio`, con su `this` real — no hace falta reimplementar
  // ni reexportar nada a mano.
  const wrapper = Object.create(servicio);

  wrapper.getAll = async function () {
    let datos = store.get(clave);
    if (!datos) {
      datos = await servicio.getAll();
      store.set(clave, datos);
    }
    // Copia liviana en cada llamada (venga del caché o recién pedida): si
    // algún llamador hace .sort()/.push() sobre lo que recibe, que no
    // corrompa el array cacheado que comparten las demás pantallas.
    return [...datos];
  };

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
