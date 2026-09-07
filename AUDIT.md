# AUDIT.md — Auditoría inicial

Fecha: 2026-09-07
Alcance: repositorio completo, rama `dev`, estado actual (sin modificar código).

---

## 0. Aclaración importante sobre la arquitectura real

Antes de leer los hallazgos: este proyecto **no es** una aplicación MVC con backend propio
(controllers, DTOs, JWT emitido por un servidor, etc.). Es una **SPA en JavaScript vanilla
(ES Modules, sin bundler)** que corre 100% en el navegador y usa **Firebase** como backend
completo:

- **Firebase Authentication** (email/contraseña) para login.
- **Firestore** como base de datos, accedida directamente desde el cliente con el SDK web.
- **`firestore.rules`** como ÚNICO punto de aplicación de autorización real — no hay
  ningún servidor intermedio, ni Cloud Functions, ni API REST propia.
- Hosting estático (GitHub Pages / Firebase Hosting).

Esto cambia el mapeo de varios conceptos del checklist estándar (DTOs, controllers, JWT
propio) pero **no** cambia los objetivos: seguridad, autorización real (no confiar en el
frontend), validación, integridad de datos. Simplemente el lugar donde eso se aplica es
distinto: `firestore.rules` cumple el rol que en un backend tradicional cumplirían los
controllers + middlewares de autorización.

---

## 1. Resumen ejecutivo

El código está considerablemente mejor cuidado de lo que suele verse en un proyecto de
este tamaño: convenciones consistentes, separación clara en `core/` (auth, sesión, router,
utilidades), `services/` (una clase por colección, todas heredando de `BaseService`) y
`modules/` (una carpeta por sección de la app), comentarios que explican decisiones no
obvias (por qué `hoyISO()` usa hora local y no UTC, por qué `cuentas` queda afuera del
caché, por qué los pagos usan `runTransaction` y no `writeBatch`), y operaciones que tocan
dinero (`registrarPago`, `anularPago`, movimientos) implementadas de forma atómica. No es
un prototipo improvisado.

Dicho esto, hay un **hueco de seguridad crítico** en la gestión de roles: cualquier cuenta
autenticada de Firebase puede, hoy, autoasignarse el rol `dueño` escribiendo directamente
contra Firestore (sin pasar por la UI), porque `firestore.rules` no valida qué contenido
puede tener el documento que un usuario crea de sí mismo. A esto se suma un patrón más
general — las reglas de Firestore solo exigen "estar autenticado" para reservas, unidades y
edificios, mientras que la matriz de permisos por rol (quién puede editar/eliminar/gestionar
propiedades) vive únicamente en el cliente (`core/sesion.js`). Eso es exactamente lo que
`CLAUDE.md` pide revisar: nunca confiar en el frontend para autorización.

De cara al caso de uso del hotel: el modelo de datos de `reservas` y la lógica de
disponibilidad (`disponibilidad.view.js`, `reservasService.verificarDisponibilidad`) son una
base razonable — el algoritmo de solapamiento es correcto y está ya bastante desacoplado del
DOM. Pero **no existe ningún camino de lectura pública/sin login** hoy (las reglas exigen
auth() en todo), lo cual es bueno como punto de partida (no hay fugas accidentales), y a la
vez implica que exponer disponibilidad al público va a requerir components nuevos
deliberados (lo más probable: Cloud Functions), nunca simplemente "relajar" la regla de
`reservas`, porque esa colección mezcla datos de disponibilidad con PII del huésped
(nombre, teléfono, email) y datos financieros (precioTotal, pagado) en el mismo documento.

---

## 2. Arquitectura actual

