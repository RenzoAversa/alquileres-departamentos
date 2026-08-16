// ============================================================
// Cálculo puro (sin DOM) para dibujar reservas como bandas continuas
// dentro de un mes calendario: cada tramo abarca sus noches con un
// colspan, con cabos redondeados si entra/sale ese mes o rectos si la
// estadía viene de antes / sigue después. Lo comparten el tape chart de
// Calendario y el mini-calendario por departamento de Disponibilidad,
// para no tener dos formas distintas de dibujar lo mismo.
// ============================================================
import { masDias } from './metricas.js';

// `reservas`: ya filtradas a las de la unidad (y sin canceladas).
// `dias`: fechas ISO del mes, 1..último día. `primerDia`/`ultimoDia`: bordes de ese rango.
export function tramosDeMes(reservas, dias, primerDia, ultimoDia) {
  const indice = new Map(dias.map((d, i) => [d, i]));
  return reservas
    .map((r) => {
      const ultimaNoche = masDias(r.fechaSalida, -1); // el día de salida no ocupa noche
      const desde = r.fechaEntrada < primerDia ? primerDia : r.fechaEntrada;
      const hasta = ultimaNoche > ultimoDia ? ultimoDia : ultimaNoche;
      if (hasta < desde) return null; // no deja ninguna noche en este mes
      const i0 = indice.get(desde);
      const i1 = indice.get(hasta);
      if (i0 == null || i1 == null) return null;
      const vieneDeAntes = r.fechaEntrada < primerDia;
      const sigueDespues = ultimaNoche > ultimoDia;
      return {
        reserva: r,
        inicio: i0,
        largo: i1 - i0 + 1,
        vieneDeAntes,
        sigueDespues,
        // Entra/sale "a mitad del día": ver comentario original en
        // calendario.view.js — la banda arranca/termina a mitad de celda
        // en vez de ocupar el día completo de entrada/salida.
        medioInicio: !vieneDeAntes,
        medioFin: !sigueDespues && (i1 + 1) < dias.length
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.inicio - b.inicio);
}
