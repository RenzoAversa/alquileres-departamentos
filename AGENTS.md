# Reglas de ingeniería — Alquileres

Vigencia: 2026-11-15. Este archivo es la fuente normativa para agentes y contribuidores.

## Contexto verificado

- SPA de JavaScript vanilla con ES Modules, import maps y CSS; **no hay React, bundler ni backend propio**.
- Firebase Authentication y Firestore Web SDK. Las Security Rules son la frontera para clientes; los futuros servicios con Admin SDK deberán autorizar cada comando porque omiten esas reglas.
- Hoy: un proyecto Firebase por cliente; roles dueño, encargado, trabajador y sin_asignar, consultados en usuarios/{email}. Custom Claims, organizaciones compartidas, portal de inquilinos, contratos mensuales y Cloud Functions son **arquitectura objetivo**, no capacidades existentes.
- Separar hechos, decisiones objetivo y trabajo pendiente. Leer [auditoría vigente](docs/CODEBASE_AUDIT.md), [ADR](docs/ARCHITECTURE_DECISIONS.md), [UX](docs/UX_GUIDELINES.md) y [roadmap](docs/REFACTOR_ROADMAP.md) antes de cambios importantes.
- AUDIT.md conserva la auditoría histórica de septiembre; no usar sus hallazgos como estado actual sin comprobar el código.

## Flujo obligatorio

1. Descubrir el flujo completo, reglas, consultas y pruebas relevantes antes de editar.
2. Explicitar problema, invariante, impacto y cambio acotado. Aplicar la solución profesional más simple; no migrar a React ni añadir capas o dependencias por costumbre.
3. Implementar dentro del alcance autorizado. Una tarea documental no autoriza a presentar fases de implementación como terminadas.
4. Verificar comportamiento y casos negativos; revisar seguridad, consistencia, UX y costo.
5. Actualizar documentos y comunicar qué pasó, evidencia y límites. No llamar seguro o listo para producción a algo sin pruebas.

No ejecutar despliegues, migraciones de datos reales, cambios de Claims o publicaciones por inferencia de una tarea local. No hacer commits si no se solicitaron. No ocultar checks fallidos ni desactivar validaciones para aprobarlos.

## Límites del workspace y referencia

**C:\xampp\htdocs\Ecommerce\ecommerce es referencia de solo lectura.** Se pueden leer sus archivos. No crear, modificar, borrar, instalar, compilar, ejecutar la aplicación ni correr git allí. Las escrituras de esta tarea y sus artefactos deben permanecer en el workspace de alquileres. Preservar cambios locales ajenos, incluidas carpetas de configuración de agentes.

## Seguridad y privacidad

- Autorización en Firestore/Storage Rules y, cuando existan, en cada Cloud Function; rutas, menús y feature flags solo mejoran la UX.
- Denegar por defecto. Matriz explícita de get/list/create/update/delete por rol, organización y asignación. Nunca usar un comodín autenticado como permiso global.
- Usar UID como identidad estable en el modelo nuevo. Claims solo desde Admin SDK en entorno privilegiado; comprobar membresía activa y versión de autorización para revocación sin esperar al refresco del token.
- Aislar organizaciones en rutas y referencias. No agregar varios propietarios/clientes al proyecto compartido antes de migrar y probar ese aislamiento.
- Firestore lee documentos completos. Separar operaciones, PII y finanzas; ocultar importes en el DOM no impide leerlos con el SDK.
- Validar claves permitidas y obligatorias, tipos, tamaños, enums, fechas, referencias, moneda, importes y campos inmutables. No reenviar objetos arbitrarios a escrituras sensibles.
- Bloquear escrituras directas de clientes sobre ledger, saldos, locks, roles y estados críticos en el destino server-authoritative. Los servicios de cliente no son una frontera de seguridad.
- App Check complementa Auth y RBAC; no los reemplaza. Nunca enviar tokens de depuración a producción.
- Configuración web de Firebase es pública por diseño. No guardar claves de servicio, tokens, credenciales de proveedores, DNI/CUIT ni PII en logs, URLs, repositorio o cachés persistentes sin una necesidad y política explícitas.
- Storage privado y reglas probadas antes de habilitar archivos. Validar rutas, pertenencia, tamaño y tipo; MIME declarado no prueba el contenido. No compartir enlaces permanentes con capacidad de descarga de contratos o recibos.
- No afirmar que la consola, IAM, App Check o las reglas desplegadas coinciden con el repo sin evidencia del entorno.

## Invariantes de dominio

