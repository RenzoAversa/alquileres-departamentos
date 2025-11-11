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
        resultadosBusqueda: document.getElementById('resultados-busqueda'),
        
        // Botones de recargar
        btnRefreshDepartamentos: document.getElementById('btn-refresh-departamentos'),
        btnRefreshReservas: document.getElementById('btn-refresh-reservas'),
        
        // Loading buttons
        loadingDepartamentos: document.getElementById('loading-departamentos'),
        loadingReservas: document.getElementById('loading-reservas')
    },

    // ========================================
    // RENDERIZADO DE DEPARTAMENTOS
    // ========================================
    
    /**
     * Renderizar lista de departamentos
     * @param {Array} departamentos - Lista de departamentos
     */
    renderizarDepartamentos(departamentos) {
        console.log(`🎨 Renderizando ${departamentos.length} departamentos`);
        const container = this.elements.listaDepartamentos;
        
        if (!departamentos || departamentos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🏢</div>
                    <p>No hay departamentos registrados.</p>
                    <p class="text-muted">Agrega tu primer departamento usando el formulario anterior.</p>
                </div>
            `;
            this.ocultarLoadingDepartamentos();
            return;
        }

        // ELIMINAR DUPLICADOS ANTES DE RENDERIZAR (por si acaso)
        const idsVistos = new Set();
        const departamentosUnicos = [];
        
        departamentos.forEach(dept => {
            if (!idsVistos.has(dept.id)) {
                idsVistos.add(dept.id);
                departamentosUnicos.push(dept);
            }
        });

        // Si había duplicados, avisar en consola
        if (departamentos.length !== departamentosUnicos.length) {
            console.warn(`🛡️ Vista: Bloqueados ${departamentos.length - departamentosUnicos.length} duplicado(s) en renderizado`);
        }

        container.innerHTML = departamentosUnicos.map(dept => `
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
        
        // Ocultar loading
        this.ocultarLoadingDepartamentos();
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
        console.log(`🎨 Renderizando ${reservas.length} reservas`);
        const container = this.elements.listaReservas;
        
        if (!departamentos || departamentos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🏢</div>
                    <p>No hay departamentos registrados.</p>
                    <p class="text-muted">Debes crear departamentos antes de poder ver reservas.</p>
                </div>
            `;
            this.ocultarLoadingReservas();
            return;
        }

        // ELIMINAR DUPLICADOS ANTES DE RENDERIZAR (por si acaso)
        const idsVistos = new Set();
        const reservasUnicas = [];
        
        reservas.forEach(res => {
            if (!idsVistos.has(res.id)) {
                idsVistos.add(res.id);
                reservasUnicas.push(res);
            }
        });

        // Si había duplicados, avisar en consola
        if (reservas.length !== reservasUnicas.length) {
            console.warn(`🛡️ Vista: Bloqueados ${reservas.length - reservasUnicas.length} reserva(s) duplicada(s) en renderizado`);
        }

        // Agrupar reservas por departamento
        const reservasPorDepartamento = {};
        
        departamentos.forEach(dept => {
            reservasPorDepartamento[dept.id] = {
                departamento: dept,
                reservas: []
            };
        });

        // Asignar reservas a cada departamento
        reservasUnicas.forEach(reserva => {
            if (reservasPorDepartamento[reserva.departamentoId]) {
                reservasPorDepartamento[reserva.departamentoId].reservas.push(reserva);
            }
        });

        // Ordenar departamentos por nombre
        const departamentosOrdenados = departamentos.sort((a, b) => 
            a.nombre.localeCompare(b.nombre)
        );

        // Renderizar por departamento
        let html = '';

        departamentosOrdenados.forEach(dept => {
            const grupo = reservasPorDepartamento[dept.id];
            const reservasDept = grupo.reservas;

            // Ordenar reservas de este departamento por fecha de entrada (más reciente primero)
            const reservasOrdenadas = [...reservasDept].sort((a, b) => 
                new Date(b.fechaEntrada) - new Date(a.fechaEntrada)
            );

            html += `
                <div class="reservas-departamento">
                    <h3 class="departamento-titulo">🏢 ${dept.nombre}</h3>
            `;

            if (reservasOrdenadas.length === 0) {
                html += `
                    <div class="empty-state-small">
                        <p>No hay reservas para este departamento.</p>
                    </div>
                `;
            } else {
                reservasOrdenadas.forEach(reserva => {
                    // Formatear fechas
                    const fechaEntrada = this.formatearFecha(reserva.fechaEntrada);
                    const fechaSalida = this.formatearFecha(reserva.fechaSalida);
                    
                    // Verificar si la reserva está activa, pasada o futura
                    // Normalizar las fechas a medianoche para comparar solo días
                    const hoy = new Date();
                    hoy.setHours(0, 0, 0, 0);
                    
                    const entrada = new Date(reserva.fechaEntrada);
                    entrada.setHours(0, 0, 0, 0);
                    
                    const salida = new Date(reserva.fechaSalida);
                    salida.setHours(0, 0, 0, 0);
                    
                    let estadoBadge = '';
                    if (hoy >= entrada && hoy <= salida) {
                        estadoBadge = '<span class="badge badge-success">Activa</span>';
                    } else if (hoy > salida) {
                        estadoBadge = '<span class="badge badge-danger">Finalizada</span>';
                    } else {
                        estadoBadge = '<span class="badge badge-warning">Próxima</span>';
                    }
                    
                    html += `
                        <div class="item-lista" data-id="${reserva.id}">
                            <div class="item-info">
                                <h4>${reserva.huesped}</h4>
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
                });
            }

            html += '</div>';
        });

        container.innerHTML = html;
        
        // Ocultar loading
        this.ocultarLoadingReservas();
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
     * @param {Object} resultado - Objeto con arrays de disponibles y noDisponibles
     * @param {Object} criterios - Criterios usados en la búsqueda
     */
    renderizarResultadosBusqueda(resultado, criterios) {
        const container = this.elements.resultadosBusqueda;
        
        // Si resultado es un array (retrocompatibilidad), convertirlo al nuevo formato
        if (Array.isArray(resultado)) {
            resultado = { disponibles: resultado, noDisponibles: [] };
        }

        const { disponibles, noDisponibles } = resultado;
        const total = disponibles.length + noDisponibles.length;

        if (total === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">❌</div>
                    <p>No se encontraron departamentos con los criterios especificados.</p>
                </div>
            `;
            return;
        }

        const criterioBusqueda = this.construirTextocriterio(criterios);

        let html = `
            <div class="alert alert-info">
                <strong>📊 Resultados: ${total} departamento${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}</strong>
                ${criterioBusqueda}
            </div>
        `;

        // Departamentos disponibles
        if (disponibles.length > 0) {
            html += `
                <div class="alert alert-success">
                    <strong>✅ ${disponibles.length} departamento${disponibles.length !== 1 ? 's' : ''} disponible${disponibles.length !== 1 ? 's' : ''}</strong>
                </div>
                ${disponibles.map(dept => `
                    <button class="resultado-item resultado-btn" 
                            data-dept-id="${dept.id}" 
                            data-fecha-entrada="${criterios.fechaEntrada || ''}" 
                            data-fecha-salida="${criterios.fechaSalida || ''}"
                            style="border-left: 4px solid #28a745; width: 100%; text-align: left; background: white; cursor: pointer; transition: all 0.3s;">
                        <h4>🏢 ${dept.nombre}</h4>
                        <p><strong>Capacidad:</strong> ${dept.capacidad} persona${dept.capacidad !== 1 ? 's' : ''}</p>
                        ${dept.descripcion ? `<p><strong>Descripción:</strong> ${dept.descripcion}</p>` : ''}
                        <p class="disponible">✅ Disponible - Click para ver en calendario</p>
                    </button>
                `).join('')}
            `;
        }

        // Departamentos no disponibles
        if (noDisponibles.length > 0) {
            html += `
                <div class="alert alert-danger" style="margin-top: 30px;">
                    <strong>❌ ${noDisponibles.length} departamento${noDisponibles.length !== 1 ? 's' : ''} no disponible${noDisponibles.length !== 1 ? 's' : ''}</strong>
                </div>
                ${noDisponibles.map(dept => `
                    <button class="resultado-item resultado-btn" 
                            data-dept-id="${dept.id}" 
                            data-fecha-entrada="${criterios.fechaEntrada || ''}" 
                            data-fecha-salida="${criterios.fechaSalida || ''}"
                            style="border-left: 4px solid #dc3545; background-color: #fff5f5; width: 100%; text-align: left; cursor: pointer; transition: all 0.3s;">
                        <h4>🏢 ${dept.nombre}</h4>
                        <p><strong>Capacidad:</strong> ${dept.capacidad} persona${dept.capacidad !== 1 ? 's' : ''}</p>
                        ${dept.descripcion ? `<p><strong>Descripción:</strong> ${dept.descripcion}</p>` : ''}
                        <div class="no-disponible">
                            <p style="color: #dc3545; font-weight: bold; margin-bottom: 10px;">❌ No disponible - Reservas existentes:</p>
                            <ul style="margin: 0; padding-left: 20px; color: #721c24;">
                                ${dept.reservasConflicto.map(reserva => {
                                    const entrada = this.formatearFecha(reserva.fechaEntrada);
                                    const salida = this.formatearFecha(reserva.fechaSalida);
                                    return `<li><strong>${reserva.huesped}</strong> - Del ${entrada} al ${salida}</li>`;
                                }).join('')}
                            </ul>
                            <p style="margin-top: 10px; font-style: italic; color: #6c757d;">Click para ver en calendario</p>
                        </div>
                    </button>
                `).join('')}
            `;
        }

        container.innerHTML = html;
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
    },

    // ========================================
    // CALENDARIO
    // ========================================

    /**
     * Renderizar calendario para un mes específico
     * @param {string} departamentoId - ID del departamento
     * @param {number} anio - Año
     * @param {number} mes - Mes (0-11)
     * @param {Object} rangoFechas - Opcional: objeto con fechaEntrada y fechaSalida para resaltar
     */
    renderizarCalendario(departamentoId, anio, mes, rangoFechas = null) {
        const container = document.getElementById('calendario-grid');
        if (!container) return;

        // Obtener información del mes
        const primerDia = new Date(anio, mes, 1);
        const ultimoDia = new Date(anio, mes + 1, 0);
        const diasEnMes = ultimoDia.getDate();
        const primerDiaSemana = primerDia.getDay(); // 0 = Domingo
        
        // Obtener reservas del mes
        const fechasReservadas = Model.obtenerReservasPorMes(departamentoId, anio, mes);
        
        // Fecha de hoy (mejorada para evitar problemas de zona horaria)
        const ahora = new Date();
        const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        
        // Procesar rango de fechas de búsqueda si existe
        let fechaEntradaBusqueda = null;
        let fechaSalidaBusqueda = null;
        if (rangoFechas && rangoFechas.fechaEntrada && rangoFechas.fechaSalida) {
            // Parsear las fechas correctamente evitando problemas de zona horaria
            // El formato esperado es "YYYY-MM-DD"
            const [anioE, mesE, diaE] = rangoFechas.fechaEntrada.split('-').map(Number);
            const [anioS, mesS, diaS] = rangoFechas.fechaSalida.split('-').map(Number);
            
            // Crear fechas en hora local (mes es 0-indexed)
            fechaEntradaBusqueda = new Date(anioE, mesE - 1, diaE);
            fechaSalidaBusqueda = new Date(anioS, mesS - 1, diaS);
            
            console.log('🔍 Resaltando rango de búsqueda:', {
                entradaOriginal: rangoFechas.fechaEntrada,
                entrada: fechaEntradaBusqueda.toDateString(),
                entradaTime: fechaEntradaBusqueda.getTime(),
                salidaOriginal: rangoFechas.fechaSalida,
                salida: fechaSalidaBusqueda.toDateString(),
                salidaTime: fechaSalidaBusqueda.getTime()
            });
        }
        
        console.log('📅 Renderizando calendario:', { 
            departamentoId, 
            anio, 
            mes, 
            hoy: hoy.toDateString(),
            hoyDetalle: {
                año: hoy.getFullYear(),
                mes: hoy.getMonth(),
                dia: hoy.getDate()
            },
            calendarioDetalle: { anio, mes }
        });

        // Actualizar el título del mes
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const mesActualElement = document.getElementById('mes-actual');
        if (mesActualElement) {
            mesActualElement.textContent = `${meses[mes]} ${anio}`;
        }

        // Limpiar el contenedor
        container.innerHTML = '';

        // Añadir headers de días
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        diasSemana.forEach(dia => {
            const header = document.createElement('div');
            header.className = 'dia-header';
            header.textContent = dia;
            container.appendChild(header);
        });

        // Añadir días vacíos al inicio
        for (let i = 0; i < primerDiaSemana; i++) {
            const diaVacio = document.createElement('div');
            diaVacio.className = 'dia otro-mes';
            container.appendChild(diaVacio);
        }

        // Añadir días del mes
        for (let dia = 1; dia <= diasEnMes; dia++) {
            const diaElement = document.createElement('div');
            diaElement.className = 'dia';
            
            // Crear span para el número del día
            const numeroDia = document.createElement('span');
            numeroDia.className = 'numero-dia';
            numeroDia.textContent = dia;
            diaElement.appendChild(numeroDia);

            // Verificar si es hoy (comparación mejorada)
            const fechaActual = new Date(anio, mes, dia);
            const esHoy = fechaActual.getFullYear() === hoy.getFullYear() && 
                         fechaActual.getMonth() === hoy.getMonth() && 
                         fechaActual.getDate() === hoy.getDate();
            
            console.log(`🔍 Comparando día ${dia}:`, {
                fechaActual: fechaActual.toDateString(),
                esHoy,
                comparacion: {
                    años: `${fechaActual.getFullYear()} === ${hoy.getFullYear()}`,
                    meses: `${fechaActual.getMonth()} === ${hoy.getMonth()}`,
                    dias: `${fechaActual.getDate()} === ${hoy.getDate()}`
                }
            });
            
            if (esHoy) {
                diaElement.classList.add('hoy');
                console.log('� ¡Día HOY detectado y clase agregada!:', dia);
            }

            // Verificar si está reservado
            const clave = `${anio}-${mes}-${dia}`;
            console.log('🔍 Buscando reserva para:', clave);
            
            if (fechasReservadas.has(clave)) {
                const reservaInfo = fechasReservadas.get(clave);
                console.log('📅 Reserva encontrada:', reservaInfo);
                
                diaElement.classList.add('reservado');
                
                if (reservaInfo.tipo === 'inicio') {
                    diaElement.classList.add('inicio-reserva');
                    console.log('🔴 Inicio reserva:', dia);
                } else if (reservaInfo.tipo === 'fin') {
                    diaElement.classList.add('fin-reserva');
                    console.log('🟠 Fin reserva:', dia);
                }

                // Añadir tooltip (para desktop)
                const tooltip = document.createElement('div');
                tooltip.className = 'dia-tooltip';
                tooltip.textContent = `Reservado: ${reservaInfo.huesped}`;
                diaElement.appendChild(tooltip);
                
                // Añadir etiqueta visible para móvil
                const etiquetaHuesped = document.createElement('span');
                etiquetaHuesped.className = 'etiqueta-huesped';
                // Usar iniciales o nombre corto
                const nombreCorto = reservaInfo.huesped.length > 10 
                    ? reservaInfo.huesped.substring(0, 8) + '...'
                    : reservaInfo.huesped;
                etiquetaHuesped.textContent = nombreCorto;
                etiquetaHuesped.title = reservaInfo.huesped; // Tooltip nativo
                diaElement.appendChild(etiquetaHuesped);
            } else if (fechaActual >= hoy) {
                diaElement.classList.add('disponible');
            }

            // Resaltar rango de fechas de búsqueda
            if (fechaEntradaBusqueda && fechaSalidaBusqueda) {
                const fechaActualNorm = new Date(anio, mes, dia);
                
                if (fechaActualNorm >= fechaEntradaBusqueda && fechaActualNorm <= fechaSalidaBusqueda) {
                    diaElement.classList.add('rango-busqueda');
                    
                    // Agregar borde especial para inicio y fin del rango
                    const esEntrada = fechaActualNorm.getTime() === fechaEntradaBusqueda.getTime();
                    const esSalida = fechaActualNorm.getTime() === fechaSalidaBusqueda.getTime();
                    
                    console.log(`📅 Día ${dia}: fechaActual=${fechaActualNorm.getTime()}, entrada=${fechaEntradaBusqueda.getTime()}, salida=${fechaSalidaBusqueda.getTime()}, esEntrada=${esEntrada}, esSalida=${esSalida}`);
                    
                    if (esEntrada) {
                        diaElement.classList.add('inicio-busqueda');
                        console.log('🟢 Agregando ENTRADA al día:', dia, fechaActualNorm);
                        // Agregar etiqueta ENTRADA como elemento HTML
                        const etiqueta = document.createElement('span');
                        etiqueta.className = 'etiqueta-fecha';
                        etiqueta.textContent = 'ENTRADA';
                        diaElement.appendChild(etiqueta);
                        console.log('✅ Etiqueta ENTRADA agregada. Hijos del dia:', diaElement.children.length);
                    }
                    if (esSalida) {
                        diaElement.classList.add('fin-busqueda');
                        console.log('🟠 Agregando SALIDA al día:', dia, fechaActualNorm);
                        // Agregar etiqueta SALIDA como elemento HTML
                        const etiqueta = document.createElement('span');
                        etiqueta.className = 'etiqueta-fecha';
                        etiqueta.textContent = 'SALIDA';
                        diaElement.appendChild(etiqueta);
                        console.log('✅ Etiqueta SALIDA agregada. Hijos del dia:', diaElement.children.length);
                    }
                }
            }

            container.appendChild(diaElement);
        }
    },

    /**
     * Llenar el select de departamentos en el calendario
     * @param {Array} departamentos - Lista de departamentos
     */
    llenarSelectCalendario(departamentos) {
        const select = document.getElementById('calendario-departamento');
        if (!select) return;

        select.innerHTML = '<option value="">Seleccione un departamento</option>';
        
        departamentos.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.nombre;
            select.appendChild(option);
        });
    },

    /**
     * Actualizar información del calendario
     * @param {Object} departamento - Datos del departamento
     * @param {number} totalReservas - Total de reservas del departamento
     */
    actualizarInfoCalendario(departamento, totalReservas) {
        const infoElement = document.getElementById('calendario-info-texto');
        if (!infoElement || !departamento) return;

        infoElement.innerHTML = `
            <p><strong>Departamento:</strong> ${departamento.nombre}</p>
            <p><strong>Capacidad:</strong> ${departamento.capacidad} persona${departamento.capacidad !== 1 ? 's' : ''}</p>
            <p><strong>Total de reservas:</strong> ${totalReservas}</p>
        `;
    },

    /**
     * Mostrar mensaje cuando no hay departamento seleccionado
     */
    mostrarMensajeCalendarioVacio() {
        const container = document.getElementById('calendario-grid');
        if (!container) return;

        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
                <div class="empty-state">
                    <div class="icon">📅</div>
                    <p>Selecciona un departamento para ver su calendario de disponibilidad</p>
                </div>
            </div>
        `;

        const infoElement = document.getElementById('calendario-info-texto');
        if (infoElement) {
            infoElement.innerHTML = '<p class="text-muted">Selecciona un departamento del menú desplegable</p>';
        }
    },

    // ========================================
    // FUNCIONES DE LOADING
    // ========================================

    /**
     * Mostrar loading para departamentos
     */
    mostrarLoadingDepartamentos() {
        if (this.elements.loadingDepartamentos) {
            this.elements.loadingDepartamentos.classList.remove('hidden');
        }
        if (this.elements.listaDepartamentos) {
            this.elements.listaDepartamentos.style.display = 'none';
        }
        if (this.elements.btnRefreshDepartamentos) {
            this.elements.btnRefreshDepartamentos.classList.add('loading');
            this.elements.btnRefreshDepartamentos.disabled = true;
        }
    },

    /**
     * Ocultar loading para departamentos
     */
    ocultarLoadingDepartamentos() {
        if (this.elements.loadingDepartamentos) {
            this.elements.loadingDepartamentos.classList.add('hidden');
        }
        if (this.elements.listaDepartamentos) {
            this.elements.listaDepartamentos.style.display = 'block';
        }
        if (this.elements.btnRefreshDepartamentos) {
            this.elements.btnRefreshDepartamentos.classList.remove('loading');
            this.elements.btnRefreshDepartamentos.disabled = false;
        }
    },

    /**
     * Mostrar loading para reservas
     */
    mostrarLoadingReservas() {
        if (this.elements.loadingReservas) {
            this.elements.loadingReservas.classList.remove('hidden');
        }
        if (this.elements.listaReservas) {
            this.elements.listaReservas.style.display = 'none';
        }
        if (this.elements.btnRefreshReservas) {
            this.elements.btnRefreshReservas.classList.add('loading');
            this.elements.btnRefreshReservas.disabled = true;
        }
    },

    /**
     * Ocultar loading para reservas
     */
    ocultarLoadingReservas() {
        if (this.elements.loadingReservas) {
            this.elements.loadingReservas.classList.add('hidden');
        }
        if (this.elements.listaReservas) {
            this.elements.listaReservas.style.display = 'block';
        }
        if (this.elements.btnRefreshReservas) {
            this.elements.btnRefreshReservas.classList.remove('loading');
            this.elements.btnRefreshReservas.disabled = false;
        }
    }
};

console.log('✅ View cargado correctamente');
