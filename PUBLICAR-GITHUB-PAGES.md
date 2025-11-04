# 🌐 Guía: Publicar en GitHub Pages (GRATIS)

## ¿Qué es GitHub Pages?
Hosting gratuito de GitHub para sitios web estáticos. Perfecto para nuestra PWA.

## 📋 Requisitos Previos
- Cuenta de GitHub (gratis): https://github.com/signup
- Git instalado en tu PC (opcional, también se puede hacer desde la web)

---

## 🚀 Método 1: Desde la Web de GitHub (MÁS FÁCIL)

### Paso 1: Crear Repositorio
1. Ve a https://github.com
2. Inicia sesión
3. Clic en el botón verde "New" (Nuevo repositorio)
4. Nombre: `alquileres-departamentos` (o el que prefieras)
5. Marcar: **✅ Public**
6. Marcar: **✅ Add a README file**
7. Clic en "Create repository"

### Paso 2: Subir Archivos
1. En tu repositorio, clic en "Add file" → "Upload files"
2. Arrastra TODOS los archivos del proyecto:
   - index.html
   - manifest.json
   - sw.js
   - README.md
   - Carpeta css/ (con style.css)
   - Carpeta js/ (con model.js, view.js, controller.js)
3. Escribe un mensaje: "Subir aplicación de alquileres"
4. Clic en "Commit changes"

### Paso 3: Activar GitHub Pages
1. En tu repositorio, ve a "Settings" (Configuración)
2. En el menú lateral, busca "Pages"
3. En "Source", selecciona: **main** (o master)
4. Clic en "Save"
5. Espera 1-2 minutos

### Paso 4: Obtener tu URL
Tu sitio estará en:
```
https://TU-USUARIO.github.io/alquileres-departamentos/
```

⚠️ **IMPORTANTE:** Edita `sw.js` y cambia las rutas antes de subir:

```javascript
// Cambiar esto:
const CACHE_URLS = [
    '/',
    '/index.html',
    '/css/style.css',
    // ...
];

// Por esto:
const CACHE_URLS = [
    '/alquileres-departamentos/',
    '/alquileres-departamentos/index.html',
    '/alquileres-departamentos/css/style.css',
    '/alquileres-departamentos/js/model.js',
    '/alquileres-departamentos/js/view.js',
    '/alquileres-departamentos/js/controller.js',
    '/alquileres-departamentos/manifest.json'
];
```

Y en `manifest.json`:
```json
{
  "start_url": "/alquileres-departamentos/index.html",
  "scope": "/alquileres-departamentos/"
}
```

---

## 🚀 Método 2: Con Git (Para usuarios avanzados)

### Instalar Git
1. Descargar: https://git-scm.com/download/win
2. Instalar con opciones por defecto

### Comandos en PowerShell:
```powershell
# Ir a la carpeta del proyecto
cd C:\xampp\htdocs\Pruebas\prueba_lucri

# Inicializar repositorio
git init

# Agregar archivos
git add .

# Hacer commit
git commit -m "Primera versión de la app"

# Conectar con GitHub (reemplaza TU-USUARIO y REPO)
git remote add origin https://github.com/TU-USUARIO/alquileres-departamentos.git

# Subir archivos
git branch -M main
git push -u origin main
```

Luego activar GitHub Pages desde Settings → Pages

---

## 🔄 Actualizar el Sitio

### Método Web:
1. Ve a tu repositorio en GitHub
2. Navega al archivo que quieres editar
3. Clic en el ícono del lápiz (Edit)
4. Haz cambios
5. Clic en "Commit changes"
6. Espera 1-2 minutos, los cambios se aplicarán automáticamente

### Método Git:
```powershell
# Hacer cambios en los archivos localmente
# Luego:
git add .
git commit -m "Descripción de cambios"
git push
```

---

## ✅ Verificar que Funciona

1. Abre tu URL: `https://TU-USUARIO.github.io/alquileres-departamentos/`
2. Verifica que:
   - La página carga correctamente
   - Puedes agregar departamentos
   - Los datos se guardan en LocalStorage
   - La PWA se puede instalar

---

## 📱 Compartir con tu Madre

1. Envíale la URL
2. Que la abra en su navegador (Chrome recomendado)
3. En móvil: puede instalarla como app
4. Los datos se guardan en SU navegador (LocalStorage)

---

## ⚠️ Consideraciones Importantes

### LocalStorage es Local
- Cada dispositivo tiene sus propios datos
- Los datos de tu madre NO se sincronizarán entre dispositivos
- Si borra datos del navegador, pierde la información

### Solución: Exportar/Importar
Tu madre puede:
1. Usar `exportarDatos()` en la consola para hacer backup
2. Guardar el archivo JSON
3. Importar en otro dispositivo si es necesario

---

## 🎯 ¿Necesitas Sincronización entre Dispositivos?

Si tu madre necesita acceder desde múltiples dispositivos con los MISMOS datos, necesitarás una base de datos en la nube. Ver: `OPCIONES-CLOUD.md`

---

## 💡 Tips

- **Dominio personalizado**: Puedes usar un dominio gratis en GitHub Pages
- **HTTPS automático**: GitHub Pages incluye certificado SSL
- **Sin límites**: Úsalo todo lo que quieras, es gratis
- **Sin publicidad**: Tu sitio es 100% tuyo

---

## 🆘 Problemas Comunes

### "404 - Page not found"
- Espera 5 minutos después de activar Pages
- Verifica que `index.html` esté en la raíz

### "La PWA no se instala"
- Verifica que las rutas en `manifest.json` y `sw.js` sean correctas
- GitHub Pages usa HTTPS automáticamente (necesario para PWA)

### "Los cambios no aparecen"
- GitHub Pages puede tardar 1-2 minutos en actualizar
- Limpia caché del navegador (Ctrl + F5)

---

**¡Listo! Tu madre podrá acceder desde cualquier lugar con internet 🌐**
