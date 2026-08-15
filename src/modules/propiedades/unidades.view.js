// CRUD de unidades (departamentos). Pueden pertenecer a un edificio o ser sueltas.
import { unidadesService } from '../../services/unidades.service.js';
import { edificiosService } from '../../services/edificios.service.js';
import { reservasService } from '../../services/reservas.service.js';
import { el, toast, confirmar, money, abrirModal, boton, botonRecargar, crearPaginado, miniatura, campo, validarFormulario } from '../../core/ui.js';
import { crearSelectorUbicacion } from '../mapa/picker.js';
import { appConfig } from '../../firebase/init.js';

const OPCION_SIN_EDIFICIO = '__sin_edificio__';
const MOSTRAR_FOTOS = !!appConfig.features.fotos;

export async function render(container) {
  const edificios = await edificiosService.getAll();

  container.append(el('div', { class: 'page-head' }, [
    el('h1', { class: 'page-title' }, 'Departamentos'),
    boton('Nuevo departamento', { variante: 'accion', icono: '+', onClick: () => abrirAltaUnidad(edificios, cargarLista) })
  ]));

  const headerLista = el('div', { class: 'finanzas-head' }, [
    el('h3', {}, 'Departamentos registrados'),
    botonRecargar(() => cargarLista())
  ]);
  const seccion = el('div', { class: 'card' }, [headerLista]);
  const listaCont = el('div', {});
  seccion.append(listaCont);
  container.append(seccion);

  const paginado = crearPaginado({
    contenedor: listaCont,
    porPagina: 20,
    mensajeVacio: 'Todavía no cargaste ningún departamento.',
    renderItem: (u) => renderFila(u)
  });

  function renderFila(u) {
    const ed = edificios.find((x) => x.id === u.edificioId);
    return el('div', { class: 'lista__item' }, [
      el('div', { class: 'lista__item-info' }, [
        MOSTRAR_FOTOS ? miniatura(u.foto, u.nombre) : null,
        el('div', {}, [
          el('strong', {}, u.nombre),
          el('span', { class: 'muted' }, ` · ${ed ? ed.nombre : 'Sin edificio'} · ${u.capacidad} pers.`),
          el('div', { class: 'muted small' }, `${money(u.precioNoche)} / noche`)
        ])
      ]),
      el('div', { style: 'display:flex;gap:8px' }, [
        el('button', {
          class: 'btn btn--ghost btn--sm',
          onClick: () => abrirEdicionUnidad(u, edificios, cargarLista)
        }, 'Editar'),
        el('button', {
          class: 'btn btn--ghost btn--sm',
          onClick: async () => {
            const reservas = await reservasService.getByUnidad(u.id);
            if (reservas.length > 0) { toast('No se puede: tiene reservas registradas', 'alerta'); return; }
            if (await confirmar(`¿Eliminar "${u.nombre}"?`)) {
              await unidadesService.remove(u.id);
              toast('Departamento eliminado', 'ok');
              cargarLista();
            }
          }
        }, 'Eliminar')
      ])
    ]);
  }

  async function cargarLista() {
    const unidades = await unidadesService.getAll();
    paginado.setItems(unidades);
  }
  cargarLista();
}

