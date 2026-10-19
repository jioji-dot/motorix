# Investigación (Fase 0): Citas y órdenes de servicio

No quedaron marcadores `NEEDS CLARIFICATION`. Se mantienen las decisiones técnicas del Sprint 1 (ver `specs/001-base-clientes-vehiculos/research.md`); aquí se consolidan las específicas de este sprint.

## 1. Máquina de estados de la orden

- **Decisión**: una función pura `orderStateMachine` con una tabla de transiciones `estado actual → estados permitidos` y la regla de quién puede aplicar cada una. Los valores de estado son los de la documentación del proyecto: `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION`, `ESPERANDO_REFACCION`, `TERMINADO`, `ENTREGADO` y `CANCELADA`.

  | Desde | Hacia | Quién |
  |-------|-------|-------|
  | RECIBIDO | DIAGNOSTICO | mecánico asignado o ADMIN |
  | DIAGNOSTICO | EN_REPARACION | mecánico asignado o ADMIN |
  | EN_REPARACION | ESPERANDO_REFACCION, TERMINADO | mecánico asignado o ADMIN |
  | ESPERANDO_REFACCION | EN_REPARACION | mecánico asignado o ADMIN |
  | TERMINADO | ENTREGADO | RECEPTIONIST o ADMIN |
  | RECIBIDO, DIAGNOSTICO, EN_REPARACION, ESPERANDO_REFACCION | CANCELADA | RECEPTIONIST o ADMIN (con motivo) |
  | ENTREGADO, CANCELADA | (ninguna) | — |

- **Justificación**: aislarla de la base de datos permite probar todas las combinaciones (estado × estado × rol) de forma rápida y exhaustiva (SC-003). Una sola fuente de verdad evita reglas repetidas en controladores o pantallas.
- **Alternativas**: reglas dispersas con `if` en el servicio (difíciles de probar); una librería de máquinas de estado (dependencia innecesaria para 7 estados).

## 2. Protección contra cambios simultáneos

- **Decisión**: la transición se aplica con `UPDATE service_orders SET status = ? WHERE id = ? AND status = <estado leído>` dentro de una transacción; si no afecta ninguna fila, se responde 409 `STATE_CONFLICT` y la pantalla pide recargar.
- **Justificación**: es bloqueo optimista, simple y suficiente (caso límite de la spec: dos usuarios cambian la misma orden a la vez).
- **Alternativas**: `SELECT ... FOR UPDATE` (también válido, pero retiene el bloqueo más tiempo); sin protección (permite saltos de estado).

## 3. Permisos por rol y por asignación

- **Decisión**: la autorización por rol sigue en middleware (`authorize`); las reglas que dependen de la orden (mecánico asignado, campos permitidos por rol) viven en el servicio, que recibe al usuario autenticado. Un mecánico que pide una orden ajena recibe 403 `FORBIDDEN`. Permisos por campo del `PATCH /orders/:id`: diagnóstico, observaciones y recomendaciones → mecánico asignado o ADMIN; problema reportado y mecánico asignado → RECEPTIONIST o ADMIN.
- **Justificación**: el rol solo no basta para "mis órdenes"; hay que comparar `mechanicId` con el usuario (RN-5, RN-15).
- **Alternativas**: filtrar solo en la interfaz (prohibido por la constitución).

## 4. Folio de la orden

- **Decisión**: `folio` con formato `OS-000123` (prefijo y el `id` con ceros), asignado dentro de la misma transacción del alta mediante un `UPDATE` posterior al `INSERT`; la columna es única y admite `NULL` solo durante esa transacción.
- **Justificación**: MySQL no permite columnas generadas que usen el `AUTO_INCREMENT`; este esquema es único, legible y sin carreras.
- **Alternativas**: tabla de contadores (más piezas); `UUID` (ilegible para el taller).

## 5. Importes y totales

- **Decisión**: `DECIMAL(10,2)` para importes y tarifas, `DECIMAL(5,2)` para horas. El importe de la mano de obra es una columna generada almacenada `ROUND(hours * hourlyRate, 2)`; el total de la orden se recalcula con `SUM` dentro de la transacción de cada alta, edición o baja de línea y se guarda en `service_orders.total`.
- **Justificación**: evita errores de punto flotante y mantiene el total consistente con las líneas (SC-007). En la API los importes viajan como cadenas con dos decimales.
- **Alternativas**: `FLOAT` (impreciso); calcular el total solo al leer (obliga a recalcular en cada listado).

## 6. Kilometraje de entrada

