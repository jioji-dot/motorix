# Investigación (Fase 0): Historial, mantenimiento e inventario

No quedaron marcadores `NEEDS CLARIFICATION`. Se mantienen las decisiones técnicas de los sprints anteriores; aquí se consolidan las específicas de este sprint.

## 1. Stock: columna guardada con restricción, validada contra los movimientos

- **Decisión**: la tabla `parts` guarda `stock` (entero sin signo) junto a un `CHECK (stock >= 0)`. Solo cambia dentro de la transacción que inserta el movimiento correspondiente; nunca se actualiza por separado. La invariante `stock = suma de los movimientos de la refacción` se verifica con una consulta de auditoría en las pruebas y en la validación final.
- **Justificación**: leer el stock es lo más frecuente (listados, alertas, picker) y no debe sumar miles de movimientos cada vez; la restricción de la base impide el stock negativo aunque falle la lógica de aplicación (SC-003). El requisito "el stock no se edita directamente" se cumple porque ninguna operación de la API recibe un stock.
- **Alternativas**: calcular el stock con `SUM` en cada lectura (lento y dificulta ordenar y filtrar por stock bajo); columna generada (MySQL no permite referenciar otra tabla).

## 2. Movimientos inmutables con cantidad con signo

- **Decisión**: `inventory_movements.quantity` es un entero **con signo** (el cambio de stock): las entradas son positivas, las salidas negativas y los ajustes pueden ser de cualquier signo. Un `CHECK` impone la coherencia con el tipo (IN > 0, OUT < 0, ADJUSTMENT ≠ 0). Cada movimiento guarda `stockAfter` (auditoría) y no tiene operaciones de edición ni baja en la API. En la API de captura, entradas y salidas manuales envían cantidad positiva y el servidor aplica el signo; el ajuste envía la diferencia con signo (aclaración).
- **Justificación**: un solo campo con signo hace trivial la suma de movimientos y la comprobación de la invariante; `stockAfter` permite reconstruir la historia sin recalcular.
- **Alternativas**: cantidad positiva más un campo de dirección (dos campos que pueden contradecirse).

## 3. Cero stock negativo bajo concurrencia

- **Decisión**: toda operación que cambia el stock, dentro de una transacción, bloquea la fila de la refacción (`SELECT ... FOR UPDATE`), valida `stock + cambio >= 0`, actualiza `stock` e inserta el movimiento. Para operaciones sobre varias refacciones (cancelar una orden) se bloquean en orden ascendente de `id` para evitar interbloqueos. El orden de bloqueo general es orden primero, refacción después.
- **Justificación**: es el patrón estándar para evitar la sobreasignación; con la restricción `CHECK` como segunda defensa. Una prueba lanza peticiones simultáneas contra la última pieza y comprueba que solo una se aplica (FR-024).
- **Alternativas**: `UPDATE ... WHERE stock >= ?` sin bloqueo previo (también válido, pero no deja explicar el stock disponible en el mensaje de error); aislamiento serializable (más costoso y propenso a reintentos).

## 4. Refacciones en la orden: instantánea del precio y una línea por refacción

- **Decisión**: `order_parts` guarda `quantity`, `unitPrice` (precio de venta al agregarla), el código y el nombre de la refacción como instantánea, y el importe como columna calculada `ROUND(quantity * unitPrice, 2)`. Hay una restricción `UNIQUE (orderId, partId)`: volver a agregar la misma refacción responde 409 e indica que se edite la cantidad. El precio lo fija siempre el catálogo (aclaración).
- **Justificación**: el precio y el nombre de las órdenes pasadas no cambian si el catálogo cambia (FR-026) y el historial sigue siendo legible; una sola línea por refacción simplifica las reversas.
- **Alternativas**: varias líneas por refacción (reversas ambiguas); leer el precio del catálogo en cada consulta (rompería las órdenes pasadas).

## 5. Ajustes de cantidad y reversas

- **Decisión**: cambiar la cantidad de una refacción usada registra la **diferencia** como una salida o una entrada con motivo "Ajuste de cantidad en la orden OS-…" ligada a la orden; quitar la línea registra una entrada por la cantidad completa. Cancelar la orden regresa todas sus refacciones con entradas "Cancelación de la orden OS-…", dentro de la misma transacción del cambio de estado, y las líneas se conservan en la orden como registro.
- **Justificación**: el stock siempre es la suma de movimientos y cada uno queda explicado; la cancelación es final (no hay doble reversa).
- **Alternativas**: borrar y volver a insertar movimientos (violaría la inmutabilidad).

## 6. Historial como vista calculada

- **Decisión**: `GET /vehicles/:id/history` consulta las órdenes del vehículo en estado `TERMINADO` o `ENTREGADO` (aclaración). La fecha del servicio es la del cambio a `TERMINADO` en `order_status_history`; el kilometraje es `serviceMileage` o, si falta, `entryMileage`. Se cargan servicios, mano de obra y refacciones de todas las órdenes de la página con una consulta por tipo (`orderId IN (...)`), sin consultas repetidas por orden.
- **Justificación**: no hay tabla de historial (RN-10); las correcciones a una orden se reflejan solas; el rendimiento no depende del número de órdenes.
- **Alternativas**: tabla de historial o vista de base de datos (copias o piezas de infraestructura sin necesidad).

## 5b. Kilometraje del servicio