```
index.html / login.html   → shells de la SPA (autenticada / login)
src/main.js                → guard de auth, arma sidebar según rol+features, arranca router
src/firebase/init.js       → initializeApp/getFirestore/getAuth con config/client.config.js
src/core/
  auth.js                  → wrapper fino sobre Firebase Auth (login/logout/watchAuth)
  sesion.js                → matriz de roles/capacidades — SOLO enforced en el cliente
  router.js                → router SPA por hash, sin dependencias
  store.js, ui.js, tema.js, metricas.js, notificaciones*, calendario-tape.js, excel.js, pdf.js, geo.js
src/services/
  base.service.js           → CRUD genérico sobre Firestore (todos heredan de acá)
  edificios/unidades/reservas/cuentas/movimientos/usuarios.service.js
  cache-colecciones.js      → caché en memoria (TTL 5 min) para edificios/unidades
src/modules/                → una carpeta por sección: dashboard, propiedades, reservas,
                               disponibilidad, calendario, mapa, contabilidad, reportes,
                               configuracion, notificaciones
firestore.rules             → único punto real de autorización (auth() + rol por doc `usuarios/{email}`)
firestore.indexes.json      → vacío (todas las queries son de un solo campo)
config/client.config.js     → claves públicas de Firebase + branding + feature flags (se commitea a propósito)
```

**Autenticación:** Firebase Auth, cuentas creadas manualmente por el dueño desde la consola
de Firebase (no hay registro público — `login.html` solo tiene `signInWithEmailAndPassword`).

**Autorización:** roles `dueño` / `encargado` / `trabajador` / `sin_asignar`, definidos en
`core/sesion.js` con dos cosas por rol: `modulos` (qué secciones ve) y `caps` (qué acciones
puede hacer: `verDinero`, `gestionarPagos`, `eliminar`, `editarReservas`,
`gestionarUsuarios`, `gestionarPropiedades`). El perfil de cada usuario vive en
`usuarios/{email}`. **Esta matriz de capacidades NO tiene equivalente en `firestore.rules`**
salvo para `cuentas`/`movimientos` (dinero) y `usuarios` (gestión de usuarios) — ver
hallazgo HIGH-1.

**Comunicación vista↔datos:** no hay "controllers"; cada `modules/*/*.view.js` importa
directamente el `service` correspondiente y llama a Firestore vía el SDK del cliente. No
hay capa de DTOs — los documentos de Firestore se leen/escriben tal cual desde la UI.

**Configuración:** un solo archivo por cliente (`config/client.config.js`), commiteado a
propósito porque las claves web de Firebase son públicas por diseño (la seguridad real está
en `firestore.rules`). No hay separación dev/test/prod formal — el mismo código apunta a
distintos proyectos de Firebase cambiando `.firebaserc` + `client.config.js` (modelo
"un proyecto de Firebase por cliente").

**Modelo de datos (colecciones):** `edificios`, `unidades`, `reservas`, `cuentas`,
`movimientos`, `usuarios`. (El README menciona además `gastos`, que no existe en el código —
ver hallazgo LOW.)

---

## 3. Hallazgos

### CRITICAL

**C1. Escalamiento de privilegios vía auto-creación de `usuarios/{email}`**
Ubicación: `firestore.rules:28-34`, `src/core/sesion.js:38-58`,
`src/services/usuarios.service.js:17-22`.

La regla dice:
```
allow create: if auth() && (email == emailUid() || esDueno());
```
No valida **qué contenido** puede tener el documento creado — en particular, no restringe
el campo `rol`. La lógica de "el primer usuario que entra queda como dueño" (`sesion.js:46`)
es puramente client-side (`equipo.length === 0`); no está reforzada por ninguna regla.

**Escenario concreto de explotación:** el dueño crea en la consola de Firebase Auth la
cuenta de un nuevo `trabajador` (email+contraseña) pensando en agregarlo después desde
*Configuración → Usuarios y roles*. Antes de que eso pase, esa persona (o cualquiera con
esas credenciales) abre las devtools del navegador y ejecuta directamente contra el SDK de
Firestore (o la REST API de Firestore, usando su ID token válido):
```js
setDoc(doc(db, 'usuarios', 'esapersona@x.com'), { rol: 'dueño', email: 'esapersona@x.com', activo: true });
```
La regla lo permite (`email == emailUid()`), sin importar que ya existan otros usuarios.
Resultado: esa cuenta pasa a tener acceso total (finanzas, gestión de usuarios, eliminar
cualquier cosa) sin pasar nunca por la UI ni por el flujo de bootstrap.

**Riesgo:** control de acceso roto (broken access control) de la variedad más grave —
cualquier cuenta autenticada, sin importar el rol que se le pensaba dar, puede convertirse
en dueño.

**Recomendación:** las reglas deben decidir el rol de bootstrap, no confiar en el campo que
manda el cliente. Opciones (de más simple a más robusta):
1. Restringir la auto-creación a `rol == 'sin_asignar'` siempre (`request.resource.data.rol == 'sin_asignar'`), y que la promoción a cualquier otro rol la haga *siempre* el dueño desde `Configuración` (`update`, ya protegido por `esDueno()`). Esto cierra el hueco a costo de que el primer usuario también tenga que auto-promoverse dueño manualmente la primera vez (un paso más en el onboarding, documentado en ONBOARDING.md).
2. Si se quiere mantener el bootstrap automático del primer usuario, moverlo a una Cloud Function con permisos de administrador que verifique server-side que la colección `usuarios` está vacía antes de asignar `dueño` — la única forma de que esa condición se evalúe de forma confiable.

---

### HIGH

**H1. La matriz de capacidades por rol no está reforzada en `firestore.rules`**
Ubicación: `firestore.rules:41-43` vs. `core/sesion.js` (`DEFINICION`).

Las reglas actuales:
```
match /edificios/{doc}  { allow read, write: if auth(); }
match /unidades/{doc}   { allow read, write: if auth(); }
match /reservas/{doc}   { allow read, write: if auth(); }
```
permiten a **cualquier usuario autenticado** —incluido un `trabajador`, que según
`sesion.js` no tiene `editarReservas`, `eliminar` ni `gestionarPropiedades`— crear, editar o
borrar cualquier edificio, unidad o reserva llamando directamente al SDK/REST API,
sorteando por completo los botones deshabilitados de la UI. Esto es exactamente el patrón
que `CLAUDE.md` pide evitar ("never trust the frontend to enforce permissions").

**Recomendación:** reflejar al menos las operaciones destructivas/sensibles en las reglas
(ej. `allow delete: if esDueno() || rol() == 'encargado';` para reservas/unidades/edificios,
y análogamente para ediciones de campos sensibles como `precioTotal` si se quiere ser
estricto). No hace falta reglas por-campo desde el día uno, pero al menos alinear
create/update/delete con el rol real.

**H2. Sin control de solapamiento a nivel de escritura (double-booking)**
Ubicación: `src/services/reservas.service.js:70-81` (`verificarDisponibilidad`),
consumido en `src/modules/reservas/reservas.view.js:454` y `editar.js:124`.

El chequeo de solapamiento se hace **antes** de la escritura, enteramente en el cliente. No
hay ninguna regla ni transacción que impida que dos escrituras concurrentes (dos pestañas,
dos empleados, o más adelante un import de iCal o una reserva pública) pasen ambas el check
y terminen reservando la misma unidad para las mismas fechas — es una condición de carrera
clásica (TOCTOU). Con el volumen de uso actual (una sola familia operando el sistema) la
probabilidad de colisión real es baja, pero es precisamente la garantía que el caso de uso
del hotel (más operadores + eventualmente escrituras automáticas por iCal) va a necesitar
que sea sólida.

**Recomendación:** no es urgente para el uso actual, pero antes de sumar más operadores
simultáneos o fuentes de escritura automatizadas, mover la validación de solapamiento a una
transacción (releer las reservas de la unidad dentro de la misma `runTransaction` que hace
`create`) o a una Cloud Function que sea el único camino de escritura para reservas.

**H3. Mass assignment: no hay validación de forma/campos en ninguna colección**
Ubicación: `src/services/base.service.js:32-46`, todas las reglas en `firestore.rules`.

`BaseService.create()`/`.update()` reenvían tal cual el objeto que les pasa el llamador a
Firestore, y ninguna regla inspecciona `request.resource.data`. Un usuario autenticado
puede, por ejemplo, escribir directamente `reservas/{id}.pagado` o `.precioTotal`
sorteando la transacción atómica de `registrarPago()` (que es la que mantiene consistentes
`pagado`/`saldo`/`estadoPago`), o agregar campos arbitrarios a cualquier documento.

**Recomendación:** no es necesario un sistema de validación exhaustivo ahora mismo (equipo
chico y de confianza), pero vale la pena, cuando se toque `firestore.rules` por los puntos
anteriores, agregar validación mínima de tipos/campos permitidos en las colecciones más
sensibles (`cuentas`, `movimientos`, y los campos de `reservas` que afectan pagos).

---

### MEDIUM

**M1. Cero tests automatizados**, pese a que el README dice "Métricas... Con tests." No se
encontró ningún archivo `*.test.js` fuera de `node_modules`. La lógica más sensible a
regresiones silenciosas —`estadoPagoDe`, `verificarDisponibilidad`, `core/metricas.js`— no
tiene red de seguridad.

**M2. Documentación desalineada con el código**: el README (sección "Modelo de datos")
describe una colección `gastos` que no existe; el código y las reglas usan `movimientos`.
Confunde a cualquiera que audite o mantenga el proyecto (incluido un futuro cliente/revisor
del portfolio).

**M3. `rol()` en `firestore.rules` hace un `get()` (lectura extra) en cada evaluación que
usa `verDinero()`/`esDueno()`.** No es un bug, pero es un costo de lectura por operación
protegida a tener en cuenta si el volumen crece.

**M4. Sin rate limiting / lockout propio en el login.** El mensaje de error genérico
("Email o contraseña incorrectos") evita enumeración de usuarios, lo cual está bien, pero
más allá de las protecciones por defecto de Firebase Auth no hay nada adicional. Aceptable
hoy; revisar si se suma más gente al sistema.

---

### LOW

**L1.** `src/modules/mapa/mapa.view.js:26` es el único lugar del código que usa la vía
`html:` del helper `el()` (que hace `innerHTML` directo) en vez del camino seguro por
defecto (`el()` crea nodos de texto, no HTML). Hoy `estado` es un enum controlado
(`activo`/`inactivo`), así que no es explotable, pero es el único punto que se sale del
patrón seguro del resto del código — vale la pena dejarlo documentado o cambiarlo por
interpolación de clase en vez de `html:` para que no se vuelva un vector de XSS si ese
campo alguna vez deja de ser un enum cerrado.

**L2.** `hoyISO()` (`core/metricas.js:15`) usa deliberadamente el reloj/huso horario local
del dispositivo (con un comentario explicando por qué, correcto para el uso actual). Para
una futura página pública, "hoy" quedaría controlado por el reloj del visitante — no es un
problema de seguridad de datos (no persiste nada), pero conviene anclar "hoy" server-side
cuando se construya el endpoint público de disponibilidad.

---

### NICE TO HAVE

- Agregar un `.env.example`/checklist explícito de "qué NO debe tener `client.config.js`"
  (hoy es correcto que las claves públicas de Firebase estén ahí, pero conviene dejar
  explícito el límite para que nadie agregue ahí, por error, algo que sí sea secreto).
- Documentar en el README, junto a la sección "Agregar el sitio web público", la decisión
  arquitectónica de que la disponibilidad pública NO se serviría abriendo `reservas`
  directamente (ver sección 4).

---

## 4. Evaluación específica: preparación para disponibilidad pública (hotel)

**Modelo de `reservas`:** los campos existentes (`unidadId`, `fechaEntrada`, `fechaSalida`,
`estado`, `huesped{}`, `noches`, `precioTotal`, `canal`) alcanzan para calcular
disponibilidad por rango de fechas. La capacidad vive en `unidades.capacidad` (no por
reserva), lo cual es correcto para el modelo actual (unidades completas, no habitaciones
divisibles).

**Falta un campo de "origen" del bloqueo.** Hoy toda fila de `reservas` es implícitamente
"una reserva interna con huésped real". Para soportar más adelante bloqueos importados por
iCal (Booking/Airbnb) o bloqueos manuales del dueño (mantenimiento, uso personal), conviene
sumar **ahora, antes de tener muchos datos**, un campo como:
```
origen: 'interna' | 'manual' | 'booking_ics' | 'airbnb_ics'   (default: 'interna')
```
o, alternativamente, separar los bloqueos no-reserva en una colección propia (`bloqueos`)
liviana (unidadId, fechaEntrada, fechaSalida, origen, referenciaExterna). Cualquiera de las
dos opciones es barata de introducir hoy y muy cara de migrar después con datos reales
cargados.

