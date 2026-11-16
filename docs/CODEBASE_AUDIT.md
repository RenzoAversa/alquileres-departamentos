# Auditoría de código y preparación para producción

Fecha: **2026-11-15**. Alcance: código y configuración locales de Alquileres, inspección estática y suites existentes. Sustituye como diagnóstico vigente al [AUDIT.md histórico](../AUDIT.md).

## 1. Resultado y límites

**La aplicación todavía no cumple las garantías de producción propuestas.** Hay RBAC real y transacciones útiles, pero el cliente puede eludir invariantes de ocupación y finanzas; la historia financiera se borra y el rol trabajador recibe datos de dinero. La modernización debe empezar por esas fronteras.

Esta entrega define estándares, decisiones y un plan; **no implementa ni despliega sus correcciones**. No se accedió a datos reales, consola de Firebase, IAM ni configuración desplegada. No se ejecutó una revisión visual en navegador: las observaciones UX provienen del DOM, CSS y flujos de código; contraste, CLS y ergonomía requieren medición posterior.

El adjunto del pedido termina en “Phase 2: Domain Model, Atomic Transactions & Immutable Rental”. Las fases posteriores del roadmap son una propuesta explícita para completar la secuencia, no texto recibido.

## 2. Referencia inspeccionada, exclusivamente por lectura

Raíz: C:\xampp\htdocs\Ecommerce\ecommerce. No se escribió, instaló, compiló, ejecutó la aplicación ni corrió git en esa ubicación.

| Fuente leída | Criterio extraído | Traducción para Alquileres |
|---|---|---|
| CLAUDE.md | Descubrir, planificar, implementar, verificar, revisar, documentar; aislamiento y pruebas de operaciones críticas | Gates verificables, alcance acotado y reglas ajustadas al stack real |
| docs/ARCHITECTURE_DECISIONS.md, secciones 1–4, 6–7 | TenantId obligatorio; outbox transaccional; ledger de stock inmutable; concurrencia optimista; holds; requestId + hash | orgId/UID, ledger de alquileres, locks de ocupación, versionado e idempotencia |
| backend/EcommerceApp.Core/Services/OrderService.cs:494–495,700–725 y Pricing/TierPercentagePricingStrategy.cs | Renglones calculados desde snapshots de precio del servidor, subtotal derivado y redondeo decimal explícito | No aceptar total definitivo del navegador; política monetaria versionada |
| docs/UX_GUIDELINES.md | 20 principios, jerarquía operativa, skeletons geométricos, objetivos táctiles y movimiento explícito | Matriz de unidades, acciones contextuales, controles accesibles y estados fiables |
| frontend/src/components/ui/TableSkeleton.jsx | Filas/columnas y alturas equivalentes; sin tamaños aleatorios | Skeletons DOM/CSS con la misma geometría que lista o matriz |
| frontend/src/components/ui/Dialog.jsx y Dialog.module.css | dialog nativo, foco contenido/restaurado y safe-area | Un único contrato de modal accesible, sin exigir React |
| frontend/src/components/admin/overlays/EntityOverlayHost.jsx | Registro de borradores, bloqueo de navegación y beforeunload | Guard compartido de formularios, router y diálogos |
| frontend/src/components/checkout/FormField.jsx | Labels y errores asociados, aria-invalid, preservación del cursor | Campos reutilizables con validación visible y accesible |
| frontend/src/index.css | Tokens de radio, touch target, easing y duración; números tabulares | Tokens centrales en assets/styles/tokens.css |

frontend/src/styles/ no existe en esa referencia; se inspeccionaron index.css, tailwind.css y módulos CSS reales. La referencia contiene también duraciones de 240 ms: el destino de Alquileres adopta **menos de 200 ms** según el pedido, sin afirmar que cada componente de referencia ya lo cumple. No se trasladan EF Core, PostgreSQL, cookies JWT propias ni patrones de controllers a una SPA Firebase.

