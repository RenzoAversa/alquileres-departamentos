# Roadmap de refactor con gates de salida

Fecha: 2026-11-15. Estado: **plan pendiente de ejecución**. Esta entrega completa auditoría y documentos; no cambia reglas, datos ni runtime.

El pedido recibido termina al comienzo de la fase 2. Se completa aquí una secuencia propuesta de fases acotadas hasta operación y validación. No es una autorización de despliegue ni una declaración de que las fases ya están hechas.

## Reglas de ejecución

- Resolver primero acceso e integridad, después costo/resiliencia, luego flujos y presentación.
- Una PR/cambio revisable por paquete de trabajo. Incluir problema, invariante, archivos, pruebas y migración; sin reescritura de frontend.
- Cada fase depende de sus gates, no de una fecha prometida. Estimaciones requieren inventario de datos y entorno.
- Nunca endurecer reglas que consume el cliente viejo sin preparar el reemplazo. La transición se prueba en emuladores/staging; no reabrir permisos para hacer pasar un release.
- No habilitar funciones mensuales, multiorganización, portal, archivos privados o web pública sobre el modelo actual sin sus fronteras.
- Identificar por separado **artefactos listos**, **migración ensayada** y **despliegue verificado**. Un deploy local no forma parte de esta tarea documental.

## Fase 0 — Línea base, fixtures y entorno de prueba

**Objetivo:** poder demostrar regresiones y ensayar migraciones sin datos reales.

**Paquete 0.1**

- Registrar versiones instaladas, configuración usada y línea base de tests.
- Preparar proyecto demo para emuladores, configuración independiente y un assert que impida pruebas destructivas sin endpoints locales.
- Crear fixtures sintéticas: dos organizaciones, roles activos/inactivos, unidades con colisión, múltiples monedas, pagos/reversas y datos legacy.
- Definir registro de consultas, catálogo de campos sensibles, fecha civil de negocio y contratos de comandos.
- Definir respaldo consistente y procedimiento de restauración antes de cualquier migración real. El backup JSON actual no es suficiente.

**Archivos previstos:** package.json, firebase.json o config de emuladores dedicada, src/firebase/init.js, tests/emulator/, docs de migración/verificación. No introducir credenciales de servicio en el repo.

**Gate:** suites conectadas solo a emuladores; fixtures de dos orgs; snapshot de configuración sin secretos; plan de recuperación revisable. Build actual N/A: ES Modules estáticos.

**Línea base obtenida en esta entrega:** lint sin errores y un warning previo; 37 unitarias + 19 de emulador aprobadas. No hay pruebas de pagos ni de bypass SDK actuales.

## Fase 1 — Firestore/Storage Rules, UID, Custom Claims y catálogo de índices

**Hallazgos:** H-01, H-05, H-08, H-09; base de H-10/M-05/M-11. C-01/C-02 **no quedan cerrados** hasta el corte autoritativo de fase 2.

### 1.1 Identidad y matriz de autorización

- Introducir un módulo compartido de autorización de servidor y membresías UID activas del ADR-01.
- Añadir bootstrap privilegiado controlado para dueño inicial y comando administrativo de cambio de rol; nunca “primer login se hace dueño”.
- Mantener último dueño mediante transacción, versión de autorización y auditoría; Claims emitidas por Admin SDK y sincronizadas con reintentos.
- Ensayar el mapeo email legacy → UID verificado. Emails ambiguos, usuarios sin Auth y referencias inexistentes se reportan para resolver; no inventar UID ni permisos.

### 1.2 Rules y separación de documentos

