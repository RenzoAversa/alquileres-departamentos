// ========================================
// FIREBASE CONFIG
// Configuración de Firebase para sincronización
// ========================================

// IMPORTANTE: Reemplaza estos valores con los de tu proyecto Firebase
// Instrucciones en: SETUP-FIREBASE.md

const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto-id",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "tu-app-id"
};

// Exportar configuración
window.firebaseConfig = firebaseConfig;

console.log('🔥 Firebase Config cargado');