function abrirAltaUnidad(edificios, onGuardar) {
  // '' queda reservado para "todavía no elegí nada" (el placeholder), así que
  // "Sin edificio" necesita un valor propio para poder validarse como elección real.
  const selEdificio = el('select', {}, [
    el('option', { value: '' }, 'Elegí una opción…'),
    el('option', { value: OPCION_SIN_EDIFICIO }, 'Sin edificio'),
    ...edificios.map((ed) => el('option', { value: ed.id }, ed.nombre))
  ]);

  // Selector de ubicación. Al elegir un edificio, hereda su ubicación (ajustable).
  const picker = crearSelectorUbicacion();
  selEdificio.addEventListener('change', () => {
    const ed = edificios.find((x) => x.id === selEdificio.value);
    if (ed?.ubicacion?.lat && ed?.ubicacion?.lng) {
      picker.setUbicacion(ed.ubicacion.lat, ed.ubicacion.lng);
    }
  });

  const inNombre = el('input', { placeholder: 'Ej: Depto 3B' });
  const inCapacidad = el('input', { type: 'number', min: '1', placeholder: '4' });
  const inAmbientes = el('input', { type: 'number', min: '1', placeholder: '2' });
  const inPrecio = el('input', { type: 'number', min: '0', placeholder: '25000' });
  const inDescripcion = el('textarea', { rows: '2', placeholder: '2 dormitorios, vista al mar' });
  const inFoto = el('input', { type: 'url', placeholder: 'https://… (opcional)' });
  const btn = boton('Guardar departamento', { variante: 'exito', tipo: 'submit' });
  const btnCancelar = boton('Cancelar', { variante: 'danger', onClick: () => modal.intentarCerrar() });

  const form = el('form', { class: 'form' }, [
    el('h3', { style: 'margin:0 0 8px' }, 'Nuevo departamento'),
    campo('Nombre', inNombre, { requerido: true }),
    campo('Edificio', selEdificio, { requerido: true }),
    fila([campo('Capacidad', inCapacidad, { requerido: true }), campo('Ambientes', inAmbientes)]),
    campo('Precio por noche', inPrecio, { requerido: true }),
    campo('Descripción', inDescripcion),
    MOSTRAR_FOTOS ? campo('Foto (URL)', inFoto) : null,
    picker.element,
    el('div', { class: 'modal__acciones' }, [
      btnCancelar,
      btn
    ])
  ]);

  const modal = abrirModal(form, { ancho: true });
  picker.montar();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ubic = picker.getValor();

    const errores = validarFormulario([
      { elemento: inNombre, validar: () => !inNombre.value.trim() && 'Ingresá un nombre.' },
      { elemento: selEdificio, validar: () => !selEdificio.value && 'Elegí un edificio (o "Sin edificio").' },
      { elemento: inCapacidad, validar: () => (!Number.isInteger(Number(inCapacidad.value)) || Number(inCapacidad.value) < 1) && 'Ingresá un número entero de 1 o más.' },
      { elemento: inPrecio, validar: () => (inPrecio.value === '' || isNaN(Number(inPrecio.value)) || Number(inPrecio.value) < 0) && 'Ingresá un precio válido (0 o más).' },
      { elemento: picker.element, validar: () => !ubicacionValida(ubic) && 'Buscá la dirección o marcá el pin en el mapa.' }
    ]);
    if (errores.length) return;

    btn.disabled = true; btn.textContent = 'Guardando…';
    btnCancelar.disabled = true;
    modal.setGuardando(true);
    try {
      await unidadesService.create({
        nombre: inNombre.value.trim(),
        edificioId: selEdificio.value === OPCION_SIN_EDIFICIO ? null : selEdificio.value,
        capacidad: parseInt(inCapacidad.value) || 1,
        ambientes: parseInt(inAmbientes.value) || null,
        precioNoche: parseFloat(inPrecio.value) || 0,
        descripcion: inDescripcion.value.trim(),
        ...(MOSTRAR_FOTOS ? { foto: inFoto.value.trim() } : {}),
        estado: 'activo',
        ubicacion: { lat: ubic.lat, lng: ubic.lng, direccion: ubic.direccion }
      });
      toast('Departamento guardado', 'ok');
      modal.cerrar();
      if (onGuardar) onGuardar();
    } catch (err) {
      console.error(err); toast('No se pudo guardar', 'alerta');
      btn.disabled = false; btn.textContent = 'Guardar departamento';
      btnCancelar.disabled = false; modal.setGuardando(false);
    }
  });
}