- Escribir reglas deny-by-default para el modelo nuevo por org/rol/asignación y operación.
- Validar claves, tipos, enums, límites, referencias y campos inmutables de las escrituras no críticas permitidas.
- Separar documentos operativos, PII, tarifas y finanzas para que trabajador no descargue dinero.
- Preparar lectores de frontend compatibles con esa proyección. No desplegar una regla que quite campos sin entregar el lector correspondiente.
- Mantener el modelo legacy aislado como transición explícita, con restricciones mínimas verificables y sin habilitar nuevas organizaciones o portales. No marcarlo como seguro por tener rol.
- Crear storage.rules con denegación total mientras no haya archivos y enlazarlo a configuración/emulador local. El módulo privado se abre únicamente con pruebas de fase 4.

### 1.3 Queries e índices de la nueva frontera

- Versionar firestore.indexes.json junto a consultas que realmente se introduzcan al migrar lectores; usar el catálogo del ADR-05 como especificación.
- No poblar índices hipotéticos ni diagnosticar el JSON vacío actual como bug de consultas de un solo campo.
- App Check: registrar cliente de prueba, medir y planificar enforcement. Separar configuración de cliente por entorno.

**Archivos previstos:** firestore.rules, storage.rules, firestore.indexes.json, firebase.json, src/core/sesion.js, servicios de usuarios/lectura, funciones de identidad mínimas, tests de Rules/Auth/Storage.

**Gate de código:** matriz positiva/negativa completa; usuario sin asignar, inactivo, token viejo, autoescalamiento, UID/email no coincidente, manager fuera de alcance, inquilino ajeno y último dueño concurrente. Trabajador no puede obtener un documento financiero por ID ni consulta.

**Gate de despliegue futuro:** migración ensayada, lectores listos, Claims sincronizadas y plan de corte. Fallo de Claims deniega temporalmente; rollback no restaura permisos más amplios.

## Fase 2 — Modelo de dominio, transacciones y ledger inmutable

**Hallazgos:** C-01, C-02, H-02 a H-07, M-02/M-11. Depende de autorización y fixtures de fases 0/1.

### 2.1 Núcleo de comandos y dinero

- Funciones puras de fecha civil, intervalos, esquema de dinero en unidad menor, moneda y redondeo.
- Sobre de comando con idempotencyKey, payloadHash de servidor, actor/org y resultado persistido.
- DTOs por caso de uso; servicio con Admin SDK siempre con contexto org explícito y autorización validada también dentro de la transacción.
- expectedVersion para ediciones; códigos de conflicto estables. Nada de UI o efectos externos dentro de callback reintentable.

**Pruebas:** fechas inválidas/adyacentes, años bisiestos, parser decimal local, importes inválidos/overflow, permisos y claves idénticas/cambiadas.

### 2.2 Ocupación y contratos

- Implementar lock por unidad + buckets mensuales exhaustivos del ADR-02.
- Comandos de alta, editar, traslado, reactivar, cancelar, hold, mantenimiento y confirmar contrato. Todos comparten el mismo protocolo.
- Validar estados/referencias y presupuesto de transacción antes del commit; aprobar límite técnico propuesto para duración contractual antes de habilitarlo.
- Retirar el getDocs de candidatas fuera de transacción y el check UI como garantía de escritura.

**Pruebas:** crear/crear, crear/editar, traslado/traslado, contrato/reserva, reactivación/mantenimiento; hold vencido antes de cleanup; rollback integral y stale version. Dos o diez comandos superpuestos dan exactamente una asignación activa.

### 2.3 Libro, pagos y reversas

- Ledger único append-only con cargos, expensas, pagos, transferencias, depósitos, devoluciones y liquidaciones; proyecciones por cuenta/contrato/reserva y moneda.
- Pagos leen saldo y cuenta frescos; validar pertenencia, actividad, moneda y aplicación del importe.
- Reversa crea otro asiento y marcador único por original. No batch.delete de historia.
- Devengamiento mensual con clave determinista por período/concepto; fuentes de índices y política versionadas antes de habilitar ICL/IPC o punitorios.
- Separar cobro de devengamiento y garantía de ingreso. Registrar override autorizado con motivo.
- Si el producto ofrece “reserva/contrato con pago inicial” como operación indivisible, un solo comando hace ambos. Si son dos intenciones, la UI muestra explícitamente reserva creada/pago pendiente; nunca éxito total engañoso.

