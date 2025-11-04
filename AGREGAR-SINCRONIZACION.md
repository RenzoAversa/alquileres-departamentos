# ☁️ Agregar Sincronización en la Nube (Opcional)

## 🤔 ¿Por qué agregar sincronización?

**LocalStorage funciona genial, PERO:**
- Los datos solo existen en ese navegador
- Si tu madre usa PC + tablet + móvil, cada uno tiene datos diferentes
- Si borra caché del navegador, pierde todo

**Con sincronización en la nube:**
- ✅ Mismos datos en todos los dispositivos
- ✅ Backup automático
- ✅ No se pierden datos
- ✅ Acceso desde cualquier lugar

---

## 🎯 Mejor Opción: Firebase Firestore (GRATIS)

### **¿Qué es Firebase?**
Base de datos de Google, gratis hasta:
- 1 GB de almacenamiento
- 50,000 lecturas/día
- 20,000 escrituras/día
- 20,000 eliminaciones/día

**Para tu caso:** GRATIS para siempre (un negocio de alquileres no llega ni cerca de esos límites)

---

## 📝 Guía: Integrar Firebase

### Paso 1: Crear Proyecto en Firebase

1. **Ir a**: https://console.firebase.google.com/
2. **Crear cuenta** (usa tu cuenta Google)
3. **Crear proyecto**:
   - Nombre: "alquileres-departamentos"
   - Deshabilitar Google Analytics (no lo necesitas)
   - Clic en "Crear proyecto"

### Paso 2: Configurar Firestore

1. En el menú lateral: **Firestore Database**
2. Clic en **"Crear base de datos"**
3. Seleccionar: **Iniciar en modo de prueba**
4. Ubicación: **us-east1** (o la más cercana)
5. Clic en **"Habilitar"**

### Paso 3: Obtener Configuración

1. Ve a **Configuración del proyecto** (⚙️ arriba)
2. Scroll down hasta **"Tus apps"**
3. Clic en el ícono **</>** (Web)
4. Nombre: "Web App"
5. **NO marcar** Firebase Hosting
6. Clic en **"Registrar app"**
7. **Copiar** el código de configuración (algo así):

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Paso 4: Configurar Reglas de Seguridad

1. En Firestore, ve a **"Reglas"**
2. Reemplaza con esto (permite lectura/escritura sin autenticación):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **NOTA:** Esto permite que cualquiera escriba. Para producción, deberías agregar autenticación.

3. Clic en **"Publicar"**

---

## 🔧 Modificar el Proyecto

### Paso 5: Agregar Firebase al HTML

Edita `index.html`, antes de cerrar `</body>`, agrega:

```html
<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js"></script>

<!-- Configuración Firebase -->
<script>
  const firebaseConfig = {
    apiKey: "TU-API-KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
  };
  
  // Inicializar Firebase
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  console.log('✅ Firebase conectado');
</script>

<!-- Scripts MVC (DESPUÉS de Firebase) -->
<script src="js/model.js"></script>
<script src="js/view.js"></script>
<script src="js/controller.js"></script>
```

### Paso 6: Modificar `model.js`

Reemplaza el archivo completo con esta versión que usa Firestore:

