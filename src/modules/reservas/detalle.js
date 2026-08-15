// ============================================================
// Detalle de reserva + gestión de pagos (modal).
// Permite al dueño/administrador:
//   - ver el resumen (total / pagado / saldo / estado de pago)
//   - registrar un pago: monto + método (cuenta) + fecha + nota
//   - ver el historial de pagos y anular alguno si hubo error
//   - cambiar el estado operativo de la reserva
// ============================================================
import { reservasService, estadoPagoDe, ETIQUETAS_PAGO, ESTADOS_RESERVA } from '../../services/reservas.service.js';
import { movimientosService } from '../../services/movimientos.service.js';
import { el, toast, confirmar, spinner, money, fecha } from '../../core/ui.js';
import { generarReciboReserva } from '../../core/pdf.js';

const hoyISO = () => new Date().toISOString().slice(0, 10);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const campo = (label, input) => el('label', { class: 'form__campo' }, [el('span', {}, label), input]);

// Abre el modal. `reserva`: objeto; `cuentas`: lista de medios de pago;
// `onCambio`: callback para refrescar la lista de reservas al cerrar/cambiar.
export function abrirDetalleReserva(reserva, cuentas, onCambio) {
  const r = { ...reserva }; // copia mutable local
  let cambiado = false;

  const overlay = el('div', { class: 'modal-overlay' });
  const cerrar = () => { overlay.remove(); if (cambiado && onCambio) onCambio(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  const cuerpo = el('div', { class: 'modal modal--ancho' });
  overlay.append(cuerpo);
  document.body.append(overlay);

  async function pintar() {
    cuerpo.innerHTML = '';
    const total = Number(r.precioTotal) || 0;
    const pagado = Number(r.pagado) || 0;
    const saldo = total - pagado;
    const estadoPago = estadoPagoDe(pagado, total);
    const infoPago = ETIQUETAS_PAGO[estadoPago];
    const nombreCuenta = (id) => cuentas.find((c) => c.id === id)?.nombre || '—';

    const btnRecibo = el('button', { class: 'btn btn--ghost btn--sm', type: 'button' }, 'Recibo PDF');
    btnRecibo.addEventListener('click', async () => {
      btnRecibo.disabled = true; btnRecibo.textContent = 'Generando…';
      try {
        const pagos = (await movimientosService.getByReserva(r.id))
          .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
          .map((p) => ({ fecha: p.fecha, monto: p.monto, nota: p.nota, nombreCuenta: nombreCuenta(p.cuentaId) }));
        await generarReciboReserva(r, pagos);
      } catch (err) {
        console.error(err); toast('No se pudo generar el PDF', 'alerta');
      } finally {
        btnRecibo.disabled = false; btnRecibo.textContent = 'Recibo PDF';
      }
    });

    // ---- Encabezado ----
    cuerpo.append(el('div', { class: 'detalle-head' }, [
      el('div', {}, [
        el('h3', { style: 'margin:0' }, r.unidadNombre || 'Reserva'),
        el('div', { class: 'muted small' }, `${r.huesped?.nombre || ''} · ${fecha(r.fechaEntrada)} ${r.horaEntrada || '15:00'} → ${fecha(r.fechaSalida)} ${r.horaSalida || '10:00'}`)
      ]),
      el('div', { style: 'display:flex;gap:8px' }, [
        btnRecibo,
        el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: cerrar }, 'Cerrar')
      ])
    ]));

    // ---- Resumen de importes ----
    cuerpo.append(el('div', { class: 'resumen-pago' }, [
      el('div', { class: 'resumen-pago__item' }, [
        el('span', { class: 'muted small' }, 'Total'),
        el('strong', {}, money(total)),
        r.precioManual ? el('span', { class: 'badge badge--info', style: 'margin-top:4px' }, 'Precio manual') : null
      ].filter(Boolean)),
      el('div', { class: 'resumen-pago__item' }, [el('span', { class: 'muted small' }, 'Pagado'), el('strong', { class: 'txt-ok' }, money(pagado))]),
      el('div', { class: 'resumen-pago__item' }, [el('span', { class: 'muted small' }, 'Saldo'), el('strong', { class: saldo > 0 ? 'txt-alerta' : '' }, money(saldo))]),
      el('div', { class: 'resumen-pago__item' }, [el('span', { class: 'muted small' }, 'Estado'), el('span', { class: `badge ${infoPago.clase}` }, infoPago.label)])
    ]));

    // ---- Registrar pago ----
    if (saldo > 0) {
      if (!cuentas.length) {
        cuerpo.append(el('div', { class: 'card card--plano' }, el('p', { class: 'muted' }, 'Para registrar pagos, primero creá cuentas en Finanzas.')));
      } else {
        const inMonto = el('input', { type: 'number', min: '0', step: 'any', value: String(saldo), required: true });
        const selCuenta = el('select', {}, cuentas.map((c) => el('option', { value: c.id }, c.nombre)));
        const inFecha = el('input', { type: 'date', value: hoyISO(), required: true });
        const inNota = el('input', { type: 'text', placeholder: 'Nota (opcional)' });
        const btn = el('button', { class: 'btn btn--primary', type: 'submit' }, 'Confirmar pago');

        const form = el('form', { class: 'card card--plano form' }, [
          el('h4', { class: 'detalle-sub' }, 'Registrar pago'),
          el('div', { class: 'form__fila' }, [campo('Monto', inMonto), campo('Método de pago', selCuenta)]),
          el('div', { class: 'form__fila' }, [campo('Fecha', inFecha), campo('Nota', inNota)]),
          btn
        ]);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const monto = parseFloat(inMonto.value) || 0;
          if (monto <= 0) { toast('El monto debe ser mayor a 0', 'alerta'); return; }
          if (monto > saldo + 0.001) { toast(`El pago no puede superar el saldo (${money(saldo)})`, 'alerta'); return; }
          btn.disabled = true; btn.textContent = 'Guardando…';
          try {
            await reservasService.registrarPago(r, { monto, cuentaId: selCuenta.value, fecha: inFecha.value, nota: inNota.value.trim() });
            // actualizar copia local
            r.pagado = (Number(r.pagado) || 0) + monto;
            r.saldo = total - r.pagado;
            r.estadoPago = estadoPagoDe(r.pagado, total);
            cambiado = true;
            toast('Pago confirmado', 'ok');
            await pintar();
          } catch (err) {
            console.error(err); toast('No se pudo registrar el pago', 'alerta');
            btn.disabled = false; btn.textContent = 'Confirmar pago';
          }
        });
        cuerpo.append(form);
      }
    } else {
      cuerpo.append(el('div', { class: 'card card--plano pago-ok' }, '✓ Reserva totalmente paga'));
    }

    // ---- Historial de pagos ----
    const histCard = el('div', { class: 'card card--plano' }, [el('h4', { class: 'detalle-sub' }, 'Pagos registrados')]);
    cuerpo.append(histCard);
    histCard.append(spinner());
    const pagos = (await movimientosService.getByReserva(r.id)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    histCard.querySelector('.loading')?.remove();

    if (!pagos.length) {
      histCard.append(el('p', { class: 'muted small' }, 'Todavía no hay pagos.'));
    } else {
      pagos.forEach((p) => histCard.append(el('div', { class: 'lista__item' }, [
        el('div', {}, [
          el('strong', {}, money(p.monto)),
          el('div', { class: 'muted small' }, `${fecha(p.fecha)} · ${nombreCuenta(p.cuentaId)}${p.nota ? ' · ' + p.nota : ''}`)
        ]),
        el('button', {
          class: 'btn btn--ghost btn--sm', type: 'button',
          onClick: async () => {
            if (!(await confirmar('¿Anular este pago? Se revertirá el saldo de la cuenta.'))) return;
            try {
              await reservasService.anularPago(r, p);
              r.pagado = Math.max(0, (Number(r.pagado) || 0) - (Number(p.monto) || 0));
              r.saldo = total - r.pagado;
              r.estadoPago = estadoPagoDe(r.pagado, total);
              cambiado = true;
              toast('Pago anulado', 'ok');
              await pintar();
            } catch (err) { console.error(err); toast('No se pudo anular', 'alerta'); }
          }
        }, 'Anular')
      ])));
    }

    // ---- Estado operativo ----
    const selEstado = el('select', {}, ESTADOS_RESERVA.map((s) => el('option', { value: s, selected: (r.estado === s) || undefined }, cap(s))));
    selEstado.addEventListener('change', async () => {
      try {
        await reservasService.update(r.id, { estado: selEstado.value });
        r.estado = selEstado.value; cambiado = true;
        toast('Estado actualizado', 'ok');
      } catch (err) { console.error(err); toast('No se pudo actualizar el estado', 'alerta'); }
    });
    cuerpo.append(el('div', { class: 'card card--plano' }, [
      el('h4', { class: 'detalle-sub' }, 'Estado de la reserva'),
      campo('Estado', selEstado)
    ]));
  }

  pintar();
}
