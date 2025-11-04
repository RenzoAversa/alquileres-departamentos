// ========================================
// DATOS DE EJEMPLO PARA PRUEBAS
// ========================================
// Instrucciones:
// 1. Abre la consola del navegador (F12)
// 2. Copia y pega este código
// 3. Los datos de ejemplo se cargarán automáticamente
// 4. Recarga la página para ver los datos

// Datos de ejemplo
const datosEjemplo = {
    departamentos: [
        {
            id: "dept001",
            nombre: "Departamento 101 - Vista al Mar",
            capacidad: 4,
            descripcion: "2 dormitorios, balcón con vista panorámica, totalmente equipado",
            fechaCreacion: "2025-11-01T10:00:00.000Z"
        },
        {
            id: "dept002",
            nombre: "Departamento 202 - Céntrico",
            capacidad: 2,
            descripcion: "1 dormitorio, ideal para pareja, cerca de todo",
            fechaCreacion: "2025-11-01T10:15:00.000Z"
        },
        {
            id: "dept003",
            nombre: "Departamento 303 - Familiar",
            capacidad: 6,
            descripcion: "3 dormitorios, 2 baños, cocina completa, sala amplia",
            fechaCreacion: "2025-11-01T10:30:00.000Z"
        },
        {
            id: "dept004",
            nombre: "Studio A - Moderno",
            capacidad: 2,
            descripcion: "Studio moderno, WiFi, Smart TV, cocina americana",
            fechaCreacion: "2025-11-01T10:45:00.000Z"
        },
        {
            id: "dept005",
            nombre: "Penthouse 501",
            capacidad: 8,
            descripcion: "Penthouse de lujo, terraza privada, jacuzzi, 4 dormitorios",
            fechaCreacion: "2025-11-01T11:00:00.000Z"
        }
    ],
    reservas: [
        {
            id: "res001",
            departamentoId: "dept001",
            huesped: "María González",
            fechaEntrada: "2025-11-10",
            fechaSalida: "2025-11-15",
            fechaCreacion: "2025-11-02T14:00:00.000Z"
        },
        {
            id: "res002",
            departamentoId: "dept002",
            huesped: "Carlos Ramírez",
            fechaEntrada: "2025-11-08",
            fechaSalida: "2025-11-12",
            fechaCreacion: "2025-11-02T15:30:00.000Z"
        },
        {
            id: "res003",
            departamentoId: "dept003",
            huesped: "Familia Rodríguez",
            fechaEntrada: "2025-11-20",
            fechaSalida: "2025-11-27",
            fechaCreacion: "2025-11-03T09:00:00.000Z"
        },
        {
            id: "res004",
            departamentoId: "dept001",
            huesped: "Juan Pérez",
            fechaEntrada: "2025-11-18",
            fechaSalida: "2025-11-22",
            fechaCreacion: "2025-11-03T10:00:00.000Z"
        },
        {
            id: "res005",
            departamentoId: "dept004",
            huesped: "Ana Martínez",
            fechaEntrada: "2025-11-05",
            fechaSalida: "2025-11-07",
            fechaCreacion: "2025-11-01T16:00:00.000Z"
        }
    ]
};

// Cargar datos de ejemplo
function cargarDatosEjemplo() {
    try {
        localStorage.setItem('departamentos', JSON.stringify(datosEjemplo.departamentos));
        localStorage.setItem('reservas', JSON.stringify(datosEjemplo.reservas));
        console.log('✅ Datos de ejemplo cargados exitosamente');
        console.log('📊 Departamentos:', datosEjemplo.departamentos.length);
        console.log('📅 Reservas:', datosEjemplo.reservas.length);
        console.log('🔄 Recarga la página para ver los datos');
        alert('✅ Datos de ejemplo cargados!\n\n📊 5 Departamentos\n📅 5 Reservas\n\n🔄 Recarga la página (F5)');
    } catch (error) {
        console.error('❌ Error al cargar datos de ejemplo:', error);
        alert('❌ Error al cargar datos: ' + error.message);
    }
}

// Limpiar todos los datos
function limpiarDatos() {
    const confirmar = confirm('⚠️ ¿Estás seguro de eliminar TODOS los datos?\n\nEsta acción no se puede deshacer.');
    if (confirmar) {
        localStorage.removeItem('departamentos');
        localStorage.removeItem('reservas');
        console.log('🗑️ Todos los datos han sido eliminados');
        console.log('🔄 Recarga la página');
        alert('🗑️ Todos los datos eliminados\n\n🔄 Recarga la página (F5)');
    }
}

// Mostrar datos actuales
function mostrarDatos() {
    const departamentos = JSON.parse(localStorage.getItem('departamentos') || '[]');
    const reservas = JSON.parse(localStorage.getItem('reservas') || '[]');
    
    console.log('📊 DATOS ACTUALES EN LOCALSTORAGE:');
    console.log('==================================');
    console.log('Departamentos:', departamentos);
    console.log('Reservas:', reservas);
    console.log('==================================');
    console.log('Total Departamentos:', departamentos.length);
    console.log('Total Reservas:', reservas.length);
}

// Exportar datos como JSON descargable
function exportarDatos() {
    const departamentos = JSON.parse(localStorage.getItem('departamentos') || '[]');
    const reservas = JSON.parse(localStorage.getItem('reservas') || '[]');
    const datos = {
        departamentos,
        reservas,
        fecha: new Date().toISOString()
    };
    
    const json = JSON.stringify(datos, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-alquileres-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ Datos exportados exitosamente');
    alert('✅ Datos exportados como JSON');
}

// Instrucciones
console.log('╔════════════════════════════════════════════╗');
console.log('║   UTILIDADES PARA DATOS DE EJEMPLO        ║');
console.log('╚════════════════════════════════════════════╝');
console.log('');
console.log('📋 Comandos disponibles:');
console.log('');
console.log('  cargarDatosEjemplo()  - Cargar 5 deptos y 5 reservas');
console.log('  limpiarDatos()        - Eliminar todos los datos');
console.log('  mostrarDatos()        - Ver datos actuales');
console.log('  exportarDatos()       - Descargar backup JSON');
console.log('');
console.log('💡 Tip: Copia y pega el comando en la consola');
console.log('');
