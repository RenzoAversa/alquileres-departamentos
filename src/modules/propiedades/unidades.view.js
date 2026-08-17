// CRUD de unidades (departamentos). Pueden pertenecer a un edificio (con piso)
// o ser sueltas. El listado se agrupa por edificio/complejo/hotel y, dentro
// de cada uno, por piso; los sueltos van en un grupo aparte al final.
import { unidadesService } from '../../services/unidades.service.js';
import { edificiosService } from '../../services/edificios.service.js';
import { reservasService } from '../../services/reservas.service.js';
import { el, toast, confirmar, money, abrirModal, boton, botonRecargar, crearPaginado, miniatura, campo, validarFormulario, compararPiso } from '../../core/ui.js';
import { crearSelectorUbicacion } from '../mapa/picker.js';
import { appConfig } from '../../firebase/init.js';

const OPCION_SIN_EDIFICIO = '__sin_edificio__';
const MOSTRAR_FOTOS = !!appConfig.features.fotos;
const SIN_PISO = '__sin_piso__';
const TIPO_LABEL = { edificio: 'Edificio', hotel: 'Hotel', complejo: 'Complejo' };

// Agrupa por edificio (con su tipo) y, dentro, por piso. Las sueltas quedan
// en un grupo aparte al final, sin sub-agrupar por piso.
function agruparUnidades(unidades, edificios) {
  const porEdificio = new Map(); // edificioId -> { ed, unidades[] }
  const sueltas = [];
  unidades.forEach((u) => {
    if (!u.edificioId) { sueltas.push(u); return; }
    if (!porEdificio.has(u.edificioId)) {
      const ed = edificios.find((e) => e.id === u.edificioId);
      porEdificio.set(u.edificioId, { ed, unidades: [] });
    }
    porEdificio.get(u.edificioId).unidades.push(u);
  });

  const gruposEdificio = [...porEdificio.values()]
    .sort((a, b) => (a.ed?.nombre || '').localeCompare(b.ed?.nombre || '', 'es'))
    .map(({ ed, unidades: us }) => {
      const porPiso = new Map();
      us.forEach((u) => {
        const key = (u.piso || '').trim() || SIN_PISO;
        if (!porPiso.has(key)) porPiso.set(key, { key, titulo: key === SIN_PISO ? 'Sin piso asignado' : `Piso ${key}`, unidades: [] });
        porPiso.get(key).unidades.push(u);
      });
      const pisos = [...porPiso.values()].sort((a, b) => {
        if (a.key === SIN_PISO) return 1;
        if (b.key === SIN_PISO) return -1;
        return compararPiso(a.key, b.key);
      });
      const tipoLabel = TIPO_LABEL[ed?.tipo] || TIPO_LABEL.edificio;
      return { key: `ed:${ed?.id}`, titulo: ed?.nombre || 'Edificio', subtitulo: tipoLabel, pisos, cantidad: us.length };
    });

  const grupoSueltas = sueltas.length
    ? [{ key: 'sueltas', titulo: 'Departamentos', subtitulo: null, pisos: null, unidades: sueltas, cantidad: sueltas.length }]
    : [];

  return [...gruposEdificio, ...grupoSueltas];
}

