// Alta y listado de reservas (con permisos por rol).
//   - Crear/ver reservas: todos los roles con acceso al módulo.
//   - Importes, estado de pago y "Ver / Pagar": solo verDinero/gestionarPagos.
//   - Eliminar: solo roles con permiso.
//   - El listado se agrupa por edificio (o por departamento suelto) en
//     menús desplegables, y se puede ordenar (próximo check-in/out, etc).
import { reservasService, estadoPagoDe, ETIQUETAS_PAGO } from '../../services/reservas.service.js';
import { unidadesService } from '../../services/unidades.service.js';
import { edificiosService } from '../../services/edificios.service.js';
import { cuentasService } from '../../services/cuentas.service.js';
import { el, toast, confirmar, money, fecha, fechaRelativa, etiquetaEstadoTemporal, noches, boton, abrirModal, botonRecargar, crearPaginado, campo, validarFormulario } from '../../core/ui.js';
import { store } from '../../core/store.js';
import { abrirDetalleReserva } from './detalle.js';
import { abrirEdicionReserva } from './editar.js';
import { crearSelectorFechas } from './selector-fechas.js';
import { sesion } from '../../core/sesion.js';

const HORA_ENTRADA_DEFAULT = '15:00';
const HORA_SALIDA_DEFAULT = '10:00';

const FILTROS_PAGO = [
  { k: 'todas', label: 'Todas' },
  { k: 'sin_pagar', label: 'Sin pagar' },
  { k: 'parcial', label: 'Parcial' },
  { k: 'pagado', label: 'Pagado' }
];

const ORDENES = [
  { k: 'entrada_asc', label: 'Próximo check-in' },
  { k: 'salida_asc', label: 'Próximo check-out' },
  { k: 'entrada_desc', label: 'Más nuevas primero' },
  { k: 'huesped', label: 'Huésped (A-Z)' }
];

function ordenarReservas(lista, orden) {
  const arr = [...lista];
  const nombreHuesped = (r) => (r.huesped?.nombre || '').toLowerCase();
  switch (orden) {
    case 'entrada_asc': return arr.sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada));
    case 'salida_asc': return arr.sort((a, b) => a.fechaSalida.localeCompare(b.fechaSalida));
    case 'huesped': return arr.sort((a, b) => nombreHuesped(a).localeCompare(nombreHuesped(b)));
    case 'entrada_desc':
    default: return arr.sort((a, b) => b.fechaEntrada.localeCompare(a.fechaEntrada));
  }
}

// Agrupa por edificio (o por la propia unidad, si es suelta). Como `reservas`
// ya viene ordenada, cada grupo hereda ese orden sin recalcular nada, y el
// grupo con la reserva "mejor ubicada" en el orden elegido aparece primero.
function agruparPorPropiedad(reservasOrdenadas, unidades, edificios) {
  const grupos = new Map();
  reservasOrdenadas.forEach((r) => {
    const unidad = unidades.find((u) => u.id === r.unidadId);
    const key = unidad?.edificioId ? `ed:${unidad.edificioId}` : `un:${r.unidadId}`;
    if (!grupos.has(key)) {
      const titulo = unidad?.edificioId
        ? (edificios.find((e) => e.id === unidad.edificioId)?.nombre || 'Edificio')
        : (r.unidadNombre || 'Departamento suelto');
      grupos.set(key, { key, titulo, reservas: [] });
    }
    grupos.get(key).reservas.push(r);
  });
  return [...grupos.values()];
}

