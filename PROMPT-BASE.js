// ========================================
// 🚀 PROMPT BASE PARA COPILOT
// ========================================
// Este es el prompt maestro que generó este proyecto completo
// Úsalo como referencia para futuros proyectos similares

/*

🚀 Proyecto: Registro de Alquileres (PWA sin backend)

Objetivo:
Crear una aplicación web simple en JavaScript (HTML + CSS + JS) usando patrón MVC
sin backend, que funcione 100% en el navegador usando LocalStorage como base de datos.
Debe permitir gestionar departamentos y reservas, y buscar disponibilidad.

Estructura del proyecto:
/index.html
/css/style.css
/js/model.js
/js/view.js
/js/controller.js
/manifest.json
/sw.js

--------------------------
Funcionalidades principales:

1️⃣ Departamentos
- Agregar, editar y eliminar departamentos.
- Cada departamento tiene: id, nombre, capacidad, descripción opcional.

2️⃣ Reservas
- Registrar alquileres asociados a un departamento existente.
- Cada reserva tiene: id, departamentoId, nombre del huésped, fechaEntrada, fechaSalida.
- Evitar superposición de reservas en el mismo departamento.

3️⃣ Búsqueda de disponibilidad
- Filtrar departamentos por:
  a) Rango de fechas (fechaEntrada, fechaSalida)
  b) Cantidad de personas (capacidad >= buscada)
- Mostrar solo los departamentos disponibles en ese rango.

4️⃣ Persistencia
- Todos los datos se guardan en LocalStorage:
  localStorage.departamentos = []
  localStorage.reservas = []
- Métodos para CRUD completo (create, read, update, delete).

5️⃣ Interfaz
- Formulario para agregar departamentos
- Formulario para registrar reservas
- Buscador de disponibilidad
- Listado dinámico de departamentos y reservas
- Botones para eliminar o editar entradas

6️⃣ MVC
- model.js: maneja almacenamiento y lógica de datos.
- view.js: renderiza el DOM (formularios, listas, resultados).
- controller.js: conecta eventos y coordina vista + modelo.

7️⃣ PWA
- manifest.json con nombre, ícono y configuración.
- sw.js para cache offline.
- index.html registra el service worker.

--------------------------
Instrucciones para Copilot:
→ Generar los archivos base con el contenido inicial.
→ Crear funciones en el modelo para manejar departamentos y reservas.
→ En la vista, usar HTML dinámico con plantillas JS (no frameworks).
→ En el controlador, manejar eventos de los formularios y actualizaciones de la vista.
→ Usar Bootstrap o CSS simple para estilo limpio y responsive.
→ Comentar el código claramente para facilitar mantenimiento.

*/

// ========================================
// 📋 ESPECIFICACIONES DETALLADAS
// ========================================

/*

MODELO DE DATOS:

Departamento:
{
  id: string (único, generado automáticamente)
  nombre: string (requerido)
  capacidad: number (requerido, mínimo 1)
  descripcion: string (opcional)
  fechaCreacion: ISO string
}

Reserva:
{
  id: string (único, generado automáticamente)
  departamentoId: string (referencia a departamento)
  huesped: string (requerido)
  fechaEntrada: string YYYY-MM-DD (requerido)
  fechaSalida: string YYYY-MM-DD (requerido)
  fechaCreacion: ISO string
}

--------------------------
VALIDACIONES REQUERIDAS:

Departamentos:
✓ Nombre no vacío
✓ Capacidad >= 1
✓ No eliminar si tiene reservas asociadas

Reservas:
✓ Departamento debe existir
✓ Huésped no vacío
✓ fechaSalida > fechaEntrada
✓ No superposición con otras reservas del mismo departamento

Búsqueda:
✓ Si se filtran fechas, ambas deben estar presentes
✓ Capacidad debe ser número positivo
✓ Al menos un criterio debe estar definido

--------------------------
FUNCIONALIDADES DEL MODEL:

init()
obtenerDepartamentos()
obtenerDepartamentoPorId(id)
crearDepartamento(datos)
actualizarDepartamento(id, datos)
eliminarDepartamento(id)

obtenerReservas()
obtenerReservaPorId(id)
crearReserva(datos)
actualizarReserva(id, datos)
eliminarReserva(id)

verificarDisponibilidad(departamentoId, fechaEntrada, fechaSalida, excludeReservaId)
buscarDepartamentosDisponibles(criterios)
obtenerReservasPorDepartamento(departamentoId)

generarId()
exportarDatos()
importarDatos(datos)

--------------------------
FUNCIONALIDADES DE LA VIEW:

renderizarDepartamentos(departamentos)
cargarDepartamentoEnFormulario(departamento)
limpiarFormularioDepartamento()

renderizarReservas(reservas, departamentos)
llenarSelectDepartamentos(departamentos)
cargarReservaEnFormulario(reserva)
limpiarFormularioReserva()

renderizarResultadosBusqueda(departamentos, criterios)
cambiarTab(tabName)

mostrarAlerta(mensaje, tipo, duracion)
confirmar(mensaje)
formatearFecha(fechaISO)

--------------------------
FUNCIONALIDADES DEL CONTROLLER:

init()
configurarEventosTabs()
configurarEventosDepartamentos()
configurarEventosReservas()
configurarEventosBusqueda()

guardarDepartamento()
editarDepartamento(id)
eliminarDepartamento(id)
actualizarVistaDepartamentos()

guardarReserva()
editarReserva(id)
eliminarReserva(id)
actualizarVistaReservas()

buscarDisponibilidad()
exportarDatos()
importarDatos(archivo)

--------------------------
INTERFAZ DE USUARIO:

Tabs:
[Departamentos] [Reservas] [Buscar Disponibilidad]

Tab Departamentos:
- Formulario: nombre, capacidad, descripción
- Lista de departamentos con botones editar/eliminar

Tab Reservas:
- Formulario: select departamento, huésped, fecha entrada, fecha salida
- Lista de reservas con badges de estado (Activa, Próxima, Finalizada)

Tab Buscador:
- Formulario: fecha entrada, fecha salida, capacidad
- Resultados con departamentos disponibles

--------------------------
PWA CONFIGURACIÓN:

manifest.json:
- name, short_name
- start_url, display: standalone
- icons (192x192, 512x512)
- theme_color, background_color

sw.js:
- Cache: HTML, CSS, JS, manifest
- Estrategia: Cache First, fallback Network
- Eventos: install, activate, fetch

--------------------------
ESTILOS CSS:

- Variables CSS para colores
- Diseño responsive (mobile-first)
- Cards con sombras
- Botones con colores semánticos (primary, danger, warning)
- Animaciones suaves
- Grid/Flexbox para layouts

*/

