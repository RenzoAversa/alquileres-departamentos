# UX de gestión de propiedades y alquileres

Fecha: 2026-11-15. Estado: **estándar objetivo para implementación gradual**. Las carencias actuales están en [CODEBASE_AUDIT.md](CODEBASE_AUDIT.md); este documento no afirma que el nuevo diseño exista.

## 1. Experiencia central: operar con confianza

La primera pantalla responde: **qué requiere atención hoy, en qué unidad y qué acción lo resuelve**. La prioridad es registrar operaciones correctas con poco esfuerzo, mantener contexto y mostrar el resultado confirmado.

Modo Operar: cuatro a seis indicadores como máximo, cola de tareas de hoy y matriz de unidades. Reportes históricos, filtros avanzados y configuración quedan en navegación secundaria. Una acción primaria por contexto; reversas, archivos y opciones excepcionales quedan en acciones secundarias con nombre explícito.

Conservar la SPA modular actual. Construir componentes DOM/CSS compartidos en core y módulos; no introducir React, Tailwind ni una librería de animación para cumplir estas reglas.

## 2. Matriz de unidades y estados

| Edificio / unidad | Ocupación | Cobranza, solo roles autorizados | Contexto próximo | Acción principal |
|---|---|---|---|---|
| Torre Norte · 2A | ○ Disponible | Sin contrato | Próxima entrada: 18 nov | Reservar |
| Torre Norte · 2B | ◷ Reservado | ◷ Vence en 3 días | Entrada: 18 nov | Ver reserva |
| Casa Sur · 1 | ✓ Alquilado | ✓ Al día | Contrato hasta 31 dic | Ver contrato |
| Casa Sur · 2 | ✓ Alquilado | ! Atrasado · 5 días | Saldo ARS visible según permiso | Cobrar |
| Torre Norte · 3A | ⚒ Mantenimiento | Sin obligación vigente | Hasta 20 nov | Ver mantenimiento |

Son ejemplos ficticios de diseño, no datos de la base.

- Separar tres ejes: ocupación (disponible/reservado/alquilado/mantenimiento), cobranza (al día/vence en X días/atrasado) y vencimiento de contrato. Un contrato próximo a vencer no implica deuda.
- Estado siempre con **icono + texto + color**. No depender del rojo/verde ni usar solo un punto de color. Iconos decorativos con aria-hidden; texto accesible completo.
- Cobranza se deriva de obligaciones vigentes y pagos confirmados del servidor. “Al día” requiere datos conciliados; falta de datos muestra “Sin confirmar”, nunca un cero verde.
- Si no hay contrato u obligación, mostrar “Sin contrato” o “No aplica”. Definir horizonte “vence pronto” como configuración de producto, sin inventar un plazo legal.
- Trabajador recibe matriz operativa sin dinero, estado de deuda ni totales financieros. La API/Rules también limita el documento: ocultar columnas no es privacidad.
- Unidad y edificio anclan la lectura; huésped/inquilino y próxima fecha como contexto secundario. Conservar filtros y posición al cerrar el detalle.
- Desktop: matriz compacta con encabezado fijo y columnas alineadas. Móvil: tarjetas por unidad, estado y acción en el primer bloque; sin reducir objetivos táctiles.
- Buscador visible: edificio, unidad, huésped/inquilino y estado permitido por rol; chips para filtros comunes y “Limpiar filtros”. Opciones avanzadas colapsadas.

## 3. Los 20 principios de UX y movimiento

Adaptación del sistema cognitivo y de motion de la referencia. Cada principio debe producir un comportamiento observable.