**Ownership/IDOR:** no aplica en el sentido clásico (no hay recursos por-huésped hoy — todo
es interno, gestionado por staff), pero los hallazgos C1/H1 **deben** cerrarse antes de
exponer cualquier endpoint público, porque un endpoint público mal diseñado sobre un modelo
de permisos ya débil agrava el problema en vez de aislarlo.

**Acoplamiento a la UI:** la lógica de `disponibilidad.view.js` (`estaLibre`,
`segmentosOcupacion`, filtro por capacidad/estado) ya está prácticamente aislada del DOM —
son funciones puras sobre arrays de reservas/unidades. Es un buen punto de partida: se puede
extraer a un módulo compartido sin reescritura y reutilizar tanto desde la app privada como
desde una futura Cloud Function pública.

**Fechas/zonas horarias:** la aritmética de fechas (`core/metricas.js`) usa strings ISO
anclados a UTC de forma consistente para comparaciones/sumas, con un fix documentado para
que "hoy" respete la hora local (Argentina). No se encontraron bugs de solapamiento por
huso horario.

**Separación público/privado:** hoy `firestore.rules` exige `auth()` en absolutamente todo
— no hay ninguna fuga accidental de datos hoy. Pero pasar de "cero acceso público" a
"disponibilidad pública" **no** puede resolverse simplemente relajando la regla de
`reservas`, porque esa colección mezcla disponibilidad (pública, en principio) con PII del
huésped y con montos (privados). El camino correcto es una de estas dos:
1. Una **Cloud Function** pública (sin auth) que internamente lea `reservas`/`unidades` con
   privilegios de servidor y devuelva solo `{unidadId, libre: true|false}` por rango — nunca
   el documento completo.
2. Una colección espejo de solo-disponibilidad (`disponibilidad_publica`, por ejemplo, con
   únicamente `unidadId`, `fechaEntrada`, `fechaSalida`), mantenida por una función/trigger,
   con una regla de lectura pública propia y acotada a esa colección.

La opción (1) es la más segura y, además, es el mismo componente que después va a hacer
falta para el export/import de iCal — conviene planificar Cloud Functions como la pieza de
infraestructura nueva del caso hotel, no como un "nice to have".

---

## 5. Roadmap propuesto

### Fase 1 — Estabilizar el uso actual (mamá), prioridad máxima
1. **C1** — Cerrar el escalamiento de privilegios en `usuarios` (bloqueante, incluso para
   el uso actual de confianza: cualquier cuenta de Auth existente podría auto-promoverse).
2. **H1** — Alinear `firestore.rules` con la matriz de capacidades de `sesion.js`
   (create/update/delete de edificios/unidades/reservas según rol).
3. **H3** (parcial, bajo costo) — Validación mínima de campos en las colecciones que tocan
   dinero.
4. **M1** — Tests para `metricas.js`, `estadoPagoDe`, `verificarDisponibilidad` (son las
   funciones con más impacto en plata y en disponibilidad).
5. Limpieza menor: README (`gastos` → `movimientos`), `mapa.view.js` (L1).

### Fase 2 — Preparar el terreno para el hotel (sin exponer nada todavía)
6. Sumar el campo `origen` (o colección `bloqueos`) a `reservas` — barato ahora, caro
   después con datos reales cargados.
7. **H2** — Mover la validación de solapamiento a una transacción (o a la futura Cloud
   Function de escritura), no solo al cliente.
8. Extraer la lógica pura de disponibilidad de `disponibilidad.view.js` a un módulo sin
   dependencias de DOM/sesión, reutilizable desde una Cloud Function.

### Fase 3 — Habilitar el caso de uso del hotel
9. Introducir **Cloud Functions** (primer componente de backend real del proyecto) para:
   (a) el endpoint público de disponibilidad (solo libre/ocupado, sin PII ni precios), y
   (b) más adelante, export/import iCal.
10. Página pública (buscador de fechas + botón de WhatsApp prellenado) consumiendo ese
    endpoint — sin login, sin acceso directo a `reservas`.
11. Sincronización iCal con Booking.com/Airbnb, apoyada en el campo `origen` de la Fase 2.

---

No se modificó ningún archivo de código en esta tarea. Quedo a la espera de que revisemos
juntos estos hallazgos antes de decidir qué se ataca primero.
