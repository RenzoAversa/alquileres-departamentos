# 🚀 Alta de un cliente nuevo — paso a paso

Cada cliente = **su propio proyecto de Firebase** (base de datos aislada + cuota gratis
propia) y **su propia publicación** (GitHub Pages o Firebase Hosting). El código es el
mismo; solo cambia un archivo de configuración.

Tiempo estimado: ~10 minutos.

---

## 1. Crear la base de datos (Firebase)

1. Entrá a <https://console.firebase.google.com> → **Agregar proyecto**. Ponele el nombre
   del cliente y creá el proyecto.
2. Dentro del proyecto, **Agregar app → Web** (ícono `</>`). Registrala y copiá el objeto
   `firebaseConfig` (vas a necesitar `apiKey`, `projectId`, `appId`, `messagingSenderId`).
3. **Build → Authentication → Comenzar → Sign-in method →** activá **Correo/contraseña**.
4. **Authentication → Users → Agregar usuario:** creá el usuario del dueño (email +
   contraseña). El **primer** usuario que inicie sesión queda automáticamente como
   **dueño**. Para sumar encargados/trabajadores: el dueño los carga por email en
   *Configuración → Usuarios y roles*, y su cuenta de acceso se crea acá en Auth.
5. **Build → Firestore Database → Crear base de datos** (modo producción, región la más
   cercana).

> Las claves web (`apiKey`, etc.) son **públicas por diseño**. La seguridad real está en
> las reglas de Firestore + el login. No hay problema en que queden en el repo.

---

## 2. Generar la configuración del cliente

Desde la carpeta del proyecto:

```bash
npm run nuevo-cliente
```

Te va a pedir el nombre, el color y las claves de Firebase, y genera:
- `.firebaserc` (apunta al proyecto del cliente)
- `config/client.config.js` (claves + marca del cliente)

En ese archivo también podés prender/apagar módulos por cliente (`features`) y cambiar el
color (`cliente.colorPrimario`).

---

## 3. Subir las reglas de seguridad (una vez)

Las reglas hacen que la base solo sea accesible con login. Subilas con la Firebase CLI:

```bash
npm install                     # ya incluye firebase-tools como devDependency
npx firebase login              # una sola vez en tu compu
npm run deploy:rules            # sube firestore.rules + índices
```

---

## 4. Publicar la app — elegí UNA opción

### Opción A — GitHub Pages (gratis, recomendada para tu caso)

> Este repo (alquileres-departamentos) ya está publicado así: Pages sirve directo
> desde la rama `main`, carpeta raíz (Settings → Pages → Source: rama `main` / `/`).
> Cada push a `main` republica sola, sin workflow. Los pasos de abajo son para dar de
> alta un cliente nuevo en un repo propio.

1. Creá un **repo nuevo** en GitHub para este cliente.
2. Subí el proyecto:
   ```bash
   git init
   git add -A
   git commit -m "Alta cliente"
   git branch -M main
   git remote add origin <URL-del-repo>
   git push -u origin main
   ```
3. En el repo: **Settings → Pages → Source: rama `main`, carpeta `/`** (modo clásico,
   sin workflow, igual que este repo). En un minuto tenés la URL
   (`https://usuario.github.io/repo/`).

> La app usa rutas relativas y navegación por hash, así que funciona perfecto bajo el
> subdirectorio de GitHub Pages.

### Opción B — Firebase Hosting

```bash
npm run deploy        # publica la app en https://<projectId>.web.app
```

---

## 5. Roles y usuarios

El sistema tiene tres roles (más "visitante", que llegará con la web pública):

| Rol | Ve / puede |
|---|---|
| **Dueño** | Todo: propiedades, reservas, finanzas, y gestión de usuarios. |
| **Encargado** | Todo lo operativo + finanzas, pero no gestiona usuarios. |
| **Trabajador** | Reservas, disponibilidad, calendario y mapa. **No ve dinero** ni finanzas. |

**Bootstrap del dueño:** la **primera persona que inicia sesión queda como dueño**
automáticamente. Asegurate de que esa primera vez seas vos.

**Agregar al equipo (lo hace el dueño):**
1. Creá la cuenta de acceso de cada persona en Firebase → **Authentication → Users**
   (email + contraseña).
2. En la app: **Configuración → Usuarios y roles → Agregar usuario** (su email + rol).
3. Cuando esa persona entre, verá solo lo que su rol permite.

> Una cuenta que inicia sesión pero no tiene rol asignado ve una pantalla de "cuenta sin
> permisos" hasta que el dueño la agregue.

## 6. Probar

1. Abrí la URL publicada → te lleva al login.
2. Entrá con el usuario que creaste en el paso 1.
3. Andá a **Finanzas** y creá las cuentas iniciales (Efectivo, Transferencia, Mercado Pago).
4. Cargá un edificio o departamento (poné la ubicación en el mapa), una reserva, y listo.

---

## 7. Checklist rápido por cliente

- [ ] Proyecto de Firebase creado
- [ ] App Web registrada + claves copiadas
- [ ] Authentication (Email/Password) activado + usuario del dueño creado
- [ ] Firestore Database creada
- [ ] `npm run nuevo-cliente` ejecutado
- [ ] `npm run deploy:rules` ejecutado
- [ ] Publicado (GitHub Pages o Firebase Hosting)
- [ ] Probado el login y una carga de prueba

---

## Nota sobre costos

Firebase cobra **por uso, no por existir**. Un cliente chico y estacional entra
holgadamente en la capa gratis (50.000 lecturas/día por proyecto). Un proyecto sin uso en
temporada baja cuesta $0. Por eso conviene un proyecto por cliente: cada uno con su propia
cuota gratis.