## 3. Mapa del sistema actual y cobertura

~~~mermaid
flowchart LR
    UI["HTML + vistas DOM"] --> Servicios["Servicios de cliente"]
    UI --> Sesion["Sesión y router hash"]
    Servicios --> SDK["Firebase Web SDK"]
    SDK --> Auth["Authentication"]
    SDK --> Rules["Firestore Security Rules"]
    Rules --> DB["Colecciones de primer nivel"]
    UI --> PDF["PDF / Excel en navegador"]
    UI --> Cache["Store + localStorage + Service Worker"]
~~~

| Área inspeccionada | Implementación y observaciones |
|---|---|
| Entradas y routing | index.html, login.html, src/main.js, core/router.js: import maps Firebase 10.7.1, lazy imports de vistas, guard por sesión, sin disposer ni control de renders fuera de orden |
| Auth y estado | firebase/init.js, core/auth.js, sesion.js, store.js: email/password; perfiles por email; sesión singleton; sin Claims/App Check en fuente |
| Acceso a datos | Todos los services: edificios, unidades, reservas, cuentas, movimientos, usuarios, BaseService y cache-colecciones; CRUD genérico y queries sin cursor |
| Operación | dashboard, propiedades, reservas (alta/detalle/edición/selector/buscador), disponibilidad, calendario y mapa/picker: fechas y estados, cálculos y controles de UI |
| Finanzas y reportes | contabilidad, reportes/valores-mensuales, core/metricas, excel, pdf, graficos, paleta: resúmenes y exportaciones calculados en cliente |
| Notificaciones | Servicio, listener, state, engine, vistos, badge, drawer y tabs: listener compartido, cleanup explícito y caché persistente de datos derivados |
| UI y estilos | core/ui, tema, geo, calendario-tape; tokens.css, styles.css, notificaciones.css: helpers DOM, modales y paginado en memoria |
| Infraestructura | firebase.json, .firebaserc, rules, indexes, sw.js, manifest, config actual/ejemplo, script nuevo-cliente, package/lock, ESLint y gitignore |
| Verificación y documentación | Suites unitarias/emulador; README, ONBOARDING, CLAUDE y AUDIT histórico |

No hay componentes React, hooks, functions/, storage.rules, uso del SDK Storage ni configuración Storage en firebase.json. storageBucket en la configuración **no demuestra** que se suban archivos o que un bucket esté abierto. Contratos, DNI/CUIT, ICL/IPC, punitorios, devengamientos mensuales, liquidaciones y depósitos de garantía **no están modelados**; no se presentan como bugs de funcionalidades existentes.

El modelo actual es de **reservas temporarias**, no de administración contractual mensual: edificios, unidades, reservas, cuentas, movimientos, usuarios y unidades/{id}/_lock/reservas. La separación entre clientes depende de **un proyecto Firebase por cliente**, no de orgId dentro de la misma base.

## 4. Controles existentes que se conservan

- La autoalta solo permite rol sin_asignar. El escalamiento C1 de septiembre ya no corresponde al código actual.
- Hay permisos por rol para propiedades, reservas y finanzas. No existe el antiguo permiso global auth-only que describe el AUDIT histórico.
- create de reserva lee/escribe un lock compartido por unidad y relee candidatas en runTransaction. Las pruebas existentes de 2, 5 y 10 altas concurrentes pasan. Protege a escritores que respetan ese protocolo.
- registrarPago relee la reserva dentro de una transacción y escribe movimiento, cuenta y estado de pago juntos, evitando dos pagos que excedan el saldo por carrera entre llamadas cooperantes.
- Notificaciones guarda unsubscribe antes de esperar el primer snapshot, invalida inicializaciones tardías con un token y limpia al logout. No se diagnostica una fuga general de listeners que ya está resuelta.
- La caché de propiedades tiene TTL e invalidación; cuentas queda fuera deliberadamente. El TTL se comprueba **al pedir datos**, no refresca por sí solo una pantalla abierta.
- el() usa nodos de texto por defecto. El pin del mapa construye DOM antes de obtener outerHTML: el hallazgo histórico sobre ese pin está corregido. No se identificó una explotación XSS concreta en esa ruta.
- abrirModal protege cierres locales con cambios y bloquea cierre durante guardado; esa protección todavía no cubre todos los flujos.

