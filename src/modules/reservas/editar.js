// ============================================================
// Edición de una reserva (modal).
//   - Cambiar unidad, huésped, teléfono, fechas y canal.
//   - Revalida disponibilidad excluyendo la propia reserva.
//   - Muestra en vivo el nuevo total; avisa si queda por debajo de
//     lo ya pagado (saldo a favor).
//   - El recálculo de total/saldo/estado de pago lo hace el servicio.
// ============================================================
import { reservasService } from '../../services/reservas.service.js';
import { el, toast, confirmar, money, noches, abrirModal, boton, campo, validarFormulario } from '../../core/ui.js';
import { crearSelectorFechas } from './selector-fechas.js';

const HORA_ENTRADA_DEFAULT = '15:00';
const HORA_SALIDA_DEFAULT = '10:00';

const fila = (c) => el('div', { class: 'form__fila' }, c);

export function abrirEdicionReserva(reserva, unidades, onGuardar) {
  const selUnidad = el('select', {}, unidades.map((u) =>
    el('option', { value: u.id, selected: (u.id === reserva.unidadId) || undefined }, u.nombre)));
  const inHuesped = el('input', { type: 'text', value: reserva.huesped?.nombre || '' });
  const inTelefono = el('input', { type: 'text', value: reserva.huesped?.telefono || '' });
  const inEmail = el('input', { type: 'email', value: reserva.huesped?.email || '', placeholder: 'nombre@mail.com' });
  const selCanal = el('select', {}, ['directo', 'booking', 'airbnb', 'otro'].map((c) =>
    el('option', { value: c, selected: (reserva.canal === c) || undefined }, c.charAt(0).toUpperCase() + c.slice(1))));
  const inHoraEntrada = el('input', { type: 'time', value: reserva.horaEntrada || HORA_ENTRADA_DEFAULT });
  const inHoraSalida = el('input', { type: 'time', value: reserva.horaSalida || HORA_SALIDA_DEFAULT });

  const preview = el('div', { class: 'muted small', style: 'margin-top:4px' }, '');
  const avisoPrecioManual = el('div', { class: 'muted small txt-alerta', hidden: true }, 'Esta reserva tiene precio manual; revisá el total.');
  const chkPrecioManual = el('input', { type: 'checkbox' });
  const inTotalManual = el('input', { type: 'number', min: '0', step: 'any', disabled: true });

  function unidadSel() { return unidades.find((u) => u.id === selUnidad.value); }
  function calcularTotal() {
    const { entrada, salida } = selectorFechas.getRango();
    const n = (entrada && salida) ? noches(entrada, salida) : 0;
    return { n, entrada, salida, totalCalc: n * (unidadSel()?.precioNoche || 0) };
  }
  function actualizarPreview() {
    const { n, entrada, salida, totalCalc } = calcularTotal();
    const pagado = Number(reserva.pagado) || 0;
    let txt = n > 0 ? `${n} noche(s) · total calculado ${money(totalCalc)}` : 'Revisá las fechas';
    if (n > 0 && !chkPrecioManual.checked && pagado > totalCalc) txt += ` · ⚠️ queda saldo a favor (ya pagó ${money(pagado)})`;
    preview.textContent = txt;
    if (!chkPrecioManual.checked) inTotalManual.value = totalCalc;

    const fechasCambiaron = reserva.fechaEntrada && reserva.fechaSalida && (entrada !== reserva.fechaEntrada || salida !== reserva.fechaSalida);
    avisoPrecioManual.hidden = !(reserva.precioManual && fechasCambiaron);
  }

  const selectorFechas = crearSelectorFechas({ excluirId: reserva.id, onCambio: actualizarPreview });
  selUnidad.addEventListener('change', () => selectorFechas.setUnidad(selUnidad.value));

  chkPrecioManual.checked = !!reserva.precioManual;
  inTotalManual.disabled = !chkPrecioManual.checked;
  if (chkPrecioManual.checked) inTotalManual.value = Number(reserva.precioTotal) || 0;
  chkPrecioManual.addEventListener('change', () => {
    inTotalManual.disabled = !chkPrecioManual.checked;
    if (!chkPrecioManual.checked) inTotalManual.value = calcularTotal().totalCalc;
    actualizarPreview();
  });

  const btn = boton('Guardar cambios', { variante: 'exito', tipo: 'submit' });
  const btnCancelar = boton('Cancelar', { variante: 'danger', onClick: () => modal.intentarCerrar() });
  const form = el('form', { class: 'form' }, [
    el('h3', { style: 'margin:0 0 8px' }, 'Editar reserva'),
    campo('Departamento', selUnidad, { requerido: true }),
    campo('Huésped', inHuesped, { requerido: true }),
    campo('Teléfono', inTelefono),
    campo('Email', inEmail),
    campo('Fechas', selectorFechas.element, { requerido: true }),
    fila([campo('Hora de entrada', inHoraEntrada), campo('Hora de salida', inHoraSalida)]),
    campo('Canal', selCanal),
    preview,
    avisoPrecioManual,
    el('label', { class: 'form__check' }, [chkPrecioManual, el('span', {}, 'Modificar precio total')]),
    campo('Total de la reserva', inTotalManual, { requerido: true }),
    el('div', { class: 'modal__acciones' }, [
      btnCancelar,
      btn
    ])
  ]);

  const modal = abrirModal(form, { ancho: true });

  selectorFechas.setUnidad(reserva.unidadId).then(() => {
    selectorFechas.setRangoInicial(reserva.fechaEntrada, reserva.fechaSalida);
    actualizarPreview();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const unidad = unidadSel();
    const { entrada, salida } = selectorFechas.getRango();

    const errores = validarFormulario([
      { elemento: selUnidad, validar: () => !unidad && 'Elegí un departamento.' },
      { elemento: inHuesped, validar: () => !inHuesped.value.trim() && 'Ingresá el nombre del huésped.' },
      { elemento: inEmail, validar: () => inEmail.value.trim() && !emailValido(inEmail.value) && 'Ingresá un email válido.' },
      { elemento: selectorFechas.element, validar: () => !(entrada && salida) && 'Elegí las fechas de entrada y salida en el calendario.' },
      { elemento: inTotalManual, validar: () => (inTotalManual.value === '' || isNaN(Number(inTotalManual.value)) || Number(inTotalManual.value) < 0) && 'Ingresá un total válido (0 o más).' }
    ]);
    if (errores.length) return;

    const precioManual = chkPrecioManual.checked;
    const total = precioManual ? parseFloat(inTotalManual.value) : calcularTotal().totalCalc;
    const pagado = Number(reserva.pagado) || 0;
    if (pagado > total) {
      const seguir = await confirmar(`El nuevo total (${money(total)}) queda por debajo de lo ya pagado (${money(pagado)}); el saldo quedaría negativo. ¿Guardar igual?`, { variante: 'guardar' });
      if (!seguir) return;
    }

    btn.disabled = true; btn.textContent = 'Guardando…';
    btnCancelar.disabled = true;
    modal.setGuardando(true);
    try {
      const libre = await reservasService.verificarDisponibilidad(unidad.id, entrada, salida, reserva.id);
      if (!libre) {
        toast('Esa unidad ya está reservada en esas fechas', 'alerta');
        btn.disabled = false; btn.textContent = 'Guardar cambios'; btnCancelar.disabled = false; modal.setGuardando(false);
        return;
      }

      await reservasService.editar(reserva, {
        unidadId: unidad.id,
        unidadNombre: unidad.nombre || '',
        edificioId: unidad.edificioId || null,
        huesped: { nombre: inHuesped.value.trim(), telefono: inTelefono.value.trim(), email: inEmail.value.trim() },
        fechaEntrada: entrada,
        fechaSalida: salida,
        horaEntrada: inHoraEntrada.value || HORA_ENTRADA_DEFAULT,
        horaSalida: inHoraSalida.value || HORA_SALIDA_DEFAULT,
        precioManual,
        canal: selCanal.value
      }, total);

      toast('Reserva actualizada', 'ok');
      modal.cerrar();
      if (onGuardar) onGuardar();
    } catch (err) {
      console.error(err); toast('No se pudo guardar', 'alerta');
      btn.disabled = false; btn.textContent = 'Guardar cambios';
      btnCancelar.disabled = false; modal.setGuardando(false);
    }
  });
}

function emailValido(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }
