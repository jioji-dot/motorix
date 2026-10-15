# Investigación (Fase 0): Historial, mantenimiento e inventario

**Funcionalidad**: [spec.md](spec.md) | **Fecha**: 2026-10-13

El Contexto técnico no tiene marcadores `NEEDS CLARIFICATION`: el stack y las convenciones ya existen desde los Sprint 1 y 2 (`specs/001-base-clientes-vehiculos`, `specs/002-citas-ordenes-servicio`). Este documento registra las decisiones de diseño propias del Sprint 3.

## D1. Historial como consulta calculada

- **Decisión**: el historial del vehículo NO tiene tabla propia. Es una consulta sobre `service_orders` con estado `TERMINADO` o `ENTREGADO`, con los servicios y la mano de obra agregados y las refacciones usadas. La fecha de servicio es la del cambio a `TERMINADO` en `order_status_history`; si no existiera esa fila, se usa `created_at` de la orden.
- **Justificación**: RN-10 y el Principio V piden derivar el historial sin duplicar. Se refleja siempre el estado actual de la orden y no hay nada que sincronizar.
- **Alternativas**: tabla `vehicle_history` poblada por un disparador o por el servicio (duplicación y riesgo de desfase); vista SQL (válida, pero la consulta paginada con agregados es más clara en el modelo y más fácil de probar).
- **Soporte**: índice compuesto `(order_id, to_status)` en `order_status_history` y el índice existente `idx_orders_vehicle` mantienen la consulta rápida con cientos de servicios por vehículo (SC-010).

## D2. Kilometraje de servicio

- **Decisión**: columna opcional `service_mileage` en `service_orders` (migración 003, mediante `ALTER TABLE`, porque la 002 es inmutable). Se captura con el trabajo técnico (`PATCH /api/orders/:id/work`) mientras la orden no esté `ENTREGADO`. Debe ser un entero mayor o igual al kilometraje de entrada. Al guardarlo, el kilometraje actual del vehículo pasa a `GREATEST(actual, servicio)` dentro de la misma transacción y con el vehículo bloqueado.
- **Presentación**: el historial muestra `COALESCE(service_mileage, entry_mileage)`.
- **Justificación**: el kilometraje de entrada ya existe; solo falta el de salida. Reutiliza `mileageService` y no obliga a capturarlo para terminar (aclaración del 2026-10-13).
- **Alternativas**: tabla de lecturas de kilometraje (excesiva para el MVP); exigirlo al terminar (rompe órdenes y pruebas del Sprint 2).

## D3. Mantenimiento: modelo y unicidad

- **Decisión**: tabla `maintenance` con `vehicle_id`, `order_id` (orden de origen, obligatoria), `description`, `next_date` (DATE, opcional), `next_mileage` (opcional), `status` (`PENDIENTE`, `REALIZADO`, `CANCELADO`), `completed_at`, `created_by` y marcas de tiempo. Una restricción `CHECK` exige fecha o kilometraje.
- **Un solo pendiente por vehículo**: columna generada `pending_vehicle_id = IF(status = 'PENDIENTE', vehicle_id, NULL)` con índice único. MySQL permite varios `NULL`, de modo que los realizados y cancelados se acumulan, y el pendiente queda único incluso con altas concurrentes.
- **Reemplazo**: si ya hay un pendiente y la petición no trae `replacePending: true`, se responde `409 MAINTENANCE_PENDING_EXISTS` con los datos del pendiente. Con `replacePending: true`, el anterior pasa a `CANCELADO` y el nuevo se inserta en la misma transacción.
- **Datos derivados**: "último servicio" (fecha y kilometraje) se obtiene de la orden de origen, no se duplica (diferencia con `Maintenance` de `docs/project-context.md`, que traía `lastServiceDate` y `lastMileage`; ver "Decisiones por confirmar" del plan).
- **Origen**: la orden debe estar `TERMINADO` o `ENTREGADO` y pertenecer al vehículo. El mecánico solo puede registrarlo desde sus órdenes; el administrador, desde cualquiera.
- **Alternativas**: permitir varios pendientes (lista ambigua para recepción); almacenar la clasificación "vencido/próximo" (se desactualiza con el paso del tiempo).

## D4. Clasificación de mantenimientos (vencido / próximo / lejano)

- **Decisión**: la clasificación se calcula al consultar, nunca se guarda.
  - **Vencido**: pendiente y (`next_date` anterior a hoy, o `next_mileage` menor al kilometraje actual del vehículo).
  - **Próximo**: pendiente, no vencido y (faltan `warning_days` días o menos para `next_date`, o faltan `warning_km` km o menos para `next_mileage`). Si coinciden la fecha o el kilometraje exactos con hoy o el actual, se considera próximo ("toca ahora").
  - **Lejano**: el resto; no aparece en el listado de avisos, pero sí en el detalle del vehículo.
- **Umbrales configurables**: tabla `app_settings` (clave, valor) con `maintenance_warning_days = 30` y `maintenance_warning_km = 1000`, cargadas por la migración 003. Se leen en cada consulta, de modo que cambiarlas no requiere tocar código. No se asumen intervalos universales por tipo de servicio (RN-12): el mecánico captura la fecha o el kilometraje que corresponda.
- **Justificación**: RN-11 y RN-12; los valores del equipo pueden cambiar sin despliegue. La clasificación en SQL permite filtrar, ordenar (vencidos primero) y paginar en la base de datos.
- **Alternativas**: variables de entorno (requieren reiniciar y no son datos del negocio); constantes en código (contradicen RN-12); pantalla de configuración (fuera del alcance del sprint).

## D5. Inventario: existencia como columna verificable

- **Decisión**: `parts.stock` guarda la existencia actual con `CHECK (stock >= 0)`, y `inventory_movements.quantity` guarda el cambio con signo (entrada positiva, salida negativa, ajuste positivo o negativo). Invariante: `parts.stock = SUM(inventory_movements.quantity)` para cada refacción. Toda modificación pasa por un único servicio que actualiza ambos en una transacción.
- **Justificación**: consultar el inventario con miles de refacciones no requiere sumar movimientos (SC-010) y la restricción de la base impide el stock negativo incluso ante un error de programación (RN-8, CA-6). Una prueba de integración recorre todas las refacciones y verifica la invariante (SC-007).
- **Alternativas**: calcular la existencia solo con la suma (lento, sin restricción nativa); solo la columna sin movimientos (sin trazabilidad, RN-7).

## D6. Tipos y signo de los movimientos

- **Decisión**: `IN` (entrada de mercancía, existencia inicial, devolución al quitar una refacción de una orden), `OUT` (uso en una orden o aumento de cantidad de una línea) y `ADJUSTMENT` (corrección por conteo, con motivo obligatorio). `OUT` siempre lleva `order_id` (FR-022). Una devolución al quitar o reducir una línea es un `IN` con `order_id` y motivo "Devolución de la orden OS-…".
- **Entradas manuales**: el administrador solo registra `IN` (cantidad positiva) y `ADJUSTMENT` (indica la nueva existencia contada; el sistema calcula la diferencia y rechaza ajustes sin diferencia).
- **Justificación**: los tres tipos de `docs/project-context.md`; el signo en `quantity` simplifica la suma y las pruebas.
- **Alternativas**: cantidad siempre positiva con el signo implícito por tipo (el ajuste necesita dirección); tipos adicionales como `RETURN` (no son necesarios).

## D7. Salida de inventario y concurrencia

- **Decisión**: agregar o aumentar una refacción en una orden ejecuta, en una transacción: (1) bloqueo de la orden, (2) bloqueo de la refacción con `SELECT … FOR UPDATE`, (3) `UPDATE parts SET stock = stock - ? WHERE id = ? AND stock >= ?`, (4) inserción del movimiento `OUT` y de la línea en `order_parts`. Si el `UPDATE` no afecta filas, se responde `409 INSUFFICIENT_STOCK` con la existencia disponible y se revierte todo (FR-014, FR-023).
- **Orden de bloqueo**: primero la orden y luego la refacción, siempre, para evitar interbloqueos entre operaciones concurrentes.
- **Justificación**: dos mecánicos que piden la última pieza compiten por el mismo bloqueo; solo uno la obtiene. La condición `stock >= ?` es una segunda defensa sobre el `CHECK`.
- **Alternativas**: control optimista con versión (reintentos innecesarios con un solo taller); validar solo en el servicio sin condición en el `UPDATE` (no es atómico).

## D8. Línea de refacción en la orden

- **Decisión**: tabla `order_parts` con `order_id`, `part_id`, `quantity`, `unit_price` (copia del precio vigente al agregar, que no cambia si el catálogo se actualiza) y `amount` calculado. Única por (`order_id`, `part_id`): agregar de nuevo la misma refacción suma a la cantidad de la línea existente, conservando el precio original.
- **Edición**: cambiar la cantidad genera un movimiento `OUT` por el aumento o `IN` por la reducción; quitar la línea genera un `IN` por toda la cantidad y elimina la fila (el rastro queda en los movimientos). Solo es posible en los estados de trabajo (`RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION`, `ESPERANDO_REFACCION`), con la misma regla `isWorkEditable` del Sprint 2.
- **Total de la orden**: `servicios + mano de obra + refacciones`; se amplía el cálculo del Sprint 2 con `partsSubtotal`.
- **Justificación**: RN-6 y RN-7. Una línea por refacción simplifica la pantalla; los movimientos conservan el detalle.
- **Alternativas**: varias líneas por refacción (confusas para el usuario); movimientos con referencia a la línea (la línea puede desaparecer; se referencia la orden).

## D9. Refacciones: baja lógica y precios

- **Decisión**: `parts.active` (por defecto verdadero). Nunca se elimina una refacción: se desactiva y deja de ofrecerse al mecánico, sin perder sus movimientos ni las órdenes que la usaron. Una refacción inactiva no se puede agregar a órdenes, pero sus líneas existentes siguen visibles. Se puede reactivar.
- **Código**: único, en mayúsculas y sin espacios al borde (normalizador existente). La búsqueda usa `LIKE` con `escapeLike` como en los sprints anteriores.
- **Precio**: un solo precio de venta `price` (DECIMAL 10,2). Sin costo de compra ni proveedor (fuera del alcance).
- **Alternativas**: borrado físico con restricciones (pierde historial); manejar costo y precio (no pedido por las historias).

## D10. Alertas de stock bajo

- **Decisión**: "Stock bajo" es `stock > 0 AND stock <= minimum_stock`; "Agotada" es `stock = 0`. Un endpoint de resumen (`GET /api/parts/alerts`) devuelve los conteos para la insignia del menú, y el listado acepta el filtro `alert=LOW|OUT|ANY`. El cliente consulta el resumen al iniciar sesión como administrador y después de cada operación de inventario u orden.
- **Justificación**: el sprint no incluye dashboard; la insignia en el menú y el aviso en la pantalla cubren CA-7 sin pantalla adicional (aclaración del 2026-10-13).
- **Alternativas**: sondeo periódico (carga innecesaria para un taller); notificaciones externas (fuera de alcance).

## D11. Permisos

- **Decisión**: se aplican en el servicio, con las mismas utilidades de los sprints anteriores.

| Recurso | ADMIN | RECEPTIONIST | MECHANIC |
|---------|:-----:|:------------:|:--------:|
| Historial del vehículo | sí | sí | sí |
| Mantenimientos de un vehículo (lectura) | sí | sí | sí |
| Listado global de mantenimientos | sí | sí | no |
| Crear, editar, cerrar mantenimiento | sí (cualquiera) | no | solo desde sus órdenes |
| Catálogo e inventario completos, entradas, ajustes | sí | no | no |
| Buscar refacciones activas para una orden | sí | no | sí |
| Refacciones de la orden | sí | solo lectura | solo en sus órdenes |

- **Justificación**: coincide con FR-024 y FR-025. La recepcionista ve las refacciones en el detalle de la orden (solo lectura) como ya ve el trabajo técnico.

## D12. Datos de ejemplo y pruebas

- **Decisión**: seed `003_sample_maintenance_inventory.sql`, idempotente: refacciones con código único (`INSERT … ON DUPLICATE KEY UPDATE` sobre campos no operativos, sin pisar la existencia), movimientos marcados con un motivo que empieza por "Semilla:" y se insertan solo si no existen, existencia recalculada desde los movimientos de ese lote, mantenimientos con `NOT EXISTS` por vehículo y descripción, y órdenes terminadas adicionales para el historial. Incluye refacciones con existencia normal, baja y agotada, y mantenimientos vencidos, próximos y lejanos.
- **Pruebas**: unitarias de la clasificación de mantenimiento y de los cálculos de inventario; integración contra `motorix_test` (invariante existencia = suma de movimientos, concurrencia por la última pieza, permisos por rol, historial derivado, idempotencia del seed, rendimiento); contrato de los endpoints nuevos; Flutter para los formularios, la tabla de refacciones de la orden y la insignia de alertas.
- **Reutilización**: fábricas de pruebas existentes se amplían con refacciones, movimientos y mantenimientos.
