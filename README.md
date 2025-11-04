# 🏢 Sistema de Registro de Alquileres - PWA

Una aplicación web progresiva (PWA) para gestionar departamentos y reservas de alquiler, completamente funcional sin backend usando LocalStorage.

## ✨ Características

### 📦 Funcionalidades Principales

- **Gestión de Departamentos**
  - Agregar, editar y eliminar departamentos
  - Definir nombre, capacidad y descripción
  - Visualización clara de todos los departamentos

- **Registro de Reservas**
  - Crear, editar y eliminar reservas
  - Asociar reservas a departamentos específicos
  - Validación automática de disponibilidad
  - Estados: Activa, Próxima, Finalizada

- **Buscador de Disponibilidad**
  - Buscar por rango de fechas
  - Filtrar por capacidad mínima
  - Visualización de departamentos disponibles

### 🎯 Características Técnicas

- ✅ **Patrón MVC** (Model-View-Controller)
- ✅ **100% Frontend** - Sin necesidad de servidor
- ✅ **LocalStorage** - Persistencia en el navegador
- ✅ **PWA** - Instalable y funciona offline
- ✅ **Responsive** - Funciona en móviles y desktop
- ✅ **Validaciones** - Evita conflictos de reservas

## 🚀 Cómo Usar

### Instalación Local

1. **Clonar o descargar** el proyecto en tu servidor local (XAMPP, WAMP, etc.)

2. **Abrir en el navegador**:
   ```
   http://localhost/prueba_lucri/index.html
   ```

3. **Instalar como PWA** (opcional):
   - En Chrome/Edge: Clic en el ícono ➕ en la barra de direcciones
   - Seleccionar "Instalar"

### Uso de la Aplicación

#### 1. Gestionar Departamentos

1. Ve a la pestaña **"Departamentos"**
2. Completa el formulario:
   - Nombre del departamento
   - Capacidad (número de personas)
   - Descripción (opcional)
3. Clic en **"Guardar Departamento"**
4. Para editar: Clic en **✏️ Editar**
5. Para eliminar: Clic en **🗑️ Eliminar**

#### 2. Registrar Reservas

1. Ve a la pestaña **"Reservas"**
2. Selecciona un departamento del listado
3. Completa los datos:
   - Nombre del huésped
   - Fecha de entrada
   - Fecha de salida
4. Clic en **"Guardar Reserva"**

> ⚠️ El sistema valida automáticamente que no haya superposición de fechas

#### 3. Buscar Disponibilidad

1. Ve a la pestaña **"Buscar Disponibilidad"**
2. Define los criterios:
   - Rango de fechas (entrada y salida)
   - Capacidad mínima (opcional)
3. Clic en **"Buscar Disponibilidad"**
4. Revisa los resultados

## 📁 Estructura del Proyecto

```
prueba_lucri/
│
├── index.html              # Página principal
├── manifest.json           # Configuración PWA
├── sw.js                   # Service Worker (cache offline)
│
├── css/
│   └── style.css          # Estilos de la aplicación
│
└── js/
    ├── model.js           # Lógica de datos y LocalStorage
    ├── view.js            # Renderizado del DOM
    └── controller.js      # Coordinación de eventos
```

## 🧠 Arquitectura MVC

### Model (model.js)
- Maneja todo el almacenamiento en LocalStorage
- CRUD completo de departamentos y reservas
- Validación de disponibilidad
- Verificación de conflictos de fechas

### View (view.js)
- Renderizado dinámico del DOM
- Gestión de formularios
- Actualización de listas
- Mensajes y alertas

### Controller (controller.js)
- Coordinación entre Model y View
- Manejo de eventos del usuario
- Validaciones de formularios
- Flujo de la aplicación

## 💾 Persistencia de Datos

Los datos se guardan en **LocalStorage** del navegador:

