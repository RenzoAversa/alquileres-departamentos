// ============================================================
// CONFIGURACIÓN DEL CLIENTE (este archivo SÍ se commitea: GitHub
// Pages necesita servirlo, y las claves web de Firebase son públicas
// por diseño — la seguridad real está en las reglas de Firestore).
// Este es el ÚNICO archivo que cambia de un cliente a otro.
// Regeneralo por cliente con:  npm run nuevo-cliente
// ============================================================
export const config = {
  firebase: {
    apiKey: "AIzaSyBdg_poljdnemkeX2gXn5EPJGldnjGB6VI",
    authDomain: "alquileres-314f3.firebaseapp.com",
    projectId: "alquileres-314f3",
    storageBucket: "alquileres-314f3.firebasestorage.app",
    messagingSenderId: "395689889099",
    appId: "1:395689889099:web:38a9cd9be4cfdefa0e2cce"
  },
  cliente: {
    nombre: "Lucrecia Garcia",
    logo: "",
    colorPrimario: "#2563eb"
  },
  features: {
    dashboard: true,
    propiedades: true,
    reservas: true,
    calendario: true,
    mapa: true,
    contabilidad: true,
    reportes: true,
    web: false,
    fotos: false
  },
  moneda: "ARS",
  zonaHoraria: "America/Argentina/Buenos_Aires"
};