export async function render(container) {
  // `edificios` la reasigna cargarLista() en cada carga (incluida la
  // inicial): antes se pedía acá Y de nuevo dentro de cargarLista() para
  // la misma pantalla, dos lecturas idénticas en simultáneo. El botón
  // "Nuevo departamento" y los de "Editar" cierran sobre esta variable y
  // la leen recién al hacer click, así que siempre ven la última que
  // trajo cargarLista() (Recargar y el guardado de alta/edición la
  // siguen refrescando exactamente igual que antes).
  let edificios = [];

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

  const gruposAbiertos = new Set();
  const pisosAbiertos = new Set();

  const paginado = crearPaginado({
    contenedor: listaCont,
    porPagina: 20,
    mensajeVacio: 'Todavía no cargaste ningún departamento.',
    renderItem: (grupo) => renderGrupoEdificio(grupo)
  });

  function renderFila(u) {
    return el('div', { class: 'lista__item' }, [
      el('div', { class: 'lista__item-info' }, [
        MOSTRAR_FOTOS ? miniatura(u.foto, u.nombre) : null,
        el('div', {}, [
          el('strong', {}, u.nombre),
          el('span', { class: 'muted' }, ` · ${u.capacidad} pers.`),
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

  // Sub-grupo por piso, dentro de un edificio. Su clave de "abierto" incluye
  // la del edificio para no chocar entre pisos del mismo número en edificios distintos.
  function renderGrupoPiso(edificioKey, piso) {
    const key = `${edificioKey}::${piso.key}`;
    const abierto = pisosAbiertos.has(key);
    const body = el('div', { class: 'piso-grupo__body' }, piso.unidades.map((u) => renderFila(u)));
    body.hidden = !abierto;
    const grupoEl = el('div', { class: `piso-grupo ${abierto ? 'is-abierto' : ''}` }, [
      el('button', {
        class: 'piso-grupo__header', type: 'button',
        onClick: () => {
          body.hidden = !body.hidden;
          grupoEl.classList.toggle('is-abierto', !body.hidden);
          if (body.hidden) pisosAbiertos.delete(key); else pisosAbiertos.add(key);
        }
      }, [
        el('span', {}, piso.titulo),
        el('span', { class: 'badge badge--info' }, `${piso.unidades.length}`),
        el('span', { class: 'reserva-grupo__flecha' }, '▾')
      ]),
      body
    ]);
    return grupoEl;
  }

  function renderGrupoEdificio(grupo) {
    const abierto = gruposAbiertos.has(grupo.key);
    // Los pisos "reales" van en su propio sub-grupo plegable; las unidades
    // sin piso asignado se listan directo (sin envoltorio "Sin piso asignado").
    const body = el('div', { class: 'reserva-grupo__body' },
      grupo.pisos
        ? grupo.pisos.flatMap((p) => (p.key === SIN_PISO ? p.unidades.map((u) => renderFila(u)) : [renderGrupoPiso(grupo.key, p)]))
        : grupo.unidades.map((u) => renderFila(u)));
    body.hidden = !abierto;
    const grupoEl = el('div', { class: `reserva-grupo ${abierto ? 'is-abierto' : ''}` }, [
      el('button', {
        class: 'reserva-grupo__header', type: 'button',
        onClick: () => {
          body.hidden = !body.hidden;
          grupoEl.classList.toggle('is-abierto', !body.hidden);
          if (body.hidden) gruposAbiertos.delete(grupo.key); else gruposAbiertos.add(grupo.key);
        }
      }, [
        el('span', { class: 'reserva-grupo__titulo' }, [
          grupo.titulo,
          grupo.subtitulo ? el('span', { class: 'muted small', style: 'font-weight:400;margin-left:6px' }, grupo.subtitulo) : null
        ].filter(Boolean)),
        el('span', { class: 'badge badge--info' }, `${grupo.cantidad} depto(s)`),
        el('span', { class: 'reserva-grupo__flecha' }, '▾')
      ]),
      body
    ]);
    return grupoEl;
  }

  async function cargarLista() {
    const [unidades, edificiosFrescos] = await Promise.all([unidadesService.getAll(), edificiosService.getAll()]);
    edificios = edificiosFrescos;
    paginado.setItems(agruparUnidades(unidades, edificios));
  }
  await cargarLista();
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
  const inPiso = el('input', { placeholder: 'Ej: 1, PB, Torre A - 3 (opcional)' });
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
    campo('Piso', inPiso),
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
        piso: inPiso.value.trim() || null,
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
  const inPiso = el('input', { value: u.piso || '', placeholder: 'Ej: 1, PB, Torre A - 3 (opcional)' });
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
    campo('Piso', inPiso),
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
        piso: inPiso.value.trim() || null,
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