- Toda alta, edición, traslado, reactivación, cancelación, hold, mantenimiento o contrato que cambie ocupación pasa por **una transacción autoritativa** y el mismo protocolo de locks deterministas del ADR-02.
- Los chequeos previos de disponibilidad sirven para feedback. Nunca garantizan exclusividad.
- Transacciones: todas las lecturas antes de escrituras; callbacks seguros ante reintentos; sin PDF, notificaciones, llamadas externas ni modificaciones de UI dentro del callback.
- Ediciones sensibles incluyen expectedVersion y fallan con conflicto si quedó vieja; no sobrescribir pagos con datos de un formulario anterior.
- Pagos, devengamientos, expensas, depósitos y liquidaciones: importes enteros en unidad menor, moneda explícita, cálculo validado por servidor y política de redondeo versionada.
- Ledger append-only. Nunca editar o borrar un asiento confirmado ni eliminarlo por borrar una reserva. Corregir con reversa vinculada, motivo y actor auditados.
- Cada comando crítico lleva idempotencyKey/requestId estable por intención y hash canónico. Mismo key/payload devuelve el resultado anterior; key con otro payload falla. Doble clic y reintento tras timeout no duplican efectos.
- La misma transacción persiste deduplicación, asientos, proyecciones y outbox. No confundir atomicidad de un batch con validación de concurrencia o idempotencia.
- No confiar en totales, intereses, índices ICL/IPC, tasas ni saldos enviados por el navegador. Un precio manual requiere permiso, motivo y validación del servidor.
- No sumar ARS y USD; no convertir sin cotización explícita, origen y fecha. No improvisar normativa contractual o fiscal.
- No borrar entidades referenciadas; archivar y preservar trazabilidad. Migraciones con dry-run, conciliación y recuperación documentada.

## Consultas, listeners y resiliencia

- Listados con filtros, orden estable, limit y cursor startAfter. Paginar arrays ya descargados no reduce lecturas.
- Nunca truncar silenciosamente una consulta de exclusión de ocupación. Exhaustividad y límites se diseñan juntos en el ADR-02.
- Índices versionados junto a cada consulta nueva; no agregar índices hipotéticos como si ya fueran necesarios.
- Todo listener tiene propietario, unsubscribe y manejo de error. Limpiar listeners, timers, observadores y cachés al desmontar/logout/cambio de organización o permisos.
- Evitar N+1 y relecturas de todo el historial. Proyecciones financieras reconciliables, no sumas parciales presentadas como totales.
- Diferenciar vacío, error, caché y datos confirmados. No mostrar éxito de pago/reserva antes del commit. Sin red, conservar la intención en memoria y reintentar con la misma clave.

## UX obligatoria

- Aplicar los 20 principios de [UX_GUIDELINES.md](docs/UX_GUIDELINES.md). Cada flujo contempla carga, vacío con CTA, error recuperable y éxito.
- Skeleton con geometría del contenido real; sin saltos de layout. Estados con icono + texto + color.
- Moneda en formato es-AR con código ARS/USD cuando pueda confundirse, precisión del dominio y font-variant-numeric: tabular-nums; números alineados.
- Transiciones explícitas menores a 200 ms con --ease-out; prohibidos transition-all y transition sin propiedades. Respetar prefers-reduced-motion.
- Objetivos táctiles de al menos 44 × 44 px; safe-area-inset-bottom en barras inferiores fijas.
- Diálogos accesibles con foco contenido y restaurado, Escape controlado y fondo inerte. Proteger borradores en Cancelar, cierre externo, atrás, navegación y recarga; bloquear cierre durante commit.
- Facilitar tareas frecuentes sin suprimir validaciones, autorización o confirmaciones financieras necesarias.

## Verificación antes de commit o entrega de código

Ejecutar y registrar:

~~~sh
npm run lint
npm test
npm run test:emulator
~~~

- Cambios de reglas, acceso o dinero exigen pruebas positivas **y negativas** en emuladores; incluir escrituras SDK directas que omitan la UI, aislamiento y concurrencia.
- Actualmente no existe script build: registrar **build N/A — ES Modules estáticos**. Verificar sintaxis y carga HTTP cuando cambie código; no inventar un build aprobado. Si se incorpora un pipeline, su build pasa a ser obligatorio.
- Pruebas de React/hooks solo si se adopta React deliberadamente; hoy probar funciones de dominio y ciclo de vida DOM.
- Para cambios documentales comprobar enlaces, coherencia y diff; reportar la línea base disponible. No añadir pruebas que solo repliquen textos o implementación.
- Registrar warnings preexistentes y restricciones del entorno. Un emulador que no arrancó no equivale a tests aprobados.
- Emuladores aislados; nunca ejecutar suites destructivas contra Firebase real. Separar proyectos de prueba y producción como indica el roadmap.
