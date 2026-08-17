// ============================================================
// Números de Reportes, siempre visibles (antes solo estaban en el
// `title` de cada barra/punto, es decir solo con hover — invisibles en
// mobile). Puro renderizado sobre datos ya calculados por metricasPeriodo();
// no dispara ninguna consulta nueva. Compartido entre Tendencias mensuales,
// Evolución mensual e Ingresos vs gastos por mes, para no repetir tres
// veces el cálculo de variación ni el armado de la fila de valores.
// ============================================================
import { el, money } from '../../core/ui.js';
import { variacion } from '../../core/metricas.js';

// Texto + color de la variación respecto al mes anterior. Reusa
// variacion() de metricas.js para el porcentaje (ya resuelve el caso
// "mes anterior en cero" devolviendo null) y arma acá el delta absoluto.
// `mostrarPct: false` es para métricas que ya son un porcentaje (la
// ocupación): mostrar "variación % de una variación %" confunde más de lo
// que aclara, así que ahí solo se muestra el delta en puntos.
export function variacionTexto(actual, anterior, formatoValor = money, { mostrarPct = true } = {}) {
  const pct = variacion(actual, anterior);
  if (pct === null) return { texto: 'nuevo', color: 'var(--texto-muted)' };
  if (actual === anterior) return { texto: '—', color: 'var(--texto-muted)' };
  const diff = actual - anterior;
  const signo = diff > 0 ? '+' : '';
  const color = diff > 0 ? 'var(--ok)' : diff < 0 ? 'var(--alerta)' : 'var(--texto-muted)';
  const texto = mostrarPct ? `${signo}${formatoValor(diff)} (${signo}${pct}%)` : `${signo}${formatoValor(diff)}`;
  return { texto, color };
}

export function nodoVariacion(actual, anterior, formatoValor = money, opciones) {
  const { texto, color } = variacionTexto(actual, anterior, formatoValor, opciones);
  return el('span', { class: 'variacion-mensual', style: `color:${color}` }, texto);
}

// Fila de valores por mes: una "tarjeta" chica por mes con una o más
// métricas (valor + variación), en vez de amontonar el texto adentro del
// SVG de graficoLineas/graficoBarrasApiladas. Con scroll horizontal en
// desktop y lista vertical en mobile (media query en el CSS): con varias
// métricas por mes no hay ancho de columna de gráfico que alcance para
// que el número se lea bien en 360px.
//
// `columnas`: [{ clave, etiqueta, formatoValor, variacion?, opcionesVariacion? }]
export function valoresMensuales(datos, columnas) {
  const meses = datos.map((d, i) => {
    const anterior = i > 0 ? datos[i - 1] : null;
    const items = columnas.map((c) => {
      const valor = d[c.clave];
      const formato = c.formatoValor || money;
      const fila = [
        el('span', { class: 'valores-mensuales__valor' }, formato(valor)),
        (c.variacion && anterior) ? nodoVariacion(valor, anterior[c.clave], formato, c.opcionesVariacion) : null
      ];
      return el('div', { class: 'valores-mensuales__item' }, [
        el('span', { class: 'muted small' }, c.etiqueta),
        el('div', { class: 'valores-mensuales__fila' }, fila)
      ]);
    });
    return el('div', { class: 'valores-mensuales__mes' }, [
      el('div', { class: 'valores-mensuales__mes-label' }, d.label),
      ...items
    ]);
  });
  return el('div', { class: 'valores-mensuales' }, meses);
}
