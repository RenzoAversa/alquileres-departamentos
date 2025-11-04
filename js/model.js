// ========================================
// MODEL.JS - Capa de Modelo (MVC)
// Maneja toda la lógica de datos con Firebase Firestore
// ========================================

const Model = {
    // Estado de Firebase
    useFirebase: false,
    db: null,
    firebaseApp: null,
    sincronizandoFirebase: false, // Bandera para evitar loops

    // ========================================
    // INICIALIZACIÓN
    // ========================================
    
    /**
     * Inicializar el modelo (LocalStorage y Firebase)
     */
    async init() {
        // Inicializar LocalStorage
        if (!localStorage.getItem('departamentos')) {
            localStorage.setItem('departamentos', JSON.stringify([]));
        }
        if (!localStorage.getItem('reservas')) {
            localStorage.setItem('reservas', JSON.stringify([]));
        }

        // Intentar inicializar Firebase
        try {
            await this.initFirebase();
        } catch (error) {
            console.warn('⚠️ Firebase no configurado, usando solo LocalStorage:', error.message);
        }
    },

    /**
     * Inicializar Firebase
     */
    async initFirebase() {
        // Verificar si existe la configuración
        if (!window.firebaseConfig || window.firebaseConfig.apiKey === "TU_API_KEY_AQUI") {
            throw new Error('Firebase no configurado. Ver SETUP-FIREBASE.md');
        }

        try {
            // Importar Firebase desde CDN
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot } = 
                await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Inicializar Firebase
            this.firebaseApp = initializeApp(window.firebaseConfig);
            this.db = getFirestore(this.firebaseApp);
            this.useFirebase = true;

            // Guardar funciones de Firestore
            this.firestore = { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot };

            console.log('✅ Firebase inicializado correctamente');

            // Sincronizar datos al iniciar
            await this.sincronizarDesdeFirebase();

            // Escuchar cambios en tiempo real
            this.escucharCambiosFirebase();

        } catch (error) {
            console.error('❌ Error al inicializar Firebase:', error);
            throw error;
        }
    },

    /**
     * Sincronizar datos desde Firebase a LocalStorage
     */
    async sincronizarDesdeFirebase() {
        if (!this.useFirebase) return;

        try {
            // Obtener departamentos
            const deptsSnapshot = await this.firestore.getDocs(
                this.firestore.collection(this.db, 'departamentos')
            );
            const departamentos = deptsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Obtener reservas
            const reservasSnapshot = await this.firestore.getDocs(
                this.firestore.collection(this.db, 'reservas')
            );
            const reservas = reservasSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Guardar en LocalStorage
            localStorage.setItem('departamentos', JSON.stringify(departamentos));
            localStorage.setItem('reservas', JSON.stringify(reservas));

            console.log('🔄 Datos sincronizados desde Firebase');
        } catch (error) {
            console.error('❌ Error al sincronizar desde Firebase:', error);
        }
    },

    /**
     * Escuchar cambios en tiempo real de Firebase
     */
    escucharCambiosFirebase() {
        if (!this.useFirebase) return;

        // Escuchar departamentos
        this.firestore.onSnapshot(
            this.firestore.collection(this.db, 'departamentos'),
            (snapshot) => {
                // Evitar actualizar durante sincronización inicial
                if (this.sincronizandoFirebase) return;

                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added" || change.type === "modified") {
                        const departamentos = this.obtenerDepartamentos();
                        const index = departamentos.findIndex(d => d.id === change.doc.id);
                        const newDept = { id: change.doc.id, ...change.doc.data() };
                        
                        if (index >= 0) {
                            departamentos[index] = newDept;
                        } else {
                            departamentos.push(newDept);
                        }
                        
                        localStorage.setItem('departamentos', JSON.stringify(departamentos));
                    } else if (change.type === "removed") {
                        const departamentos = this.obtenerDepartamentos();
                        const filtered = departamentos.filter(d => d.id !== change.doc.id);
                        localStorage.setItem('departamentos', JSON.stringify(filtered));
                    }
                });
                
                // Notificar a la vista si existe
                if (window.Controller && window.Controller.actualizarVistaDepartamentos) {
                    window.Controller.actualizarVistaDepartamentos();
                }
            }
        );

        // Escuchar reservas
        this.firestore.onSnapshot(
            this.firestore.collection(this.db, 'reservas'),
            (snapshot) => {
                // Evitar actualizar durante sincronización inicial
                if (this.sincronizandoFirebase) return;

                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added" || change.type === "modified") {
                        const reservas = this.obtenerReservas();
                        const index = reservas.findIndex(r => r.id === change.doc.id);
                        const newReserva = { id: change.doc.id, ...change.doc.data() };
                        
                        if (index >= 0) {
                            reservas[index] = newReserva;
                        } else {
                            reservas.push(newReserva);
                        }
                        
                        localStorage.setItem('reservas', JSON.stringify(reservas));
                    } else if (change.type === "removed") {
                        const reservas = this.obtenerReservas();
                        const filtered = reservas.filter(r => r.id !== change.doc.id);
                        localStorage.setItem('reservas', JSON.stringify(filtered));
                    }
                });
                
                // Notificar a la vista si existe
                if (window.Controller && window.Controller.actualizarVistaReservas) {
                    window.Controller.actualizarVistaReservas();
                }
            }
        );

        console.log('👂 Escuchando cambios en tiempo real de Firebase');
    },

    // ========================================
    // CRUD DEPARTAMENTOS
    // ========================================
    
    /**
     * Obtener todos los departamentos
     * @returns {Array} Lista de departamentos
     */
    obtenerDepartamentos() {
        return JSON.parse(localStorage.getItem('departamentos')) || [];
    },

    /**
     * Obtener un departamento por ID
     * @param {string} id - ID del departamento
     * @returns {Object|null} Departamento encontrado o null
     */
    obtenerDepartamentoPorId(id) {
        const departamentos = this.obtenerDepartamentos();
        return departamentos.find(dept => dept.id === id) || null;
    },

    /**
     * Crear un nuevo departamento
     * @param {Object} departamento - Datos del departamento
     * @returns {Object} Departamento creado
     */
    async crearDepartamento(departamento) {
        const nuevoDepartamento = {
            nombre: departamento.nombre.trim(),
            capacidad: parseInt(departamento.capacidad),
            descripcion: departamento.descripcion?.trim() || '',
            fechaCreacion: new Date().toISOString()
        };
        
        // Sincronizar con Firebase primero si está habilitado
        if (this.useFirebase) {
            try {
                const docRef = await this.firestore.addDoc(
                    this.firestore.collection(this.db, 'departamentos'),
                    nuevoDepartamento
                );
                // Usar el ID de Firebase como ID único
                nuevoDepartamento.id = docRef.id;
                console.log('🔥 Departamento guardado en Firebase:', docRef.id);
            } catch (error) {
                console.error('❌ Error al guardar en Firebase:', error);
                // Si falla Firebase, usar ID local
                nuevoDepartamento.id = this.generarId();
            }
        } else {
            // Si no hay Firebase, usar ID local
            nuevoDepartamento.id = this.generarId();
        }

        // Guardar en localStorage
        const departamentos = this.obtenerDepartamentos();
        departamentos.push(nuevoDepartamento);
        localStorage.setItem('departamentos', JSON.stringify(departamentos));
        
        return nuevoDepartamento;
    },

    /**
     * Actualizar un departamento existente
     * @param {string} id - ID del departamento
     * @param {Object} datosActualizados - Nuevos datos
     * @returns {Object|null} Departamento actualizado o null
     */
    async actualizarDepartamento(id, datosActualizados) {
        const departamentos = this.obtenerDepartamentos();
        const index = departamentos.findIndex(dept => dept.id === id);
        
        if (index === -1) return null;
        
        departamentos[index] = {
            ...departamentos[index],
            nombre: datosActualizados.nombre.trim(),
            capacidad: parseInt(datosActualizados.capacidad),
            descripcion: datosActualizados.descripcion?.trim() || '',
            fechaModificacion: new Date().toISOString()
        };
        
        localStorage.setItem('departamentos', JSON.stringify(departamentos));

        // Sincronizar con Firebase si está habilitado
        if (this.useFirebase) {
            try {
                const docRef = this.firestore.doc(this.db, 'departamentos', id);
                await this.firestore.updateDoc(docRef, departamentos[index]);
                console.log('🔥 Departamento actualizado en Firebase');
            } catch (error) {
                console.error('❌ Error al actualizar en Firebase:', error);
            }
        }
        
        return departamentos[index];
    },

    /**
     * Eliminar un departamento
     * @param {string} id - ID del departamento
     * @returns {boolean} true si se eliminó correctamente
     */
    async eliminarDepartamento(id) {
        // Verificar si tiene reservas asociadas
        const reservas = this.obtenerReservas();
        const tieneReservas = reservas.some(res => res.departamentoId === id);
        
        if (tieneReservas) {
            throw new Error('No se puede eliminar un departamento con reservas asociadas');
        }
        
        const departamentos = this.obtenerDepartamentos();
        const nuevosDepartamentos = departamentos.filter(dept => dept.id !== id);
        
        if (departamentos.length === nuevosDepartamentos.length) {
            return false; // No se encontró el departamento
        }
        
        localStorage.setItem('departamentos', JSON.stringify(nuevosDepartamentos));

        // Sincronizar con Firebase si está habilitado
        if (this.useFirebase) {
            try {
                const docRef = this.firestore.doc(this.db, 'departamentos', id);
                await this.firestore.deleteDoc(docRef);
                console.log('🔥 Departamento eliminado de Firebase');
            } catch (error) {
                console.error('❌ Error al eliminar de Firebase:', error);
            }
        }
        
        return true;
    },

    // ========================================
    // CRUD RESERVAS
    // ========================================
    
    /**
     * Obtener todas las reservas
     * @returns {Array} Lista de reservas
     */
    obtenerReservas() {
        return JSON.parse(localStorage.getItem('reservas')) || [];
    },

    /**
     * Obtener una reserva por ID
     * @param {string} id - ID de la reserva
     * @returns {Object|null} Reserva encontrada o null
     */
    obtenerReservaPorId(id) {
        const reservas = this.obtenerReservas();
        return reservas.find(res => res.id === id) || null;
    },

    /**
     * Crear una nueva reserva
     * @param {Object} reserva - Datos de la reserva
     * @returns {Object} Reserva creada
     */
    async crearReserva(reserva) {
        // Validar que el departamento existe
        const departamento = this.obtenerDepartamentoPorId(reserva.departamentoId);
        if (!departamento) {
            throw new Error('El departamento no existe');
        }

        // Validar fechas
        const fechaEntrada = new Date(reserva.fechaEntrada);
        const fechaSalida = new Date(reserva.fechaSalida);
        
        if (fechaSalida <= fechaEntrada) {
            throw new Error('La fecha de salida debe ser posterior a la fecha de entrada');
        }

        // Verificar disponibilidad (no debe haber superposición)
        if (!this.verificarDisponibilidad(reserva.departamentoId, reserva.fechaEntrada, reserva.fechaSalida)) {
            throw new Error('El departamento ya está reservado en esas fechas');
        }

        const nuevaReserva = {
            departamentoId: reserva.departamentoId,
            huesped: reserva.huesped.trim(),
            fechaEntrada: reserva.fechaEntrada,
            fechaSalida: reserva.fechaSalida,
            fechaCreacion: new Date().toISOString()
        };
        
        // Sincronizar con Firebase primero si está habilitado
        if (this.useFirebase) {
            try {
                const docRef = await this.firestore.addDoc(
                    this.firestore.collection(this.db, 'reservas'),
                    nuevaReserva
                );
                // Usar el ID de Firebase como ID único
                nuevaReserva.id = docRef.id;
                console.log('🔥 Reserva guardada en Firebase:', docRef.id);
            } catch (error) {
                console.error('❌ Error al guardar reserva en Firebase:', error);
                // Si falla Firebase, usar ID local
                nuevaReserva.id = this.generarId();
            }
        } else {
            // Si no hay Firebase, usar ID local
            nuevaReserva.id = this.generarId();
        }

        // Guardar en localStorage
        const reservas = this.obtenerReservas();
        reservas.push(nuevaReserva);
        localStorage.setItem('reservas', JSON.stringify(reservas));
        
        return nuevaReserva;
    },

    /**
     * Actualizar una reserva existente
     * @param {string} id - ID de la reserva
     * @param {Object} datosActualizados - Nuevos datos
     * @returns {Object|null} Reserva actualizada o null
     */
    async actualizarReserva(id, datosActualizados) {
        const reservas = this.obtenerReservas();
        const index = reservas.findIndex(res => res.id === id);
        
        if (index === -1) return null;

        // Validar fechas
        const fechaEntrada = new Date(datosActualizados.fechaEntrada);
        const fechaSalida = new Date(datosActualizados.fechaSalida);
        
        if (fechaSalida <= fechaEntrada) {
            throw new Error('La fecha de salida debe ser posterior a la fecha de entrada');
        }

        // Verificar disponibilidad (excluyendo la reserva actual)
        if (!this.verificarDisponibilidad(
            datosActualizados.departamentoId,
            datosActualizados.fechaEntrada,
            datosActualizados.fechaSalida,
            id
        )) {
            throw new Error('El departamento ya está reservado en esas fechas');
        }

        reservas[index] = {
            ...reservas[index],
            departamentoId: datosActualizados.departamentoId,
            huesped: datosActualizados.huesped.trim(),
            fechaEntrada: datosActualizados.fechaEntrada,
            fechaSalida: datosActualizados.fechaSalida,
            fechaModificacion: new Date().toISOString()
        };
        
        localStorage.setItem('reservas', JSON.stringify(reservas));

        // Sincronizar con Firebase si está habilitado
        if (this.useFirebase) {
            try {
                const docRef = this.firestore.doc(this.db, 'reservas', id);
                await this.firestore.updateDoc(docRef, reservas[index]);
                console.log('🔥 Reserva actualizada en Firebase');
            } catch (error) {
                console.error('❌ Error al actualizar reserva en Firebase:', error);
            }
        }
        
        return reservas[index];
    },

    /**
     * Eliminar una reserva
     * @param {string} id - ID de la reserva
     * @returns {boolean} true si se eliminó correctamente
     */
    async eliminarReserva(id) {
        const reservas = this.obtenerReservas();
        const nuevasReservas = reservas.filter(res => res.id !== id);
        
        if (reservas.length === nuevasReservas.length) {
            return false; // No se encontró la reserva
        }
        
        localStorage.setItem('reservas', JSON.stringify(nuevasReservas));

        // Sincronizar con Firebase si está habilitado
        if (this.useFirebase) {
            try {
                const docRef = this.firestore.doc(this.db, 'reservas', id);
                await this.firestore.deleteDoc(docRef);
                console.log('🔥 Reserva eliminada de Firebase');
            } catch (error) {
                console.error('❌ Error al eliminar reserva de Firebase:', error);
            }
        }
        
        return true;
    },

    // ========================================
    // BÚSQUEDA Y DISPONIBILIDAD
    // ========================================
    
    /**
     * Verificar si un departamento está disponible en un rango de fechas
     * @param {string} departamentoId - ID del departamento
     * @param {string} fechaEntrada - Fecha de entrada (YYYY-MM-DD)
     * @param {string} fechaSalida - Fecha de salida (YYYY-MM-DD)
     * @param {string} excludeReservaId - ID de reserva a excluir (para actualizaciones)
     * @returns {boolean} true si está disponible
     */
    verificarDisponibilidad(departamentoId, fechaEntrada, fechaSalida, excludeReservaId = null) {
        const reservas = this.obtenerReservas();
        const entrada = new Date(fechaEntrada);
        const salida = new Date(fechaSalida);

        // Buscar reservas que se superponen
        const hayConflicto = reservas.some(reserva => {
            // Excluir la reserva actual si se está editando
            if (excludeReservaId && reserva.id === excludeReservaId) {
                return false;
            }

            // Solo verificar el mismo departamento
            if (reserva.departamentoId !== departamentoId) {
                return false;
            }

            const resEntrada = new Date(reserva.fechaEntrada);
            const resSalida = new Date(reserva.fechaSalida);

            // Verificar superposición de fechas
            // Hay conflicto si:
            // - La entrada está entre una reserva existente
            // - La salida está entre una reserva existente
            // - La reserva existente está completamente dentro del rango buscado
            return (
                (entrada >= resEntrada && entrada < resSalida) ||
                (salida > resEntrada && salida <= resSalida) ||
                (entrada <= resEntrada && salida >= resSalida)
            );
        });

        return !hayConflicto;
    },

    /**
     * Buscar departamentos disponibles según criterios
     * @param {Object} criterios - Criterios de búsqueda
     * @returns {Array} Lista de departamentos disponibles
     */
    buscarDepartamentosDisponibles(criterios) {
        const { fechaEntrada, fechaSalida, capacidad } = criterios;
        let departamentos = this.obtenerDepartamentos();

        // Filtrar por capacidad si se especificó
        if (capacidad) {
            departamentos = departamentos.filter(dept => dept.capacidad >= parseInt(capacidad));
        }

        // Filtrar por disponibilidad si se especificaron fechas
        if (fechaEntrada && fechaSalida) {
            departamentos = departamentos.filter(dept => 
                this.verificarDisponibilidad(dept.id, fechaEntrada, fechaSalida)
            );
        }

        return departamentos;
    },

    /**
     * Obtener reservas de un departamento específico
     * @param {string} departamentoId - ID del departamento
     * @returns {Array} Lista de reservas del departamento
     */
    obtenerReservasPorDepartamento(departamentoId) {
        const reservas = this.obtenerReservas();
        return reservas.filter(res => res.departamentoId === departamentoId);
    },

    /**
     * Obtener fechas reservadas de un departamento en un mes específico
     * @param {string} departamentoId - ID del departamento
     * @param {number} anio - Año
     * @param {number} mes - Mes (0-11)
     * @returns {Object} Objeto con fechas reservadas y detalles
     */
    obtenerReservasPorMes(departamentoId, anio, mes) {
        const reservas = this.obtenerReservasPorDepartamento(departamentoId);
        const fechasReservadas = new Map();

        reservas.forEach(reserva => {
            const fechaEntrada = new Date(reserva.fechaEntrada);
            const fechaSalida = new Date(reserva.fechaSalida);
            
            // Iterar por cada día de la reserva
            let fechaActual = new Date(fechaEntrada);
            while (fechaActual <= fechaSalida) {
                const anioActual = fechaActual.getFullYear();
                const mesActual = fechaActual.getMonth();
                
                if (anioActual === anio && mesActual === mes) {
                    const dia = fechaActual.getDate();
                    const clave = `${anio}-${mes}-${dia}`;
                    
                    // Determinar tipo de día
                    let tipo = 'reservado';
                    if (fechaActual.getTime() === fechaEntrada.getTime()) {
                        tipo = 'inicio';
                    } else if (fechaActual.getTime() === fechaSalida.getTime()) {
                        tipo = 'fin';
                    }
                    
                    fechasReservadas.set(clave, {
                        dia: dia,
                        tipo: tipo,
                        huesped: reserva.huesped,
                        reservaId: reserva.id
                    });
                }
                
                fechaActual.setDate(fechaActual.getDate() + 1);
            }
        });

        return fechasReservadas;
    },

    /**
     * Verificar si una fecha específica está reservada
     * @param {string} departamentoId - ID del departamento
     * @param {Date} fecha - Fecha a verificar
     * @returns {Object|null} Información de la reserva o null si está disponible
     */
    verificarFechaReservada(departamentoId, fecha) {
        const reservas = this.obtenerReservasPorDepartamento(departamentoId);
        const fechaBuscar = new Date(fecha);
        fechaBuscar.setHours(0, 0, 0, 0);

        for (const reserva of reservas) {
            const fechaEntrada = new Date(reserva.fechaEntrada);
            const fechaSalida = new Date(reserva.fechaSalida);
            fechaEntrada.setHours(0, 0, 0, 0);
            fechaSalida.setHours(0, 0, 0, 0);

            if (fechaBuscar >= fechaEntrada && fechaBuscar <= fechaSalida) {
                return {
                    reserva: reserva,
                    tipo: fechaBuscar.getTime() === fechaEntrada.getTime() ? 'inicio' :
                          fechaBuscar.getTime() === fechaSalida.getTime() ? 'fin' : 'reservado'
                };
            }
        }

        return null;
    },

    // ========================================
    // UTILIDADES
    // ========================================
    
    /**
     * Generar un ID único
     * @returns {string} ID único
     */
    generarId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Limpiar todos los datos (útil para desarrollo/testing)
     */
    limpiarTodo() {
        localStorage.removeItem('departamentos');
        localStorage.removeItem('reservas');
        this.init();
    },

    /**
     * Exportar datos como JSON
     * @returns {Object} Objeto con todos los datos
     */
    exportarDatos() {
        return {
            departamentos: this.obtenerDepartamentos(),
            reservas: this.obtenerReservas(),
            fecha: new Date().toISOString()
        };
    },

    /**
     * Importar datos desde JSON
     * @param {Object} datos - Datos a importar
     */
    importarDatos(datos) {
        if (datos.departamentos) {
            localStorage.setItem('departamentos', JSON.stringify(datos.departamentos));
        }
        if (datos.reservas) {
            localStorage.setItem('reservas', JSON.stringify(datos.reservas));
        }
    }
};

// Inicializar el modelo al cargar
Model.init();

console.log('✅ Model cargado correctamente');