export async function render(container) {
  const verDinero = sesion.puede('verDinero');
  const gestionarPagos = sesion.puede('gestionarPagos');
  const puedeEliminar = sesion.puede('eliminar');
  const puedeEditar = sesion.puede('editarReservas');

  const cargas = [unidadesService.getAll(), edificiosService.getAll()];
  if (gestionarPagos) cargas.push(cuentasService.getAll());
  const r0 = await Promise.all(cargas);
  const unidades = r0[0];
  const edificios = r0[1];
  const cuentas = gestionarPagos ? (r0[2] || []) : [];

  container.append(el('div', { class: 'page-head' }, [
    el('h1', { class: 'page-title' }, 'Reservas'),
    boton('Nueva reserva', { variante: 'accion', icono: '+', onClick: () => abrirAltaReserva(unidades, cargarLista) })
  ]));

  // Si venimos del buscador de disponibilidad o del mapa, abrimos el
  // formulario ya precargado en vez de esperar el click del botón.
  const preset = store.get('reservaPreset');
  if (preset) {
    store.set('reservaPreset', null);
    abrirAltaReserva(unidades, cargarLista, preset);
    toast('Datos precargados desde el buscador', 'ok');
  }

  let filtroPago = 'todas';
  let orden = 'entrada_desc';
  const gruposAbiertos = new Set();
  const gruposAbiertosFinalizadas = new Set();
  const seccion = el('div', { class: 'card' });
  const headerLista = el('div', { class: 'finanzas-head' }, [
    el('h3', {}, 'Reservas registradas'),
    botonRecargar(() => cargarLista())
  ]);
  const controles = el('div', { class: 'periodo-barra' });

  const selOrden = el('select', {}, ORDENES.map((o) => el('option', { value: o.k }, o.label)));
  selOrden.value = orden;
  selOrden.addEventListener('change', () => { orden = selOrden.value; cargarLista(); });
  controles.append(el('label', { class: 'form__campo', style: 'flex-direction:row;align-items:center;gap:8px' }, [
    el('span', { class: 'muted small' }, 'Ordenar por'), selOrden
  ]));

  // Filtros por estado de pago (solo si ve dinero)
  if (verDinero) {
    const chips = el('div', { class: 'periodo-chips' }, FILTROS_PAGO.map((op) =>
      el('button', {
        class: `chip-periodo ${filtroPago === op.k ? 'is-active' : ''}`, type: 'button', 'data-k': op.k,
        onClick: () => { filtroPago = op.k; chips.querySelectorAll('.chip-periodo').forEach((b) => b.classList.toggle('is-active', b.dataset.k === filtroPago)); cargarLista(); }
      }, op.label)));
    controles.append(chips);
  }

  seccion.append(headerLista, controles);
  const listaCont = el('div', {});
  seccion.append(listaCont);
  container.append(seccion);

  const paginado = crearPaginado({
    contenedor: listaCont,
    porPagina: 20,
    mensajeVacio: 'No hay reservas para este filtro.',
    renderItem: (grupo) => renderGrupo(grupo, gruposAbiertos)
  });

  // ---- Reservas finalizadas: mismo listado, aparte, para no mezclar lo
  // que ya terminó con lo activo. Una reserva "termina" cuando ya pasó
  // su fecha+hora de salida (no depende del estado operativo). Plegada
  // por default: solo se abre si se quiere ver.
  const seccionFin = el('div', { class: 'card card-plegable' });
  const listaContFin = el('div', {});
  listaContFin.hidden = true;
  const tituloFin = el('button', { type: 'button', class: 'card-plegable__titulo' }, [
    'Reservas finalizadas',
    el('span', { class: 'reserva-grupo__flecha' }, '▾')
  ]);
  tituloFin.addEventListener('click', () => {
    listaContFin.hidden = !listaContFin.hidden;
    seccionFin.classList.toggle('is-abierto', !listaContFin.hidden);
  });
  const headerFin = el('div', { class: 'finanzas-head' }, [
    tituloFin,
    botonRecargar(() => cargarLista())
  ]);
  seccionFin.append(headerFin, listaContFin);
  container.append(seccionFin);

  const paginadoFin = crearPaginado({
    contenedor: listaContFin,
    porPagina: 20,
    mensajeVacio: 'Todavía no hay reservas finalizadas.',
    renderItem: (grupo) => renderGrupo(grupo, gruposAbiertosFinalizadas)
  });

  function renderFila(r) {
    const total = Number(r.precioTotal) || 0;
    const pagado = Number(r.pagado) || 0;
    const saldo = total - pagado;
    const info = ETIQUETAS_PAGO[estadoPagoDe(pagado, total)];
    const estadoTemporal = etiquetaEstadoTemporal(r);

    const titulo = el('div', { class: 'reserva-linea' }, [el('strong', {}, r.unidadNombre || 'Unidad')]);
    if (verDinero) titulo.append(el('span', { class: `badge ${info.clase}` }, info.label));
    if (estadoTemporal) titulo.append(el('span', { class: 'small', style: `color:${estadoTemporal.color}` }, estadoTemporal.texto));

    const infoImporte = verDinero
      ? el('div', { class: 'muted small' }, `${money(total)}${saldo > 0 ? ` · saldo ${money(saldo)}` : ''}`)
      : null;

    const acciones = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, []);
    if (puedeEditar) acciones.append(el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => abrirEdicionReserva(r, unidades, cargarLista) }, 'Editar'));
    if (gestionarPagos) acciones.append(el('button', { class: 'btn btn--primary btn--sm', type: 'button', onClick: () => abrirDetalleReserva(r, cuentas, cargarLista) }, 'Ver / Pagar'));
    if (puedeEliminar) acciones.append(el('button', {
      class: 'btn btn--ghost btn--sm', type: 'button',
      onClick: async () => {
        if (await confirmar('¿Eliminar esta reserva?')) {
          await reservasService.remove(r.id); toast('Reserva eliminada', 'ok'); cargarLista();
        }
      }
    }, 'Eliminar'));

    const lineaFechas = el('span', {
      class: 'muted small', title: `${fecha(r.fechaEntrada)} → ${fecha(r.fechaSalida)}`
    }, `${r.huesped?.nombre || ''} · ${fechaRelativa(r.fechaEntrada)} → ${fechaRelativa(r.fechaSalida)}`);

    return el('div', { class: 'lista__item' }, [
      el('div', {}, [
        titulo,
        lineaFechas,
        infoImporte
      ].filter(Boolean)),
      acciones
    ]);
  }

  // Menú desplegable por edificio/departamento: agrupa y sólo pinta el
  // detalle cuando se abre (mismo trabajo, mucho más legible de un vistazo).
  // Qué grupos están abiertos vive en un Set (afuera de esta función, uno
  // por card), así sobrevive a los recargos de la lista después de guardar,
  // pagar o eliminar una reserva: antes cada recarga los volvía a cerrar.
  function renderGrupo(grupo, abiertosSet) {
    const abierto = abiertosSet.has(grupo.key);
    const body = el('div', { class: 'reserva-grupo__body' }, grupo.reservas.map((r) => renderFila(r)));
    body.hidden = !abierto;
    const grupoEl = el('div', { class: `reserva-grupo ${abierto ? 'is-abierto' : ''}` }, [
      el('button', {
        class: 'reserva-grupo__header', type: 'button',
        onClick: () => {
          body.hidden = !body.hidden;
          grupoEl.classList.toggle('is-abierto', !body.hidden);
          if (body.hidden) abiertosSet.delete(grupo.key); else abiertosSet.add(grupo.key);
        }
      }, [
        el('span', { class: 'reserva-grupo__titulo' }, grupo.titulo),
        el('span', { class: 'badge badge--info' }, `${grupo.reservas.length} reserva(s)`),
        el('span', { class: 'reserva-grupo__flecha' }, '▾')
      ]),
      body
    ]);
    return grupoEl;
  }

  // Terminó cuando ya pasó su fecha+hora de salida, sin importar el estado
  // operativo (pendiente/confirmada/etc) ni si está pagada.
  function estaFinalizada(r) {
    const horaSalida = r.horaSalida || HORA_SALIDA_DEFAULT;
    return new Date(`${r.fechaSalida}T${horaSalida}`).getTime() <= Date.now();
  }

  async function cargarLista() {
    let reservas = await reservasService.getAll();
    if (verDinero && filtroPago !== 'todas') {
      reservas = reservas.filter((r) => estadoPagoDe(r.pagado, r.precioTotal) === filtroPago);
    }
    reservas = ordenarReservas(reservas, orden);
    const activas = reservas.filter((r) => !estaFinalizada(r));
    const finalizadas = reservas.filter((r) => estaFinalizada(r));
    paginado.setItems(agruparPorPropiedad(activas, unidades, edificios));
    paginadoFin.setItems(agruparPorPropiedad(finalizadas, unidades, edificios));
  }
  cargarLista();
}