| # | Principio | Aplicación y criterio de aceptación |
|---|---|---|
| 1 | Respuesta física sutil | Press de botones con escala 0.985 opcional y 90 ms; sin cambiar geometría ni mover etiquetas. Se desactiva con reduced-motion. |
| 2 | Anticipación | Lista, matriz, resumen y detalle muestran skeleton de su geometría antes de datos; ningún vacío temporal se presenta como resultado real. |
| 3 | Enfocar la tarea | Cobro/contrato en diálogo o drawer con fondo inerte; total, destinatario y acción principal visibles sin competir con reportes. |
| 4 | Estados explícitos | idle, editing, validating, submitting, confirmed, conflict y failed tienen presentación definida; no mezclar éxito verde con request pendiente. |
| 5 | Continuidad breve | Filas o menús aparecen con opacity/transform en 120–180 ms, sin rebote ni cascadas que retrasen el uso. |
| 6 | Easing consistente | --ease-out en transiciones de interacción; sin ease-linear en entradas/salidas. El usuario controla scroll y drag, sin animación que lo contradiga. |
| 7 | Origen espacial claro | Drawer entra desde su borde; popover se ancla al control; toast aparece cerca de su zona estable sin recorrer la pantalla. |
| 8 | Acción secundaria discreta | Badge y saldo se actualizan después del commit sin quitar foco ni desplazar la acción que el usuario está usando. |
| 9 | Respuesta ágil | Todas las transiciones de UI menores a 200 ms. Feedback de activación inmediato; no retrasar clics para terminar una animación. |
| 10 | Error inequívoco | Conflicto de unidad, versión o monto tiene texto específico y resolución; conservar datos y enfocar el campo o bloque relevante. |
| 11 | Capas coherentes | Escala de elevación única para shell, popover, drawer, diálogo y confirmación; solo la capa superior captura Escape y foco. |
| 12 | Precisión visual | Escala 4/8/12/16/24/32 px, tipografía y radios consistentes; números alineados; espacio suficiente sin tarjetas ornamentales repetidas. |
| 13 | Ley de Fitts | Cobrar, reservar y guardar aparecen junto a su contexto y en zona cómoda; acciones destructivas separadas y con nombre preciso. |
| 14 | Áreas táctiles amplias | Todo botón, cierre, filtro, fecha y paginador tiene objetivo mínimo de 44 × 44 px, también si su icono mide 16 px. |
| 15 | Ley de Hick | Una acción primaria; filtros frecuentes visibles, avanzados progresivos. No ofrecer mail/WhatsApp como acciones operativas si aún no funcionan. |
| 16 | Agrupar información | Dashboard con máximo seis KPIs; detalle dividido en unidad/partes/fechas, importes y actividad; no un formulario largo sin jerarquía. |
| 17 | Feedback sin espera | Reacción visual ideal <100 ms; si red supera 400 ms, mantener skeleton o progreso contextual. Nunca confirmar cobros/ocupación de modo optimista. |
| 18 | Entrada tolerante, dominio estricto | Búsqueda ignora mayúsculas/tildes; teléfonos/moneda aceptan pegado local y preservan cursor. Servidor valida fechas, moneda, importes y permisos. |
| 19 | Patrones familiares | Buscar arriba, filtros junto al listado, unidad clicable, detalle lateral y botón guardar/cancelar predecibles. Enter y teclado respetan semántica nativa. |
| 20 | Frecuencia y economía de pasos | Predeterminar contexto y reutilizar datos autorizados; medir clics de cobro/recibo y no repetir edificio, unidad o inquilino conocidos. |

## 4. Flujos principales

### Registrar un pago y obtener un recibo

El formulario llega con unidad/contrato, saldo fresco, moneda, fecha de negocio y cuenta habitual autorizada. Si no hay cuenta válida, usar un CTA claro para configurarla; no elegir una cuenta incompatible silenciosamente.

1. Desde la matriz: **Cobrar** abre el panel contextual (clic 1).
2. **Confirmar y generar recibo** muestra importe/moneda/cuenta y confirma el comando (clic 2). Generación PDF se solicita automáticamente, sin otra pantalla ni registro duplicado.

