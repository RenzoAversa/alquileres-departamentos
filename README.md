# 🏢 Alquileres App — base single-tenant escalable

Sistema de gestión de alquileres pensado para **replicarse por cliente**: cada cliente
tiene su propio proyecto de Firebase (aislamiento total de datos + tier gratis
independiente). El código es **uno solo**; lo único que cambia entre clientes es un
archivo de configuración.

Arquitectura sin bundler: JavaScript con **ES Modules** nativos + Firebase desde CDN.
No necesitás compilar nada.

---

## 📂 Estructura

```
alquileres-app/
├── firebase.json            # Config de Hosting + Firestore
├── .firebaserc              # Proyecto Firebase (cambia por cliente)
├── firestore.rules          # Reglas de seguridad (single-tenant)
├── firestore.indexes.json   # Índices compuestos
├── package.json             # Scripts (serve/deploy/nuevo-cliente)
├── scripts/
│   └── nuevo-cliente.sh      # Genera la config de un cliente nuevo
├── config/
│   ├── client.config.example.js   # Plantilla (molde) de config
│   └── client.config.js  # ⭐ Config REAL del cliente (claves + branding)
├── index.html            # App autenticada (shell + SPA), raíz = lo que se publica
├── login.html            # Pantalla de ingreso
├── assets/styles/        # tokens.css (design system) + styles.css
└── src/
    ├── main.js           # Guard de auth + arma sidebar + arranca router
    ├── firebase/init.js  # Inicializa Firebase (app, db, auth)
    ├── core/             # router, auth, store, ui, geo (Leaflet + geocoding)
    ├── services/         # ⭐ Capa de datos sobre Firestore
    │   ├── base.service.js       # CRUD genérico (todos heredan de acá)
    │   ├── edificios.service.js
    │   ├── unidades.service.js
    │   ├── reservas.service.js   # incluye verificarDisponibilidad()
    │   ├── cuentas.service.js    # cuentas/medios de pago con saldo
    │   └── movimientos.service.js# ingresos/egresos/transferencias (increment)
    └── modules/          # Una carpeta por sección de la app
        ├── dashboard/      ✅ KPIs + saldos por cuenta
        ├── propiedades/    ✅ edificios + unidades (CRUD)
        ├── reservas/       ✅ fechas + estados de pago + detalle.js (pagos) + editar.js (edición)
        ├── disponibilidad/ ✅ buscador: fechas + huéspedes -> libres + precio
        ├── contabilidad/   ✅ Finanzas: cuentas, saldos, ingresos/egresos/transferencias
        ├── configuracion/  ✅ cuenta + gestión de usuarios/roles (dueño)
        ├── calendario/     ✅ grilla mensual por unidad (estilo PMS)
        └── mapa/           ✅ mapa + filtro de disponibilidad + selector de ubicación
```

### Las dos piezas clave de la escalabilidad
1. **`services/base.service.js`** — todo acceso a datos pasa por acá. Si el día de mañana
   migrás a multi-tenant o cambiás de backend, tocás **este archivo**, no los módulos.
2. **`config/client.config.js`** — el único archivo que cambia por cliente (claves de
   Firebase, nombre, color y qué módulos están activos).

---

## ▶️ Correr en local

Los ES Modules necesitan servirse por HTTP (no funcionan abriendo el archivo directo).

```bash
npm run serve       # levanta la app en http://localhost:5000
```

(usa `npx serve`; si prefierís: `python3 -m http.server 5000`).

---

## 🔧 Configurar Firebase (una vez por cliente)

1. Entrá a <https://console.firebase.google.com> y **creá un proyecto** para el cliente.
2. Registrá una **app web** y copiá el objeto `firebaseConfig` (apiKey, projectId, etc.).
3. En **Authentication → Sign-in method**, activá **Email/Password**.
4. En **Authentication → Users**, creá el usuario del dueño (email + contraseña).
5. En **Firestore Database**, creá la base (modo producción).

---

## 👥 Replicar a un cliente nuevo

```bash
npm run nuevo-cliente
```

El script te pide nombre, projectId y claves, y genera:
- `.firebaserc` apuntando al proyecto del cliente
- `config/client.config.js` con sus claves + branding

Después:

```bash
npm run deploy:rules    # sube reglas de seguridad e índices
npm run deploy          # publica la app
```

> Cada cliente = un proyecto Firebase = su propio tier gratis (50.000 lecturas/día).
> Un proyecto sin uso (temporada baja) cuesta $0: Firebase cobra por uso, no por existir.

### Actualizar a todos los clientes
Como el código es uno solo, para propagar una mejora: cambiás `.firebaserc` al proyecto
de cada cliente (o usás `firebase use <alias>`) y corrés `npm run deploy`. Con pocos
clientes se hace por script; si algún día son muchos, ahí conviene pasar a multi-tenant.

---

## 🔐 Seguridad

`firestore.rules` exige que el usuario esté **autenticado**. Como todo el proyecto es de
un solo cliente, con eso alcanza. El archivo trae comentado cómo agregar **roles**
(admin / staff / contable) cuando lo necesites.

> Importante: aunque sea single-tenant, **el login es obligatorio**. Sin las reglas +
> auth, la base de Firestore quedaría abierta a cualquiera con la URL.

---

