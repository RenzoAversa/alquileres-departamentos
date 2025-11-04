# 🚀 Guía Rápida de Inicio

## 📝 Cómo Empezar

### 1️⃣ Abrir la Aplicación
```
http://localhost/prueba_lucri/index.html
```

### 2️⃣ Cargar Datos de Ejemplo (Opcional)

Para probar rápidamente, abre la consola del navegador (F12) y ejecuta:

```javascript
// Opción 1: Cargar el script de datos de ejemplo
// En la consola, copia y pega el contenido de datos-ejemplo.js

// Opción 2: Usar el comando directo
cargarDatosEjemplo();
```

### 3️⃣ Empezar a Usar

1. **Agregar tu primer departamento**
   - Pestaña "Departamentos"
   - Llenar el formulario
   - Guardar

2. **Crear una reserva**
   - Pestaña "Reservas"
   - Seleccionar departamento
   - Ingresar datos del huésped
   - Definir fechas
   - Guardar

3. **Buscar disponibilidad**
   - Pestaña "Buscar Disponibilidad"
   - Ingresar criterios
   - Buscar

## 🎯 Casos de Uso Rápidos

### ✅ Agregar Departamento
```
Nombre: Depto 101
Capacidad: 4
Descripción: 2 dormitorios, vista al mar
```

### ✅ Crear Reserva
```
Departamento: [Seleccionar de la lista]
Huésped: Juan Pérez
Entrada: 2025-11-10
Salida: 2025-11-15
```

### ✅ Buscar Disponibilidad
```
Fecha Entrada: 2025-11-20
Fecha Salida: 2025-11-25
Capacidad: 2
```

## 🔧 Comandos de Consola Útiles

```javascript
// Ver datos actuales
Model.obtenerDepartamentos()
Model.obtenerReservas()

// Limpiar todo
Model.limpiarTodo()

// Exportar datos
Controller.exportarDatos()

// Ver estructura de datos
Model.exportarDatos()
```

## 📱 Instalar como PWA

### Chrome / Edge:
1. Clic en el ícono ➕ en la barra de direcciones
2. Seleccionar "Instalar Registro de Alquileres"
3. La app aparecerá como aplicación independiente

### Firefox:
1. Menú → Instalar sitio como aplicación
2. Confirmar instalación

## 🐛 Soluciones Rápidas

### ❌ No se guardan los datos
- Verificar que LocalStorage esté habilitado
- Abrir en modo normal (no incógnito)

### ❌ Service Worker no funciona
- Debe estar en `localhost` o `https://`
- Verificar en DevTools → Application → Service Workers

### ❌ No aparecen los departamentos en reservas
- Primero crear al menos un departamento
- Cambiar a la pestaña de reservas

## 💡 Tips

- **Editar**: Clic en el botón ✏️ Editar
- **Eliminar**: Clic en el botón 🗑️ Eliminar
- **Cancelar edición**: Botón "Cancelar" que aparece al editar
- **Ver detalles**: Los badges muestran el estado de las reservas

## 🎨 Personalización

### Cambiar colores
Editar `css/style.css` en la sección `:root`:

```css
:root {
    --primary-color: #4A90E2;    /* Azul principal */
    --secondary-color: #50C878;  /* Verde */
    --danger-color: #E74C3C;     /* Rojo */
}
```

### Agregar campos
1. Editar `index.html` (agregar input)
2. Editar `model.js` (agregar propiedad)
3. Editar `controller.js` (capturar valor)

## 📊 Estructura de Datos

### LocalStorage
```javascript
localStorage.departamentos = [
  { id, nombre, capacidad, descripcion, fechaCreacion }
]

localStorage.reservas = [
  { id, departamentoId, huesped, fechaEntrada, fechaSalida, fechaCreacion }
]
```

## 🔐 Validaciones Automáticas

✅ No permite reservas superpuestas
✅ Fecha salida > fecha entrada
✅ Capacidad mínima 1
✅ Campos requeridos validados
✅ No eliminar deptos con reservas

---

## 🌐 ¿Quieres Ponerla Online?

Si quieres que tu madre (o cualquier persona) pueda acceder desde cualquier lugar **SIN PAGAR HOSTING:**

📖 **Lee:** `COMO-PONERLA-ONLINE.md`

**Opciones 100% gratuitas:**
- GitHub Pages
- Netlify (más fácil)
- Vercel
- Firebase
- Y más...

**Tiempo de configuración:** 3-10 minutos ⏱️

---

**¡Todo listo para gestionar tus alquileres! 🎉**