**Pruebas:** doble clic, retry después de timeout, pagos parciales concurrentes, monto no positivo, cuenta ajena/inactiva, moneda incompatible, reversas repetidas/diferentes, pago vs edición/cancelación, depósitos y conciliación por moneda.

### 2.4 Migración ensayada y cierre de escritores antiguos

1. Script de dry-run: inventario de referencias, duplicados, diferencias, fechas y monedas; sin escribir datos reales.
2. Respaldo restaurable y corte propuesto. En entorno de prueba, copiar datos con mapeo verificable y asientos de apertura legacy; no inventar historia faltante.
3. Reconstruir ocupación y comparar contra reservas/contratos. Cualquier solapamiento exige resolución antes de activar locks nuevos.
4. Conciliar ledger/proyecciones a la unidad menor; emitir informe por entidad y moneda.
5. Entregar cliente que usa comandos nuevos. Durante corte controlado, congelar escritores viejos, migrar deltas/validar y cerrar Rules legacy críticas.
6. Comprobar con SDK directo que ledger, saldos, locks y estados críticos rechazan escrituras, también para dueño.

**Archivos previstos:** functions/src/commands, domain, repositories; src/services/reservas.service.js, movimientos.service.js, cuentas.service.js; vistas que envían intenciones; firestore.rules; scripts/migrations y suites de integración.

**Gate:** ningún camino alternativo de escritura rompe la invariante; conciliación exacta, migración repetible y pruebas adversarias. No liberar el nuevo dominio mientras el cliente viejo pueda modificar sus proyecciones.

**Recuperación:** antes de corte, cancelar migración y seguir con modelo original intacto; después de cortar, detener comandos afectados y reparar/avanzar desde respaldo y ledger. No volver a habilitar deletes ni realizar dual-write no atómico para hacer rollback.

## Fase 3 — Consultas acotadas, listeners y resiliencia

**Hallazgos:** M-01 a M-06, H-10; exactitud de reportes y backups en M-12.

### 3.1 Lecturas y costo

- Reemplazar getAll/buscar genéricos del flujo diario por repositorios con filtros, limit, orden estable y cursor.
- Índices y queries en la misma PR; staging verifica su disponibilidad. Emulador no valida todos los requerimientos de índices de producción.
- Ventanas de calendario por meses visibles; deudas con query propia, incluidas antiguas.
- Búsqueda normalizada acotada; agrupar referencias por unidad y evitar lectura por cada fila.
- Métricas autoritativas/reconciliadas; exportación paginada y corte consistente, sin presentar totales de una página como globales.

### 3.2 Ciclo de vida y offline

- render retorna dispose; router invalida renders tardíos y limpia timers/listeners/observadores.
- Conservar el cleanup correcto de notificaciones y ampliar tests a logout durante init, error tardío y cambio de rol/org.
- Eliminar caché persistente con PII/finanzas; cachés operativas de sesión con ámbito y TTL real.
- Service Worker por allowlist de assets/versiones, actualización coherente y fallback offline explícito; no cachear respuestas privadas.
- Tras timeout, recuperar comando por key. Confirmaciones de pago/ocupación requieren servidor; guardar intención en memoria sin duplicarla.

**Archivos previstos:** BaseService/servicios de lectura, core/router, store, notificaciones, buscador, vistas de calendario/reportes, excel, sw.js, indexes y tests de ciclo de vida.

**Gate:** lecturas por página acotadas con fixtures crecientes; cursores sin omisiones con fechas iguales; cero listeners residuales medidos; reconexión nunca muestra otra sesión; error distinguible de vacío; deudas antiguas presentes.

## Fase 4 — Outbox, recibos y documentos privados

**Hallazgos:** M-12; ejecución de ADR-04. Depende de pagos/contratos confirmados e idempotencia de fase 2.

