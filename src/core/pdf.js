// ============================================================
// Generador de recibos en PDF (reservas).
//   - Carga jsPDF on-demand desde CDN (no pesa la app si no se usa).
//   - Todo se arma en el navegador, sin backend ni costo de servidor.
//   - Layout simple con texto y líneas (sin plugins de tablas) para
//     mantener la librería liviana.
// ============================================================
import { appConfig } from '../firebase/init.js';
import { money, fecha, toast } from './ui.js';
import { colorPaletaHex, hexARgb } from './paleta.js';

let promesa = null;
function cargarJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve();
  if (promesa) return promesa;
  promesa = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar el generador de PDF'));
    document.head.append(s);
  });
  return promesa;
}

const COLOR_PRIMARIO = [37, 99, 235];
const COLOR_MUTED = [100, 116, 139];
const COLOR_TEXTO = [15, 23, 42];
const COLOR_BORDE = [226, 232, 240];

// Recibo de una reserva: datos generales + historial de pagos.
// `pagos`: [{ fecha, monto, nombreCuenta, nota }]
export async function generarReciboReserva(reserva, pagos = []) {
  await cargarJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 48;
  let y = 0;

  // ---- Encabezado con marca ----
  doc.setFillColor(...COLOR_PRIMARIO);
  doc.rect(0, 0, ancho, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(appConfig.cliente.nombre || 'Alquileres', margen, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Recibo de reserva', margen, 58);
  y = 100;

  const total = Number(reserva.precioTotal) || 0;
  const pagado = Number(reserva.pagado) || 0;
  const saldo = total - pagado;

  // ---- Datos de la reserva ----
  doc.setTextColor(...COLOR_TEXTO);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(reserva.unidadNombre || 'Unidad', margen, y);
  y += 18;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_MUTED);
  const filaDatos = (label, valor) => {
    doc.text(label, margen, y);
    doc.setTextColor(...COLOR_TEXTO);
    doc.text(String(valor ?? '—'), margen + 110, y);
    doc.setTextColor(...COLOR_MUTED);
    y += 16;
  };
  filaDatos('Huésped', reserva.huesped?.nombre);
  filaDatos('Teléfono', reserva.huesped?.telefono);
  filaDatos('Entrada', fecha(reserva.fechaEntrada));
  filaDatos('Salida', fecha(reserva.fechaSalida));
  filaDatos('Noches', reserva.noches);
  filaDatos('Canal', reserva.canal);
  y += 8;

  // ---- Resumen de importes ----
  doc.setDrawColor(...COLOR_BORDE);
  doc.line(margen, y, ancho - margen, y);
  y += 22;

  const col = (x, label, valor, color = COLOR_TEXTO) => {
    doc.setFontSize(9); doc.setTextColor(...COLOR_MUTED);
    doc.text(label, x, y);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...color);
    doc.text(money(valor), x, y + 16);
    doc.setFont('helvetica', 'normal');
  };
  const anchoCol = (ancho - margen * 2) / 3;
  col(margen, 'Total', total);
  col(margen + anchoCol, 'Pagado', pagado, [22, 163, 74]);
  col(margen + anchoCol * 2, 'Saldo', saldo, saldo > 0 ? [220, 38, 38] : [22, 163, 74]);
  y += 34;

  doc.setDrawColor(...COLOR_BORDE);
  doc.line(margen, y, ancho - margen, y);
  y += 24;

  // ---- Historial de pagos ----
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...COLOR_TEXTO);
  doc.text('Pagos registrados', margen, y);
  y += 18;

  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  if (!pagos.length) {
    doc.setTextColor(...COLOR_MUTED);
    doc.text('Todavía no hay pagos registrados.', margen, y);
    y += 16;
  } else {
    pagos.forEach((p) => {
      doc.setTextColor(...COLOR_TEXTO);
      doc.text(fecha(p.fecha), margen, y);
      doc.text(p.nombreCuenta || '—', margen + 80, y);
      doc.text(money(p.monto), margen + 220, y);
      if (p.nota) { doc.setTextColor(...COLOR_MUTED); doc.text(p.nota, margen + 300, y); }
      y += 16;
    });
  }

  // ---- Pie ----
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Generado el ${fecha(new Date().toISOString().slice(0, 10))}`, margen, doc.internal.pageSize.getHeight() - 30);

  const archivo = `recibo-${(reserva.unidadNombre || 'reserva').replace(/\s+/g, '_')}-${reserva.huesped?.nombre?.replace(/\s+/g, '_') || ''}.pdf`;
  doc.save(archivo);
}

// ============================================================
// Gráficos vectoriales para PDF (torta / barras / líneas / apiladas).
// Dibujado a mano con las primitivas de jsPDF (rect/triangle/line), en vez
// de rasterizar el SVG de core/graficos.js: ese SVG usa colores
// var(--color-primario) que no se resuelven al renderizar como imagen
// suelta, y esto además da un PDF vectorial (liviano, nítido a cualquier
// zoom) en vez de una captura de pantalla.
// ============================================================
const COLOR_TEXTO_PDF = COLOR_TEXTO;
const COLOR_MUTED_PDF = COLOR_MUTED;

function polarPDF(cx, cy, r, anguloDeg) {
  const rad = ((anguloDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Devuelve { validos, total } o null si no hay datos. Dibuja los gajos por
// fan-triangulación (jsPDF no tiene un "arc fill" nativo).
function dibujarTortaPDF(doc, { cx, cy, r, items, formatoValor }) {
  const validos = (items || []).filter((d) => Number(d.valor) > 0);
  if (!validos.length) return null;
  const total = validos.reduce((a, d) => a + Number(d.valor), 0);
  let angulo = 0;
  validos.forEach((d, i) => {
    const frac = Number(d.valor) / total;
    const angFin = angulo + frac * 360;
    doc.setFillColor(...(d.color ? hexARgb(d.color) : hexARgb(colorPaletaHex(i))));
    const pasos = Math.max(1, Math.ceil((angFin - angulo) / 4));
    for (let s = 0; s < pasos; s++) {
      const a0 = angulo + (angFin - angulo) * (s / pasos);
      const a1 = angulo + (angFin - angulo) * ((s + 1) / pasos);
      const p0 = polarPDF(cx, cy, r, a0);
      const p1 = polarPDF(cx, cy, r, a1);
      doc.triangle(cx, cy, p0.x, p0.y, p1.x, p1.y, 'F');
    }
    angulo = angFin;
  });
  return { validos, total };
}

// Leyenda vertical: cuadradito de color + "label · valor (pct%)".
function leyendaPDF(doc, { x, y, items, total, formatoValor }) {
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  let ly = y;
  items.forEach((d, i) => {
    doc.setFillColor(...(d.color ? hexARgb(d.color) : hexARgb(colorPaletaHex(i))));
    doc.rect(x, ly - 8, 10, 10, 'F');
    doc.setTextColor(...COLOR_TEXTO_PDF);
    const pct = total ? Math.round((Number(d.valor) / total) * 100) : 0;
    doc.text(`${d.label} · ${formatoValor(Number(d.valor))} (${pct}%)`, x + 16, ly);
    ly += 18;
  });
  return ly;
}

function dibujarBarrasPDF(doc, { x, y, w, h, datos, colorRGB, valorDe = (d) => Number(d.valor) || 0 }) {
  const n = datos.length;
  if (!n) return;
  const max = Math.max(1, ...datos.map(valorDe));
  const gap = 5;
  const anchoBarra = (w - gap * (n - 1)) / n;
  doc.setFillColor(...colorRGB);
  datos.forEach((d, i) => {
    const val = valorDe(d);
    const alto = Math.max(0, (val / max) * h);
    const bx = x + i * (anchoBarra + gap);
    doc.rect(bx, y + h - alto, anchoBarra, alto, 'F');
  });
}

function dibujarBarrasApiladasPDF(doc, { x, y, w, h, datos }) {
  const n = datos.length;
  if (!n) return;
  const totales = datos.map((d) => d.segmentos.reduce((a, s) => a + Math.max(0, Number(s.valor) || 0), 0));
  const max = Math.max(1, ...totales);
  const gap = 5;
  const anchoBarra = (w - gap * (n - 1)) / n;
  datos.forEach((d, i) => {
    let yAcum = y + h;
    const bx = x + i * (anchoBarra + gap);
    d.segmentos.forEach((s) => {
      const val = Math.max(0, Number(s.valor) || 0);
      const alto = (val / max) * h;
      const by = yAcum - alto;
      doc.setFillColor(...(s.color ? hexARgb(s.color) : [148, 163, 184]));
      doc.rect(bx, by, anchoBarra, alto, 'F');
      yAcum = by;
    });
  });
}

function dibujarLineasPDF(doc, { x, y, w, h, series, etiquetas }) {
  const n = etiquetas.length;
  if (!n) return;
  const todos = series.flatMap((s) => s.valores.map((v) => Number(v) || 0));
  const maxY = Math.max(1, ...todos);
  const minY = Math.min(0, ...todos);
  const rango = (maxY - minY) || 1;
  const px = (i) => x + (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const py = (v) => y + h - ((Number(v) - minY) / rango) * h;
  // Línea de base (0) si el rango incluye negativos, para poder leer el gráfico.
  if (minY < 0) {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.6);
    doc.line(x, py(0), x + w, py(0));
  }
  series.forEach((s) => {
    doc.setDrawColor(...(s.color ? hexARgb(s.color) : [37, 99, 235]));
    doc.setLineWidth(1.4);
    for (let i = 0; i < s.valores.length - 1; i++) {
      doc.line(px(i), py(s.valores[i]), px(i + 1), py(s.valores[i + 1]));
    }
  });
}

function ejeXPDF(doc, { x, y, w, etiquetas }) {
  const n = etiquetas.length;
  if (!n) return;
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLOR_MUTED_PDF);
  etiquetas.forEach((et, i) => {
    doc.text(String(et), x + (w / n) * (i + 0.5), y, { align: 'center' });
  });
}

function leyendaHorizontalPDF(doc, { x, y, items }) {
  let lx = x;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  items.forEach((it) => {
    doc.setFillColor(...(it.color ? hexARgb(it.color) : [100, 116, 139]));
    doc.rect(lx, y - 7, 9, 9, 'F');
    doc.setTextColor(...COLOR_TEXTO_PDF);
    doc.text(it.nombre, lx + 13, y);
    lx += doc.getTextWidth(it.nombre) + 34;
  });
}

function encabezadoPDF(doc, { ancho, subtitulo }) {
  doc.setFillColor(...COLOR_PRIMARIO);
  doc.rect(0, 0, ancho, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text(appConfig.cliente.nombre || 'Alquileres', 48, 42);
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text(subtitulo, 48, 58);
}

function piePDF(doc) {
  doc.setFontSize(8); doc.setTextColor(...COLOR_MUTED_PDF);
  doc.text(`Generado el ${fecha(new Date().toISOString().slice(0, 10))}`, 48, doc.internal.pageSize.getHeight() - 30);
}

// ---- Panel: 1 torta por hoja ----
// `hojas`: [{ nombre, items:[{label,valor,color?}], formatoValor? }]
export async function generarGraficosTortaPDF(hojas, nombreArchivo) {
  const secciones = (hojas || []).filter((h) => (h.items || []).some((d) => Number(d.valor) > 0));
  if (!secciones.length) { toast('No hay datos para exportar', 'alerta'); return; }
  await cargarJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 48;

  secciones.forEach((sec, i) => {
    if (i > 0) doc.addPage();
    encabezadoPDF(doc, { ancho, subtitulo: sec.nombre });
    const formatoValor = sec.formatoValor || ((n) => String(Math.round(n)));
    const cx = margen + 90, cy = 210, r = 85;
    const res = dibujarTortaPDF(doc, { cx, cy, r, items: sec.items, formatoValor });
    if (res) leyendaPDF(doc, { x: cx + r + 40, y: cy - r + 8, items: res.validos, total: res.total, formatoValor });
    piePDF(doc);
  });

  doc.save(nombreArchivo);
  toast('PDF generado', 'ok');
}

// ---- Reportes: las 4 series de "Tendencias mensuales" en una página ----
// `datos`: [{ label, ingresos, egresos, neto, ocupacion }] por mes.
export async function generarTendenciasPDF(datos = [], { cantMeses, nombreArchivo } = {}) {
  if (!datos.length) { toast('No hay datos para exportar', 'alerta'); return; }
  await cargarJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 48;
  const anchoGrafico = ancho - margen * 2;
  const etiquetas = datos.map((d) => d.label);

  encabezadoPDF(doc, { ancho, subtitulo: `Tendencias mensuales · últimos ${cantMeses || datos.length} meses` });

  let y = 110;
  const tituloSeccion = (t) => {
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...COLOR_TEXTO_PDF);
    doc.text(t, margen, y);
    y += 14;
  };

  // Ingresos por mes (barras)
  tituloSeccion('Ingresos por mes');
  dibujarBarrasPDF(doc, { x: margen, y, w: anchoGrafico, h: 70, datos, colorRGB: [22, 163, 74], valorDe: (d) => Number(d.ingresos) || 0 });
  ejeXPDF(doc, { x: margen, y: y + 84, w: anchoGrafico, etiquetas });
  y += 108;

  // Ocupación por mes (barras, %)
  tituloSeccion('Ocupación por mes');
  dibujarBarrasPDF(doc, { x: margen, y, w: anchoGrafico, h: 70, datos, colorRGB: [37, 99, 235], valorDe: (d) => Math.min(100, Number(d.ocupacion) || 0) });
  ejeXPDF(doc, { x: margen, y: y + 84, w: anchoGrafico, etiquetas });
  y += 108;

  // Evolución mensual (líneas: ingresos / gastos / neto)
  tituloSeccion('Evolución mensual');
  const seriesEvol = [
    { nombre: 'Ingresos', valores: datos.map((d) => Number(d.ingresos) || 0), color: '16A34A' },
    { nombre: 'Gastos', valores: datos.map((d) => Number(d.egresos) || 0), color: 'DC2626' },
    { nombre: 'Neto', valores: datos.map((d) => Number(d.neto) || 0), color: '2563EB' }
  ];
  leyendaHorizontalPDF(doc, { x: margen, y, items: seriesEvol });
  y += 14;
  dibujarLineasPDF(doc, { x: margen, y, w: anchoGrafico, h: 70, series: seriesEvol, etiquetas });
  ejeXPDF(doc, { x: margen, y: y + 84, w: anchoGrafico, etiquetas });
  y += 108;

  // Ingresos vs gastos por mes (barras apiladas)
  tituloSeccion('Ingresos vs gastos por mes');
  const datosApilados = datos.map((d) => ({
    label: d.label,
    segmentos: [
      { nombre: 'Ingresos', valor: Number(d.ingresos) || 0, color: '16A34A' },
      { nombre: 'Gastos', valor: Number(d.egresos) || 0, color: 'DC2626' }
    ]
  }));
  leyendaHorizontalPDF(doc, { x: margen, y, items: [{ nombre: 'Ingresos', color: '16A34A' }, { nombre: 'Gastos', color: 'DC2626' }] });
  y += 14;
  dibujarBarrasApiladasPDF(doc, { x: margen, y, w: anchoGrafico, h: 70, datos: datosApilados });
  ejeXPDF(doc, { x: margen, y: y + 84, w: anchoGrafico, etiquetas });

  piePDF(doc);
  doc.save(nombreArchivo);
  toast('PDF generado', 'ok');
}
