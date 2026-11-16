# CLAUDE.md — Ingeniería de Alquileres

Leé y aplicá [AGENTS.md](AGENTS.md) completo: es la fuente normativa compartida para agentes y contribuidores. Este archivo es su entrada para Claude; no mantener otra matriz de permisos ni otro roadmap aquí.

## Contexto real (2026-11-15)

SPA de JavaScript vanilla, ES Modules e import maps, sin React ni bundler. Firebase Auth + Firestore Web SDK; un proyecto Firebase por cliente. Roles actuales: dueño, encargado, trabajador y sin_asignar desde usuarios/{email}. No existen Cloud Functions, Storage integrado, contratos mensuales ni portal de inquilinos en el repositorio.

La arquitectura objetivo está definida en los ADR y aún requiere implementación. No describirla como desplegada ni proponer una reescritura del frontend por defecto.

## Invariantes obligatorios

- Security Rules y autorización de servidor como frontera; nunca confiar en menús, botones o rutas.
- Aislamiento por organización/UID, membresía activa y RBAC comprobable antes de habilitar más clientes en una base compartida. Custom Claims solo mediante Admin SDK privilegiado.
- Reserva/contrato: transacción autoritativa con locks deterministas para todas las transiciones de ocupación. El chequeo del formulario no garantiza exclusividad.
- Pagos: transacción, idempotencyKey, validación de importes enteros por moneda, ledger append-only y reversas auditadas. No editar ni borrar historia financiera.
- Totales y ajustes se calculan en servidor; la UI solo presenta estimaciones. Side effects mediante outbox; nunca dentro de callbacks transaccionales reintentables.
- Consultas acotadas con cursores e índices; listeners con unsubscribe y manejo de error; ninguna truncación que comprometa disponibilidad o totales.
- Skeletons sin saltos, estados claros, borradores protegidos, foco accesible, controles de 44 × 44 px, moneda con tabular-nums, safe-area y movimiento explícito menor a 200 ms. Prohibido transition-all.
- No registrar ni persistir PII innecesaria. Firebase web config es pública; credenciales administrativas nunca son configuración de cliente.
- Implementar fases acotadas y mantener compatibilidad/migración verificable. Evitar sobreingeniería y preservar cambios ajenos.

## Verificación

Antes de cualquier commit o entrega de código: npm run lint, npm test y npm run test:emulator. Reglas, pagos y reservas requieren pruebas negativas y de concurrencia que también omitan los servicios de UI. Registrar warnings y checks que no se pudieron ejecutar.

Build actual: **N/A — no existe script build; ES Modules estáticos**. Validar sintaxis y carga HTTP para cambios de runtime. Si se agrega compilación, el build será obligatorio. No ejecutar deploy ni migrar datos reales como parte de una verificación local.

## Documentos vivos

- [Auditoría vigente y evidencia](docs/CODEBASE_AUDIT.md)
- [Decisiones de arquitectura](docs/ARCHITECTURE_DECISIONS.md)
- [20 principios de UX y motion](docs/UX_GUIDELINES.md)
- [Roadmap con gates de salida](docs/REFACTOR_ROADMAP.md)

AUDIT.md queda como registro histórico de septiembre, no como diagnóstico vigente.

## Referencia de solo lectura

C:\xampp\htdocs\Ecommerce\ecommerce se inspecciona exclusivamente por lectura. **No escribir, borrar, instalar, compilar, ejecutar ni correr git dentro de esa referencia.** Todas las escrituras de esta tarea permanecen dentro del workspace de Alquileres.
