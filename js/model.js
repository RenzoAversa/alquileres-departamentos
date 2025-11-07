// ========================================
// MODEL.JS - Capa de Modelo (MVC)
// Maneja toda la lógica de datos con Firebase Firestore únicamente
// ========================================

const Model = {
    // Estado de Firebase
    db: null,
    firebaseApp: null,
    
    // Cache en memoria (no localStorage)
    departamentosCache: [],
    reservasCache: [],

    // ========================================
    // INICIALIZACIÓN
    // ========================================
    
    /**
     * Inicializar el modelo con Firebase
     */
    async init() {
        console.log('🚀 Iniciando Model...');
        
        try {
            await this.initFirebase();
        } catch (error) {
            console.error('❌ Firebase es obligatorio:', error.message);
            throw error;
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
            const { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, setDoc } = 
                await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // Inicializar Firebase
            this.firebaseApp = initializeApp(window.firebaseConfig);
            this.db = getFirestore(this.firebaseApp);

            // Guardar funciones de Firestore
            this.firestore = { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, setDoc };

            console.log('✅ Firebase inicializado correctamente');

            // Cargar datos iniciales
            await this.cargarDatos();

            // Escuchar cambios en tiempo real
            this.escucharCambiosFirebase();

        } catch (error) {
            console.error('❌ Error al inicializar Firebase:', error);
            throw error;
        }
    },

    /**
     * Cargar datos desde Firebase
     */
    async cargarDatos() {
        try {
            console.log('📥 Cargando datos desde Firebase...');
            
            // Cargar departamentos
            const deptsSnapshot = await this.firestore.getDocs(
                this.firestore.collection(this.db, 'departamentos')
            );
            
            this.departamentosCache = [];
            deptsSnapshot.docs.forEach(doc => {
                this.departamentosCache.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Cargar reservas
            const reservasSnapshot = await this.firestore.getDocs(
                this.firestore.collection(this.db, 'reservas')
            );
            
            this.reservasCache = [];
            reservasSnapshot.docs.forEach(doc => {
                this.reservasCache.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log('✅ Datos cargados:', {
                departamentos: this.departamentosCache.length,
                reservas: this.reservasCache.length
            });
        } catch (error) {
            console.error('❌ Error al cargar datos desde Firebase:', error);
            throw error;
        }
    },

    /**
     * Escuchar cambios en tiempo real de Firebase
     */
    escucharCambiosFirebase() {
        // Escuchar departamentos
        this.firestore.onSnapshot(
            this.firestore.collection(this.db, 'departamentos'),
            (snapshot) => {
                console.log(`📡 Listener departamentos: ${snapshot.docChanges().length} cambio(s)`);

                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const nuevo = { id: change.doc.id, ...change.doc.data() };
                        const index = this.departamentosCache.findIndex(d => d.id === nuevo.id);
                        if (index === -1) {
                            this.departamentosCache.push(nuevo);
                        }
                    } else if (change.type === "modified") {
                        const modificado = { id: change.doc.id, ...change.doc.data() };
                        const index = this.departamentosCache.findIndex(d => d.id === modificado.id);
                        if (index !== -1) {
                            this.departamentosCache[index] = modificado;
                        }
                    } else if (change.type === "removed") {
                        this.departamentosCache = this.departamentosCache.filter(d => d.id !== change.doc.id);
                    }
                });
                
                // Actualizar vista
                if (window.Controller && window.Controller.actualizarVistaDepartamentos) {
                    window.Controller.actualizarVistaDepartamentos();
                }
            }
        );

        // Escuchar reservas
        this.firestore.onSnapshot(
            this.firestore.collection(this.db, 'reservas'),
            (snapshot) => {
                console.log(`📡 Listener reservas: ${snapshot.docChanges().length} cambio(s)`);

                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const nuevo = { id: change.doc.id, ...change.doc.data() };
                        const index = this.reservasCache.findIndex(r => r.id === nuevo.id);
                        if (index === -1) {
                            this.reservasCache.push(nuevo);
                        }
                    } else if (change.type === "modified") {
                        const modificado = { id: change.doc.id, ...change.doc.data() };
                        const index = this.reservasCache.findIndex(r => r.id === modificado.id);
                        if (index !== -1) {
                            this.reservasCache[index] = modificado;
                        }
                    } else if (change.type === "removed") {
                        this.reservasCache = this.reservasCache.filter(r => r.id !== change.doc.id);
                    }
                });
                
                // Actualizar vista
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
     */
    obtenerDepartamentos() {
        return [...this.departamentosCache];
    },

    /**
     * Obtener un departamento por ID
     */
    obtenerDepartamentoPorId(id) {
        return this.departamentosCache.find(dept => dept.id === id) || null;
    },

    /**
     * Crear un nuevo departamento
     */
    async crearDepartamento(departamento) {
        const nuevoDepartamento = {
            nombre: departamento.nombre.trim(),
            capacidad: parseInt(departamento.capacidad),
            descripcion: departamento.descripcion?.trim() || '',
            fechaCreacion: new Date().toISOString()
        };
        
        try {
            const docRef = await this.firestore.addDoc(
                this.firestore.collection(this.db, 'departamentos'),
                nuevoDepartamento
            );
            
            console.log('✅ Departamento creado en Firebase:', docRef.id);
            
            return {
                id: docRef.id,
                ...nuevoDepartamento
            };
        } catch (error) {
            console.error('❌ Error al crear departamento:', error);
            throw error;
        }
    },

    /**
     * Actualizar un departamento existente
     */
    async actualizarDepartamento(id, datosActualizados) {
        const datosFirebase = {
            nombre: datosActualizados.nombre.trim(),
            capacidad: parseInt(datosActualizados.capacidad),
            descripcion: datosActualizados.descripcion?.trim() || '',
            fechaModificacion: new Date().toISOString()
        };
        
        try {
            const docRef = this.firestore.doc(this.db, 'departamentos', id);
            await this.firestore.updateDoc(docRef, datosFirebase);
            
            console.log('✅ Departamento actualizado en Firebase');
            
            return {
                id: id,
                ...datosFirebase
            };
        } catch (error) {
            console.error('❌ Error al actualizar departamento:', error);
            throw error;
        }
    },

    /**
     * Eliminar un departamento
     */
    async eliminarDepartamento(id) {
        // Verificar si tiene reservas asociadas
        const tieneReservas = this.reservasCache.some(res => res.departamentoId === id);
        
        if (tieneReservas) {
            throw new Error('No se puede eliminar un departamento con reservas asociadas');
        }
        
        try {
            const docRef = this.firestore.doc(this.db, 'departamentos', id);
            await this.firestore.deleteDoc(docRef);
            
            console.log('✅ Departamento eliminado de Firebase');
            return true;
        } catch (error) {
            console.error('❌ Error al eliminar departamento:', error);
            throw error;
        }
    },

    // ========================================
    // CRUD RESERVAS
    // ========================================
    
    /**
     * Obtener todas las reservas
     */
    obtenerReservas() {
        return [...this.reservasCache];
    },

    /**
     * Obtener una reserva por ID
     */
    obtenerReservaPorId(id) {
        return this.reservasCache.find(res => res.id === id) || null;
    },

    /**
     * Crear una nueva reserva
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

        // Verificar disponibilidad
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
        
        try {
            const docRef = await this.firestore.addDoc(
                this.firestore.collection(this.db, 'reservas'),
                nuevaReserva
            );
            
            console.log('✅ Reserva creada en Firebase:', docRef.id);
            
            return {
                id: docRef.id,
                ...nuevaReserva
            };
        } catch (error) {
            console.error('❌ Error al crear reserva:', error);
            throw error;
        }
    },

    /**
     * Actualizar una reserva existente
     */
    async actualizarReserva(id, datosActualizados) {
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

        const datosFirebase = {
            departamentoId: datosActualizados.departamentoId,
            huesped: datosActualizados.huesped.trim(),
            fechaEntrada: datosActualizados.fechaEntrada,
            fechaSalida: datosActualizados.fechaSalida,
            fechaModificacion: new Date().toISOString()
        };
        
        try {
            const docRef = this.firestore.doc(this.db, 'reservas', id);
            await this.firestore.updateDoc(docRef, datosFirebase);
            
            console.log('✅ Reserva actualizada en Firebase');
            
            return {
                id: id,
                ...datosFirebase
            };
        } catch (error) {
            console.error('❌ Error al actualizar reserva:', error);
            throw error;
        }
    },

    /**
     * Eliminar una reserva
     */
    async eliminarReserva(id) {
        try {
            const docRef = this.firestore.doc(this.db, 'reservas', id);
            await this.firestore.deleteDoc(docRef);
            
            console.log('✅ Reserva eliminada de Firebase');
            return true;
        } catch (error) {
            console.error('❌ Error al eliminar reserva:', error);
            throw error;
        }
    },

    // ========================================
    // BÚSQUEDA Y DISPONIBILIDAD
    // ========================================
    
    /**
     * Verificar si un departamento está disponible en un rango de fechas
     */
    verificarDisponibilidad(departamentoId, fechaEntrada, fechaSalida, excludeReservaId = null) {
        const entrada = new Date(fechaEntrada);
        const salida = new Date(fechaSalida);

        const hayConflicto = this.reservasCache.some(reserva => {
            if (excludeReservaId && reserva.id === excludeReservaId) {
                return false;
            }

            if (reserva.departamentoId !== departamentoId) {
                return false;
            }

            const resEntrada = new Date(reserva.fechaEntrada);
            const resSalida = new Date(reserva.fechaSalida);

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
     */
    buscarDepartamentosDisponibles(criterios) {
        const { fechaEntrada, fechaSalida, capacidad } = criterios;
        let departamentos = [...this.departamentosCache];

        if (capacidad) {
            departamentos = departamentos.filter(dept => dept.capacidad >= parseInt(capacidad));
        }

        if (fechaEntrada && fechaSalida) {
            departamentos = departamentos.filter(dept => 
                this.verificarDisponibilidad(dept.id, fechaEntrada, fechaSalida)
            );
        }

        return departamentos;
    },

    /**
     * Buscar todos los departamentos con información de disponibilidad
     * @param {Object} criterios - Criterios de búsqueda
     * @returns {Object} Objeto con departamentos disponibles y no disponibles
     */
    buscarDepartamentosConDisponibilidad(criterios) {
        const { fechaEntrada, fechaSalida, capacidad } = criterios;
        let todosDepartamentos = [...this.departamentosCache];

        // Filtrar por capacidad primero (esto aplica a todos)
        if (capacidad) {
            todosDepartamentos = todosDepartamentos.filter(dept => dept.capacidad >= parseInt(capacidad));
        }

        const disponibles = [];
        const noDisponibles = [];

        todosDepartamentos.forEach(dept => {
            if (fechaEntrada && fechaSalida) {
                const estaDisponible = this.verificarDisponibilidad(dept.id, fechaEntrada, fechaSalida);
                
                if (estaDisponible) {
                    disponibles.push(dept);
                } else {
                    // Obtener las reservas que causan el conflicto
                    const reservasConflicto = this.obtenerReservasEnRango(dept.id, fechaEntrada, fechaSalida);
                    noDisponibles.push({
                        ...dept,
                        reservasConflicto
                    });
                }
            } else {
                // Sin fechas, todos están "disponibles"
                disponibles.push(dept);
            }
        });

        return {
            disponibles,
            noDisponibles
        };
    },

    /**
     * Obtener reservas de un departamento en un rango de fechas
     * @param {string} departamentoId - ID del departamento
     * @param {string} fechaEntrada - Fecha de entrada
     * @param {string} fechaSalida - Fecha de salida
     * @returns {Array} Reservas que causan conflicto
     */
    obtenerReservasEnRango(departamentoId, fechaEntrada, fechaSalida) {
        const entrada = new Date(fechaEntrada);
        const salida = new Date(fechaSalida);

        return this.reservasCache.filter(reserva => {
            if (reserva.departamentoId !== departamentoId) {
                return false;
            }

            const resEntrada = new Date(reserva.fechaEntrada);
            const resSalida = new Date(reserva.fechaSalida);

            // Verificar si hay superposición
            return (
                (entrada >= resEntrada && entrada < resSalida) ||
                (salida > resEntrada && salida <= resSalida) ||
                (entrada <= resEntrada && salida >= resSalida)
            );
        });
    },

    /**
     * Obtener reservas de un departamento específico
     */
    obtenerReservasPorDepartamento(departamentoId) {
        return this.reservasCache.filter(res => res.departamentoId === departamentoId);
    },

    /**
     * Obtener fechas reservadas de un departamento en un mes específico
     */
    obtenerReservasPorMes(departamentoId, anio, mes) {
        const reservas = this.obtenerReservasPorDepartamento(departamentoId);
        const fechasReservadas = new Map();

        reservas.forEach(reserva => {
            const [anioEntrada, mesEntrada, diaEntrada] = reserva.fechaEntrada.split('-').map(n => parseInt(n));
            const [anioSalida, mesSalida, diaSalida] = reserva.fechaSalida.split('-').map(n => parseInt(n));
            
            const fechaEntrada = new Date(anioEntrada, mesEntrada - 1, diaEntrada);
            const fechaSalida = new Date(anioSalida, mesSalida - 1, diaSalida);
            
            let fechaActual = new Date(fechaEntrada);
            while (fechaActual <= fechaSalida) {
                const anioActual = fechaActual.getFullYear();
                const mesActual = fechaActual.getMonth();
                
                if (anioActual === anio && mesActual === mes) {
                    const dia = fechaActual.getDate();
                    const clave = `${anio}-${mes}-${dia}`;
                    
                    let tipo = 'reservado';
                    if (fechaActual.getDate() === fechaEntrada.getDate() && 
                        fechaActual.getMonth() === fechaEntrada.getMonth() && 
                        fechaActual.getFullYear() === fechaEntrada.getFullYear()) {
                        tipo = 'inicio';
                    } else if (fechaActual.getDate() === fechaSalida.getDate() && 
                              fechaActual.getMonth() === fechaSalida.getMonth() && 
                              fechaActual.getFullYear() === fechaSalida.getFullYear()) {
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
     * Exportar datos como JSON
     */
    exportarDatos() {
        return {
            departamentos: this.obtenerDepartamentos(),
            reservas: this.obtenerReservas(),
            fecha: new Date().toISOString()
        };
    }
};

console.log('✅ Model cargado correctamente (Firebase Only)');
