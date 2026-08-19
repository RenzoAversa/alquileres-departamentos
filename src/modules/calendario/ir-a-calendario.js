// ============================================================
// Navegar al Calendario marcando una reserva puntual: mecanismo
// compartido entre "Próximas reservas" del Panel y "Ver en calendario"
// de Reservas. Los dos deben usar exactamente este mismo helper (mismo
// nombre de clave en el store) para que el Calendario solo tenga que
// leer una única forma de reservaDestacada al montarse.
// ============================================================
import { store } from '../../core/store.js';
import { navegar } from '../../core/router.js';

export function irACalendario(reserva) {
  store.set('reservaDestacada', { id: reserva.id, fechaEntrada: reserva.fechaEntrada });
  navegar('calendario');
}
