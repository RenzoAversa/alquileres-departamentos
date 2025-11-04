# ✅ CHECKLIST: Subir a GitHub Pages

## 🎯 Ya hiciste los cambios necesarios en el código

He modificado automáticamente:
- ✅ `sw.js` - Rutas ajustadas para GitHub Pages
- ✅ `manifest.json` - Start URL y scope actualizados

---

## 📤 Siguiente Paso: Subir a GitHub

### Método 1: Desde la Web de GitHub (MÁS FÁCIL)

#### Paso 1: Ve a tu repositorio
```
https://github.com/TU-USUARIO/prueba_lucri
```

#### Paso 2: Subir los archivos modificados

**Opción A: Subir todos los archivos de nuevo**
1. Clic en "Add file" → "Upload files"
2. Arrastra TODA la carpeta `prueba_lucri`
3. Marca: "Replace all files"
4. Escribe mensaje: "Ajustar rutas para GitHub Pages"
5. Clic en "Commit changes"

**Opción B: Actualizar solo los 2 archivos modificados**
1. Ve a `sw.js` en tu repositorio
2. Clic en el ícono del lápiz (✏️ Edit)
3. Copia y pega el contenido del archivo local `sw.js`
4. Clic en "Commit changes"
5. Repite lo mismo con `manifest.json`

---

### Método 2: Con Git (Si ya lo usaste antes)

```powershell
# Ir a la carpeta del proyecto
cd C:\xampp\htdocs\Pruebas\prueba_lucri

# Ver qué archivos cambiaron
git status

# Agregar los archivos modificados
git add sw.js manifest.json

# Hacer commit
git commit -m "Ajustar rutas para GitHub Pages"

# Subir a GitHub
git push
```

---

## ⏱️ Esperar Deploy

Después de subir los archivos:
1. ✅ Espera **1-2 minutos**
2. ✅ GitHub Pages se actualizará automáticamente
3. ✅ Prueba tu URL

---

## 🌐 Tu URL Final

Tu aplicación estará en:
```
https://TU-USUARIO.github.io/prueba_lucri/
```

**Ejemplo:**
- Si tu usuario es "juanperez"
- URL: `https://juanperez.github.io/prueba_lucri/`

---

## ✅ Verificar que Todo Funciona

Abre tu URL y verifica:

### 1. La página carga correctamente
- ✅ Se ve el diseño
- ✅ Los tabs funcionan
- ✅ Los formularios se muestran

### 2. LocalStorage funciona
- ✅ Agrega un departamento
- ✅ Recarga la página (F5)
- ✅ El departamento sigue ahí

### 3. PWA funciona
- ✅ En Chrome, aparece el ícono de instalación ➕ en la barra
- ✅ Puedes instalarlo como app
- ✅ Funciona offline (cierra internet y prueba)

### 4. Service Worker registrado
- ✅ Abre DevTools (F12)
- ✅ Ve a "Application" → "Service Workers"
- ✅ Debe aparecer el Service Worker activo

---

## 🐛 Si Algo No Funciona

### Problema: "404 - Page not found"
**Solución:**
- Espera 5 minutos más
- Verifica que activaste GitHub Pages en Settings → Pages
- Verifica que elegiste la rama "main"

### Problema: "La PWA no se instala"
**Solución:**
- Verifica que usas HTTPS (GitHub Pages lo da automático)
- Limpia caché del navegador (Ctrl + Shift + Delete)
- Recarga con Ctrl + F5

### Problema: "Service Worker error"
**Solución:**
1. Abre DevTools (F12) → Console
2. Busca errores rojos
3. Si dice "Failed to fetch", verifica las rutas en `sw.js`
4. Asegúrate que el nombre del repo en `sw.js` coincide con tu repositorio

### Problema: "Los datos no se guardan"
**Solución:**
- Abre DevTools (F12) → Application → Local Storage
- Verifica que LocalStorage esté habilitado
- No uses modo incógnito

---

## 📱 Compartir con tu Madre

Una vez que todo funcione:

1. **Copia tu URL:**
   ```
   https://TU-USUARIO.github.io/prueba_lucri/
   ```

2. **Envíasela por WhatsApp/Email/etc.**

3. **Instrucciones para ella:**
   ```
   Hola mamá 👋
   
   Entra a este link desde tu navegador (Chrome preferiblemente):
   [TU URL AQUÍ]
   
   Para instalarlo en tu celular:
   1. Abre el link
   2. Toca el menú (⋮) arriba a la derecha
   3. Selecciona "Instalar app" o "Agregar a pantalla de inicio"
   4. ¡Listo! Ahora tienes el ícono en tu celular
   
   Ahí puedes:
   - Agregar departamentos
   - Registrar reservas
   - Buscar disponibilidad
   
   Los datos se guardan automáticamente en tu celular.
   ```

---

## 🔄 Para Actualizar en el Futuro

Cuando hagas cambios en el código:

**Método Web:**
1. Edita el archivo en GitHub
2. Commit changes
3. Espera 1-2 minutos

**Método Git:**
```powershell
git add .
git commit -m "Descripción del cambio"
git push
```

---

## ⚠️ IMPORTANTE: Nombre del Repositorio

Los cambios que hice asumen que tu repositorio se llama **"prueba_lucri"**.

**Si tu repositorio tiene otro nombre:**

1. Abre `sw.js`
2. Encuentra esta línea:
   ```javascript
   const REPO_NAME = '/prueba_lucri';
   ```
3. Cámbiala por tu nombre de repo:
   ```javascript
   const REPO_NAME = '/tu-nombre-de-repo';
   ```

4. Abre `manifest.json`
5. Cambia:
   ```json
   "start_url": "/tu-nombre-de-repo/index.html",
   "scope": "/tu-nombre-de-repo/",
   ```

---

## 🎉 ¡Listo!

Ahora solo:
1. ✅ Sube los archivos a GitHub
2. ✅ Espera 1-2 minutos
3. ✅ Abre tu URL
4. ✅ ¡Disfruta tu app online!

---

**¿Tienes algún error o duda? ¡Avísame!** 😊
