// ============================================================
// PLANTILLA de configuración por cliente.
// El script scripts/nuevo-cliente.sh usa este archivo para
// generar public/config/client.config.js reemplazando los __PLACEHOLDERS__.
// NO edites este archivo con datos reales; es solo el molde.
// ============================================================
export const config = {
  // Claves del proyecto de Firebase de ESTE cliente
  firebase: {
    apiKey: "__API_KEY__",
    authDomain: "__PROJECT_ID__.firebaseapp.com",
    projectId: "__PROJECT_ID__",
    storageBucket: "__PROJECT_ID__.firebasestorage.app",
    messagingSenderId: "__SENDER_ID__",
    appId: "__APP_ID__"
  },
  // Identidad visual del cliente
  cliente: {
    nombre: "__NOMBRE__",
    logo: "",                 // URL opcional; si vacío, se usa la inicial
    colorPrimario: "__COLOR__"
  },
  // Módulos habilitados para este cliente (feature flags)
  features: {
    dashboard: true,
    propiedades: true,
    reservas: true,
    calendario: true,
    mapa: true,
    contabilidad: true,
    reportes: true,
    web: false,                // sitio público (se activa para el cliente que lo pague)
    fotos: false               // campo "Foto (URL)" en edificios/deptos (solo si tiene web pública)
  },
  // Preferencias
  moneda: "ARS",
  zonaHoraria: "America/Argentina/Buenos_Aires"
};