## 🗺️ Mapa (ya integrado)

- **Leaflet + OpenStreetMap** se cargan **on-demand** (solo al abrir el mapa o un
  formulario con ubicación) desde `core/geo.js`, así no pesan la app.
- **Selector de ubicación** reutilizable (`modules/mapa/picker.js`): dirección →
  geocodificación con Nominatim → pin ajustable. Se usa al crear edificios y departamentos.
- **Mapa general** (`modules/mapa/mapa.view.js`): pines de todas las unidades con
  ubicación, filtro por fechas (verde = libre, rojo = ocupada) y popups con precio.

## Dashboard y exportación (ya integrados)

- **Dashboard** (`modules/dashboard`): panel de hoy, comparativa por período
  (hoy / 7 días / 30 días / rango personalizado) contra el período anterior equivalente
  con variación (↑/↓), y gráfico de ocupación de los últimos 7 días.
- **Exportar a Excel** (`core/excel.js`, SheetJS on-demand): un reporte con hojas
  Resumen, Movimientos, Reservas, Ocupación y Saldos, con encabezados con color y
  formato de miles. Botón en Dashboard (período elegido) y en Finanzas (mes).
- **Métricas** (`core/metricas.js`): cálculos puros de ocupación/períodos, compartidos
  entre dashboard y Excel (los números siempre coinciden). Con tests.

## Roles y permisos

Tres roles: **dueño** (todo + gestión de usuarios), **encargado** (todo lo operativo +
finanzas, sin usuarios) y **trabajador** (reservas / disponibilidad / calendario / mapa,
**sin ver dinero**). El visitante queda para la web pública.

- La matriz de permisos está en `core/sesion.js` (un solo lugar para ajustarla).
- El menú y las vistas se adaptan al rol; las restricciones también están reforzadas en
  `firestore.rules` (finanzas y usuarios protegidos por rol).
- Perfiles en `usuarios/{email}`. Nadie puede auto-asignarse un rol (por regla de
  Firestore, ver `firestore.rules`): el dueño se promueve a mano una única vez por cliente
  nuevo (ver ONBOARDING.md) y desde ahí administra el resto de los roles desde
  Configuración.

## Estados de pago (reservas)

Cada reserva tiene estado de pago (**sin pagar / parcial / pagado**). Desde el detalle de
la reserva ("Ver / Pagar"), el dueño o un administrador **confirma un pago** indicando
monto, **método (cuenta)** y fecha. Al confirmarlo, en una sola escritura atómica:
1) se crea el ingreso en `movimientos`, 2) se suma al saldo de esa cuenta, y 3) se
actualiza el estado de pago de la reserva. Los pagos se pueden anular (revierte todo).
La lógica vive en `reservas.service.js` y la pantalla en `modules/reservas/detalle.js`.

## Alta de clientes nuevos

Ver **ONBOARDING.md** para el paso a paso. Resumen: cada cliente = su propio proyecto de
Firebase + su propia publicación (GitHub Pages o Firebase Hosting).

- `npm run nuevo-cliente` genera la config del cliente (claves + marca) y el `.firebaserc`.
- Este repo publica en GitHub Pages desde la rama `main` (raíz), en modo clásico
  (Settings → Pages → Source: rama). Cada push a `main` republica sola, sin workflow.
- Las rutas son relativas y la navegación es por hash, así que la app funciona bajo el
  subdirectorio de GitHub Pages sin tocar nada.

## Sobre índices de Firestore

Todas las consultas de la app son de **un solo campo** (`fechaSalida >= X`, `fecha` entre
A y B, `unidadId ==`, `edificioId ==`), y Firestore indexa esos automáticamente, así que
ya son rápidas. No se declaran índices compuestos para no agregar costo de escritura
innecesario.

---

## 🌐 Agregar el sitio web público (más adelante, para el cliente que lo pague)

La estructura ya lo contempla con el feature flag `features.web`. Cuando lo armemos:
- Se agrega una carpeta `web/` (o páginas en la raíz) con el sitio público:
  landing + buscador de disponibilidad + reserva online.
- El sitio público **lee** las mismas colecciones (`unidades`, `reservas`) usando los
  mismos servicios, pero sin login (con reglas de solo-lectura para lo público).
- El panel de gestión (esto) sigue detrás de login.

---

## 🧱 Modelo de datos (colecciones de primer nivel)

- **`edificios`** — hoteles/edificios: `nombre, tipo, direccion, ubicacion{lat,lng}`.
- **`unidades`** — departamentos: `nombre, edificioId (null=suelto), capacidad,
  precioNoche, ubicacion, estado`.
- **`reservas`** — `unidadId, unidadNombre, edificioId, huesped{}, fechaEntrada,
  fechaSalida, noches, precioTotal, senia, saldo, estado, canal`.
- **`gastos`** — ingresos/egresos: `tipo, categoria, monto, fecha, unidadId?, reservaId?,
  descripcion`.

Relación: un **edificio** agrupa muchas **unidades** (por `edificioId`); una **unidad**
tiene muchas **reservas**; los **gastos** se imputan opcionalmente a una unidad/reserva.

> Si más adelante pasás a multi-tenant, estas colecciones se moverían bajo
> `organizaciones/{orgId}/…` y solo cambiaría `base.service.js`. El resto queda igual.