```javascript
// ========================================
// MODEL.JS - Versión con Firebase Firestore
// ========================================

const Model = {
    // Colecciones de Firestore
    departamentosRef: db.collection('departamentos'),
    reservasRef: db.collection('reservas'),
    
    // Cache local (para lectura rápida)
    cacheDepartamentos: [],
    cacheReservas: [],
    
    // ========================================
    // INICIALIZACIÓN
    // ========================================
    
    async init() {
        console.log('🔥 Inicializando Firestore...');
        
        // Sincronizar en tiempo real
        this.sincronizarDepartamentos();
        this.sincronizarReservas();
    },
    
    // Sincronización en tiempo real
    sincronizarDepartamentos() {
        this.departamentosRef.onSnapshot((snapshot) => {
            this.cacheDepartamentos = [];
            snapshot.forEach((doc) => {
                this.cacheDepartamentos.push({ id: doc.id, ...doc.data() });
            });
            console.log('🔄 Departamentos sincronizados:', this.cacheDepartamentos.length);
            
            // Notificar al controller para actualizar vista
            if (typeof Controller !== 'undefined' && Controller.actualizarVistaDepartamentos) {
                Controller.actualizarVistaDepartamentos();
            }
        });
    },
    
    sincronizarReservas() {
        this.reservasRef.onSnapshot((snapshot) => {
            this.cacheReservas = [];
            snapshot.forEach((doc) => {
                this.cacheReservas.push({ id: doc.id, ...doc.data() });
            });
            console.log('🔄 Reservas sincronizadas:', this.cacheReservas.length);
            
            // Notificar al controller
            if (typeof Controller !== 'undefined' && Controller.actualizarVistaReservas) {
                Controller.actualizarVistaReservas();
            }
        });
    },
    
    // ========================================
    // CRUD DEPARTAMENTOS
    // ========================================
    
    obtenerDepartamentos() {
        return this.cacheDepartamentos;
    },
    
    obtenerDepartamentoPorId(id) {
        return this.cacheDepartamentos.find(dept => dept.id === id) || null;
    },
    
    async crearDepartamento(departamento) {
        const nuevoDepartamento = {
            nombre: departamento.nombre.trim(),
            capacidad: parseInt(departamento.capacidad),
            descripcion: departamento.descripcion?.trim() || '',
            fechaCreacion: new Date().toISOString()
        };
        
        const docRef = await this.departamentosRef.add(nuevoDepartamento);
        return { id: docRef.id, ...nuevoDepartamento };
    },
    
    async actualizarDepartamento(id, datosActualizados) {
        const datos = {
            nombre: datosActualizados.nombre.trim(),
            capacidad: parseInt(datosActualizados.capacidad),
            descripcion: datosActualizados.descripcion?.trim() || '',
            fechaModificacion: new Date().toISOString()
        };
        
        await this.departamentosRef.doc(id).update(datos);
        return { id, ...datos };
    },
    
    async eliminarDepartamento(id) {
        // Verificar reservas
        const tieneReservas = this.cacheReservas.some(res => res.departamentoId === id);
        if (tieneReservas) {
            throw new Error('No se puede eliminar un departamento con reservas asociadas');
        }
        
        await this.departamentosRef.doc(id).delete();
        return true;
    },
    
    // ========================================
    // CRUD RESERVAS
    // ========================================
    
    obtenerReservas() {
        return this.cacheReservas;
    },
    
    obtenerReservaPorId(id) {
        return this.cacheReservas.find(res => res.id === id) || null;
    },
    
    async crearReserva(reserva) {
        // Validaciones
        const departamento = this.obtenerDepartamentoPorId(reserva.departamentoId);
        if (!departamento) {
            throw new Error('El departamento no existe');
        }
        
        const fechaEntrada = new Date(reserva.fechaEntrada);
        const fechaSalida = new Date(reserva.fechaSalida);
        
        if (fechaSalida <= fechaEntrada) {
            throw new Error('La fecha de salida debe ser posterior a la fecha de entrada');
        }
        
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
        
        const docRef = await this.reservasRef.add(nuevaReserva);
        return { id: docRef.id, ...nuevaReserva };
    },
    
    async actualizarReserva(id, datosActualizados) {
        const fechaEntrada = new Date(datosActualizados.fechaEntrada);
        const fechaSalida = new Date(datosActualizados.fechaSalida);
        
        if (fechaSalida <= fechaEntrada) {
            throw new Error('La fecha de salida debe ser posterior a la fecha de entrada');
        }
        
        if (!this.verificarDisponibilidad(
            datosActualizados.departamentoId,
            datosActualizados.fechaEntrada,
            datosActualizados.fechaSalida,
            id
        )) {
            throw new Error('El departamento ya está reservado en esas fechas');
        }
        
        const datos = {
            departamentoId: datosActualizados.departamentoId,
            huesped: datosActualizados.huesped.trim(),
            fechaEntrada: datosActualizados.fechaEntrada,
            fechaSalida: datosActualizados.fechaSalida,
            fechaModificacion: new Date().toISOString()
        };
        
        await this.reservasRef.doc(id).update(datos);
        return { id, ...datos };
    },
    
    async eliminarReserva(id) {
        await this.reservasRef.doc(id).delete();
        return true;
    },
    
    // ========================================
    // BÚSQUEDA (igual que antes)
    // ========================================
    
    verificarDisponibilidad(departamentoId, fechaEntrada, fechaSalida, excludeReservaId = null) {
        const entrada = new Date(fechaEntrada);
        const salida = new Date(fechaSalida);
        
        const hayConflicto = this.cacheReservas.some(reserva => {
            if (excludeReservaId && reserva.id === excludeReservaId) return false;
            if (reserva.departamentoId !== departamentoId) return false;
            
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
    
    buscarDepartamentosDisponibles(criterios) {
        const { fechaEntrada, fechaSalida, capacidad } = criterios;
        let departamentos = [...this.cacheDepartamentos];
        
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
    
    obtenerReservasPorDepartamento(departamentoId) {
        return this.cacheReservas.filter(res => res.departamentoId === departamentoId);
    }
};

// Inicializar
Model.init();
console.log('✅ Model con Firestore cargado');
```

---

## 🎉 ¡Listo!

Ahora tu aplicación:
- ✅ Guarda datos en la nube (Firebase)
- ✅ Sincroniza en tiempo real
- ✅ Funciona en múltiples dispositivos
- ✅ No pierde datos si borra caché

---

## 🔐 Seguridad (Opcional pero Recomendado)

### Agregar Autenticación Simple

Para que solo tu madre pueda acceder:

1. **Activar Firebase Authentication**:
   - En Firebase Console → Authentication
   - Habilitar "Email/Password"

2. **Agregar login al HTML**:
```html
<div id="login" style="display:none;">
  <input type="email" id="email" placeholder="Email">
  <input type="password" id="password" placeholder="Contraseña">
  <button onclick="login()">Entrar</button>
</div>
```

3. **Script de login**:
```javascript
function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(() => {
      document.getElementById('login').style.display = 'none';
      document.querySelector('main').style.display = 'block';
    })
    .catch((error) => {
      alert('Error: ' + error.message);
    });
}
```

4. **Actualizar reglas de Firestore**:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 💰 Costos

**Firebase GRATIS incluye:**
- 1 GB de almacenamiento
- 50,000 lecturas/día
- 20,000 escrituras/día

**Para tu caso:**
- Supongamos 100 departamentos
- 500 reservas al año
- Acceso 10 veces al día

**Total estimado:**
- ~100 lecturas/día
- ~5 escrituras/día

**Conclusión:** GRATIS para siempre 🎉

---

## 🆘 Soporte

- Documentación Firebase: https://firebase.google.com/docs/firestore
- Videos tutoriales: YouTube "Firebase Firestore tutorial español"

---

**Con esto, tu madre tendrá acceso desde cualquier dispositivo con los mismos datos 🚀**
