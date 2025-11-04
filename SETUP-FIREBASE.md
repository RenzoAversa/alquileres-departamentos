# 🔥 Configuración de Firebase para Sincronización

## 📋 Paso 1: Crear Proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en **"Agregar proyecto"**
3. Nombra tu proyecto: `alquileres-departamentos`
4. Desactiva Google Analytics (no es necesario)
5. Haz clic en **"Crear proyecto"**

## 📋 Paso 2: Registrar tu App Web

1. En la página principal de tu proyecto, haz clic en el ícono **</>** (Web)
2. Nickname de la app: `Gestión Alquileres`
3. **NO marques** "Firebase Hosting"
4. Haz clic en **"Registrar app"**
5. **Copia el código de configuración** que aparece (algo como esto):

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "alquileres-xxxx.firebaseapp.com",
  projectId: "alquileres-xxxx",
  storageBucket: "alquileres-xxxx.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:xxxxxxxxxxxxx"
};
```

6. Pega estos valores en el archivo `js/firebase-config.js`

## 📋 Paso 3: Configurar Firestore Database

1. En el menú lateral, ve a **"Compilación"** → **"Firestore Database"**
2. Haz clic en **"Crear base de datos"**
3. Selecciona **"Comenzar en modo de prueba"** (por ahora)
4. Ubicación: Elige la más cercana a ti (ej: `southamerica-east1` para Argentina)
5. Haz clic en **"Habilitar"**

## 📋 Paso 4: Configurar Reglas de Seguridad

1. En Firestore Database, ve a la pestaña **"Reglas"**
2. Reemplaza el contenido con:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir lectura y escritura a todos (temporal para desarrollo)
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Haz clic en **"Publicar"**

⚠️ **IMPORTANTE**: Estas reglas son para desarrollo. Para producción, implementa autenticación.

## 📋 Paso 5: Actualizar tu Configuración

1. Abre el archivo `js/firebase-config.js`
2. Reemplaza los valores de `firebaseConfig` con los tuyos
3. Guarda el archivo

## 📋 Paso 6: Probar la Sincronización

1. Abre tu aplicación en el navegador
2. Crea un departamento o reserva
3. Abre la aplicación en otro dispositivo o navegador
4. ¡Deberías ver los mismos datos! 🎉

## 🔐 Paso 7: Seguridad (Recomendado para Producción)

### Opción A: Autenticación Anónima

1. Ve a **"Autenticación"** → **"Método de acceso"**
2. Activa **"Anónimo"**
3. Actualiza las reglas de Firestore:

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

### Opción B: Autenticación con Email

1. Ve a **"Autenticación"** → **"Método de acceso"**
2. Activa **"Correo electrónico/contraseña"**
3. Implementa login/registro en tu app

## 📊 Monitorear Uso

1. Ve a **"Firestore Database"** → **"Uso"**
2. Firebase gratis incluye:
   - ✅ 50,000 lecturas/día
   - ✅ 20,000 escrituras/día
   - ✅ 20,000 eliminaciones/día
   - ✅ 1 GB almacenamiento

## 🆘 Solución de Problemas

### Error: "Firebase is not defined"
- Verifica que hayas pegado tu configuración en `firebase-config.js`
- Recarga la página con Ctrl+F5

### Los datos no se sincronizan
- Verifica las reglas de Firestore
- Abre la consola del navegador (F12) para ver errores
- Verifica que tu proyecto tenga Firestore habilitado

### Error de CORS
- Asegúrate de que tu dominio esté en la lista blanca en Firebase
- Ve a **Configuración del proyecto** → **Dominios autorizados**

## 📚 Recursos Útiles

- [Documentación de Firebase](https://firebase.google.com/docs)
- [Firestore Guides](https://firebase.google.com/docs/firestore)
- [Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

---

✅ Una vez configurado, tus datos se sincronizarán automáticamente entre todos tus dispositivos!
