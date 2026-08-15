// ============================================================
// Gráficos SVG inline, sin dependencias externas (nada de CDN: la PWA
// cachea los estáticos offline y no queremos mantener una lista de
// cacheo de terceros). Funciones puras: reciben datos YA calculados
// y devuelven un nodo DOM listo para insertar. Cero lógica de negocio,
// cero lecturas a Firestore acá.
//
//   graficoTorta([{ label, valor, color? }], opciones)
//   graficoLineas([{ nombre, valores:[n,...], color? }], { etiquetas })
//   graficoBarrasApiladas([{ label, segmentos:[{nombre,valor,color?}] }])
//
// Todas devuelven un nodo "sin datos" legible si no hay nada que dibujar.
// ============================================================
import { el } from './ui.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

function sinDatos(mensaje) {
  return el('div', { class: 'grafico grafico--vacio' }, el('p', { class: 'grafico-vacio' }, mensaje));
}

// Paleta derivada de los tokens semánticos (nunca hex inventado). Para más
// categorías que colores base, se repite la vuelta mezclando con la superficie.
const PALETA_BASE = ['var(--color-primario)', 'var(--ok)', 'var(--warn)', 'var(--alerta)', 'var(--texto-muted)'];
function colorPaleta(i) {
  const base = PALETA_BASE[i % PALETA_BASE.length];
  const vuelta = Math.floor(i / PALETA_BASE.length);
  if (vuelta === 0) return base;
  const pct = Math.max(35, 75 - vuelta * 20);
  return `color-mix(in srgb, ${base} ${pct}%, var(--superficie))`;
}

const formatoDefault = (n) => String(Math.round(Number(n) || 0));