function abrirEdicionUnidad(u, edificios, onGuardar) {
  const picker = crearSelectorUbicacion({ lat: u.ubicacion?.lat, lng: u.ubicacion?.lng, direccion: u.ubicacion?.direccion || '' });
  const inNombre = el('input', { value: u.nombre || '' });
  const selEdificio = el('select', {}, [
    el('option', { value: OPCION_SIN_EDIFICIO, selected: (!u.edificioId) || undefined }, 'Sin edificio'),
    ...edificios.map((ed) => el('option', { value: ed.id, selected: (ed.id === u.edificioId) || undefined }, ed.nombre))
  ]);
  const inCapacidad = el('input', { type: 'number', min: '1', value: u.capacidad || 1 });
  const inAmbientes = el('input', { type: 'number', min: '1', value: u.ambientes || '' });
  const inPrecio = el('input', { type: 'number', min: '0', value: u.precioNoche || 0 });
  const inDescripcion = el('textarea', { rows: '2' }, u.descripcion || '');
  const inFoto = el('input', { type: 'url', value: u.foto || '', placeholder: 'https://… (opcional)' });
  const btn = boton('Guardar cambios', { variante: 'exito', tipo: 'submit' });
  const btnCancelar = boton('Cancelar', { variante: 'danger', onClick: () => modal.intentarCerrar() });
  // Registros viejos sin ubicación cargada: no los bloqueamos por esto al editar.
  const yaLeFaltabaUbicacion = !ubicacionValida(u.ubicacion);

  const form = el('form', { class: 'form' }, [
    el('h3', { style: 'margin:0 0 8px' }, 'Editar departamento'),
    campo('Nombre', inNombre, { requerido: true }),
    campo('Edificio', selEdificio, { requerido: true }),
    fila([campo('Capacidad', inCapacidad, { requerido: true }), campo('Ambientes', inAmbientes)]),
    campo('Precio por noche', inPrecio, { requerido: true }),
    campo('Descripción', inDescripcion),
    MOSTRAR_FOTOS ? campo('Foto (URL)', inFoto) : null,
    picker.element,
    el('div', { class: 'modal__acciones' }, [
      btnCancelar,
      btn
    ])
  ]);

  const modal = abrirModal(form, { ancho: true });
  picker.montar();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ubic = picker.getValor();

    const errores = validarFormulario([
      { elemento: inNombre, validar: () => !inNombre.value.trim() && 'Ingresá un nombre.' },
      { elemento: selEdificio, validar: () => !selEdificio.value && 'Elegí un edificio (o "Sin edificio").' },
      { elemento: inCapacidad, validar: () => (!Number.isInteger(Number(inCapacidad.value)) || Number(inCapacidad.value) < 1) && 'Ingresá un número entero de 1 o más.' },
      { elemento: inPrecio, validar: () => (inPrecio.value === '' || isNaN(Number(inPrecio.value)) || Number(inPrecio.value) < 0) && 'Ingresá un precio válido (0 o más).' },
      { elemento: picker.element, validar: () => !yaLeFaltabaUbicacion && !ubicacionValida(ubic) && 'Buscá la dirección o marcá el pin en el mapa.' }
    ]);
    if (errores.length) return;

    btn.disabled = true; btn.textContent = 'Guardando…';
    btnCancelar.disabled = true;
    modal.setGuardando(true);
    try {
      await unidadesService.update(u.id, {
        nombre: inNombre.value.trim(),
        edificioId: selEdificio.value === OPCION_SIN_EDIFICIO ? null : selEdificio.value,
        capacidad: parseInt(inCapacidad.value) || 1,
        ambientes: parseInt(inAmbientes.value) || null,
        precioNoche: parseFloat(inPrecio.value) || 0,
        descripcion: inDescripcion.value.trim(),
        ...(MOSTRAR_FOTOS ? { foto: inFoto.value.trim() } : {}),
        ubicacion: { lat: ubic.lat, lng: ubic.lng, direccion: ubic.direccion }
      });
      toast('Departamento actualizado', 'ok');
      modal.cerrar();
      if (onGuardar) onGuardar();
    } catch (err) {
      console.error(err); toast('No se pudo guardar', 'alerta');
      btn.disabled = false; btn.textContent = 'Guardar cambios';
      btnCancelar.disabled = false; modal.setGuardando(false);
    }
  });
}

function ubicacionValida(ubic) {
  return typeof ubic?.lat === 'number' && !Number.isNaN(ubic.lat) && typeof ubic?.lng === 'number' && !Number.isNaN(ubic.lng);
}
function fila(campos) { return el('div', { class: 'form__fila' }, campos); }