## 5. Hallazgos vigentes

Severidad por impacto: **CRITICAL** compromete integridad esencial; **HIGH** rompe una garantía de autorización/consistencia; **MEDIUM** afecta operación, escala o recuperación; **LOW** afecta mantenibilidad/pulido; **NICE TO HAVE** es opcional. “Confirmado estático” significa deducido del código, sin ejecutar el abuso contra datos reales.

| ID / nivel | Evidencia local | Diagnóstico y consecuencia | Cierre requerido |
|---|---|---|---|
| C-01 · CRITICAL | firestore.rules:80–81,123; services/base.service.js:32,40,48 | Dueño/encargado puede escribir o borrar cuentas y movimientos, o cambiar pagado/saldo sin un asiento. Un servicio transaccional de JS no impide llamadas SDK directas. Historia y proyecciones no son confiables frente a esos escritores. | ADR-03/04: comandos de servidor, ledger append-only, denegar escrituras de cliente y pruebas negativas |
| C-02 · CRITICAL | firestore.rules:108–123; reservas.service.js:80,130; detalle.js:185 | Staff puede crear una reserva sin tocar lock; los operadores pueden cambiar fechas/unidad/estado libremente. El alta cooperante está protegida, pero el sistema completo permite doble ocupación, incluida reactivación. | ADR-02: única frontera de escritura, locks en todas las transiciones y edición versionada |
| H-01 · HIGH | firestore.rules:86,90,118; sesion.js:22–25 | Trabajador recibe documentos completos de reservas y unidades: precioTotal, pagado, saldo, precioNoche y datos del huésped. “No ve dinero” solo se cumple en pantalla. | Separar documentos operativos, financieros y PII; reglas por asignación |
| H-02 · HIGH | reservas.service.js:225–239; movimientos.service.js:41–45 | Anular/eliminar usa datos antiguos, borra el asiento e incrementa saldo inverso. Repetir la misma anulación puede descontar de nuevo: borrar un doc ya inexistente no deduplica el incremento. Dos anulaciones de pagos distintos pueden sobrescribir pagado. | Reversa única por asiento, tx de lectura fresca, motivo y clave estable |
| H-03 · HIGH | reservas.service.js:246–255 | remove consulta pagos fuera del batch, revierte y borra todo. Puede competir con otro borrado, anulación o pago, duplicar reversión o dejar movimientos huérfanos. Un batch grande tampoco escala. | Archivar/cancelar por comando; no borrar ledger; conciliación |
| H-04 · HIGH | reservas.service.js:130–142; editar.js:113–157 | editar calcula saldo desde reserva.pagado de una copia vieja. Un pago concurrente puede dejar pagado nuevo pero saldo/estado viejos; el check de fechas anterior es TOCTOU. | expectedVersion, relectura y locks en la transacción |
| H-05 · HIGH | reglas completas; BaseService:32–44 | Falta allowlist de campos/tipos/rangos y referencias; create reserva valida solo tres relaciones de pago. Permite importes negativos, fechas incoherentes, unidad inexistente y estados/origen arbitrarios; data.id puede sustituir el id al mapear. | Esquemas por comando y Rules; identidad derivada de la ruta, nunca del payload |
| H-06 · HIGH | reservas.service.js:164–221; movimientos.service.js:32–38; cuentas.service.js:23–31 | Sin idempotencyKey persistente. Reintentar un pago parcial después de timeout puede registrarlo otra vez si queda saldo; doble submit de movimiento duplica caja. IDs aleatorios no deduplican intenciones. | Documento de comandos + hash y resultado atómicos |
| H-07 · HIGH | reservas.service.js:165,196–207; reservas.view.js:352–362,468; contabilidad.view.js:262; ui.js:287–291 | Precios y saldo dependen del navegador y floats; servicio admite monto ≤ 0 y toma moneda/unidad del objeto del llamador. No verifica cuenta activa/moneda; finanzas fija ARS y formatter oculta centavos. | Enteros por moneda, cálculo/validación de servidor y cotizaciones explícitas |
| H-08 · HIGH | firestore.rules:48–59,71–76; usuarios.service.js:17–27; sesion.js:50–73 | activo no se consulta; identidad por email; no guard de último dueño ni auditoría de cambios. Deshabilitar perfil no quita permisos y un dueño puede quitarse el último acceso por SDK. Sesión UI queda vieja tras cambio de rol. | Membresías UID activas, versión de permisos, Claims privilegiadas y último-owner transaccional |
| H-09 · HIGH, requisito futuro | reglas y colecciones raíz; BaseService:16 | No hay aislamiento de varios dueños/organizaciones en una base ni relaciones de inquilino. Hoy se usa un proyecto por cliente: no se encontró una fuga entre proyectos. Compartir uno sin migrar sería inseguro. | No habilitar multiorganización/portal antes de ADR-01 y matriz de aislamiento |
| H-10 · HIGH | notificaciones.service.js:289–320; engine.js:194–214 | Caché localStorage guarda notificaciones con reserva, huésped y datos financieros bajo clave global. Se limpia en logout normal, pero persiste tras cierre abrupto y se restaura antes de datos frescos, sin namespace UID/org. | Persistir solo preferencias no sensibles; datos operativos en memoria por sesión |
| H-11 · HIGH, si se publica con esa config | firebase.json:3–5 | hosting.public = "." e ignore por exclusión incluye docs, tests, reglas, scripts y package files. No hay secreto de servidor identificado, pero se publica material interno innecesario. El serve local también expone la raíz. | Artefacto estático por allowlist, inspección del manifiesto de publicación |
| M-01 · MEDIUM | BaseService:22,55,61; ui.js:233–267; busqueda-global.js:39,67–69 | getAll/buscar/listen no tienen limit/cursor. La paginación y los ocho resultados de búsqueda se aplican después de descargar todo. Backup carga seis colecciones completas. | ADR-05; listados paginados, búsqueda acotada y exportación por lotes |
| M-02 · MEDIUM | reservas.service.js:97–102; disponibilidad.view.js:268; reportes.view.js:189; excel.js:105 | Alta hace query histórica de unidad y otra lectura por candidata: amplificación N+1, multiplicada por reintentos. Consultas por fechaSalida con solo límite inferior traen todo el futuro. | Índice de ocupación exhaustivo por ventanas acotadas; agrupar por unidad en memoria |
| M-03 · MEDIUM | listener.js:70–78,118–135; notificaciones.service.js:87–99; firestore.indexes.json | Listener de hoy-7 a todo el futuro sin límite superior; no avanza la ventana a medianoche. Deudas de reservas antiguas quedan fuera. Error tardío solo se loguea. Índices compuestos están vacíos, acorde a queries actuales de un campo. | Query de deudas propia; ventana móvil/reconexión; índices para consultas nuevas, no inventados |
| M-04 · MEDIUM | router.js:23–45; BaseService:55–58; busqueda-global.js:104 | Sin contrato de dispose/cancelación del router ni token de render. Navegación rápida puede intercalar renders; BaseService.listen no recibe callback de error. Búsqueda cacheada sin TTL ignora cambios de otras sesiones. | Ciclo de vida explícito, generación de render y limpieza comprobada |
| M-05 · MEDIUM | firebase/init.js; package.json; firebase.json | No App Check integrado ni separación formal dev/test/prod. Scripts/tests de emulador usan ID del proyecto actual, aunque sí conectan a emuladores. Falta gate contra selección accidental de producción. | Proyecto demo aislado, asserts de emulador, rollout App Check monitorizado y configuración validada |
| M-06 · MEDIUM | sw.js:4–40; index.html/login.html | Cache-first conserva HTML/JS sin revalidar hasta cambio manual v7; skipWaiting + claim puede mezclar versiones. Exclusión por substring, sin allowlist de origen/rutas. Offline cubre shell, no garantiza Firebase ni CDNs. | Política de actualización coherente, solo assets públicos versionados y errores offline explícitos |
| M-07 · MEDIUM | ui.js:48–141; detalle.js:24–30 | Modal genérico no contiene/restaura foco ni vuelve inerte el fondo. El detalle de pago usa overlay propio: cierre externo pierde cambios y permite cerrar durante commit. Escape de modales apilados no tiene dueño único. | dialog accesible común + dirty guard del router y de pestaña |
| M-08 · MEDIUM | styles.css:49,75,142,150,219,357,392; tokens.css | transition sin propiedades equivale a all; sidebar/toast de 250 ms y barras de 300–400 ms. Botones pequeños/menú sin mínimo 44; sin safe-area inferior global ni números tabulares universales. Hay tabular y reduced-motion parciales. | Tokens y componentes UX; revisar toda superficie interactiva |
| M-09 · MEDIUM | spinner/vacio en ui.js:271–284; dashboard/reportes/mapa/reservas | Predominan spinners que no reservan geometría y vacíos textuales sin CTA; no skeletons de tabla/matriz. Falta estado de mantenimiento y vencimiento contractual consistente. | Carga geométrica, CTA pertinente y ejes de estado separados; medir CLS |
| M-10 · MEDIUM | geo.js:15–27; pdf.js:13–22; excel.js:23–32; index.html importmap | Scripts CDN ejecutan con acceso a la sesión; no integrity en los scripts dinámicos ni CSP configurada. SDK navegador fijo y dependencia npm con rango pueden divergir. No se hizo análisis de advisories ni se afirma una CVE. | Dependencias reproducibles y revisadas, CSP compatible probada; fallback de carga/reintento |
| M-11 · MEDIUM | propiedades/edificios.view.js:53–56; unidades.view.js:107–110; reglas:87,91 | Integridad referencial solo se revisa en UI, contra caché/consulta previa. SDK puede borrar propiedad con reservas o crear referencias cruzadas. | Archivar, validar referencias y estado de unidad en servidor |
| M-12 · MEDIUM | pdf.js:33–55; detalle.js:39–60; configuracion.view.js:36–53 | PDF se genera desde copias mutables del navegador sin identidad de recibo o snapshot inmutable; botón mail es “Próximamente”. Backup JSON no es snapshot consistente, omite subcolecciones y no tiene restauración probada. | ADR-04, snapshots de recibos, outbox y backup/restauración verificados |
| M-13 · MEDIUM | tests/ y package.json | Pruebas actuales cubren métricas, estadoPago, lectura de usuarios y altas cooperantes. No cubren pagos, reversas, escritura directa hostil, revocación, aislamiento org ni contratos. No hay CI versionada ni build. | Matriz de pruebas del roadmap y CI con gates reales |
| L-01 · LOW | README; ONBOARDING; scripts/nuevo-cliente.sh; AUDIT histórico | Convivían seguridad “basta login”, migración multitenant “solo BaseService”, web pública leyendo reservas y workflow inexistente. La auditoría vieja decía cero tests. | Avisos/enlaces actuales y reemplazo de recomendaciones inseguras; mantener docs vivos |
| L-02 · LOW | core/metricas.js:15; config/client.config.js; reservas.view.js:457–460 | “Hoy” depende del reloj local; zonaHoraria configurada no se aplica a todos los cálculos. Confundir fecha civil y Timestamp afectará vencimientos/penalidades futuras. | Fecha civil de negocio y reloj de servidor definidos por ADR-03 |
| N-01 · NICE TO HAVE | arquitectura modular actual | Tipado estático, Storybook o React podrían facilitar crecimiento, pero no cierran las brechas anteriores. | Evaluar solo con beneficio medible después de estabilizar el dominio |

