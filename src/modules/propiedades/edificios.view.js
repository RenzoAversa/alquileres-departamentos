// CRUD de edificios/hoteles.
import { edificiosService } from '../../services/edificios.service.js';
import { unidadesService } from '../../services/unidades.service.js';
import { el, toast, confirmar, abrirModal, boton, botonRecargar, crearPaginado, miniatura, campo, validarFormulario } from '../../core/ui.js';
import { crearSelectorUbicacion } from '../mapa/picker.js';
import { appConfig } from '../../firebase/init.js';

const MOSTRAR_FOTOS = !!appConfig.features.fotos;

export async function render(container) {
  container.append(el('div', { class: 'page-head' }, [
    el('h1', { class: 'page-title' }, 'Edificios / Hoteles'),
    boton('Nuevo edificio', { variante: 'accion', icono: '+', onClick: () => abrirAltaEdificio(cargarLista) })
  ]));

  // Lista
  const headerLista = el('div', { class: 'finanzas-head' }, [
    el('h3', {}, 'Edificios registrados'),
    botonRecargar(() => cargarLista())
  ]);
  const seccion = el('div', { class: 'card' }, [headerLista]);
  const listaCont = el('div', {});
  seccion.append(listaCont);
  container.append(seccion);

  const paginado = crearPaginado({
    contenedor: listaCont,
    porPagina: 20,
    mensajeVacio: 'Todavía no cargaste ningún edificio.',
    renderItem: (ed) => renderFila(ed)
  });

  let unidadesCache = [];

  function renderFila(ed) {
    const cant = unidadesCache.filter((u) => u.edificioId === ed.id).length;
    return el('div', { class: 'lista__item' }, [
      el('div', { class: 'lista__item-info' }, [
        MOSTRAR_FOTOS ? miniatura(ed.foto, ed.nombre) : null,
        el('div', {}, [
          el('strong', {}, ed.nombre),
          el('span', { class: 'muted' }, ` · ${ed.tipo || 'edificio'} · ${cant} unidad(es)`),
          ed.direccion ? el('div', { class: 'muted small' }, ed.direccion) : null
        ])
      ]),
      el('div', { style: 'display:flex;gap:8px' }, [
        el('button', {
          class: 'btn btn--ghost btn--sm',
          onClick: () => abrirEdicionEdificio(ed, cargarLista)
        }, 'Editar'),
        el('button', {
          class: 'btn btn--ghost btn--sm',
          onClick: async () => {
            if (cant > 0) { toast('No se puede: tiene unidades asignadas', 'alerta'); return; }
            if (await confirmar(`¿Eliminar "${ed.nombre}"?`)) {
              await edificiosService.remove(ed.id);
              toast('Edificio eliminado', 'ok');
              cargarLista();
            }
          }
        }, 'Eliminar')
      ])
    ]);
  }

  async function cargarLista() {
    const [edificios, unidades] = await Promise.all([
      edificiosService.getAll(),
      unidadesService.getAll()
    ]);
    unidadesCache = unidades;
    paginado.setItems(edificios);
  }
  cargarLista();
}

function abrirAltaEdificio(onGuardar) {
  const picker = crearSelectorUbicacion();
  const inNombre = el('input', { placeholder: 'Ej: Edificio Costa Azul' });
  const selTipo = selectTipo();
  const inFoto = el('input', { type: 'url', placeholder: 'https://… (opcional)' });
  const btn = boton('Guardar edificio', { variante: 'exito', tipo: 'submit' });
  const btnCancelar = boton('Cancelar', { variante: 'danger', onClick: () => modal.intentarCerrar() });

  const form = el('form', { class: 'form' }, [
    el('h3', { style: 'margin:0 0 8px' }, 'Nuevo edificio'),
    campo('Nombre', inNombre, { requerido: true }),
    campo('Tipo', selTipo, { requerido: true }),
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
      { elemento: selTipo, validar: () => !selTipo.value && 'Elegí un tipo.' },
      { elemento: picker.element, validar: () => !ubicacionValida(ubic) && 'Buscá la dirección o marcá el pin en el mapa.' }
    ]);
    if (errores.length) return;

    btn.disabled = true; btn.textContent = 'Guardando…';
    btnCancelar.disabled = true;
    modal.setGuardando(true);
    try {
      await edificiosService.create({
        nombre: inNombre.value.trim(),
        tipo: selTipo.value,
        ...(MOSTRAR_FOTOS ? { foto: inFoto.value.trim() } : {}),
        direccion: ubic.direccion,
        ubicacion: { lat: ubic.lat, lng: ubic.lng, direccion: ubic.direccion }
      });
      toast('Edificio guardado', 'ok');
      modal.cerrar();
      if (onGuardar) onGuardar();
    } catch (err) {
      console.error(err); toast('No se pudo guardar', 'alerta');
      btn.disabled = false; btn.textContent = 'Guardar edificio';
      btnCancelar.disabled = false; modal.setGuardando(false);
    }
  });
}

function abrirEdicionEdificio(ed, onGuardar) {
  const picker = crearSelectorUbicacion({ lat: ed.ubicacion?.lat, lng: ed.ubicacion?.lng, direccion: ed.direccion || '' });
  const inNombre = el('input', { value: ed.nombre || '' });
  const selTipo = selectTipo(ed.tipo);
  const inFoto = el('input', { type: 'url', value: ed.foto || '', placeholder: 'https://… (opcional)' });
  const btn = boton('Guardar cambios', { variante: 'exito', tipo: 'submit' });
  const btnCancelar = boton('Cancelar', { variante: 'danger', onClick: () => modal.intentarCerrar() });
  // Registros viejos sin ubicación cargada: no los bloqueamos por esto al editar.
  const yaLeFaltabaUbicacion = !ubicacionValida(ed.ubicacion);

  const form = el('form', { class: 'form' }, [
    el('h3', { style: 'margin:0 0 8px' }, 'Editar edificio'),
    campo('Nombre', inNombre, { requerido: true }),
    campo('Tipo', selTipo, { requerido: true }),
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
      { elemento: selTipo, validar: () => !selTipo.value && 'Elegí un tipo.' },
      { elemento: picker.element, validar: () => !yaLeFaltabaUbicacion && !ubicacionValida(ubic) && 'Buscá la dirección o marcá el pin en el mapa.' }
    ]);
    if (errores.length) return;

    btn.disabled = true; btn.textContent = 'Guardando…';
    btnCancelar.disabled = true;
    modal.setGuardando(true);
    try {
      await edificiosService.update(ed.id, {
        nombre: inNombre.value.trim(),
        tipo: selTipo.value,
        ...(MOSTRAR_FOTOS ? { foto: inFoto.value.trim() } : {}),
        direccion: ubic.direccion,
        ubicacion: { lat: ubic.lat, lng: ubic.lng, direccion: ubic.direccion }
      });
      toast('Edificio actualizado', 'ok');
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
function selectTipo(actual) {
  const s = el('select', { name: 'tipo' });
  ['edificio', 'hotel', 'complejo'].forEach((t) =>
    s.append(el('option', { value: t, selected: (t === actual) || undefined }, t.charAt(0).toUpperCase() + t.slice(1))));
  return s;
}

