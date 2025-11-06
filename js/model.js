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
        console.log('🚀 Iniciando Model...');
        
        // LIMPIAR DUPLICADOS EXISTENTES INMEDIATAMENTE
        this.limpiarDuplicadosExistentes();
        
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
     * Limpiar duplicados existentes del localStorage
     */
    limpiarDuplicadosExistentes() {
        try {
            const departamentos = JSON.parse(localStorage.getItem('departamentos')) || [];
            const reservas = JSON.parse(localStorage.getItem('reservas')) || [];
            
            const deptsLimpios = this.eliminarDuplicadosPorId(departamentos);
            const reservasLimpias = this.eliminarDuplicadosPorId(reservas);
            
            const deptsEliminados = departamentos.length - deptsLimpios.length;
            const reservasEliminadas = reservas.length - reservasLimpias.length;
            
            if (deptsEliminados > 0 || reservasEliminadas > 0) {
                localStorage.setItem('departamentos', JSON.stringify(deptsLimpios));
                localStorage.setItem('reservas', JSON.stringify(reservasLimpias));
                console.warn(`🧹 AUTO-LIMPIEZA: Eliminados ${deptsEliminados} departamento(s) y ${reservasEliminadas} reserva(s) duplicada(s)`);
            }
        } catch (error) {
            console.error('Error al limpiar duplicados:', error);
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
            this.useFirebase = true;

            // Guardar funciones de Firestore
            this.firestore = { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, setDoc };

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

        // Activar bandera para evitar que los listeners agreguen duplicados
        this.sincronizandoFirebase = true;

        try {
            // LIMPIAR LOCALSTORAGE PRIMERO
            localStorage.setItem('departamentos', JSON.stringify([]));
            localStorage.setItem('reservas', JSON.stringify([]));
            
            console.log('🧹 LocalStorage limpiado, sincronizando desde Firebase...');
            
            // Obtener departamentos
            const deptsSnapshot = await this.firestore.getDocs(
                this.firestore.collection(this.db, 'departamentos')
            );
            
            // USAR MAP PARA GARANTIZAR IDs ÚNICOS
            const deptsMap = new Map();
            deptsSnapshot.docs.forEach(doc => {
                deptsMap.set(doc.id, {
                    id: doc.id,
                    ...doc.data()
                });
            });
            const departamentos = Array.from(deptsMap.values());

            // Obtener reservas
            const reservasSnapshot = await this.firestore.getDocs(
                this.firestore.collection(this.db, 'reservas')
            );
            
            // USAR MAP PARA GARANTIZAR IDs ÚNICOS
            const reservasMap = new Map();
            reservasSnapshot.docs.forEach(doc => {
                reservasMap.set(doc.id, {
                    id: doc.id,
                    ...doc.data()
                });
            });
            const reservas = Array.from(reservasMap.values());

            // Guardar en LocalStorage (ya sin duplicados)
            localStorage.setItem('departamentos', JSON.stringify(departamentos));
            localStorage.setItem('reservas', JSON.stringify(reservas));

            console.log('🔄 Datos sincronizados desde Firebase (ÚNICOS):', {
                departamentos: departamentos.length,
                reservas: reservas.length
            });
        } catch (error) {
            console.error('❌ Error al sincronizar desde Firebase:', error);
        } finally {
            // Desactivar la bandera después de un delay más largo
            // para asegurar que los listeners iniciales no se disparen
            setTimeout(() => {
                this.sincronizandoFirebase = false;
                console.log('✅ Sincronización completada, listeners activos');
            }, 2000); // Aumentado a 2 segundos
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
                if (this.sincronizandoFirebase) {
                    console.log('⏸️ Listener bloqueado durante sincronización inicial');
                    return;
                }

                console.log(`📡 Listener departamentos: ${snapshot.docChanges().length} cambio(s)`);

                // OBTENER DATOS ACTUALES Y CONVERTIR A MAP
                const departamentos = this.obtenerDepartamentos();
                const deptsMap = new Map(departamentos.map(d => [d.id, d]));

                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added" || change.type === "modified") {
                        // ACTUALIZAR/AGREGAR EN MAP (garantiza unicidad)
                        deptsMap.set(change.doc.id, {
                            id: change.doc.id,
                            ...change.doc.data()
                        });
                        console.log(`  ${change.type === "added" ? "➕" : "✏️"} ${change.doc.id.substr(0,8)}`);
                    } else if (change.type === "removed") {
                        // ELIMINAR DEL MAP
                        deptsMap.delete(change.doc.id);
                        console.log(`  🗑️ ${change.doc.id.substr(0,8)}`);
                    }
                });
                
                // CONVERTIR MAP A ARRAY (sin duplicados)
                const deptsUnicos = Array.from(deptsMap.values());
                localStorage.setItem('departamentos', JSON.stringify(deptsUnicos));
                console.log(`💾 Guardados ${deptsUnicos.length} departamentos únicos`);
                
                // COMENTADO: Evitar doble renderizado - el Controller ya maneja las vistas
                // if (window.Controller && window.Controller.actualizarVistaDepartamentos) {
                //     window.Controller.actualizarVistaDepartamentos();
                // }
            }
        );

        // Escuchar reservas
        this.firestore.onSnapshot(
            this.firestore.collection(this.db, 'reservas'),
            (snapshot) => {
                // Evitar actualizar durante sincronización inicial
                if (this.sincronizandoFirebase) return;

                // OBTENER DATOS ACTUALES Y CONVERTIR A MAP
                const reservas = this.obtenerReservas();
                const reservasMap = new Map(reservas.map(r => [r.id, r]));

                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added" || change.type === "modified") {
                        // ACTUALIZAR/AGREGAR EN MAP (garantiza unicidad)
                        reservasMap.set(change.doc.id, {
                            id: change.doc.id,
                            ...change.doc.data()
                        });
                    } else if (change.type === "removed") {
                        // ELIMINAR DEL MAP
                        reservasMap.delete(change.doc.id);
                    }
                });
                
                // CONVERTIR MAP A ARRAY (sin duplicados)
                const reservasUnicas = Array.from(reservasMap.values());
                localStorage.setItem('reservas', JSON.stringify(reservasUnicas));
                
                // COMENTADO: Evitar doble renderizado - el Controller ya maneja las vistas
                // if (window.Controller && window.Controller.actualizarVistaReservas) {
                //     window.Controller.actualizarVistaReservas();
                // }
            }
        );

        console.log('👂 Escuchando cambios en tiempo real de Firebase');
    },

    // ========================================
    // UTILIDADES
    // ========================================
    
    /**
     * Eliminar duplicados de un array por ID
     * @param {Array} items - Array con posibles duplicados
     * @returns {Array} Array sin duplicados
     */
    eliminarDuplicadosPorId(items) {
        const idsVistos = new Set();
        const itemsUnicos = [];
        
        items.forEach(item => {
            if (item.id && !idsVistos.has(item.id)) {
                idsVistos.add(item.id);
                itemsUnicos.push(item);
            }
        });
        
        return itemsUnicos;
    },

    // ========================================
    // CRUD DEPARTAMENTOS
    // ========================================
    
    /**
     * Obtener todos los departamentos (sin duplicados)
     * @returns {Array} Lista de departamentos
     */
    obtenerDepartamentos() {
        const departamentos = JSON.parse(localStorage.getItem('departamentos')) || [];
        const sinDuplicados = this.eliminarDuplicadosPorId(departamentos);
        
        // Si se encontraron duplicados, limpiar localStorage
        if (departamentos.length !== sinDuplicados.length) {
            console.warn(`🧹 Limpiando ${departamentos.length - sinDuplicados.length} departamento(s) duplicado(s)`);
            localStorage.setItem('departamentos', JSON.stringify(sinDuplicados));
        }
        
        return sinDuplicados;
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

        // Guardar en localStorage (VERIFICAR que no exista ya)
        const departamentos = this.obtenerDepartamentos();
        
        // Verificar si ya existe este ID
        const yaExiste = departamentos.some(dept => dept.id === nuevoDepartamento.id);
        if (yaExiste) {
            console.warn('⚠️ Departamento con este ID ya existe, actualizando en lugar de duplicar');
            const index = departamentos.findIndex(dept => dept.id === nuevoDepartamento.id);
            departamentos[index] = nuevoDepartamento;
        } else {
            departamentos.push(nuevoDepartamento);
        }
        
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
        
        // Preparar los datos actualizados
        const datosFirebase = {
            nombre: datosActualizados.nombre.trim(),
            capacidad: parseInt(datosActualizados.capacidad),
            descripcion: datosActualizados.descripcion?.trim() || '',
            fechaModificacion: new Date().toISOString()
        };
        
        // Actualizar en localStorage
        departamentos[index] = {
            ...departamentos[index],
            ...datosFirebase
        };
        
        localStorage.setItem('departamentos', JSON.stringify(departamentos));

        // Sincronizar con Firebase si está habilitado
        if (this.useFirebase) {
            const docRef = this.firestore.doc(this.db, 'departamentos', id);
            
            try {
                console.log('🔄 Actualizando departamento en Firebase...', { id, datosFirebase });
                await this.firestore.updateDoc(docRef, datosFirebase);
                console.log('✅ Departamento actualizado exitosamente en Firebase');
            } catch (error) {
                console.error('❌ Error al actualizar en Firebase:', error);
                console.error('Detalles del error:', {
                    code: error.code,
                    message: error.message,
                    id: id,
                    datos: datosFirebase
                });
                
                // Si el documento no existe (code: 'not-found'), crearlo CON EL MISMO ID
                if (error.code === 'not-found') {
                    try {
                        console.log('📝 El departamento no existe en Firebase, sincronizándolo con el mismo ID:', id);
                        // Crear el documento en Firebase con el MISMO ID que tiene en localStorage
                        const datosCompletos = {
                            ...datosFirebase,
                            fechaCreacion: departamentos[index].fechaCreacion || new Date().toISOString()
                        };
                        // setDoc con el ID específico crea/actualiza el documento sin duplicar
                        await this.firestore.setDoc(docRef, datosCompletos);
                        console.log('✅ Departamento sincronizado exitosamente en Firebase con ID:', id);
                    } catch (createError) {
                        console.error('❌ Error al sincronizar departamento en Firebase:', createError);
                    }
                }
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
                console.log('🗑️ Eliminando departamento de Firebase...', id);
                const docRef = this.firestore.doc(this.db, 'departamentos', id);
                await this.firestore.deleteDoc(docRef);
                console.log('✅ Departamento eliminado exitosamente de Firebase');
            } catch (error) {
                console.error('❌ Error al eliminar de Firebase:', error);
                console.error('Detalles del error:', {
                    code: error.code,
                    message: error.message,
                    id: id
                });
            }
        }
        
        return true;
    },

    // ========================================
    // CRUD RESERVAS
    // ========================================
    
    /**
     * Obtener todas las reservas (sin duplicados)
     * @returns {Array} Lista de reservas
     */
    obtenerReservas() {
        const reservas = JSON.parse(localStorage.getItem('reservas')) || [];
        const sinDuplicados = this.eliminarDuplicadosPorId(reservas);
        
        // Si se encontraron duplicados, limpiar localStorage
        if (reservas.length !== sinDuplicados.length) {
            console.warn(`🧹 Limpiando ${reservas.length - sinDuplicados.length} reserva(s) duplicada(s)`);
            localStorage.setItem('reservas', JSON.stringify(sinDuplicados));
        }
        
        return sinDuplicados;
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

        // Guardar en localStorage (VERIFICAR que no exista ya)
        const reservas = this.obtenerReservas();
        
        // Verificar si ya existe este ID
        const yaExiste = reservas.some(res => res.id === nuevaReserva.id);
        if (yaExiste) {
            console.warn('⚠️ Reserva con este ID ya existe, actualizando en lugar de duplicar');
            const index = reservas.findIndex(res => res.id === nuevaReserva.id);
            reservas[index] = nuevaReserva;
        } else {
            reservas.push(nuevaReserva);
        }
        
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

        // Preparar los datos actualizados (IGUAL QUE DEPARTAMENTOS)
        const datosFirebase = {
            departamentoId: datosActualizados.departamentoId,
            huesped: datosActualizados.huesped.trim(),
            fechaEntrada: datosActualizados.fechaEntrada,
            fechaSalida: datosActualizados.fechaSalida,
            fechaModificacion: new Date().toISOString()
        };

        // Validar que todos los campos requeridos tienen valores
        if (!datosFirebase.departamentoId || !datosFirebase.huesped || !datosFirebase.fechaEntrada || !datosFirebase.fechaSalida) {
            throw new Error('Faltan campos requeridos para la reserva');
        }

        // Actualizar en localStorage
        reservas[index] = {
            ...reservas[index],
            ...datosFirebase
        };
        
        localStorage.setItem('reservas', JSON.stringify(reservas));

        // Sincronizar con Firebase si está habilitado
        if (this.useFirebase) {
            const docRef = this.firestore.doc(this.db, 'reservas', id);
            
            try {
                console.log('🔄 Actualizando reserva en Firebase...', { id, datosFirebase });
                await this.firestore.updateDoc(docRef, datosFirebase);
                console.log('✅ Reserva actualizada exitosamente en Firebase');
            } catch (error) {
                console.error('❌ Error al actualizar en Firebase:', error);
                console.error('Detalles del error:', {
                    code: error.code,
                    message: error.message,
                    id: id,
                    datos: datosFirebase
                });
                
                // Si el documento no existe (code: 'not-found'), crearlo CON EL MISMO ID
                if (error.code === 'not-found') {
                    try {
                        console.log('📝 El documento no existe en Firebase, sincronizándolo con el mismo ID:', id);
                        // Incluir todos los datos de la reserva para la creación
                        const datosCompletos = {
                            departamentoId: datosFirebase.departamentoId,
                            huesped: datosFirebase.huesped,
                            fechaEntrada: datosFirebase.fechaEntrada,
                            fechaSalida: datosFirebase.fechaSalida,
                            fechaCreacion: reservas[index].fechaCreacion || new Date().toISOString(),
                            fechaModificacion: datosFirebase.fechaModificacion
                        };
                        // setDoc con el ID específico crea/actualiza el documento sin duplicar
                        await this.firestore.setDoc(docRef, datosCompletos);
                        console.log('✅ Documento sincronizado exitosamente en Firebase con ID:', id);
                    } catch (createError) {
                        console.error('❌ Error al sincronizar documento en Firebase:', createError);
                    }
                }
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
                console.log('🗑️ Eliminando reserva de Firebase...', id);
                const docRef = this.firestore.doc(this.db, 'reservas', id);
                await this.firestore.deleteDoc(docRef);
                console.log('✅ Reserva eliminada exitosamente de Firebase');
            } catch (error) {
                console.error('❌ Error al eliminar reserva de Firebase:', error);
                console.error('Detalles del error:', {
                    code: error.code,
                    message: error.message,
                    id: id
                });
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

        console.log('📅 Procesando reservas para el mes:', { departamentoId, anio, mes, totalReservas: reservas.length });

        reservas.forEach(reserva => {
            // Crear fechas locales para evitar problemas de zona horaria
            const [anioEntrada, mesEntrada, diaEntrada] = reserva.fechaEntrada.split('-').map(n => parseInt(n));
            const [anioSalida, mesSalida, diaSalida] = reserva.fechaSalida.split('-').map(n => parseInt(n));
            
            const fechaEntrada = new Date(anioEntrada, mesEntrada - 1, diaEntrada);
            const fechaSalida = new Date(anioSalida, mesSalida - 1, diaSalida);
            
            console.log('📅 Procesando reserva:', {
                huesped: reserva.huesped,
                entrada: fechaEntrada.toDateString(),
                salida: fechaSalida.toDateString()
            });
            
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
                    if (fechaActual.getDate() === fechaEntrada.getDate() && 
                        fechaActual.getMonth() === fechaEntrada.getMonth() && 
                        fechaActual.getFullYear() === fechaEntrada.getFullYear()) {
                        tipo = 'inicio';
                    } else if (fechaActual.getDate() === fechaSalida.getDate() && 
                              fechaActual.getMonth() === fechaSalida.getMonth() && 
                              fechaActual.getFullYear() === fechaSalida.getFullYear()) {
                        tipo = 'fin';
                    }
                    
                    console.log('📅 Agregando día reservado:', { clave, dia, tipo });
                    
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

        console.log('📅 Fechas reservadas generadas:', Array.from(fechasReservadas.entries()));
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
    },

    /**
     * Limpiar duplicados en Firebase (función de mantenimiento)
     * Esta función elimina reservas duplicadas basándose en huésped y fechas
     */
    async limpiarDuplicadosFirebase() {
        if (!this.useFirebase) {
            console.log('Firebase no está habilitado');
            return;
        }

        try {
            console.log('🧹 Iniciando limpieza de duplicados en Firebase...');
            
            // Obtener todas las reservas de Firebase
            const reservasSnapshot = await this.firestore.getDocs(
                this.firestore.collection(this.db, 'reservas')
            );
            
            const reservasFirebase = [];
            reservasSnapshot.docs.forEach(doc => {
                reservasFirebase.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log('📊 Reservas encontradas en Firebase:', reservasFirebase.length);

            // Encontrar duplicados (mismo huésped y fechas)
            const duplicados = [];
            const yaRevisados = new Set();

            for (let i = 0; i < reservasFirebase.length; i++) {
                if (yaRevisados.has(i)) continue;
                
                const reservaA = reservasFirebase[i];
                const similares = [reservaA];
                
                for (let j = i + 1; j < reservasFirebase.length; j++) {
                    const reservaB = reservasFirebase[j];
                    
                    if (reservaA.huesped === reservaB.huesped && 
                        reservaA.departamentoId === reservaB.departamentoId &&
                        (reservaA.fechaEntrada === reservaB.fechaEntrada || 
                         Math.abs(new Date(reservaA.fechaEntrada) - new Date(reservaB.fechaEntrada)) <= 24 * 60 * 60 * 1000)) {
                        similares.push(reservaB);
                        yaRevisados.add(j);
                    }
                }
                
                if (similares.length > 1) {
                    duplicados.push(similares);
                }
                yaRevisados.add(i);
            }

            console.log('🔍 Grupos de duplicados encontrados:', duplicados.length);

            // Eliminar duplicados (mantener el más reciente)
            for (const grupo of duplicados) {
                // Ordenar por fecha de modificación/creación (más reciente primero)
                grupo.sort((a, b) => {
                    const fechaA = new Date(a.fechaModificacion || a.fechaCreacion);
                    const fechaB = new Date(b.fechaModificacion || b.fechaCreacion);
                    return fechaB - fechaA;
                });

                console.log(`🗑️ Eliminando ${grupo.length - 1} duplicado(s) de ${grupo[0].huesped}`);
                
                // Eliminar todos excepto el primero (más reciente)
                for (let i = 1; i < grupo.length; i++) {
                    try {
                        const docRef = this.firestore.doc(this.db, 'reservas', grupo[i].id);
                        await this.firestore.deleteDoc(docRef);
                        console.log(`  ✅ Eliminado duplicado: ${grupo[i].id}`);
                    } catch (error) {
                        console.error(`  ❌ Error al eliminar ${grupo[i].id}:`, error);
                    }
                }
            }

            console.log('🎉 Limpieza completada');
            
        } catch (error) {
            console.error('❌ Error durante la limpieza:', error);
        }
    }
};

// NO inicializar aquí - se inicializa desde controller.js
// Model.init();

// Funciones globales (accesibles desde consola)
window.limpiarDuplicados = () => {
    Model.limpiarDuplicadosFirebase();
};

window.sincronizarTodo = async () => {
    console.log('🔄 Iniciando sincronización completa...');
    await Model.sincronizarDesdeFirebase();
    console.log('✅ Sincronización completada');
    location.reload(); // Recargar la página para refrescar la vista
};

console.log('✅ Model cargado correctamente');
