// ============================================================
// Módulo Finanzas.
//   - Saldos por cuenta (efectivo / transferencia / Mercado Pago…)
//   - Alta de cuentas
//   - Resumen del mes (ingresos / egresos / neto)
//   - Alta de movimientos: ingreso, egreso o transferencia entre cuentas
//   - Listado de movimientos del mes
// ============================================================
import { cuentasService } from '../../services/cuentas.service.js';
import { movimientosService } from '../../services/movimientos.service.js';
import { unidadesService } from '../../services/unidades.service.js';
import { el, toast, confirmar, spinner, money, fecha, botonRecargar, crearPaginado, abrirModal, boton } from '../../core/ui.js';
import { exportarReporte } from '../../core/excel.js';
import { hoyISO } from '../../core/metricas.js';
import { abrirSelectorFecha } from '../reservas/selector-fechas.js';

const CATEGORIAS = ['alquiler', 'limpieza', 'servicios', 'mantenimiento', 'impuestos', 'comision', 'otro'];
const TIPOS_CUENTA = { efectivo: 'Efectivo', banco: 'Transferencia / Banco', billetera: 'Billetera (MP)', tarjeta: 'Tarjeta' };

const campo = (label, input) => el('label', { class: 'form__campo' }, [el('span', {}, label), input]);
const fila = (c) => el('div', { class: 'form__fila' }, c);