Desde el panel de cobro ya abierto: **Confirmar pago** (clic 1) → **Compartir por WhatsApp** o **Descargar PDF** (clic 2). Este es el objetivo de ≤2 clics para cobro + compartir; la navegación previa y completar/corregir campos no se ocultan en la medición. El objetivo desde matriz es ≤2 clics para cobro + generación.

Si se implementa una acción combinada “Confirmar y compartir”, puede mantener dos clics desde matriz en navegadores compatibles, pero solo abrirá el compositor después de confirmar el pago y preparar el recibo. No enviar automáticamente ni eliminar la revisión del importe para cumplir una métrica. Verificar bloqueo de popups y alternativas de compartir antes de prometer ese recorrido en todos los dispositivos.

- Durante submit: bloquear repetición y cierre, conservar key de intención; texto “Confirmando pago…”.
- Commit confirmado, PDF pendiente: “Pago registrado · Preparando recibo”. Mostrar importe y referencia confirmados. El fallo de PDF ofrece “Reintentar recibo”, nunca “Volver a cobrar”.
- Timeout con resultado incierto: “Verificando el pago”. Recuperar por la misma clave; no sugerir crear otro pago.
- Conflicto por pago de otra sesión: actualizar saldo con explicación y preservar nota/cuenta válidas.
- Compartir abre el compositor del usuario con texto mínimo y enlace privado apto para el destinatario; nunca expone PII en URLs ni publicaciones de Storage.
- Recibo identifica pago, moneda, fecha y saldo al emitir. Cambios posteriores generan documentos vinculados, no reescriben la historia.
- “Revertir pago” requiere motivo y muestra efecto sobre saldo; no se llama “Eliminar” ni borra el original.

### Crear o renovar un contrato

Entrar desde una unidad preselecciona edificio/unidad. Elegir inquilino existente rellena datos permitidos sin duplicar la persona; nuevo inquilino usa formulario mínimo. No mostrar DNI/CUIT en listados generales.

Bloques progresivos: partes → vigencia → condiciones económicas → revisión. Reutilizar términos autorizados al renovar, pero volver a validar disponibilidad, versión, moneda e índices. Identificar claramente qué es estimación y qué importe confirmó el servidor.

Borrador conserva cambios durante navegación interna autorizada; no ocupa la unidad. Confirmar crea contrato, ocupación y obligaciones iniciales exigibles atómicamente según ADR-02/03. Conflicto conserva el borrador y ofrece fechas/unidades alternativas. Renovar es una nueva versión/documento vinculado, no modificación silenciosa del contrato firmado.

### Buscar, reservar y mantener contexto

Texto y filtros tienen respuesta visual inmediata; debounce de 150–180 ms y cancelación lógica de resultados viejos. Resultados paginados por servidor; no descargar todo el historial. Mostrar alcance, estado de carga y CTA para limpiar filtros sin confundir error con “No hay resultados”.

En disponibilidad, resultados indican rango y capacidad; el precio mostrado es estimación autorizada. Reservar revalida al confirmar y explica si otra persona ocupó la unidad. Mantenimiento usa el mismo flujo de exclusión y no queda como una simple etiqueta editable.

## 5. Tokens de precisión

Propuesta para assets/styles/tokens.css y los componentes compartidos; no es CSS ya incorporado.

~~~css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-press: 90ms;
  --dur-fast: 120ms;
  --dur-base: 180ms;
  --touch-target: 44px;
  --radius-control: 10px;
}

.control {
  min-width: var(--touch-target);
  min-height: var(--touch-target);
  transition: background-color var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out),
              opacity var(--dur-fast) var(--ease-out);
}
.money, .numeric {
  font-variant-numeric: tabular-nums;
}
.money {
  text-align: right;
  white-space: nowrap;
}
.mobile-actions {
  padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
}
:focus-visible {
  outline: 2px solid var(--color-primario);
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .control, .drawer, .toast, .skeleton {
    transition: none;
    animation: none;
    transform: none;
  }
}
~~~