```javascript
// Estructura de datos
localStorage.departamentos = [
  {
    id: "unique-id",
    nombre: "Depto 101",
    capacidad: 4,
    descripcion: "2 dormitorios",
    fechaCreacion: "2025-11-04T..."
  }
]

localStorage.reservas = [
  {
    id: "unique-id",
    departamentoId: "dept-id",
    huesped: "Juan Pérez",
    fechaEntrada: "2025-11-10",
    fechaSalida: "2025-11-15",
    fechaCreacion: "2025-11-04T..."
  }
]
```

## 🔒 Validaciones

### Departamentos
- ✅ Nombre requerido
- ✅ Capacidad mínima de 1 persona
- ✅ No se puede eliminar si tiene reservas

### Reservas
- ✅ Departamento debe existir
- ✅ Huésped requerido
- ✅ Fecha de salida > fecha de entrada
- ✅ No superposición de fechas en el mismo departamento

### Búsqueda
- ✅ Al menos un criterio requerido
- ✅ Ambas fechas o ninguna
- ✅ Validación de rango de fechas

## 📱 PWA (Progressive Web App)

### Características PWA

- **Instalable**: Se puede instalar en el dispositivo
- **Offline**: Funciona sin conexión a internet
- **Cache**: Service Worker cachea recursos
- **Responsive**: Se adapta a cualquier pantalla

### Cache Offline

El Service Worker cachea automáticamente:
- HTML, CSS, JavaScript
- Manifest y recursos estáticos
- Estrategia: Cache First, fallback a Network

## 🎨 Interfaz de Usuario

- **Diseño moderno** con gradientes y sombras
- **Tabs navegables** para organizar funcionalidades
- **Cards limpias** para formularios y listados
- **Botones coloridos** con estados hover
- **Badges** para estados (Activa, Próxima, Finalizada)
- **Alertas animadas** para feedback del usuario

## 🌐 Compatibilidad

- ✅ Chrome / Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Opera
- ✅ Navegadores móviles

## 🔧 Desarrollo y Extensión

### Agregar Nuevas Funcionalidades

1. **Model**: Agregar métodos de datos
2. **View**: Crear funciones de renderizado
3. **Controller**: Conectar eventos

### Ejemplo: Agregar campo "precio" a departamentos

```javascript
// 1. Model - Actualizar estructura
crearDepartamento(departamento) {
    const nuevoDepartamento = {
        // ... campos existentes
        precio: parseFloat(departamento.precio) || 0
    };
}

// 2. View - Agregar al formulario HTML
// <input type="number" id="dept-precio" placeholder="Precio por noche">

// 3. Controller - Capturar en submit
guardarDepartamento() {
    const datos = {
        // ... campos existentes
        precio: View.elements.deptPrecio.value
    };
}
```

## 🐛 Solución de Problemas

### Los datos no se guardan
- Verificar que el navegador permita LocalStorage
- Abrir la consola del navegador (F12) y buscar errores

### Service Worker no se registra
- Debe servirse desde `http://localhost` o `https://`
- Verificar en DevTools > Application > Service Workers

### La PWA no se instala
- Verificar que `manifest.json` sea accesible
- Debe tener HTTPS (o localhost para desarrollo)

## 📝 Notas Adicionales

- **Límite de LocalStorage**: ~5-10MB según navegador
- **Datos locales**: Los datos solo existen en el navegador actual
- **Backup**: Puedes exportar/importar datos (funcionalidad en Controller)

## 🎓 Aprendizaje

Este proyecto demuestra:
- Patrón arquitectónico MVC
- Manipulación del DOM
- LocalStorage API
- Service Workers
- PWA básica
- Validación de datos
- UX/UI moderna

## 👨‍💻 Autor

Desarrollado como proyecto de aprendizaje - Sistema de Gestión de Alquileres

---

## 📄 Licencia

Proyecto de código abierto - Libre para usar y modificar

---

**¡Disfruta gestionando tus alquileres! 🎉**