function polarACartesiano(cx, cy, r, anguloDeg) {
  const rad = ((anguloDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function trozoTorta(cx, cy, r, angInicio, angFin) {
  const p0 = polarACartesiano(cx, cy, r, angInicio);
  const p1 = polarACartesiano(cx, cy, r, angFin);
  const largeArc = angFin - angInicio > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`;
}

// ------------------------------------------------------------
// Torta: datos = [{ label, valor, color? }]
// ------------------------------------------------------------
export function graficoTorta(datos = [], opciones = {}) {
  const { formatoValor = formatoDefault, titulo = 'Gráfico de torta' } = opciones;
  const items = (datos || []).filter((d) => Number(d.valor) > 0);
  if (!items.length) return sinDatos('Sin datos para mostrar.');

  const total = items.reduce((a, d) => a + Number(d.valor), 0);
  const cx = 50, cy = 50, r = 42;
  let angulo = 0;

  const trozos = items.map((d, i) => {
    const valor = Number(d.valor);
    const frac = valor / total;
    const angInicio = angulo;
    const angFin = angulo + frac * 360;
    angulo = angFin;
    const color = d.color || colorPaleta(i);
    const pct = Math.round(frac * 100);

    const nodo = items.length === 1
      ? svgEl('circle', { cx, cy, r, fill: color, class: 'grafico-torta__slice' })
      : svgEl('path', {
          d: trozoTorta(cx, cy, r, angInicio, angFin), fill: color,
          class: 'grafico-torta__slice', style: `animation-delay:${i * 60}ms`
        });
    nodo.append(svgEl('title', {}, `${d.label}: ${formatoValor(valor)} (${pct}%)`));
    return nodo;
  });

  const svg = svgEl('svg', {
    viewBox: '0 0 100 100', class: 'grafico__svg', role: 'img',
    'aria-label': `${titulo}: ${items.map((d) => `${d.label} ${Math.round((Number(d.valor) / total) * 100)}%`).join(', ')}`
  }, trozos);

  const leyenda = el('div', { class: 'grafico-leyenda' }, items.map((d, i) =>
    el('span', { class: 'grafico-leyenda__item' }, [
      el('span', { class: 'grafico-leyenda__muestra', style: `background:${d.color || colorPaleta(i)}` }),
      `${d.label} · ${formatoValor(Number(d.valor))}`
    ])));

  return el('div', { class: 'grafico' }, [svg, leyenda]);
}

// ------------------------------------------------------------
// Líneas: series = [{ nombre, valores:[n,...], color? }], opciones.etiquetas
// (mismo largo que `valores`, ej. salida de ultimosMeses().map(m=>m.label))
// ------------------------------------------------------------
export function graficoLineas(series = [], opciones = {}) {
  const { etiquetas = [], formatoValor = formatoDefault, titulo = 'Evolución' } = opciones;
  const activas = (series || []).filter((s) => Array.isArray(s.valores) && s.valores.length);
  if (!activas.length || !etiquetas.length) return sinDatos('Sin datos para mostrar.');

  const n = etiquetas.length;
  const todos = activas.flatMap((s) => s.valores.map((v) => Number(v) || 0));
  const maxY = Math.max(1, ...todos);
  const minY = Math.min(0, ...todos);
  const rango = (maxY - minY) || 1;
  const W = 100, H = 45;
  const x = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v) => H - ((Number(v) - minY) / rango) * H;

  const grupos = activas.map((s, si) => {
    const color = s.color || colorPaleta(si);
    const puntos = s.valores.map((v, i) => ({ x: x(i), y: y(v), v: Number(v) || 0, i }));
    const d = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    const path = svgEl('path', {
      d, fill: 'none', stroke: color, 'stroke-width': 1.6,
      class: 'grafico-linea__path', style: `animation-delay:${si * 100}ms`
    });
    const puntosEl = puntos.map((p) => {
      const c = svgEl('circle', { cx: p.x.toFixed(2), cy: p.y.toFixed(2), r: 1.8, fill: color, class: 'grafico-linea__punto' });
      c.append(svgEl('title', {}, `${s.nombre} · ${etiquetas[p.i] ?? ''}: ${formatoValor(p.v)}`));
      return c;
    });
    return svgEl('g', {}, [path, ...puntosEl]);
  });

  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'grafico__svg', role: 'img',
    'aria-label': `${titulo}: ${activas.map((s) => s.nombre).join(', ')}`
  }, grupos);

  const eje = el('div', { class: 'grafico-eje' }, etiquetas.map((et) => el('span', { class: 'grafico-eje__label' }, et)));
  const leyenda = activas.length > 1
    ? el('div', { class: 'grafico-leyenda' }, activas.map((s, i) =>
        el('span', { class: 'grafico-leyenda__item' }, [
          el('span', { class: 'grafico-leyenda__muestra', style: `background:${s.color || colorPaleta(i)}` }),
          s.nombre
        ])))
    : null;

  return el('div', { class: 'grafico' }, [svg, eje, leyenda].filter(Boolean));
}

// ------------------------------------------------------------
// Barras apiladas: datos = [{ label, segmentos:[{nombre, valor, color?}] }]
// Todos los puntos deben traer los mismos `segmentos` (mismo orden), para
// que la leyenda salga del primero.
// ------------------------------------------------------------
export function graficoBarrasApiladas(datos = [], opciones = {}) {
  const { formatoValor = formatoDefault, titulo = 'Barras apiladas' } = opciones;
  const items = (datos || []).filter((d) => Array.isArray(d.segmentos) && d.segmentos.length);
  const hayDatos = items.some((d) => d.segmentos.some((s) => Number(s.valor) > 0));
  if (!items.length || !hayDatos) return sinDatos('Sin datos para mostrar.');

  const totales = items.map((d) => d.segmentos.reduce((a, s) => a + Math.max(0, Number(s.valor) || 0), 0));
  const maxTotal = Math.max(1, ...totales);
  const n = items.length;
  const W = 100, H = 45;
  const gap = n > 1 ? 1.5 : 0;
  const anchoBarra = (W - gap * (n - 1)) / n;

  const barras = items.map((d, i) => {
    const xBase = i * (anchoBarra + gap);
    let yAcum = H;
    const rects = d.segmentos.map((s, si) => {
      const valor = Math.max(0, Number(s.valor) || 0);
      const alto = (valor / maxTotal) * H;
      const y = yAcum - alto;
      yAcum = y;
      const color = s.color || colorPaleta(si);
      const rect = svgEl('rect', {
        x: xBase.toFixed(2), y: y.toFixed(2), width: anchoBarra.toFixed(2), height: alto.toFixed(2),
        fill: color, class: 'grafico-barra__seg', style: `animation-delay:${i * 40}ms`
      });
      rect.append(svgEl('title', {}, `${s.nombre} · ${d.label}: ${formatoValor(valor)}`));
      return rect;
    });
    return svgEl('g', {}, rects);
  });

  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'grafico__svg', role: 'img',
    'aria-label': `${titulo}: ${items.map((d) => d.label).join(', ')}`
  }, barras);

  const eje = el('div', { class: 'grafico-eje' }, items.map((d) => el('span', { class: 'grafico-eje__label' }, d.label)));
  const nombresSegmento = items[0].segmentos.map((s, i) => ({ nombre: s.nombre, color: s.color || colorPaleta(i) }));
  const leyenda = el('div', { class: 'grafico-leyenda' }, nombresSegmento.map((s) =>
    el('span', { class: 'grafico-leyenda__item' }, [
      el('span', { class: 'grafico-leyenda__muestra', style: `background:${s.color}` }),
      s.nombre
    ])));

  return el('div', { class: 'grafico' }, [svg, eje, leyenda]);
}