- **Decisión**: entero entre 0 y 1,500,000. Si es menor al `currentMileage` del vehículo y no llega `mileageCorrection: true`, 409 `MILEAGE_DECREASE` (mismo código que en vehículos). Al crear la orden, el `currentMileage` del vehículo se actualiza al valor de entrada en la misma transacción.
- **Justificación**: aclaración del 2026-10-19; reutiliza la regla ya probada en vehículos.
- **Alternativas**: validar solo en la interfaz (insuficiente).

## 7. Fechas y horas de las citas

- **Decisión**: `scheduledAt` es un `DATETIME` en hora local del taller. La API acepta `YYYY-MM-DDTHH:mm`; no se permiten fechas pasadas al crear o cambiar la fecha (con tolerancia del minuto en curso). El aviso de cita duplicada (mismo vehículo, misma fecha y hora, estado activo) responde 409 `DUPLICATE_APPOINTMENT` y se acepta reenviando `confirmDuplicate: true`.
- **Justificación**: un solo taller, una sola zona horaria; mismo patrón de confirmación que el teléfono repetido del Sprint 1.
- **Alternativas**: guardar en UTC (complejidad innecesaria para un solo taller); bloquear horarios por capacidad (fuera de alcance).

## 8. Relación cita–orden

- **Decisión**: `service_orders.appointmentId` opcional. La regla "una cita, una orden activa" se aplica en el servicio dentro de la transacción (no con `UNIQUE`, para permitir crear otra orden si la anterior se canceló). Crear la orden pasa la cita a `EN_PROCESO`; cancelar la orden la devuelve a `CONFIRMADA`; entregarla la pasa a `COMPLETADA`.
- **Justificación**: refleja la aclaración (sin cancelación en cascada) y conserva el historial.
- **Alternativas**: `UNIQUE (appointmentId)` (impediría reintentar tras cancelar).

## 9. Líneas de servicio y mano de obra

- **Decisión**: tablas `order_services` y `order_labor` con llave foránea a la orden (sin cascada, porque las órdenes no se eliminan). Quitar una línea sí la borra físicamente: no es un registro del historial, y mientras la orden esté en curso el total se recalcula. Una vez la orden es `TERMINADO`, `ENTREGADO` o `CANCELADA`, las líneas son de solo lectura.
- **Justificación**: simple y alineado con la spec ("agregar, editar y quitar").
- **Alternativas**: borrado lógico de líneas (más complejidad sin requisito que lo pida).

## 10. Historial de cambios de estado

- **Decisión**: tabla `order_status_history` con estado anterior y nuevo, usuario, fecha y motivo opcional (obligatorio al cancelar); se inserta en la misma transacción del cambio.
- **Justificación**: FR-023 y trazabilidad; la orden creada también registra su primer estado.
- **Alternativas**: solo `updatedAt` (no responde quién ni cuándo).

## 11. Lista de mecánicos para asignar

- **Decisión**: `GET /api/mechanics` (ADMIN y RECEPTIONIST) devuelve los mecánicos activos (`id`, `name`); `GET /api/users` sigue siendo solo para ADMIN.
- **Justificación**: recepción necesita elegir mecánico sin acceder a la gestión de usuarios.
- **Alternativas**: abrir `/users` a recepción (excesivo).

## 12. Frontend

- **Decisión**: dos secciones nuevas en la barra lateral: **Citas** (ADMIN y RECEPTIONIST) y **Órdenes de servicio** (los tres roles; el mecánico solo ve las suyas porque el servidor ya filtra). Providers de datos al nivel de `MaterialApp`, vaciados al cerrar sesión (como en el Sprint 1). El detalle de la orden concentra las acciones según rol y estado; los botones de estado se muestran solo si la transición es válida y el rol puede aplicarla (el servidor valida de todos modos).
- **Justificación**: coherencia con el sistema de diseño y la estructura del Sprint 1.
- **Alternativas**: pantallas separadas por rol (duplicación).

## 13. Estrategia de pruebas

- **Decisión**: prueba unitaria **exhaustiva** de `orderStateMachine` (7 × 7 estados × 3 roles × asignado/no asignado); pruebas de servicio con modelos simulados; integración y contrato por rol contra la base `*_test`; widgets de cada pantalla con el API simulado compartido; prueba de diseño adaptable ampliada con las secciones nuevas.
- **Justificación**: CA-8 y SC-003 piden pruebas de la lógica de transiciones; el Sprint 1 mostró que las pruebas de diseño adaptable encuentran fallos reales.
- **Alternativas**: probar solo recorridos felices (deja huecos en las transiciones inválidas).
