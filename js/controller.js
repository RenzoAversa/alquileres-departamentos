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
        
        // Configurar fechas mínimas
        View.configurarFechasMinimas();
        
        // Renderizar datos iniciales
        this.actualizarVistaDepartamentos();
        this.actualizarVistaReservas();
        
        console.log('✅ Controller inicializado correctamente');
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
        }

        // Botones de navegación
        const btnPrevMes = document.getElementById('btn-prev-mes');
        const btnNextMes = document.getElementById('btn-next-mes');
        const btnHoy = document.getElementById('btn-hoy');

        if (btnPrevMes) {
            btnPrevMes.addEventListener('click', () => {
                this.cambiarMesCalendario(-1);
            });
        }

        if (btnNextMes) {
            btnNextMes.addEventListener('click', () => {
                this.cambiarMesCalendario(1);
            });
        }

        if (btnHoy) {
            btnHoy.addEventListener('click', () => {
                const selectDept = document.getElementById('calendario-departamento');
                if (selectDept && selectDept.value) {
                    this.calendarioActual = {
                        departamentoId: selectDept.value,
                        anio: new Date().getFullYear(),
                        mes: new Date().getMonth()
                    };
                    this.actualizarCalendario(selectDept.value);
                } else {
                    View.mostrarAlerta('Selecciona un departamento primero', 'info');
                }
            });
        }
    },

    /**
     * Actualizar el calendario para un departamento
     * @param {string} departamentoId - ID del departamento
     */
    actualizarCalendario(departamentoId) {
        if (!this.calendarioActual) {
            this.calendarioActual = {
                departamentoId: departamentoId,
                anio: new Date().getFullYear(),
                mes: new Date().getMonth()
            };
        } else {
            this.calendarioActual.departamentoId = departamentoId;
        }

        const departamento = Model.obtenerDepartamentoPorId(departamentoId);
        if (!departamento) {
            View.mostrarAlerta('Departamento no encontrado', 'error');
            return;
        }

        const reservas = Model.obtenerReservasPorDepartamento(departamentoId);
        
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
        if (!this.calendarioActual || !this.calendarioActual.departamentoId) {
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

        this.actualizarCalendario(this.calendarioActual.departamentoId);
    },

    /**
     * Inicializar calendario cuando se cambia a la pestaña
     */
    inicializarCalendario() {
        const departamentos = Model.obtenerDepartamentos();
        View.llenarSelectCalendario(departamentos);
        
        if (departamentos.length === 0) {
            View.mostrarAlerta('No hay departamentos registrados. Crea uno primero.', 'info');
        } else {
            View.mostrarMensajeCalendarioVacio();
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
document.addEventListener('DOMContentLoaded', () => {
    Controller.init();
});

console.log('✅ Controller cargado correctamente');