function abrirAltaReserva(unidades, onGuardar, preset = null) {
  const selUnidad = el('select', {}, [
    el('option', { value: '' }, 'Seleccioná un departamento'),
    ...unidades.map((u) => el('option', { value: u.id, selected: (u.id === preset?.unidadId) || undefined }, u.nombre))
  ]);
  const inHuesped = el('input', { placeholder: 'Nombre y apellido' });
  const inTelefono = el('input', { placeholder: '+54 9 ...' });
  const inEmail = el('input', { type: 'email', placeholder: 'nombre@mail.com' });
  const selectorFechas = crearSelectorFechas({ onCambio: () => actualizarResumenPrecio() });
  const inHoraEntrada = el('input', { type: 'time', value: HORA_ENTRADA_DEFAULT });
  const inHoraSalida = el('input', { type: 'time', value: HORA_SALIDA_DEFAULT });
  const selCanal = selectCanal();
  const btn = boton('Guardar reserva', { variante: 'exito', tipo: 'submit' });
  const btnCancelar = boton('Cancelar', { variante: 'danger', onClick: () => modal.intentarCerrar() });

  const resumenPrecio = el('div', { class: 'muted small resumen-precio', hidden: true }, '');
  const chkPrecioManual = el('input', { type: 'checkbox' });
  const inTotalManual = el('input', { type: 'number', min: '0', step: 'any', disabled: true });

  function calcularTotal() {
    const { entrada, salida } = selectorFechas.getRango();
    const unidad = unidades.find((u) => u.id === selUnidad.value);
    const n = (entrada && salida) ? noches(entrada, salida) : 0;
    return { n, unidad, totalCalc: n * (unidad?.precioNoche || 0) };
  }

  function actualizarResumenPrecio() {
    const { n, unidad, totalCalc } = calcularTotal();
    if (!unidad || n <= 0) { resumenPrecio.hidden = true; return; }
    resumenPrecio.hidden = false;
    resumenPrecio.textContent = `${money(unidad.precioNoche || 0)} x ${n} noche(s) = ${money(totalCalc)}`;
    if (!chkPrecioManual.checked) inTotalManual.value = totalCalc;
  }

  chkPrecioManual.addEventListener('change', () => {
    inTotalManual.disabled = !chkPrecioManual.checked;
    if (!chkPrecioManual.checked) inTotalManual.value = calcularTotal().totalCalc;
  });

  selUnidad.addEventListener('change', () => { selectorFechas.setUnidad(selUnidad.value); });

  const form = el('form', { class: 'form' }, [
    el('h3', { style: 'margin:0 0 8px' }, 'Nueva reserva'),
    campo('Departamento', selUnidad, { requerido: true }),
    campo('Huésped', inHuesped, { requerido: true }),
    campo('Teléfono', inTelefono),
    campo('Email', inEmail),
    campo('Fechas', selectorFechas.element, { requerido: true }),
    fila([campo('Hora de entrada', inHoraEntrada), campo('Hora de salida', inHoraSalida)]),
    campo('Canal', selCanal),
    resumenPrecio,
    el('label', { class: 'form__check' }, [chkPrecioManual, el('span', {}, 'Modificar precio total')]),
    campo('Total de la reserva', inTotalManual, { requerido: true }),
    el('div', { class: 'modal__acciones' }, [
      btnCancelar,
      btn
    ])
  ]);

  const modal = abrirModal(form, { ancho: true });

  if (preset?.unidadId) {
    selectorFechas.setUnidad(preset.unidadId).then(() => {
      if (preset?.entrada && preset?.salida) selectorFechas.setRangoInicial(preset.entrada, preset.salida);
      actualizarResumenPrecio();
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const unidadId = selUnidad.value;
    const { entrada, salida } = selectorFechas.getRango();

    const errores = validarFormulario([
      { elemento: selUnidad, validar: () => !unidadId && 'Elegí un departamento.' },
      { elemento: inHuesped, validar: () => !inHuesped.value.trim() && 'Ingresá el nombre del huésped.' },
      { elemento: inEmail, validar: () => inEmail.value.trim() && !emailValido(inEmail.value) && 'Ingresá un email válido.' },
      { elemento: selectorFechas.element, validar: () => !(entrada && salida) && 'Elegí las fechas de entrada y salida en el calendario.' },
      { elemento: inTotalManual, validar: () => (inTotalManual.value === '' || isNaN(Number(inTotalManual.value)) || Number(inTotalManual.value) < 0) && 'Ingresá un total válido (0 o más).' }
    ]);
    if (errores.length) return;

    const total = chkPrecioManual.checked ? parseFloat(inTotalManual.value) : calcularTotal().totalCalc;
    const precioManual = chkPrecioManual.checked;

    btn.disabled = true; btn.textContent = 'Guardando…';
    btnCancelar.disabled = true;
    modal.setGuardando(true);
    try {
      const libre = await reservasService.verificarDisponibilidad(unidadId, entrada, salida);
      if (!libre) {
        toast('Esa unidad ya está reservada en esas fechas', 'alerta');
        btn.disabled = false; btn.textContent = 'Guardar reserva'; btnCancelar.disabled = false; modal.setGuardando(false);
        return;
      }

      const unidad = unidades.find((u) => u.id === unidadId);
      const n = noches(entrada, salida);

      await reservasService.create({
        unidadId,
        unidadNombre: unidad?.nombre || '',
        edificioId: unidad?.edificioId || null,
        huesped: { nombre: inHuesped.value.trim(), telefono: inTelefono.value.trim(), email: inEmail.value.trim() },
        fechaEntrada: entrada, fechaSalida: salida, noches: n,
        horaEntrada: inHoraEntrada.value || HORA_ENTRADA_DEFAULT,
        horaSalida: inHoraSalida.value || HORA_SALIDA_DEFAULT,
        precioTotal: total, precioManual, pagado: 0, saldo: total, estadoPago: 'sin_pagar',
        estado: 'confirmada', canal: selCanal.value
      });
      toast('Reserva guardada', 'ok');
      modal.cerrar();
      if (onGuardar) onGuardar();
    } catch (err) {
      console.error(err); toast('No se pudo guardar', 'alerta');
      btn.disabled = false; btn.textContent = 'Guardar reserva';
      btnCancelar.disabled = false; modal.setGuardando(false);
    }
  });
}

function fila(campos) { return el('div', { class: 'form__fila' }, campos); }
function emailValido(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }
function selectCanal() {
  const s = el('select', {});
  ['directo', 'booking', 'airbnb', 'otro'].forEach((c) => s.append(el('option', { value: c }, c.charAt(0).toUpperCase() + c.slice(1))));
  return s;
}
