# Decisiones de arquitectura — Alquileres

Fecha: 2026-11-15. Estado global: **decisiones objetivo adoptadas para el refactor; implementación pendiente**. La [auditoría](CODEBASE_AUDIT.md) describe el estado real. La aplicación continúa siendo JavaScript modular; estos ADR no requieren React.

## Contexto e invariantes

Hoy cada cliente tiene su propio proyecto Firebase y sus colecciones de primer nivel. El destino mantiene esa opción de despliegue y agrega una frontera de organización explícita antes de compartir base. “Tenant” técnico significa organización; “inquilino” significa la persona vinculada a un contrato, nunca se intercambian ambos conceptos.

Se adaptan los criterios de la referencia de solo lectura: aislamiento obligatorio, ledger inmutable, concurrencia optimista, deduplicación y outbox. Los importes y estados enviados por el navegador son intenciones, no datos confiables.

~~~mermaid
flowchart LR
    SPA["SPA: intención + idempotencyKey"] --> Command["Callable: Auth, App Check, RBAC, esquema"]
    Command --> TX["Transacción Firestore"]
    TX --> Membership["Membresía / versiones"]
    TX --> Occupancy["Locks + ocupación"]
    TX --> Ledger["Ledger + proyecciones"]
    TX --> Dedup["Resultado del comando"]
    TX --> Outbox["Outbox"]
    Outbox --> Worker["Worker idempotente"]
    Worker --> Artifacts["PDF privado / notificación"]
    Reads["Lecturas SDK acotadas"] --> Rules["Security Rules"]
    Rules --> Projection["Proyecciones autorizadas"]
~~~