- Worker con lease/reintento/backoff y cola de revisión. Cada evento conserva org y correlationId; payload sin PII innecesaria.
- Recibo desde snapshot de pago y ruta determinista de PDF; una repetición no emite otra identidad.
- Reglas Storage por org, actor y contrato/recibo; limitar upload y validar contenido antes de publicar. Clientes no sobrescriben archivos emitidos.
- Descarga autenticada/enlace breve autorizado y compartición explícita. No abrir el bucket ni generar URL permanente como sustituto de permiso.
- UI diferencia pago confirmado, recibo pendiente y fallo de entrega; reintentar documento no repite cobro.
- Retirar acción de mail “Próximamente” del flujo operativo o reemplazarla por una función completa y configurada.

**Archivos previstos:** workers/outbox/PDF, storage.rules, firebase.json (Storage y emulador), core/pdf o adaptador de descarga, detalle de cobro, tests de Storage/worker.

**Gate:** crash antes/después del efecto; evento duplicado y lease expirado; PDF idéntico por pago; acceso cruzado y URL vencida denegados; fallo del proveedor no revierte dinero. Limitaciones de deduplicación del proveedor documentadas.

## Fase 5 — UX operativa y diseño de precisión

**Hallazgos:** M-07 a M-09, H-01 en presentación. Aplicar [los 20 principios](UX_GUIDELINES.md) sobre contratos de datos ya estabilizados.

### 5.1 Componentes fundamentales

- Tokens --ease-out y duraciones <200 ms; transiciones explícitas, tabular-nums en importes ARS/USD, objetivos 44 × 44 px, safe-area y reduced-motion.
- Dialog/drawer accesible compartido con gestión de foco, Escape, fondo inerte y dirty-state de navegación/recarga.
- Skeletons geométricos para matriz/listas/resúmenes; estados vacíos con CTA y errores con retry.
- Campo monetario que no pierde cursor, preserva precisión y muestra moneda; errores accesibles.

### 5.2 Flujos

- Dashboard Operar y matriz con ocupación/cobranza/vencimiento separados, icono + texto + color y acción contextual por rol.
- Cobro desde matriz: Cobrar → Confirmar y generar recibo, con defaults válidos. Compartir desde panel: Confirmar → WhatsApp/PDF; medir el punto de partida como define UX.
- Contrato desde unidad con datos reutilizados, borrador protegido y conflictos recuperables.
- Filtros por edificio/unidad/inquilino/estado; volver del detalle conserva filtro, cursor y scroll.

**Archivos previstos:** tokens.css/styles.css/notificaciones.css; core/ui y router; dashboard, reservas/detalle/editar, propiedades, disponibilidad y nuevos módulos de contratos cuando existan.

**Gate:** 360/768/desktop, temas claro/oscuro, teclado/lector, zoom 200 %, reduced-motion, safe-area, red lenta, timeout y conflicto real. CLS ≤0.1 medido; cumplimiento de geometría/clics y privacidad por rol. No basta revisar capturas.

## Fase 6 — Release reproducible y operación

**Hallazgos:** H-11, M-05/M-10/M-13, L-01/L-02.

- CI con lint, unitarias, emuladores Rules/Auth/Storage/Functions según lo incorporado, sintaxis y validación de artefacto. Añadir build solo si existe bundler o empaquetado; mientras tanto registrar N/A.
- Empaquetar una carpeta pública por allowlist para Hosting/Pages. Excluir docs, tests, scripts, logs y configuración interna; incluir config web necesaria sin secretos.
- Revisar/pinear dependencias y alinear SDK navegador/tests; comprobar advisories con fuentes oficiales al ejecutar esa fase. No hacer upgrade masivo sin pruebas.
- CSP/headers compatibles con scripts/import maps/CDN y mapas; migrar inline o usar hashes según el esquema elegido. Verificar políticas en staging.
- Observabilidad sin PII: commandId/correlationId, denegaciones agregadas, conflictos, duración, outbox atrasada, errores y discrepancias de conciliación.
- Alertas de uso/costo y políticas de respaldo/retención/restauración. Restauración ensayada en entorno aislado.
- Runbook de incidentes: revocar miembro, detener un comando, recuperar job, conciliar saldos y restaurar sin modificar asientos históricos.
- Confirmar reglas/índices desplegados, IAM mínimo, App Check y separación de entornos; evidencia real antes de afirmar producción lista.