export async function render(container) {
  container.append(el('h1', { class: 'page-title' }, 'Finanzas'));

  const ahora = new Date();
  let anio = ahora.getFullYear();
  let mes = ahora.getMonth() + 1;

  let cuentas = [];
  let unidades = [];
  // pintarResumen() ya trae los movimientos del mes (los necesita para las
  // 3 KPI); acá quedan un momento para que pintarLista() los reuse en vez
  // de volver a pedir el mismo mes. Se consume una sola vez: si pintarLista()
  // se llama sola (su propio botón "Recargar"), vuelve a pedir fresco.
  let movimientosCache = null;

  const contSaldos = el('div', {});
  const contResumen = el('div', {});
  const contForm = el('div', {});
  const contLista = el('div', {});
  container.append(contSaldos, contResumen, contForm, contLista);

  contSaldos.append(spinner('Cargando finanzas…'));

  // Sección "Movimientos del mes": se arma una sola vez, la lista se repagina.
  const listaCont = el('div', {});
  const seccionLista = el('div', { class: 'card' }, [
    el('div', { class: 'finanzas-head' }, [
      el('h3', {}, 'Movimientos del mes'),
      botonRecargar(() => pintarLista())
    ]),
    listaCont
  ]);
  contLista.append(seccionLista);
  const paginadoMovs = crearPaginado({
    contenedor: listaCont,
    porPagina: 20,
    mensajeVacio: 'Sin movimientos en este período.',
    renderItem: (m) => renderMovimiento(m)
  });

  async function recargarDatos() {
    [cuentas, unidades] = await Promise.all([
      cuentasService.getAll(),
      unidadesService.getAll()
    ]);
  }

  // -------- Saldos por cuenta --------
  async function pintarSaldos() {
    contSaldos.innerHTML = '';
    if (!cuentas.length) {
      contSaldos.append(el('div', { class: 'card' }, [
        el('h3', {}, 'Cuentas'),
        el('p', { class: 'muted' }, 'Todavía no tenés cuentas cargadas. Creá las básicas para empezar a registrar plata.'),
        el('div', { class: 'form__fila', style: 'margin-top:12px' }, [
          el('button', {
            class: 'btn btn--primary',
            onClick: async () => {
              await cuentasService.crearIniciales();
              toast('Cuentas creadas: Efectivo, Transferencia y Mercado Pago', 'ok');
              await refrescarTodo();
            }
          }, 'Crear Efectivo + Transferencia + Mercado Pago'),
          el('button', { class: 'btn btn--ghost', onClick: () => abrirFormCuenta() }, 'Crear una a mano')
        ])
      ]));
      return;
    }

    const total = cuentas.reduce((a, c) => a + (Number(c.saldo) || 0), 0);
    const tarjetas = cuentas.map((c) =>
      el('div', { class: 'kpi' }, [
        el('div', { class: 'kpi__valor' }, money(c.saldo, c.moneda)),
        el('div', { class: 'kpi__label' }, c.nombre)
      ]));

    contSaldos.append(el('div', { class: 'card' }, [
      el('div', { class: 'finanzas-head' }, [
        el('h3', {}, 'Saldos por cuenta'),
        el('button', { class: 'btn btn--ghost btn--sm', onClick: () => abrirFormCuenta() }, '+ Cuenta')
      ]),
      el('div', { class: 'kpi-grid' }, tarjetas),
      el('p', { class: 'muted small' }, `Total en todas las cuentas: ${money(total)}`)
    ]));
  }

  function abrirFormCuenta() {
    const selTipo = el('select', { name: 'tipo' });
    Object.entries(TIPOS_CUENTA).forEach(([v, t]) => selTipo.append(el('option', { value: v }, t)));
    const btn = boton('Guardar', { variante: 'exito', tipo: 'submit' });
    const btnCancelar = boton('Cancelar', { variante: 'danger', onClick: () => modal.intentarCerrar() });
    const form = el('form', { class: 'form' }, [
      el('h3', {}, 'Nueva cuenta'),
      campo('Nombre', el('input', { name: 'nombre', required: true, placeholder: 'Ej: Banco Galicia' })),
      campo('Tipo', selTipo),
      campo('Saldo inicial', el('input', { name: 'saldoInicial', type: 'number', value: '0' })),
      el('div', { class: 'modal__acciones' }, [
        btnCancelar,
        btn
      ])
    ]);
    const modal = abrirModal(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      btn.disabled = true; btn.textContent = 'Guardando…';
      btnCancelar.disabled = true;
      modal.setGuardando(true);
      try {
        await cuentasService.create({
          nombre: f.get('nombre').trim(),
          tipo: f.get('tipo'),
          saldoInicial: parseFloat(f.get('saldoInicial')) || 0,
          moneda: 'ARS'
        });
        modal.cerrar();
        toast('Cuenta creada', 'ok');
        await refrescarTodo();
      } catch (err) {
        console.error(err); toast('No se pudo guardar', 'alerta');
        btn.disabled = false; btn.textContent = 'Guardar';
        btnCancelar.disabled = false; modal.setGuardando(false);
      }
    });
  }

  // -------- Resumen del mes --------
  async function pintarResumen() {
    contResumen.innerHTML = '';
    const selMes = el('input', {
      type: 'month',
      value: `${anio}-${String(mes).padStart(2, '0')}`,
      onChange: async (e) => {
        const [a, m] = e.target.value.split('-');
        anio = parseInt(a); mes = parseInt(m);
        await pintarResumen();
        await pintarLista();
      }
    });
    const r = await movimientosService.resumenMes(anio, mes);
    movimientosCache = r.movimientos;
    const btnExp = el('button', { class: 'btn btn--ghost btn--sm', type: 'button' }, 'Exportar a Excel');
    btnExp.addEventListener('click', async () => {
      const mm = String(mes).padStart(2, '0');
      const desde = `${anio}-${mm}-01`;
      const ultimo = new Date(anio, mes, 0).getDate();
      const hasta = `${anio}-${mm}-${String(ultimo).padStart(2, '0')}`;
      btnExp.disabled = true; btnExp.textContent = 'Generando…';
      try { await exportarReporte({ desde, hasta }); }
      catch (e) { console.error(e); toast('No se pudo generar el Excel', 'alerta'); }
      finally { btnExp.disabled = false; btnExp.textContent = 'Exportar a Excel'; }
    });
    contResumen.append(el('div', { class: 'card' }, [
      el('div', { class: 'finanzas-head' }, [
        el('h3', {}, 'Resumen del mes'),
        el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
          el('label', { class: 'form__campo', style: 'flex-direction:row;align-items:center;gap:8px' }, [el('span', {}, 'Período'), selMes]),
          btnExp
        ])
      ]),
      el('div', { class: 'kpi-grid' }, [
        el('div', { class: 'kpi kpi--ok' }, [el('div', { class: 'kpi__valor' }, money(r.ingresos)), el('div', { class: 'kpi__label' }, 'Ingresos')]),
        el('div', { class: 'kpi kpi--alerta' }, [el('div', { class: 'kpi__valor' }, money(r.egresos)), el('div', { class: 'kpi__label' }, 'Gastos')]),
        el('div', { class: `kpi ${r.neto >= 0 ? 'kpi--ok' : 'kpi--alerta'}` }, [el('div', { class: 'kpi__valor' }, money(r.neto)), el('div', { class: 'kpi__label' }, 'Resultado neto')])
      ])
    ]));
  }

  // -------- Alta de movimiento (form dinámico) --------
  function pintarForm() {
    contForm.innerHTML = '';
    if (!cuentas.length) return;

    const selTipo = el('select', { name: 'tipo' });
    [['ingreso', 'Ingreso'], ['egreso', 'Gasto'], ['transferencia', 'Transferencia entre cuentas']]
      .forEach(([v, t]) => selTipo.append(el('option', { value: v }, t)));

    const cuentaOptions = () => cuentas.map((c) => el('option', { value: c.id }, c.nombre));
    const zonaCuentas = el('div', {});
    const zonaCategoria = el('div', {});

    function pintarCamposSegunTipo() {
      const tipo = selTipo.value;
      zonaCuentas.innerHTML = '';
      zonaCategoria.innerHTML = '';
      if (tipo === 'transferencia') {
        const selOrigen = el('select', { name: 'cuentaOrigen', required: true }, cuentaOptions());
        const selDestino = el('select', { name: 'cuentaDestino', required: true }, cuentaOptions());
        if (cuentas.length > 1) selDestino.selectedIndex = 1;
        zonaCuentas.append(fila([campo('Desde', selOrigen), campo('Hacia', selDestino)]));
      } else {
        const selCuenta = el('select', { name: 'cuentaId', required: true }, cuentaOptions());
        const selCat = el('select', { name: 'categoria' }, CATEGORIAS.map((c) => el('option', { value: c }, c[0].toUpperCase() + c.slice(1))));
        zonaCuentas.append(campo(tipo === 'ingreso' ? 'Entra a' : 'Sale de', selCuenta));
        zonaCategoria.append(campo('Categoría', selCat));
      }
    }
    selTipo.addEventListener('change', pintarCamposSegunTipo);

    const selUnidad = el('select', { name: 'unidadId' }, [
      el('option', { value: '' }, 'Sin imputar'),
      ...unidades.map((u) => el('option', { value: u.id }, u.nombre))
    ]);

    // Fecha del movimiento: mismo calendario propio que el resto de la app,
    // en su modo de una sola fecha (soloUnDia). permitirPasado porque acá
    // cargar un movimiento de un día anterior es el caso normal (asentar
    // un gasto/cobro con demora), no algo que amerite la confirmación de
    // Reservas. El input oculto es el que viaja en el FormData del submit.
    let fechaMov = hoyISO();
    const inFecha = el('input', { type: 'hidden', name: 'fecha', value: fechaMov });
    const btnFecha = el('button', { type: 'button', class: 'btn btn--ghost' }, fecha(fechaMov));
    btnFecha.addEventListener('click', async () => {
      const elegida = await abrirSelectorFecha({ fecha: fechaMov, permitirPasado: true });
      if (!elegida) return;
      fechaMov = elegida;
      inFecha.value = fechaMov;
      btnFecha.textContent = fecha(fechaMov);
    });

    const form = el('form', { class: 'card form' }, [
      el('h3', {}, 'Nuevo movimiento'),
      fila([campo('Tipo', selTipo), campo('Monto', el('input', { name: 'monto', type: 'number', min: '0', required: true, placeholder: '25000' }))]),
      zonaCuentas,
      zonaCategoria,
      fila([campo('Fecha', el('div', {}, [inFecha, btnFecha])), campo('Imputar a', selUnidad)]),
      campo('Descripción', el('input', { name: 'descripcion', placeholder: 'Detalle del movimiento' })),
      el('button', { class: 'btn btn--primary', type: 'submit' }, 'Guardar movimiento')
    ]);
    pintarCamposSegunTipo();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const tipo = f.get('tipo');
      const monto = parseFloat(f.get('monto')) || 0;
      if (monto <= 0) { toast('El monto debe ser mayor a 0', 'alerta'); return; }

      const base = {
        tipo, monto, moneda: 'ARS',
        fecha: f.get('fecha'),
        descripcion: (f.get('descripcion') || '').trim(),
        unidadId: f.get('unidadId') || null
      };

      if (tipo === 'transferencia') {
        const origen = f.get('cuentaOrigen');
        const destino = f.get('cuentaDestino');
        if (origen === destino) { toast('Elegí cuentas distintas', 'alerta'); return; }
        await movimientosService.crear({ ...base, cuentaOrigen: origen, cuentaDestino: destino, categoria: 'otro' });
      } else {
        await movimientosService.crear({ ...base, cuentaId: f.get('cuentaId'), categoria: f.get('categoria') });
      }

      toast('Movimiento guardado', 'ok');
      form.reset();
      fechaMov = hoyISO();
      inFecha.value = fechaMov;
      btnFecha.textContent = fecha(fechaMov);
      await refrescarTodo();
    });

    contForm.append(form);
  }

  // -------- Listado de movimientos --------
  function nombreCuenta(id) { return cuentas.find((c) => c.id === id)?.nombre || '—'; }

  function renderMovimiento(m) {
    let detalle, badge;
    if (m.tipo === 'transferencia') {
      detalle = `${fecha(m.fecha)} · ${nombreCuenta(m.cuentaOrigen)} → ${nombreCuenta(m.cuentaDestino)}`;
      badge = el('span', { class: 'badge badge--info' }, money(m.monto));
    } else {
      detalle = `${fecha(m.fecha)} · ${m.categoria} · ${nombreCuenta(m.cuentaId)}`;
      badge = el('span', { class: `badge ${m.tipo === 'ingreso' ? 'badge--ok' : 'badge--alerta'}` },
        `${m.tipo === 'ingreso' ? '+' : '−'} ${money(m.monto)}`);
    }
    return el('div', { class: 'lista__item' }, [
      el('div', {}, [
        el('strong', {}, m.descripcion || (m.tipo === 'transferencia' ? 'Transferencia' : m.categoria)),
        el('div', { class: 'muted small' }, detalle)
      ]),
      el('div', { style: 'display:flex;align-items:center;gap:8px' }, [
        badge,
        m.reservaId
          ? el('span', { class: 'badge', title: 'Se gestiona desde la reserva' }, 'Pago de reserva')
          : el('button', {
              class: 'btn btn--ghost btn--sm',
              onClick: async () => {
                if (await confirmar('¿Eliminar este movimiento? Se ajustarán los saldos.')) {
                  await movimientosService.eliminar(m);
                  toast('Movimiento eliminado', 'ok');
                  await refrescarTodo();
                }
              }
            }, 'Eliminar')
      ])
    ]);
  }

  async function pintarLista() {
    const movs = movimientosCache || await movimientosService.getByMes(anio, mes);
    movimientosCache = null;
    paginadoMovs.setItems(movs);
  }

  async function refrescarTodo() {
    await recargarDatos();
    await pintarSaldos();
    await pintarResumen();
    pintarForm();
    await pintarLista();
  }

  await refrescarTodo();
}