Prohibidos transition-all y transition sin propiedad, incluidas abreviaciones como transition: .15s. Preferir opacity/transform para movimiento; no animar width/height de tablas ni barras durante operaciones. Skeleton estático es válido; brillo opcional discreto y reducido a cero bajo reduced-motion.

Dinero: formato es-AR desde importeMinor, moneda inequívoca ARS/USD y precisión del dominio (dos decimales para estos asientos). No mostrar importes confirmados con maximumFractionDigits: 0 ni convertir falta de dato en cero. Alinear decimales en tablas y evitar que el crecimiento del saldo mueva botones.

## 6. Estados, borradores y accesibilidad

| Situación | Comportamiento exigido |
|---|---|
| Carga inicial | Skeleton con las mismas columnas, altura de fila, márgenes, cabecera y overflow del resultado en cada breakpoint; aria-busy y etiqueta de estado |
| Refetch | Conservar datos/contexto y señalar actualización; no reemplazar toda la pantalla por spinner |
| Colección vacía | Explicación específica y CTA permitido: “Todavía no hay unidades” → “Crear unidad” |
| Filtro vacío | Mostrar alcance y “Limpiar filtros”; no sugerir crear una entidad duplicada |
| Error de red/permisos | Mensaje recuperable y reintento si corresponde; no tabla vacía ni acceso ampliado localmente |
| Datos antiguos/offline | Marca visible “Sin conexión / última actualización…”; pagos y reservas sin éxito hasta commit |
| Éxito | Resultado confirmado en contexto, referencia y siguiente acción; toast como apoyo, no única evidencia |
| Borrador sucio | Cancelar, X, clic externo, Escape, atrás, cambio de ruta y recarga usan el mismo guard; continuar edición como opción principal segura |
| Guardado en curso | Evitar cierres/repeticiones; permitir salir de la pestaña solo con aviso y recuperación posterior de la intención |

- Dialog nativo o equivalente probado: nombre accesible, foco inicial razonable, trap, fondo inerte y devolución de foco al disparador. Confirmación sobre diálogo no destruye el formulario inferior.
- Inputs con label; errores asociados con aria-describedby/aria-invalid y resumen enfocado cuando son varios. Mensajes de pago/carga con live region adecuada, sin anunciar todos los cambios del dashboard.
- Búsqueda accesible por teclado (Enter/Escape y navegación de resultados); no usar un div role=button sin acción de teclado equivalente.
- Selector de fechas con foco y nombre completo del día, estado seleccionado/no disponible, navegación de teclado y explicación del bloqueo.
- Dinero y datos sensibles no se persisten como borrador en localStorage por defecto. Una política de recuperación persistente debe definir cifrado/retención, alcance UID/org y eliminación; no incorporarla por comodidad.
- Mobile con zoom, teclado abierto y orientación horizontal: acciones accesibles sin tapar el campo activo. Barra inferior fija solo si ayuda al flujo y reserva su espacio en layout.

## 7. Gate de calidad visual y funcional

Antes de marcar un flujo terminado:

- Revisar 360 px, 768 px y desktop, ambos temas, zoom 200 %, teclado completo y reduced-motion.
- Medir CLS en carga/refetch con datos representativos y red lenta: objetivo ≤0.1 global, sin saltos atribuibles al intercambio skeleton/contenido.
- Comprobar objetivos de 44 × 44 px y safe-area en dispositivo/emulación compatible; medir contraste AA, no inferirlo de tokens.
- Cronometrar feedback y duraciones; inspeccionar CSS para all implícito/expreso.
- Probar dirty guard por cada salida, submit duplicado, timeout, conflicto de otra sesión, PDF fallido y reconexión.
- Medir clics con punto de partida registrado para cobro/generación/compartir; incluir casos sin cuenta o con permisos limitados.
- Verificar que matriz, recibo y saldo concuerdan con servidor y que trabajador/inquilino no reciben datos ajenos.

Capturas y métricas se registran al implementar; la revisión estática de esta entrega no sustituye ese gate.
