// ========================================
// CONTROLLER.JS - Capa de Controlador (MVC)
// Coordina eventos entre Modelo y Vista
// ========================================

const Controller = {
    // ========================================
    // INICIALIZACIÓN
    // ========================================
    
    /**
     * Inicializar el controlador
     */
    init() {
        console.log('🚀 Iniciando Controller...');
        
        // Configurar eventos
        this.configurarEventosTabs();
        this.configurarEventosDepartamentos();
        this.configurarEventosReservas();
        this.configurarEventosBusqueda();
        this.configurarEventosCalendario();
        this.configurarBotonLimpiarDuplicados();
        
        // Configurar fechas mínimas
        View.configurarFechasMinimas();
        
        // Renderizar datos iniciales (solo una vez)
        console.log('🎯 Renderizado inicial de datos');
        
        // Mostrar loading inicial muy breve
        setTimeout(() => {
            this.actualizarVistaDepartamentos();
            this.actualizarVistaReservas();
        }, 100);
        
        // Verificar si hay duplicados
        this.verificarDuplicados();
        
        console.log('✅ Controller inicializado correctamente');
    },

    /**
     * Verificar si hay duplicados y mostrar botón de limpieza
     */
    verificarDuplicados() {
        const departamentos = JSON.parse(localStorage.getItem('departamentos')) || [];
        const reservas = JSON.parse(localStorage.getItem('reservas')) || [];
        
        const idsDeptos = departamentos.map(d => d.id);
        const idsReservas = reservas.map(r => r.id);
        
        const duplicadosDeptos = idsDeptos.length !== new Set(idsDeptos).size;
        const duplicadosReservas = idsReservas.length !== new Set(idsReservas).size;
        
        if (duplicadosDeptos || duplicadosReservas) {
            const btn = document.getElementById('btn-limpiar-duplicados');
            if (btn) {
                btn.style.display = 'block';
                console.warn('⚠️ Duplicados detectados - Botón de limpieza visible');
            }
        }
    },

    /**
     * Configurar botón de limpiar duplicados
     */
    configurarBotonLimpiarDuplicados() {
        const btn = document.getElementById('btn-limpiar-duplicados');
        if (!btn) return;
        
        btn.addEventListener('click', () => {
            if (!confirm('¿Limpiar todos los duplicados del almacenamiento local?\n\nEsto eliminará copias repetidas pero mantendrá los datos únicos.')) {
                return;
            }
            
            // Función para eliminar duplicados
            const eliminarDuplicados = (items) => {
                const idsVistos = new Set();
                return items.filter(item => {
                    if (!idsVistos.has(item.id)) {
                        idsVistos.add(item.id);
                        return true;
                    }
                    return false;
                });
            };
            
            // Limpiar departamentos
            const departamentos = JSON.parse(localStorage.getItem('departamentos')) || [];
            const deptsLimpios = eliminarDuplicados(departamentos);
            
            // Limpiar reservas
            const reservas = JSON.parse(localStorage.getItem('reservas')) || [];
            const reservasLimpias = eliminarDuplicados(reservas);
            
            // Guardar
            localStorage.setItem('departamentos', JSON.stringify(deptsLimpios));
            localStorage.setItem('reservas', JSON.stringify(reservasLimpias));
            
            const eliminados = (departamentos.length - deptsLimpios.length) + (reservas.length - reservasLimpias.length);
            
            alert(`✅ Duplicados eliminados: ${eliminados}\n\nRecargando página...`);
            location.reload();
        });
    },

    // ========================================
    // EVENTOS DE TABS
    // ========================================
    
    /**
     * Configurar eventos de navegación entre tabs
     */
    configurarEventosTabs() {
        View.elements.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                View.cambiarTab(tabName);
                
                // Si cambia a reservas, actualizar el select de departamentos
                if (tabName === 'reservas') {
                    const departamentos = Model.obtenerDepartamentos();
                    View.llenarSelectDepartamentos(departamentos);
                }
                
                // Si cambia a calendario, inicializar calendario
                if (tabName === 'calendario') {
                    this.inicializarCalendario();
                }
            });
        });
    },

    // ========================================
    // EVENTOS DE DEPARTAMENTOS
    // ========================================
    
    /**
     * Configurar eventos relacionados con departamentos
     */
    configurarEventosDepartamentos() {
        // Submit del formulario
        View.elements.formDepartamento.addEventListener('submit', (e) => {
            e.preventDefault();
            this.guardarDepartamento();
        });

        // Botón cancelar
        View.elements.btnCancelarDept.addEventListener('click', () => {
            View.limpiarFormularioDepartamento();
            View.mostrarAlerta('Edición cancelada', 'info');
        });

        // Botón recargar departamentos
        View.elements.btnRefreshDepartamentos.addEventListener('click', () => {
            this.recargarDepartamentos();
        });

        // Delegación de eventos para botones dinámicos
        View.elements.listaDepartamentos.addEventListener('click', (e) => {
            // Editar departamento
            if (e.target.classList.contains('btn-editar-dept')) {
                const id = e.target.dataset.id;
                this.editarDepartamento(id);
            }
            
            // Eliminar departamento
            if (e.target.classList.contains('btn-eliminar-dept')) {
                const id = e.target.dataset.id;
                this.eliminarDepartamento(id);
            }
        });
    },

    /**
     * Guardar o actualizar departamento
     */
    async guardarDepartamento() {
        const id = View.elements.deptId.value;
        const datos = {
            nombre: View.elements.deptNombre.value,
            capacidad: View.elements.deptCapacidad.value,
            descripcion: View.elements.deptDescripcion.value
        };

        // Validaciones básicas
        if (!datos.nombre.trim()) {
            View.mostrarAlerta('El nombre del departamento es requerido', 'error');
            return;
        }

        if (!datos.capacidad || datos.capacidad < 1) {
            View.mostrarAlerta('La capacidad debe ser al menos 1', 'error');
            return;
        }

        try {
            if (id) {
                // Actualizar existente
                await Model.actualizarDepartamento(id, datos);
                View.mostrarAlerta('✅ Departamento actualizado exitosamente', 'success');
            } else {
                // Crear nuevo
                await Model.crearDepartamento(datos);
                View.mostrarAlerta('✅ Departamento creado exitosamente', 'success');
            }

            View.limpiarFormularioDepartamento();
            this.actualizarVistaDepartamentos();
            
            // Si estamos en el tab de reservas, actualizar el select
            const tabActivo = document.querySelector('.tab-content.active');
            if (tabActivo && tabActivo.id === 'tab-reservas') {
                const departamentos = Model.obtenerDepartamentos();
                View.llenarSelectDepartamentos(departamentos);
            }
        } catch (error) {
            View.mostrarAlerta('❌ Error: ' + error.message, 'error');
        }
    },

    /**
     * Editar un departamento
     * @param {string} id - ID del departamento
     */
    editarDepartamento(id) {
        const departamento = Model.obtenerDepartamentoPorId(id);
        if (departamento) {
            View.cargarDepartamentoEnFormulario(departamento);
        } else {
            View.mostrarAlerta('Departamento no encontrado', 'error');
        }
    },

    /**
     * Eliminar un departamento
     * @param {string} id - ID del departamento
     */
    async eliminarDepartamento(id) {
        const departamento = Model.obtenerDepartamentoPorId(id);
        if (!departamento) {
            View.mostrarAlerta('Departamento no encontrado', 'error');
            return;
        }

        const confirmar = View.confirmar(
            `¿Estás seguro de eliminar el departamento "${departamento.nombre}"?\n\n` +
            `Esta acción no se puede deshacer y no podrás eliminar departamentos con reservas asociadas.`
        );

        if (!confirmar) return;

        try {
            await Model.eliminarDepartamento(id);
            View.mostrarAlerta('✅ Departamento eliminado exitosamente', 'success');
            this.actualizarVistaDepartamentos();
            
            // Si se estaba editando este departamento, limpiar formulario
            if (View.elements.deptId.value === id) {
                View.limpiarFormularioDepartamento();
            }
        } catch (error) {
            View.mostrarAlerta('❌ Error: ' + error.message, 'error');
        }
    },

    /**
     * Actualizar la vista de departamentos
     */
    actualizarVistaDepartamentos() {
        const departamentos = Model.obtenerDepartamentos();
        View.renderizarDepartamentos(departamentos);
    },

    // ========================================
    // EVENTOS DE RESERVAS
    // ========================================
    
    /**
     * Configurar eventos relacionados con reservas
     */
    configurarEventosReservas() {
        // Submit del formulario
        View.elements.formReserva.addEventListener('submit', (e) => {
            e.preventDefault();
            this.guardarReserva();
        });

        // Botón cancelar
        View.elements.btnCancelarReserva.addEventListener('click', () => {
            View.limpiarFormularioReserva();
            View.mostrarAlerta('Edición cancelada', 'info');
        });

        // Validar que fecha de salida sea posterior a entrada
        View.elements.reservaEntrada.addEventListener('change', () => {
            View.elements.reservaSalida.min = View.elements.reservaEntrada.value;
        });

        // Botón recargar reservas
        View.elements.btnRefreshReservas.addEventListener('click', () => {
            this.recargarReservas();
        });

        // Delegación de eventos para botones dinámicos
        View.elements.listaReservas.addEventListener('click', (e) => {
            // Editar reserva
            if (e.target.classList.contains('btn-editar-reserva')) {
                const id = e.target.dataset.id;
                this.editarReserva(id);
            }
            
            // Eliminar reserva
            if (e.target.classList.contains('btn-eliminar-reserva')) {
                const id = e.target.dataset.id;
                this.eliminarReserva(id);
            }
        });
    },

    /**
     * Guardar o actualizar reserva
     */
    async guardarReserva() {
        const id = View.elements.reservaId.value;
        const datos = {
            departamentoId: View.elements.reservaDepartamento.value,
            huesped: View.elements.reservaHuesped.value,
            fechaEntrada: View.elements.reservaEntrada.value,
            fechaSalida: View.elements.reservaSalida.value
        };

        // Validaciones básicas
        if (!datos.departamentoId) {
            View.mostrarAlerta('Debes seleccionar un departamento', 'error');
            return;
        }

        if (!datos.huesped.trim()) {
            View.mostrarAlerta('El nombre del huésped es requerido', 'error');
            return;
        }

        if (!datos.fechaEntrada || !datos.fechaSalida) {
            View.mostrarAlerta('Las fechas de entrada y salida son requeridas', 'error');
            return;
        }

        try {
            if (id) {
                // Actualizar existente
                await Model.actualizarReserva(id, datos);
                View.mostrarAlerta('✅ Reserva actualizada exitosamente', 'success');
            } else {
                // Crear nueva
                await Model.crearReserva(datos);
                View.mostrarAlerta('✅ Reserva creada exitosamente', 'success');
            }

            View.limpiarFormularioReserva();
            this.actualizarVistaReservas();
        } catch (error) {
            View.mostrarAlerta('❌ Error: ' + error.message, 'error');
        }
    },

    /**
     * Editar una reserva
     * @param {string} id - ID de la reserva
     */
    editarReserva(id) {
        const reserva = Model.obtenerReservaPorId(id);
        if (reserva) {
            View.cargarReservaEnFormulario(reserva);
        } else {
            View.mostrarAlerta('Reserva no encontrada', 'error');
        }
    },

    /**
     * Eliminar una reserva
     * @param {string} id - ID de la reserva
     */
    async eliminarReserva(id) {
        const reserva = Model.obtenerReservaPorId(id);
        if (!reserva) {
            View.mostrarAlerta('Reserva no encontrada', 'error');
            return;
        }

        const departamento = Model.obtenerDepartamentoPorId(reserva.departamentoId);
        const nombreDept = departamento ? departamento.nombre : 'Desconocido';

        const confirmar = View.confirmar(
            `¿Estás seguro de eliminar la reserva de "${reserva.huesped}"?\n` +
            `Departamento: ${nombreDept}\n` +
            `Fechas: ${View.formatearFecha(reserva.fechaEntrada)} - ${View.formatearFecha(reserva.fechaSalida)}\n\n` +
            `Esta acción no se puede deshacer.`
        );

        if (!confirmar) return;

        try {
            await Model.eliminarReserva(id);
            View.mostrarAlerta('✅ Reserva eliminada exitosamente', 'success');
            this.actualizarVistaReservas();
            
            // Si se estaba editando esta reserva, limpiar formulario
            if (View.elements.reservaId.value === id) {
                View.limpiarFormularioReserva();
            }
        } catch (error) {
            View.mostrarAlerta('❌ Error: ' + error.message, 'error');
        }
    },

    /**
     * Actualizar la vista de reservas
     */
    actualizarVistaReservas() {
        const reservas = Model.obtenerReservas();
        const departamentos = Model.obtenerDepartamentos();
        View.renderizarReservas(reservas, departamentos);
        
        // Si hay un calendario activo, actualizarlo también
        if (this.calendarioActual && this.calendarioActual.departamentoId) {
            console.log('🔄 Actualizando calendario por cambio en reservas');
            this.actualizarCalendario(this.calendarioActual.departamentoId);
        }
    },

    /**
     * Recargar departamentos con loading
     */
    async recargarDepartamentos() {
        console.log('🔄 Recargando departamentos...');
        View.mostrarLoadingDepartamentos();
        
        // Simular delay para mostrar el loading
        await new Promise(resolve => setTimeout(resolve, 500));
        
        this.actualizarVistaDepartamentos();
        View.mostrarAlerta('Departamentos recargados correctamente', 'success');
    },

    /**
     * Recargar reservas con loading
     */
    async recargarReservas() {
        console.log('🔄 Recargando reservas...');
        View.mostrarLoadingReservas();
        
        // Simular delay para mostrar el loading
        await new Promise(resolve => setTimeout(resolve, 500));
        
        this.actualizarVistaReservas();
        View.mostrarAlerta('Reservas recargadas correctamente', 'success');
    },

    // ========================================
    // EVENTOS DE BÚSQUEDA
    // ========================================
    
    /**
     * Configurar eventos de búsqueda
     */
    configurarEventosBusqueda() {
        // Submit del formulario
        View.elements.formBuscar.addEventListener('submit', (e) => {
            e.preventDefault();
            this.buscarDisponibilidad();
        });

        // Botón limpiar
        View.elements.btnLimpiarBusqueda.addEventListener('click', () => {
            View.elements.formBuscar.reset();
            View.elements.resultadosBusqueda.innerHTML = `
                <p class="text-muted">Use los filtros anteriores para buscar departamentos disponibles.</p>
            `;
            View.mostrarAlerta('Búsqueda limpiada', 'info');
        });

        // Validar que fecha de salida sea posterior a entrada
        View.elements.buscarEntrada.addEventListener('change', () => {
            if (View.elements.buscarEntrada.value) {
                View.elements.buscarSalida.min = View.elements.buscarEntrada.value;
            }
        });
    },

    /**
     * Buscar disponibilidad de departamentos
     */
    buscarDisponibilidad() {
        const criterios = {
            fechaEntrada: View.elements.buscarEntrada.value,
            fechaSalida: View.elements.buscarSalida.value,
            capacidad: View.elements.buscarCapacidad.value
        };

        // Validar que al menos un criterio esté presente
        if (!criterios.fechaEntrada && !criterios.fechaSalida && !criterios.capacidad) {
            View.mostrarAlerta('Debes especificar al menos un criterio de búsqueda', 'warning');
            return;
        }

        // Validar fechas si ambas están presentes
        if (criterios.fechaEntrada && criterios.fechaSalida) {
            const entrada = new Date(criterios.fechaEntrada);
            const salida = new Date(criterios.fechaSalida);
            
            if (salida <= entrada) {
                View.mostrarAlerta('La fecha de salida debe ser posterior a la fecha de entrada', 'error');
                return;
            }
        }

        // Si solo hay una fecha, advertir
        if ((criterios.fechaEntrada && !criterios.fechaSalida) || 
            (!criterios.fechaEntrada && criterios.fechaSalida)) {
            View.mostrarAlerta('Debes especificar ambas fechas (entrada y salida)', 'warning');
            return;
        }

        try {
            const departamentosDisponibles = Model.buscarDepartamentosDisponibles(criterios);
            View.renderizarResultadosBusqueda(departamentosDisponibles, criterios);
            
            if (departamentosDisponibles.length > 0) {
                View.mostrarAlerta(
                    `Se encontraron ${departamentosDisponibles.length} departamento(s) disponible(s)`,
                    'success'
                );
            }
        } catch (error) {
            View.mostrarAlerta('❌ Error en la búsqueda: ' + error.message, 'error');
        }
    },

    // ========================================
    // EVENTOS DE CALENDARIO
    // ========================================
    
    /**
     * Configurar eventos del calendario
     */
    configurarEventosCalendario() {
        console.log('🔧 Configurando eventos calendario...');
        
        // Asegurar que el DOM esté listo
        const configurarEventos = () => {
            // Cambio de departamento
            const selectDept = document.getElementById('calendario-departamento');
            if (selectDept) {
                selectDept.addEventListener('change', (e) => {
                    const departamentoId = e.target.value;
                    if (departamentoId) {
                        this.actualizarCalendario(departamentoId);
                    } else {
                        View.mostrarMensajeCalendarioVacio();
                    }
                });
                console.log('✅ Evento select departamento configurado');
            }

            // Botones de navegación
            const btnPrevMes = document.getElementById('btn-mes-anterior');
            const btnNextMes = document.getElementById('btn-mes-siguiente');
            const btnHoy = document.getElementById('btn-hoy');

            console.log('🔍 Elementos encontrados:', { 
                btnPrevMes: !!btnPrevMes, 
                btnNextMes: !!btnNextMes, 
                btnHoy: !!btnHoy 
            });

            if (btnPrevMes) {
                btnPrevMes.addEventListener('click', () => {
                    console.log('🔙 Click en mes anterior');
                    this.cambiarMesCalendario(-1);
                });
                console.log('✅ Evento mes anterior configurado');
            } else {
                console.warn('❌ No se encontró el botón mes anterior (#btn-mes-anterior)');
            }

            if (btnNextMes) {
                btnNextMes.addEventListener('click', () => {
                    console.log('🔜 Click en mes siguiente');
                    this.cambiarMesCalendario(1);
                });
                console.log('✅ Evento mes siguiente configurado');
            } else {
                console.warn('❌ No se encontró el botón mes siguiente (#btn-mes-siguiente)');
            }

            if (btnHoy) {
                btnHoy.addEventListener('click', () => {
                    console.log('📅 Click en botón HOY');
                    const selectDept = document.getElementById('calendario-departamento');
                    if (selectDept && selectDept.value) {
                        this.calendarioActual = {
                            departamentoId: selectDept.value,
                            anio: new Date().getFullYear(),
                            mes: new Date().getMonth()
                        };
                        this.actualizarCalendario(selectDept.value);
                        console.log('✅ Calendario actualizado a mes actual');
                    } else {
                        View.mostrarAlerta('Selecciona un departamento primero', 'info');
                    }
                });
                console.log('✅ Evento botón HOY configurado');
            } else {
                console.warn('❌ No se encontró el botón HOY (#btn-hoy)');
            }
        };

        // Si el DOM ya está listo, configurar inmediatamente
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', configurarEventos);
        } else {
            configurarEventos();
        }
    },

    /**
     * Actualizar el calendario para un departamento
     * @param {string} departamentoId - ID del departamento
     */
    actualizarCalendario(departamentoId) {
        console.log('📅 Actualizando calendario para departamento:', departamentoId);
        
        const ahora = new Date();
        const añoActual = ahora.getFullYear();
        const mesActual = ahora.getMonth();
        
        if (!this.calendarioActual) {
            this.calendarioActual = {
                departamentoId: departamentoId,
                anio: añoActual,
                mes: mesActual
            };
            console.log('📅 Inicializando calendario actual con fecha de HOY:', {
                ...this.calendarioActual,
                fechaHoy: ahora.toDateString()
            });
        } else {
            this.calendarioActual.departamentoId = departamentoId;
            console.log('📅 Actualizando departamento en calendario:', this.calendarioActual);
        }

        const departamento = Model.obtenerDepartamentoPorId(departamentoId);
        if (!departamento) {
            View.mostrarAlerta('Departamento no encontrado', 'error');
            return;
        }

        const reservas = Model.obtenerReservasPorDepartamento(departamentoId);
        console.log('📅 Reservas encontradas:', reservas.length);
        
        View.renderizarCalendario(
            departamentoId,
            this.calendarioActual.anio,
            this.calendarioActual.mes
        );

        View.actualizarInfoCalendario(departamento, reservas.length);
    },

    /**
     * Cambiar mes del calendario
     * @param {number} direccion - 1 para siguiente mes, -1 para mes anterior
     */
    cambiarMesCalendario(direccion) {
        console.log('📅 Cambiando mes calendario:', direccion, this.calendarioActual);
        
        if (!this.calendarioActual || !this.calendarioActual.departamentoId) {
            console.warn('❌ No hay calendario actual o departamento seleccionado');
            View.mostrarAlerta('Selecciona un departamento primero', 'info');
            return;
        }

        this.calendarioActual.mes += direccion;

        // Ajustar año si es necesario
        if (this.calendarioActual.mes > 11) {
            this.calendarioActual.mes = 0;
            this.calendarioActual.anio++;
        } else if (this.calendarioActual.mes < 0) {
            this.calendarioActual.mes = 11;
            this.calendarioActual.anio--;
        }

        console.log('📅 Nuevo estado calendario:', this.calendarioActual);
        this.actualizarCalendario(this.calendarioActual.departamentoId);
    },

    /**
     * Inicializar calendario cuando se cambia a la pestaña
     */
    inicializarCalendario() {
        console.log('🚀 Inicializando calendario...');
        
        const departamentos = Model.obtenerDepartamentos();
        View.llenarSelectCalendario(departamentos);
        
        if (departamentos.length === 0) {
            View.mostrarAlerta('No hay departamentos registrados. Crea uno primero.', 'info');
        } else {
            View.mostrarMensajeCalendarioVacio();
            
            // Si hay un departamento y el calendario no está inicializado, usar el primero
            if (!this.calendarioActual && departamentos.length > 0) {
                const primerDepartamento = departamentos[0];
                const select = document.getElementById('calendario-departamento');
                if (select) {
                    select.value = primerDepartamento.id;
                    
                    // Asegurar que inicie en el mes actual
                    const ahora = new Date();
                    this.calendarioActual = {
                        departamentoId: primerDepartamento.id,
                        anio: ahora.getFullYear(),
                        mes: ahora.getMonth()
                    };
                    console.log('📅 Forzando calendario al mes actual:', {
                        departamento: primerDepartamento.nombre,
                        fecha: ahora.toDateString(),
                        calendario: this.calendarioActual
                    });
                    
                    this.actualizarCalendario(primerDepartamento.id);
                }
            }
        }
    },

    // ========================================
    // UTILIDADES
    // ========================================
    
    /**
     * Exportar datos (útil para respaldo)
     */
    exportarDatos() {
        try {
            const datos = Model.exportarDatos();
            const json = JSON.stringify(datos, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `alquileres-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            View.mostrarAlerta('✅ Datos exportados exitosamente', 'success');
        } catch (error) {
            View.mostrarAlerta('❌ Error al exportar: ' + error.message, 'error');
        }
    },

    /**
     * Importar datos (restaurar respaldo)
     * @param {File} archivo - Archivo JSON con datos
     */
    importarDatos(archivo) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const datos = JSON.parse(e.target.result);
                Model.importarDatos(datos);
                this.actualizarVistaDepartamentos();
                this.actualizarVistaReservas();
                View.mostrarAlerta('✅ Datos importados exitosamente', 'success');
            } catch (error) {
                View.mostrarAlerta('❌ Error al importar: ' + error.message, 'error');
            }
        };
        reader.readAsText(archivo);
    }
};

// ========================================
// INICIAR LA APLICACIÓN
// ========================================

// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔥 INICIANDO APP - VERSIÓN v7 (FIX DOBLE INICIALIZACIÓN)');
    
    // Inicializar Model primero (incluye auto-limpieza)
    await Model.init();
    
    // Luego inicializar Controller
    Controller.init();
    
    console.log('✅ APP LISTA - Sin duplicados garantizado');
});

console.log('✅ Controller cargado correctamente');