// ========================================
// 🎓 CONCEPTOS CLAVE
// ========================================

/*

MVC (Model-View-Controller):
- Separación de responsabilidades
- Model: Lógica de negocio y datos
- View: Presentación y UI
- Controller: Coordinación entre Model y View

LocalStorage:
- Almacenamiento persistente en el navegador
- Limitado a ~5-10MB
- Solo strings (usar JSON.stringify/parse)
- localStorage.setItem('key', value)
- localStorage.getItem('key')

PWA (Progressive Web App):
- Instalable en dispositivos
- Funciona offline con Service Workers
- Experiencia nativa
- manifest.json para metadatos

Service Workers:
- Scripts en background
- Interceptan peticiones de red
- Cachean recursos para offline
- Eventos: install, activate, fetch

Validación de fechas:
- Evitar superposición de rangos
- Comparar Date objects
- Verificar conflictos en reservas

*/

// ========================================
// 🚀 EXTENSIONES FUTURAS
// ========================================

/*

Ideas para mejorar:

1. Precios y pagos
   - Agregar campo precio por noche
   - Calcular total de reserva
   - Registro de pagos

2. Estados de reserva
   - Confirmada, Pendiente, Cancelada
   - Flujo de confirmación

3. Fotos de departamentos
   - Upload de imágenes (base64 en LocalStorage)
   - Galería de fotos

4. Calendario visual
   - Vista de calendario mensual
   - Drag & drop para reservas

5. Exportar/Importar
   - Backup automático
   - Sincronización con cloud (Firebase, etc.)

6. Notificaciones
   - Recordatorios de check-in
   - Push notifications

7. Estadísticas
   - Dashboard con gráficos
   - Ocupación por mes
   - Ingresos totales

8. Multi-idioma
   - Internacionalización (i18n)
   - Español/Inglés/Portugués

9. Modo oscuro
   - Toggle dark/light theme
   - Persistir preferencia

10. Backend opcional
    - API REST (Node.js + Express)
    - Base de datos (MongoDB, PostgreSQL)
    - Autenticación de usuarios

*/

// ========================================
// 📚 RECURSOS DE APRENDIZAJE
// ========================================

/*

MDN Web Docs:
- LocalStorage: https://developer.mozilla.org/es/docs/Web/API/Window/localStorage
- Service Workers: https://developer.mozilla.org/es/docs/Web/API/Service_Worker_API
- PWA: https://developer.mozilla.org/es/docs/Web/Progressive_web_apps

Google Developers:
- PWA Checklist: https://web.dev/pwa-checklist/
- Service Worker Lifecycle: https://web.dev/service-worker-lifecycle/

Tutoriales:
- JavaScript MVC: Buscar "JavaScript MVC pattern tutorial"
- LocalStorage CRUD: Buscar "localStorage CRUD JavaScript"
- PWA Tutorial: Buscar "Progressive Web App tutorial"

*/

console.log('📝 Prompt base cargado - Referencia para futuros proyectos');