No se acepta que el Admin SDK sea seguro “porque está en una función”: omite Rules y necesita el mismo aislamiento, validación y autorización en cada comando. [Firebase: consultas y Security Rules](https://firebase.google.com/docs/firestore/security/rules-query).

## ADR-01 — Aislamiento de organizaciones, propietarios y RBAC

**Problema actual.** Perfiles por email, activo ignorado y documentos que mezclan dinero/PII/operación. No hay Custom Claims ni membresía multiorganización.

**Decisión.** UID es la identidad estable; todas las rutas del modelo nuevo parten de organizaciones/{orgId}. La organización activa procede de un ID token firmado y se coteja con membresía activa. La UI no elige el alcance enviando un orgId arbitrario.

### Esquema objetivo mínimo

~~~text
organizaciones/{orgId}
  miembros/{uid}                   rol, activo, authzVersion, permisos
  asignaciones/{uid_propiedadId}   alcance explícito del manager/trabajador
  edificios/{id}                  datos operativos sin PII financiera
  unidades/{id}                   datos operativos; sin tarifas privadas
  tarifas/{id}                    solo roles financieros autorizados
  reservas/{id}                   ocupación y referencia de huésped
  huespedesPrivados/{id}          PII mínima y política de acceso
  reservasFinancieras/{id}        proyección financiera autorizada
  contratos/{id}                  operación y relación de partes
  contratosPrivados/{id}          identidad/documentación protegida
  contratosFinancieros/{id}       términos y cargos autorizados
  cuentas/{id}, ledger/{entryId}
  comandos/{commandId}, outbox/{eventId}, recibos/{receiptId}
~~~

No colocar dinero ni DNI/CUIT dentro de documentos legibles por trabajador. Firestore entrega el documento completo; las restricciones de campos sirven para escrituras, no para devolver versiones censuradas de una lectura. [Firebase: reglas por campo](https://firebase.google.com/docs/firestore/security/rules-fields).

### Contrato de permisos

| Principal | Lectura | Comandos autorizables |
|---|---|---|
| Anónimo / sin_asignar / miembro inactivo | Ningún documento privado; sin_asignar solo su perfil mínimo | Ningún comando de negocio |
| Dueño / administrador de organización | Datos de su organización según finalidad | Equipo, propiedades, contratos, caja y reversas auditadas; sin acceso implícito a otra organización |
| Encargado / manager | Propiedades asignadas; finanzas solo de ese alcance y permisos de cuenta explícitos | Operación/cobros autorizados del alcance; no administra identidades ni permisos |
| Trabajador | Proyección operativa asignada y contacto estrictamente necesario; sin importes | Solicitar reserva con tarifa validada por servidor; sin override de precio ni gestión de pagos |
| Inquilino (futuro) | Solo contrato publicado, cargos y recibos propios mediante relación UID validada; sin datos de terceros | Solicitudes propias; nunca confirmar pagos, modificar términos ni escribir ledger |
| Worker de servidor | Alcance org de su evento y cuenta de servicio mínima | Solo su caso de uso, validando referencias y versiones |

No hay un “admin global” accesible desde el cliente. Si se crea un plano de soporte transversal, será separado, explícito y auditado.

### Claims y revocación

- Claims mínimas: orgId activo, rol y authzVersion. Asignaciones extensas viven en Firestore, no en el token; no incluir PII ni listas completas de clientes.
- Solo un proceso privilegiado con Admin SDK emite Claims. El endpoint administrativo valida que el actor puede gestionar esa organización, la transición permitida y que quede al menos un dueño activo.
- Cambiar rol o desactivar: transacción sobre miembro + documento org con contador de dueños + auditoría + outbox de sincronización de Claims. Revalidar permisos del actor dentro de la transacción.
- Rules y comandos comparan token.authzVersion con miembro.authzVersion y exigen activo. Una versión vieja queda denegada inmediatamente, aunque el ID token anterior no haya expirado. Un fallo al sincronizar Claims provoca denegación temporal, nunca acceso ampliado.
- El worker actualiza Claims y la UI renueva el token para recuperar acceso. No prometer revocación inmediata con Claims solamente: se propagan en nuevos tokens. [Firebase: Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims).
- Email verificado como política de onboarding; invitación por email se redime contra un UID autenticado y verificado. Ausencia de pantalla de registro no demuestra que el alta por API esté bloqueada en el proyecto.

### Rules y pruebas

Permisos separados para get/list/create/update/delete. Denegar escrituras de clientes sobre miembros administrativos, tarifas críticas, ocupación, contratos confirmados, ledger, saldos y outbox. Las lecturas validan org y asignación; list exige restricciones compatibles con Rules y límites de consulta. Rules no filtra resultados: una consulta debe poder demostrar todo su alcance.

Para campos no críticos editables por cliente: hasOnly/hasAll, tipos y máximos, diff de campos editables, referencias de misma org y timestamps controlados. Ningún wildcard recursivo puede reabrir una colección privada. Comprobar presupuesto de accesos get/exists/getAfter por request; no construir grafos de autorización sin límite.

**Consecuencias.** Más documentos/proyecciones y migración coordinada; se obtiene aislamiento verificable. Se conserva el despliegue por cliente mientras migra. No habilitar un portal ni varios propietarios compartidos antes de esta frontera.

**Aceptación.** Matriz positiva/negativa por rol y operación; dos orgs con IDs iguales; manager fuera de asignación; inquilino ajeno; usuario inactivo y token obsoleto; intento de autoescalamiento y eliminación concurrente del último dueño. Ninguna prueba depende de botones ocultos.

## ADR-02 — Cero doble ocupación y contratos atómicos

**Problema actual.** create usa correctamente un lock por unidad, pero las reglas permiten omitirlo; editar/reactivar y mantenimiento no siguen un protocolo común. Las candidatas se consultan fuera del seguimiento transaccional.

**Decisión.** Todas las mutaciones de ocupación son comandos de servidor ejecutados con runTransaction. Para mantener una comprobación exhaustiva y acotada se usa un índice autoritativo por **unidad y mes civil**, además de un documento de contención/versionado por unidad.

~~~text
organizaciones/{orgId}/unidades/{unidadId}/_locks/ocupacion
organizaciones/{orgId}/unidades/{unidadId}/ocupacion/{YYYY-MM}
  dias: { "01": { asignacionId, tipo, expiresAt? }, ... }
~~~

La ocupación actual es por noche de unidad completa. El rango es [fechaEntrada, fechaSalida): checkout y checkin el mismo día son compatibles. No se pretende resolver turnos por hora con este modelo. Una reserva, hold, contrato o mantenimiento bloqueante ocupa los mismos slots.

### Protocolo

1. Validar Auth, esquema, rol/alcance, fechas civiles reales, entrada < salida y tamaño de operación. Capturar un ahora de servidor para evaluar expiración; no usar reloj del cliente.
2. Derivar referencias de comando, documento de negocio, locks y meses afectados. En traslados/ediciones incluir unión de rangos viejos/nuevos y ambas unidades; ordenar IDs de locks consistentemente.
3. Dentro de la transacción, **antes de escribir**, leer membresía/versión, idempotencia, unidad y versión de negocio, locks y todos los buckets afectados. Una ausencia de bucket significa libre, no omitir su lectura.
4. Comprobar unidad existente, activa y del mismo alcance; expectedVersion vigente; slots libres o propiedad de la misma asignación. Un hold expirado no bloquea aunque el worker de limpieza todavía no corrió.
5. Escribir en el mismo commit: liberar slots viejos propios, ocupar los nuevos, subir versión del lock y entidad, actualizar reserva/contrato, deduplicación, auditoría y outbox. Si es alta con pago inicial explícitamente atómico, incluir el asiento y sus proyecciones.
6. Retornar resultado confirmado. Un conflicto de negocio preserva el formulario y ofrece buscar otras fechas; un conflicto de versión exige recargar/comparar, nunca reintentar sobrescritura silenciosa.

Dos transacciones de la misma unidad leen/escriben el mismo lock; el reintento relee todos los buckets. **No se usa getDocs fuera de la transacción para decidir disponibilidad.** No limitar una lista de conflictos y asumir que los no cargados no existen.

### Estados y límites

- pendiente/hold → confirmada/activa; pendiente/hold → cancelada/expirada; confirmada → finalizada o cancelada según política de negocio.
- Reactivar, extender o cambiar de unidad siempre reclama ocupación de nuevo; cancelar libera solo slots pertenecientes a esa entidad. Mantenimiento usa idéntica exclusión.
- Un contrato borrador no bloquea. Confirmarlo crea contrato + ocupación + cargos iniciales exigibles juntos. Un contrato activo no se borra: finalizar/cancelar deja historia.
- Hold requiere expiresAt de servidor; la limpieza es mantenimiento y jamás la fuente de verdad de disponibilidad. El job comprueba asignacionId/versión antes de liberar.
- Propuesta inicial a validar con producto: **máximo 36 meses por comando**, para reservas/contratos con fin explícito. El servidor calcula antes del commit documentos, tamaño y accesos esperados y rechaza operaciones que excedan su presupuesto. No fragmentar una confirmación en commits parciales ni afirmar atomicidad de un contrato sin cobertura completa.
- Contratos de plazo mayor/indefinido requieren una decisión adicional antes de habilitarlos. La cifra anterior es un límite técnico propuesto, no una regla legal ni capacidad ya implementada.

Callbacks transaccionales pueden repetirse y deben evitar efectos externos o cambios de UI; las transacciones cliente fallan offline. [Firebase: transacciones](https://firebase.google.com/docs/firestore/manage-data/transactions).

**Consecuencias.** Los buckets agregan escrituras y contención por unidad, a cambio de exclusión determinista sin escanear todo el historial. Una unidad de alta demanda puede requerir backoff y conflicto recuperable, no saltarse el lock.

**Aceptación.** Exactamente una confirmación ante 2/10 altas superpuestas; límites adyacentes; cancelada; hold expirado antes de cleanup; crear vs editar; dos traslados inversos; reactivación vs mantenimiento; contrato vs reserva; operación sin unidad; fechas inválidas; rollback completo y escritura SDK directa denegada.

## ADR-03 — Ledger inmutable de alquileres, gastos, pagos y depósitos

**Problema actual.** Movimientos y saldos mutables, reversas mediante delete, floats y ausencia de deduplicación. La atomicidad existente no garantiza trazabilidad ni un único efecto por intención.

**Decisión.** Libro append-only, validado y escrito exclusivamente por servidor. Cargos, pagos, depósitos y liquidaciones son tipos de asiento del mismo ledger, con proyecciones de lectura separadas. No crear cuatro CRUD independientes con saldos divergentes.

### Registro y dinero

Cada asiento contiene id, schemaVersion, orgId, tipo, moneda, importeMinor, contratoId/reservaId/unidadId/cuentaId cuando correspondan, fechaEfectiva civil, creadoEn de servidor, actorUid, commandId, motivo, referencias y versión de la política usada. Rechazar campos no admitidos.

- importeMinor es entero seguro en unidad menor de la moneda, con límites de negocio y comprobación de overflow; ARS/USD se contabilizan por separado.
- No usar parseFloat acumulativo ni Number(valor)||0 para aceptar entradas inválidas. Convertir texto decimal mediante parser estricto; cálculos proporcionales con decimal/racional controlado y un redondeo explícito al contabilizar.
- Política inicial propuesta: redondeo de mitad hacia afuera de cero a la unidad menor por línea; versionar la política y aprobar ejemplos antes de activar ajustes.
- Precios, expensas, intereses, depósitos, IVA si correspondiera y ajustes se derivan de términos y tasas validados por servidor. La UI puede estimar, pero el commit devuelve el total autoritativo.
- Manual override: permiso separado, importe validado y motivo auditado. Trabajador no define precio final.
- Cargo por alquiler/expensas no equivale a dinero cobrado. Pago reduce deuda y aumenta caja; transferencia no es ingreso; depósito de garantía es un pasivo, no renta. Liquidación no crea otro ingreso por sí sola.
- Una conversión de moneda es una operación explícita con ambas piernas, cotización, fecha y origen; nunca sumar ARS y USD para un KPI sin conversión identificada.

### Idempotencia y concurrencia

El cliente genera una idempotencyKey por intención y la conserva durante sus reintentos. El servidor deriva commandId con hash de orgId + actorUid + tipoComando + key; no acepta rutas arbitrarias ni una clave nueva por retry.

~~~text
comandos/{commandId}
  actorUid, tipo, payloadHash, resultado, entidadId, completadoEn
~~~

El hash se calcula **en servidor** sobre payload normalizado y versión del comando; incluye importes, moneda, referencias y motivo, excluye transporte/timestamps de solicitud. Para una operación con expectedVersion, una repetición exacta sigue devolviendo el resultado aunque la entidad haya avanzado.

En una transacción: leer membresía y permisos actuales; leer comando; si existe y hash coincide devolver resultado original; si difiere, conflicto de idempotencia. Si no existe, leer entidades/cuenta/proyección frescas, validar y escribir asiento(s), asignaciones del pago, proyecciones, resultado y outbox juntos. Una revocación de permisos también impide releer el resultado.

El saldo de cuenta se deriva de apertura + asientos de caja; el saldo de contrato/reserva, de cargos − pagos aplicados + reversas. Proyecciones son server-only, versionadas y reconciliables. Leer la cuenta para validar existencia, moneda y actividad; no basta increment sobre una referencia del navegador.

Para devengamientos automáticos, usar clave de negocio determinista (contrato + período + concepto + versión) independiente del job que reintente. Corregir un período con reversa y nuevo asiento, no cambiando la clave para duplicarlo.

### Reversas e índices de ajuste

- El asiento original nunca cambia. Reversa nueva con reversaDe, motivo, actor, commandId y signo contable contrario.
- En la misma transacción crear un marcador único reversas/{asientoOriginalId}. Leerlo evita dos reversas del mismo asiento aunque tengan keys distintas.
- Revertir con importes y cuenta del asiento fresco, no del formulario. Actualizar caja y aplicaciones/proyecciones atómicamente; depósitos y liquidaciones requieren sus políticas propias.
- ICL/IPC: almacenar serie, período, fecha de publicación, fuente, valores base/final, fórmula, política de redondeo y revisión. Nunca pedir al cliente el factor definitivo. Falta de índice bloquea el ajuste y muestra pendiente, no aplica cero ni una estimación.
- Punitorios: términos, calendario, base, tope y versión explícitos; no inventar tasas o reglas legales. Revisión de términos fuera de esta entrega.

No eliminar documentos de deduplicación mientras una operación pueda reintentarse; el ledger conserva commandId y la unicidad de negocio incluso si se diseña un archivado posterior.

**Migración.** Exportar respaldo restaurable; inventariar saldos/monedas; detectar duplicados y diferencias; crear asientos de apertura con procedencia legacy y corte; no inventar asientos históricos ausentes. Conciliar hasta unidad menor y congelar escritores viejos durante el cambio. Evitar dual-write no atómico entre modelos.

**Aceptación.** Retry parcial idéntico produce un asiento; key distinta con payload idéntico es otra intención y debe pasar las reglas de negocio. Key repetida/cambiada falla. Dos reversas producen una sola reversa; pago vs ajuste usa versiones frescas; cuenta ajena/inactiva o moneda incompatible falla; conciliación reproduce cada proyección.

## ADR-04 — Mutaciones críticas en servidor y side effects recuperables

**Decisión.** Cloud Functions callable para reservar, editar/trasladar/reactivar/cancelar ocupación, confirmar contrato, registrar/revertir pago, contabilizar cargos/ajustes/depósitos/liquidaciones y administrar roles. La alternativa de reglas con getAfter solo se admite si puede probar la invariante completa; no alcanza para buscar intervalos arbitrarios ni validar fuentes externas.

Límites del módulo futuro:

~~~text
functions/src/
  commands/       valida transporte, Auth, App Check y DTOs
  domain/         políticas y cálculos puros
  repositories/   acceso Firestore con org obligatorio
  workers/        outbox, PDF, notificaciones, conciliación
~~~

No agregar interfaces sin consumidores ni una API REST paralela por costumbre. Usar errores de dominio estables: FECHAS_OCUPADAS, VERSION_CONFLICT, IDEMPOTENCY_CONFLICT, SALDO_INSUFICIENTE, MONEDA_INCOMPATIBLE, PERMISSION_DENIED; mensajes de UI claros sin stacks ni PII. Si luego existe REST, mapear conflictos a HTTP 409.

### App Check y abuso

Activar en web y medir antes de enforcement de Firestore/Storage; los callables críticos exigen enforceAppCheck al entrar en servicio. Validar identidad y permiso igualmente; limitar tamaño/rango/frecuencia por UID y org. App Check no previene un abuso por un usuario legítimo con permisos excesivos ni reemplaza idempotencia. [Firebase: enforcement en callables](https://firebase.google.com/docs/app-check/cloud-functions).

### Outbox

La transacción crea eventos con eventId estable, orgId, tipo, entidad/versión, snapshot/referencia inmutable, estado, intentos, nextAttemptAt y correlationId.

1. Worker reclama un evento con lease y vencimiento en una transacción.
2. Ejecuta el efecto fuera de la transacción con eventId como clave del proveedor cuando sea posible.
3. Guarda resultado verificable y confirma procesado; al fallar programa backoff acotado. Tras máximo de intentos, cola de revisión con error depurado.
4. Otro worker puede recuperar lease expirado. No prometer entrega exactamente una vez: si el proveedor no deduplica, el crash entre envío y confirmación puede duplicar una notificación. Mostrarlo y conciliar/revisar, sin duplicar dinero.

Los triggers pueden entregarse repetidos; handlers y callbacks deben ser idempotentes. [Firebase: reintentos de funciones](https://firebase.google.com/docs/functions/retries).

### Recibos, contratos y Storage

- Recibo emitido desde snapshot de un **pago confirmado**, no de una reserva mutable completa. receiptId estable por pago/versión, monto/moneda/fecha/actor, saldo al momento y referencia del asiento.
- PDF generado por worker en ruta determinista y privada; retry no genera otro recibo. La UI muestra pago confirmado aunque el PDF esté pendiente y permite reintentar sin registrar otro cobro.
- No llamar factura fiscal a un recibo ni afirmar validez fiscal por producir un PDF.
- Storage: organizaciones/{orgId}/contratos/{contratoId}/... y .../recibos/{receiptId}/.... Reglas privadas con claims/membresía y pertenencia; frontend no sobrescribe archivos emitidos. IAM y el endpoint generador se verifican por separado.
- Uploads futuros: allowlist de tipos y tamaños con cuarentena y validación de contenido en servidor; no confiar solo en MIME/extensión. Los metadatos y la propiedad son inmutables para cliente.
- Descarga autenticada o enlace de corta duración emitido tras autorizar al solicitante; no usar URLs permanentes de descarga como permiso de lectura. Compartir nunca publica el bucket.
- WhatsApp: una acción explícita abre el compositor del usuario con texto mínimo; no se envían mensajes automáticamente. Un enlace privado compartible requiere política de destinatario y caducidad.
- Si no se habilita Storage, mantenerlo fuera del producto y preparar reglas deny-all versionadas antes de cualquier activación; la ausencia local actual no prueba la seguridad del bucket remoto.

**Aceptación.** Escrituras SDK críticas denegadas; handler rechaza org/rol/referencias ajenas incluso con Admin SDK; reintentos y crashes de workers; recibo idéntico en retry; PDF fallido no revierte pago; URL vencida o usuario ajeno no descarga; no salen notificaciones desde callbacks de transacción.

## ADR-05 — Higiene de consultas, índices, listeners y estado offline

**Decisión.** Consultas explícitas por caso de uso. No extender BaseService.getAll a entidades críticas ni afirmar que multiorganización se resuelve cambiando ese archivo: hay escrituras y lecturas directas en varios servicios.

- Listados: página inicial de 25, máximo 100 por petición; orderBy estable y document ID como desempate; startAfter del último documento confirmado. Mantener cursor/página al volver de un detalle.
- Filtrar en Firestore por org/ruta y alcance; filtros por building, unit, paymentStatus o rango se diseñan antes de agregar el índice. No descargar toda la base para ofrecer búsqueda instantánea.
- Búsqueda inicial por prefijos normalizados y campos admitidos en org/asignación, con debounce de 150–180 ms y cancelación lógica de resultados viejos. Firestore no ofrece búsqueda substring/full-text general; un servicio externo requiere decisión separada.
- Calendario/ocupación usa solo meses visibles con cobertura completa; no un limit que corte conflictos. Reportes exactos usan proyecciones conciliadas o job paginado, nunca el primer lote presentado como total.
- Exportaciones/backup como jobs autorizados por lotes y snapshot/corte explícito. Un JSON descargado desde seis queries independientes no sustituye un respaldo restaurable.

### Catálogo de queries e índices previstos

Estos son **diseños para las queries nuevas**, no índices requeridos por el código actual. Versionar JSON exacto en firestore.indexes.json en la misma fase que implemente cada query; validar en staging, porque el emulador no certifica disponibilidad de índices de producción.

| Caso | Colección objetivo / predicados | Orden y cursor | Índice compuesto previsto |
|---|---|---|---|
| Reservas por unidad | reservas, unidadId ==, estado == | fechaEntrada ASC + __name__ ASC, limit 25 | unidadId ASC, estado ASC, fechaEntrada ASC |
| Reservas por edificio | reservas, edificioId ==, estado == | fechaEntrada ASC + __name__ ASC | edificioId ASC, estado ASC, fechaEntrada ASC |
| Cobros pendientes | reservasFinancieras, estadoCobro == pendiente | vencimiento ASC + __name__ ASC | estadoCobro ASC, vencimiento ASC |
| Mayor de cuenta | ledger, cuentaId ==, fechaEfectiva en rango | fechaEfectiva DESC + __name__ DESC | cuentaId ASC, fechaEfectiva DESC |
| Recibos de inquilino | recibos, inquilinoUid == | emitidoEn DESC + __name__ DESC | inquilinoUid ASC, emitidoEn DESC |
| Outbox disponible | outbox, estado == pending, nextAttemptAt <= ahora | nextAttemptAt ASC + __name__ ASC | estado ASC, nextAttemptAt ASC |

Rutas por org evitan un campo orgId adicional para queries internas; collectionGroup o consultas de control plane necesitan aislamiento explícito distinto. Un manager con asignación limitada usa índices/proyecciones compatibles con esa asignación; no se le abre un listado global para filtrarlo en JS. Si cambia el sentido de __name__, declararlo expresamente.

### Ciclo de vida y offline

- Cada render devuelve dispose. El router dispone el anterior, cancela resultados tardíos con generationId y remueve listeners/intervals/observers. Limpiar también al logout, cambio de org o versión de permisos.
- Listener con ventana superior/inferior y límite documentado; si la ventana se completa, mostrar “hay más” y consultar páginas, no aparentar exhaustividad. Renovar ventana al cambiar el día/mes. Deudas antiguas tienen consulta independiente.
- onSnapshot recibe callback de error; la UI deja de mostrar “actualizado”, ofrece retry y diferencia datos de caché de confirmados. Conservar unsubscribe antes de await del primer snapshot, como ya hace notificaciones.
- Cachés de datos autorizados por UID/org y TTL; invalidación tras comandos. PII y dinero preferentemente en memoria; cerrar sesión purga todo. Cambiar permisos también invalida búsquedas y datos de UI.
- Pagos/reservas no se confirman offline. Ante timeout, consultar comando o reintentar misma key antes de permitir repetir la intención. Un indicador persistente diferencia “sin confirmar” de error definitivo.
- Service Worker solo almacena shell/assets públicos de una versión coherente; excluir Auth, Functions, Firestore, PII y documentos privados. No prometer uso offline integral si el SDK/CDN no está disponible.

**Consecuencias.** Más contratos de consulta y proyecciones pequeñas; lecturas y memoria quedan acotadas. No aumentar índices indiscriminadamente ni llamar gratis a cambios de listeners.

**Aceptación.** Cursores con fechas repetidas no omiten/duplican filas; crecimiento de historial no aumenta lecturas por página; tests de logout durante init y navegación rápida; datos de otra org nunca aparecen tras reconectar; error de listener visible; consultas nuevas funcionan con índices desplegados en entorno de prueba.

## Seguimiento

Los cinco ADR se implementan mediante los gates de [REFACTOR_ROADMAP.md](REFACTOR_ROADMAP.md). No cambiar su estado a “implementado” hasta aportar diff, pruebas de seguridad/concurrencia y evidencia de migración/entorno correspondiente.