**Gate previo a despliegue:** todos los checks aprobados, advertencias resueltas o justificadas, artefacto inspeccionado, migración/recuperación probadas y revisión de cambios. Publicación o migración real requiere autorización de esa operación y revisión del entorno concreto.

## Fase futura — Portal, múltiples propietarios e integraciones

Solo después de los gates anteriores:

- Portal de inquilinos con relación UID a contrato/recibos, pruebas de identidad ajena y publicación controlada de documentos.
- Consolidación de clientes en proyecto compartido como migración independiente; nunca asumir que cambiar BaseService alcanza.
- Disponibilidad pública mediante endpoint/proyección sin PII ni finanzas privadas; jamás permitir lectura pública de reservas internas.
- iCal/Booking/Airbnb como comandos externos idempotentes bajo el mismo lock. Diseñar conflictos de importación, actualización y borrado sin sobreescribir ocupaciones confirmadas.
- Ajustes ICL/IPC y punitorios se habilitan solo con fuente, términos y política aprobados; esta documentación no determina su validez jurídica/fiscal.

## Matriz mínima de regresiones y trazabilidad

| Invariante | Caso que debe aprobar / rechazar | Fase de cierre |
|---|---|---|
| Aislamiento | Mismo ID de unidad en dos orgs no concede lectura ni escritura cruzada | 1 + corte 2 |
| RBAC | Trabajador no descarga dinero; manager no opera unidad ajena | 1 |
| Identidad | Autoescalar, miembro inactivo o token de versión vieja fallan | 1 |
| Último dueño | Dos desactivaciones concurrentes dejan uno activo | 1 |
| Exclusividad | Crear/editar/reactivar/contrato/mantenimiento compiten por misma ocupación | 2 |
| Frontera | SDK directo no escribe lock, ledger, saldos ni estado confirmado | 2 |
| Idempotencia | Retry exacto devuelve resultado; payload distinto con misma key falla | 2 |
| Reversa | Dos anulaciones del mismo pago producen una sola reversa | 2 |
| Dinero | Valores inválidos y cuenta/moneda ajena se rechazan; no se pierden centavos | 2 |
| Concurrencia | Pago/edición/cancelación conserva saldo y versión | 2 |
| Migración | Rerun no duplica apertura; discrepancias bloquean corte | 2 |
| Consultas | Cursores estables, conteos completos y lecturas acotadas | 3 |
| Sesión | Logout/cambio de org durante init elimina listeners y datos viejos | 3 |
| Side effects | Retry/crash no duplica recibo ni dinero; notificación incierta se revisa | 4 |
| Storage | Documento ajeno, upload no permitido y enlace vencido fallan | 4 |
| Borradores | Escape/atrás/ruta/recarga protegen cambios y guardado en curso | 5 |
| UX de cobro | Flujo medido, estado confirmado y recibo pendiente recuperable | 5 |
| Operación | Artefacto permitido, índices disponibles y restore probado | 6 |

## Checklist de cierre por paquete

1. Diff y documentos coherentes; no tocar referencia ni cambios ajenos.
2. npm run lint; npm test; npm run test:emulator y suites nuevas pertinentes.
3. Build si existe; hoy N/A con verificación adecuada a módulos estáticos.
4. Casos negativos, concurrencia y migración del paquete con evidencia, no solo happy path.
5. Riesgos restantes registrados por ID; no confundir el gate de una PR con aprobación de producción.

No hay commits, despliegues ni migraciones reales realizados por esta entrega.