Las lecturas de Firestore se autorizan a nivel de documento; la solución de H-01 requiere separación de documentos o una respuesta de servidor depurada, no una regla que oculte campos. Véase [Firebase: acceso a campos](https://firebase.google.com/docs/firestore/security/rules-fields).

## 6. Escenarios que deben convertirse en regresiones

1. **Bypass del lock:** staff crea dos documentos de reserva con idénticas fechas y campos iniciales de pago válidos usando setDoc, sin llamar a ReservasService. La regla actual no exige lock, existencia de unidad ni exclusividad.
2. **Reversa repetida:** anular dos veces el mismo movimiento resta dos veces la cuenta; el segundo delete no comprueba que el pago exista. Un batch atómico puede ejecutar una transición de negocio inválida.
3. **Edición contra pago:** un formulario conserva pagado=0, otro operador paga y luego el primero guarda fechas/precio; saldo se recalcula con la copia vieja.
4. **Pago parcial reintentado:** un cobro confirmado cuyo resultado se perdió puede repetirse con otro movRef mientras el saldo restante lo permita.
5. **Revocación incompleta:** cambiar activo=false deja rol operativo válido para rol(); ocultar la navegación no corrige eso.
6. **Lectura de dinero:** un contexto trabajador obtiene una reserva/unidad completa y accede a los campos que la UI no dibuja.

Son reproducciones derivadas de código y reglas; **no se ejecutaron abusos contra producción**. Las pruebas futuras deben negar estos casos tras el cambio, además de aprobar los caminos permitidos.

## 7. Verificación ejecutada en esta entrega

| Check | Resultado |
|---|---|
| npm run lint | Código 0; 0 errores, 1 warning preexistente: formatoValor sin usar en src/core/pdf.js:152 |
| npm test | **37/37** aprobadas, 15 suites |
| Suite equivalente a npm run test:emulator | **19/19** aprobadas, 4 suites, Firestore + Auth locales |
| Build | **N/A:** no existe script build ni compilación; ES Modules estáticos |
| Producción / Storage / Functions / UX en navegador | No verificados; sin despliegues ni cambios de consola |

Por restricciones del wrapper npm.ps1 y para mantener archivos temporales dentro del workspace, el emulador se lanzó con el ejecutable Node de la CLI local:

~~~sh
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only firestore,auth --project alquileres-314f3 "node --test tests/emulator/*.test.js"
~~~

Se usó el JAR ya disponible, copiado a .firebase/audit-runtime/emulators, con config y temporales locales. La CLI avisó que no tenía login y no pudo consultar MOTD remoto; **los emuladores arrancaron y el script terminó con código 0**. Se cerró el proceso Java residual después del shutdown y se retiraron los temporales de esta ejecución. No fue necesario autenticar ni contactar la base real. Ese ID compartido con la configuración actual queda como deuda M-05, no como patrón recomendado.

Estas 56 pruebas prueban lo que sus casos cubren; no certifican las garantías faltantes de la tabla. El código de runtime, las reglas y los índices permanecen sin cambios en esta entrega.

## 8. Secuencia de remediación

Seguir [REFACTOR_ROADMAP.md](REFACTOR_ROADMAP.md): primero fronteras y aislamiento; luego ocupación/ledger autoritativos; después consultas, recibos y UX; por último operación y eventual multiorganización. Cada fase tiene tests de salida y una estrategia para no bloquear el cliente viejo antes de tener reemplazo.