- **Decisión**: columna opcional `service_orders.serviceMileage` (migración 003). Se edita con `PATCH /orders/:id` como los demás campos de trabajo (mecánico asignado o administrador, con la orden en curso), con valor entero entre el kilometraje de entrada y 1,500,000. Al guardarlo, el kilometraje actual del vehículo pasa a `GREATEST(actual, serviceMileage)` dentro de la misma transacción (nunca disminuye).
- **Justificación**: cumple la historia 2 del sprint con el mínimo cambio y reutiliza los permisos del Sprint 2.
- **Alternativas**: exigirlo al terminar (cambiaría una regla ya probada del Sprint 2).

## 7. Clasificación de mantenimientos: función pura y paginación en memoria

- **Decisión**: `maintenanceClassifier.classify(mantenimiento, kilometrajeActual, hoy)` devuelve `VENCIDO` si la próxima fecha ya pasó o el kilometraje actual alcanzó el próximo; `PROXIMO` si faltan 15 días o menos, o 500 km o menos; `NORMAL` en otro caso; con ambos valores gana el más urgente. Calcula también `daysLeft` y `kmLeft`. El listado carga los pendientes, los clasifica en el servidor, filtra, ordena (Vencido, Próximo, Normal; dentro de cada grupo, el más urgente primero) y pagina en memoria.
- **Justificación**: una sola implementación de la regla, probada de forma exhaustiva en sus límites (día 15/16, km 500/501); para un solo taller (cientos de registros) la paginación en memoria es suficiente y evita duplicar la regla en SQL.
- **Alternativas**: `CASE` en SQL (dos implementaciones de la misma regla); guardar la clasificación en la tabla (se desactualizaría cada día).

## 8. Reemplazo del mantenimiento anterior

- **Decisión**: al registrar un mantenimiento, en la misma transacción se marcan como `ATENDIDO` (con `completedAt`) los pendientes del mismo vehículo con el mismo tipo de servicio (sin distinguir mayúsculas ni espacios en los extremos). Los atendidos no se editan.
- **Justificación**: refleja la regla de la especificación sin pasos manuales.
- **Alternativas**: cierre manual (olvidable, deja pendientes duplicados).

## 9. Precio de compra solo para administrador

- **Decisión**: los modelos devuelven siempre `purchasePrice`, pero un serializador por rol (`serializePart(parte, usuario)`) lo elimina de la respuesta cuando el usuario no es ADMIN; la captura y edición del precio de compra por otro rol se rechaza (403 a nivel de ruta y el campo no existe en esquemas de otros roles). Una prueba de contrato recorre todas las respuestas con una cuenta no administradora y comprueba que `purchasePrice` no aparece.
- **Justificación**: la seguridad se aplica en el servidor (RN-15), no solo en la interfaz.
- **Alternativas**: ocultar solo en la interfaz (inseguro).

## 10. Total de la orden con refacciones

- **Decisión**: `recalculateTotal` (Sprint 2) suma también `order_parts.amount`; todas las operaciones de refacciones llaman a esa función dentro de su transacción.
- **Justificación**: SC-007; un solo punto que calcula el total.
- **Alternativas**: totales separados por tipo (más columnas sin necesidad).

## 11. Alertas de stock bajo

- **Decisión**: el nivel se deriva en el servidor: `OUT` si el stock es 0, `LOW` si es menor o igual al stock mínimo (y mayor que 0), `OK` en otro caso, solo para refacciones activas. `GET /parts/summary` devuelve los conteos y `GET /parts?stockLevel=LOW,OUT` filtra. Se calculan al leer, así que reflejan siempre el stock actual al abrir la pantalla (SC-005).
- **Justificación**: no hay estado de alerta que mantener ni notificaciones que programar (fuera de alcance).
- **Alternativas**: tabla de alertas (estado duplicado).

## 12. Frontend

- **Decisión**: dos secciones nuevas en la barra lateral para los tres roles: **Inventario** y **Mantenimientos**; el historial se abre desde el detalle del vehículo. Las acciones de escritura se muestran solo a quien puede aplicarlas (el servidor valida de todos modos). El selector de refacciones del detalle de la orden busca en el servidor y muestra la advertencia de stock bajo. Providers de datos al nivel de `MaterialApp`, vaciados al cerrar sesión.
- **Justificación**: coherencia con el sistema de diseño y con los sprints anteriores.
- **Alternativas**: el historial como sección propia (necesitaría elegir primero el vehículo; es más natural desde el vehículo).

## 13. Datos de ejemplo coherentes

- **Decisión**: los seeds de refacciones registran movimientos (existencia inicial, entradas y salidas ligadas a órdenes de ejemplo) y al final fijan `parts.stock` como la suma de sus movimientos, de modo que la invariante se cumple por construcción y repetir el seed no duplica nada (cada movimiento de ejemplo tiene un motivo único por refacción u orden).
- **Justificación**: FR-035 y consistencia desde la instalación.
- **Alternativas**: fijar el stock a mano (podría contradecir los movimientos).

## 14. Estrategia de pruebas

- **Decisión**: prueba unitaria exhaustiva de los límites de `classifyMaintenance` (fecha: hoy, +15, +16, −1; km: −501, −500, 0, +1; combinaciones y vacíos); pruebas de servicio con modelos simulados para las reglas de stock; pruebas de integración con la base `*_test` para la invariante `stock = suma de movimientos` tras una secuencia aleatoria de operaciones, la concurrencia sobre la última pieza, la cancelación con reversa y el ocultamiento del precio de compra; contrato y matriz de permisos ampliados; widgets de cada pantalla con el API simulado.
- **Justificación**: CA-8 y SC-002 a SC-005.
- **Alternativas**: solo recorridos felices (dejaría sin probar los límites de la clasificación ni la concurrencia).
