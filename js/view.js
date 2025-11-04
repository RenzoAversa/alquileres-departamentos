// ========================================
// VIEW.JS - Capa de Vista (MVC)
// Maneja todo el renderizado del DOM
// ========================================

const View = {
    // ========================================
    // ELEMENTOS DEL DOM
    // ========================================
    
    elements: {
        // Tabs
        tabButtons: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // Formularios
        formDepartamento: document.getElementById('form-departamento'),
        formReserva: document.getElementById('form-reserva'),
        formBuscar: document.getElementById('form-buscar'),
        
        // Inputs Departamento
        deptId: document.getElementById('dept-id'),
        deptNombre: document.getElementById('dept-nombre'),
        deptCapacidad: document.getElementById('dept-capacidad'),
        deptDescripcion: document.getElementById('dept-descripcion'),
        btnGuardarDept: document.getElementById('btn-guardar-dept'),
        btnCancelarDept: document.getElementById('btn-cancelar-dept'),
        
        // Inputs Reserva
        reservaId: document.getElementById('reserva-id'),
        reservaDepartamento: document.getElementById('reserva-departamento'),
        reservaHuesped: document.getElementById('reserva-huesped'),
        reservaEntrada: document.getElementById('reserva-entrada'),
        reservaSalida: document.getElementById('reserva-salida'),
        btnGuardarReserva: document.getElementById('btn-guardar-reserva'),
        btnCancelarReserva: document.getElementById('btn-cancelar-reserva'),
        
        // Inputs Búsqueda
        buscarEntrada: document.getElementById('buscar-entrada'),
        buscarSalida: document.getElementById('buscar-salida'),
        buscarCapacidad: document.getElementById('buscar-capacidad'),
        btnLimpiarBusqueda: document.getElementById('btn-limpiar-busqueda'),
        
        // Contenedores
        listaDepartamentos: document.getElementById('lista-departamentos'),
        listaReservas: document.getElementById('lista-reservas'),
        resultadosBusqueda: document.getElementById('resultados-busqueda')
    },

    // ========================================
    // RENDERIZADO DE DEPARTAMENTOS
    // ========================================
    
    /**
     * Renderizar lista de departamentos
     * @param {Array} departamentos - Lista de departamentos
     */
    renderizarDepartamentos(departamentos) {
        const container = this.elements.listaDepartamentos;
        
        if (!departamentos || departamentos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🏢</div>
                    <p>No hay departamentos registrados.</p>
                    <p class="text-muted">Agrega tu primer departamento usando el formulario anterior.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = departamentos.map(dept => `
            <div class="item-lista" data-id="${dept.id}">
                <div class="item-info">
                    <h4>${dept.nombre}</h4>
                    <p><strong>Capacidad:</strong> ${dept.capacidad} persona${dept.capacidad !== 1 ? 's' : ''}</p>
                    ${dept.descripcion ? `<p><strong>Descripción:</strong> ${dept.descripcion}</p>` : ''}
                    <span class="badge badge-primary">ID: ${dept.id.substr(0, 8)}</span>
                </div>
                <div class="item-acciones">
                    <button class="btn btn-warning btn-small btn-editar-dept" data-id="${dept.id}">
                        ✏️ Editar
                    </button>
                    <button class="btn btn-danger btn-small btn-eliminar-dept" data-id="${dept.id}">
                        🗑️ Eliminar
                    </button>
                </div>
            </div>
        `).join('');
    },

    /**
     * Cargar datos de un departamento en el formulario para editar
     * @param {Object} departamento - Datos del departamento
     */
    cargarDepartamentoEnFormulario(departamento) {
        this.elements.deptId.value = departamento.id;
        this.elements.deptNombre.value = departamento.nombre;
        this.elements.deptCapacidad.value = departamento.capacidad;
        this.elements.deptDescripcion.value = departamento.descripcion || '';
        
        this.elements.btnGuardarDept.textContent = 'Actualizar Departamento';
        this.elements.btnCancelarDept.style.display = 'inline-block';
        
        // Scroll al formulario
        this.elements.formDepartamento.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    /**
     * Limpiar formulario de departamento
     */
    limpiarFormularioDepartamento() {
        this.elements.formDepartamento.reset();
        this.elements.deptId.value = '';
        this.elements.btnGuardarDept.textContent = 'Guardar Departamento';
        this.elements.btnCancelarDept.style.display = 'none';
    },

    // ========================================
    // RENDERIZADO DE RESERVAS
    // ========================================
    
    /**
     * Renderizar lista de reservas
     * @param {Array} reservas - Lista de reservas
     * @param {Array} departamentos - Lista de departamentos para obtener nombres
     */
    renderizarReservas(reservas, departamentos) {
        const container = this.elements.listaReservas;
        
        if (!reservas || reservas.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📅</div>
                    <p>No hay reservas registradas.</p>
                    <p class="text-muted">Registra tu primera reserva usando el formulario anterior.</p>
                </div>
            `;
            return;
        }

        // Ordenar reservas por fecha de entrada (más reciente primero)
        const reservasOrdenadas = [...reservas].sort((a, b) => 
            new Date(b.fechaEntrada) - new Date(a.fechaEntrada)
        );

        container.innerHTML = reservasOrdenadas.map(reserva => {
            const departamento = departamentos.find(d => d.id === reserva.departamentoId);
            const nombreDept = departamento ? departamento.nombre : 'Departamento no encontrado';
            
            // Formatear fechas
            const fechaEntrada = this.formatearFecha(reserva.fechaEntrada);
            const fechaSalida = this.formatearFecha(reserva.fechaSalida);
            
            // Verificar si la reserva está activa, pasada o futura
            const hoy = new Date();
            const entrada = new Date(reserva.fechaEntrada);
            const salida = new Date(reserva.fechaSalida);
            
            let estadoBadge = '';
            if (hoy >= entrada && hoy <= salida) {
                estadoBadge = '<span class="badge badge-success">Activa</span>';
            } else if (hoy > salida) {
                estadoBadge = '<span class="badge">Finalizada</span>';
            } else {
                estadoBadge = '<span class="badge badge-warning">Próxima</span>';
            }
            
            return `
                <div class="item-lista" data-id="${reserva.id}">
                    <div class="item-info">
                        <h4>${reserva.huesped}</h4>
                        <p><strong>Departamento:</strong> ${nombreDept}</p>
                        <p><strong>Entrada:</strong> ${fechaEntrada} | <strong>Salida:</strong> ${fechaSalida}</p>
                        ${estadoBadge}
                    </div>
                    <div class="item-acciones">
                        <button class="btn btn-warning btn-small btn-editar-reserva" data-id="${reserva.id}">
                            ✏️ Editar
                        </button>
                        <button class="btn btn-danger btn-small btn-eliminar-reserva" data-id="${reserva.id}">
                            🗑️ Eliminar
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Llenar el select de departamentos en el formulario de reserva
     * @param {Array} departamentos - Lista de departamentos
     */
    llenarSelectDepartamentos(departamentos) {
        const select = this.elements.reservaDepartamento;
        
        select.innerHTML = '<option value="">Seleccione un departamento</option>';
        
        departamentos.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = `${dept.nombre} (Capacidad: ${dept.capacidad})`;
            select.appendChild(option);
        });
    },

    /**
     * Cargar datos de una reserva en el formulario para editar
     * @param {Object} reserva - Datos de la reserva
     */
    cargarReservaEnFormulario(reserva) {
        this.elements.reservaId.value = reserva.id;
        this.elements.reservaDepartamento.value = reserva.departamentoId;
        this.elements.reservaHuesped.value = reserva.huesped;
        this.elements.reservaEntrada.value = reserva.fechaEntrada;
        this.elements.reservaSalida.value = reserva.fechaSalida;
        
        this.elements.btnGuardarReserva.textContent = 'Actualizar Reserva';
        this.elements.btnCancelarReserva.style.display = 'inline-block';
        
        // Scroll al formulario
        this.elements.formReserva.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    /**
     * Limpiar formulario de reserva
     */
    limpiarFormularioReserva() {
        this.elements.formReserva.reset();
        this.elements.reservaId.value = '';
        this.elements.btnGuardarReserva.textContent = 'Guardar Reserva';
        this.elements.btnCancelarReserva.style.display = 'none';
    },

    // ========================================
    // RENDERIZADO DE BÚSQUEDA
    // ========================================
    
    /**
     * Renderizar resultados de búsqueda
     * @param {Array} departamentos - Departamentos disponibles
     * @param {Object} criterios - Criterios usados en la búsqueda
     */
    renderizarResultadosBusqueda(departamentos, criterios) {
        const container = this.elements.resultadosBusqueda;
        
        if (!departamentos || departamentos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">❌</div>
                    <p>No se encontraron departamentos disponibles con los criterios especificados.</p>
                </div>
            `;
            return;
        }

        const criterioBusqueda = this.construirTextocriterio(criterios);

        container.innerHTML = `
            <div class="alert alert-success">
                <strong>✅ ${departamentos.length} departamento${departamentos.length !== 1 ? 's' : ''} disponible${departamentos.length !== 1 ? 's' : ''}</strong>
                ${criterioBusqueda}
            </div>
            ${departamentos.map(dept => `
                <div class="resultado-item">
                    <h4>🏢 ${dept.nombre}</h4>
                    <p><strong>Capacidad:</strong> ${dept.capacidad} persona${dept.capacidad !== 1 ? 's' : ''}</p>
                    ${dept.descripcion ? `<p><strong>Descripción:</strong> ${dept.descripcion}</p>` : ''}
                    <p class="disponible">✅ Disponible</p>
                </div>
            `).join('')}
        `;
    },

    /**
     * Construir texto descriptivo de los criterios de búsqueda
     * @param {Object} criterios - Criterios de búsqueda
     * @returns {string} Texto descriptivo
     */
    construirTextocriterio(criterios) {
        const partes = [];
        
        if (criterios.fechaEntrada && criterios.fechaSalida) {
            partes.push(`del ${this.formatearFecha(criterios.fechaEntrada)} al ${this.formatearFecha(criterios.fechaSalida)}`);
        }
        
        if (criterios.capacidad) {
            partes.push(`capacidad mínima de ${criterios.capacidad} persona${criterios.capacidad !== '1' ? 's' : ''}`);
        }
        
        return partes.length > 0 ? `<br><small>Búsqueda: ${partes.join(', ')}</small>` : '';
    },

    // ========================================
    // TABS
    // ========================================
    
    /**
     * Cambiar a un tab específico
     * @param {string} tabName - Nombre del tab a mostrar
     */
    cambiarTab(tabName) {
        // Actualizar botones
        this.elements.tabButtons.forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Actualizar contenido
        this.elements.tabContents.forEach(content => {
            if (content.id === `tab-${tabName}`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    },

    // ========================================
    // ALERTAS Y MENSAJES
    // ========================================
    
    /**
     * Mostrar alerta temporal
     * @param {string} mensaje - Mensaje a mostrar
     * @param {string} tipo - Tipo de alerta: success, error, warning, info
     * @param {number} duracion - Duración en milisegundos (por defecto 4000)
     */
    mostrarAlerta(mensaje, tipo = 'info', duracion = 4000) {
        const alerta = document.createElement('div');
        alerta.className = `alert alert-${tipo}`;
        alerta.textContent = mensaje;
        alerta.style.position = 'fixed';
        alerta.style.top = '20px';
        alerta.style.right = '20px';
        alerta.style.zIndex = '10000';
        alerta.style.maxWidth = '400px';
        alerta.style.animation = 'slideIn 0.3s ease';
        
        document.body.appendChild(alerta);
        
        setTimeout(() => {
            alerta.style.opacity = '0';
            alerta.style.transition = 'opacity 0.3s ease';
            setTimeout(() => alerta.remove(), 300);
        }, duracion);
    },

    /**
     * Confirmar acción con el usuario
     * @param {string} mensaje - Mensaje de confirmación
     * @returns {boolean} true si el usuario confirma
     */
    confirmar(mensaje) {
        return confirm(mensaje);
    },

    // ========================================
    // UTILIDADES
    // ========================================
    
    /**
     * Formatear fecha de YYYY-MM-DD a formato legible
     * @param {string} fechaISO - Fecha en formato ISO
     * @returns {string} Fecha formateada
     */
    formatearFecha(fechaISO) {
        const fecha = new Date(fechaISO + 'T00:00:00');
        const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
        return fecha.toLocaleDateString('es-ES', opciones);
    },

    /**
     * Obtener fecha de hoy en formato YYYY-MM-DD
     * @returns {string} Fecha de hoy
     */
    obtenerFechaHoy() {
        const hoy = new Date();
        return hoy.toISOString().split('T')[0];
    },

    /**
     * Establecer fecha mínima en inputs de fecha
     */
    configurarFechasMinimas() {
        const hoy = this.obtenerFechaHoy();
        this.elements.reservaEntrada.min = hoy;
        this.elements.reservaSalida.min = hoy;
        this.elements.buscarEntrada.min = hoy;
        this.elements.buscarSalida.min = hoy;
    }
};

console.log('✅ View cargado correctamente');
