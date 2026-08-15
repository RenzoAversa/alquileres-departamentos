// ============================================================
// Generador de recibos en PDF (reservas).
//   - Carga jsPDF on-demand desde CDN (no pesa la app si no se usa).
//   - Todo se arma en el navegador, sin backend ni costo de servidor.
//   - Layout simple con texto y líneas (sin plugins de tablas) para
//     mantener la librería liviana.
// ============================================================
import { appConfig } from '../firebase/init.js';
import { money, fecha } from './ui.js';

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
