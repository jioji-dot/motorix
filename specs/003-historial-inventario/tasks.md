---

description: "Lista de tareas del Sprint 3: historial, mantenimiento e inventario"
---

# Tareas: Historial, mantenimiento e inventario (Sprint 3)

**Entrada**: Documentos de diseño en `/specs/003-historial-inventario/`

**Requisitos previos**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Pruebas**: Se incluyen porque la constitución (Principio VII) las exige para la lógica de negocio (stock, mantenimientos, permisos) y el criterio CA-8 pide pruebas de inventario y mantenimiento, con pruebas de integración y contrato contra `motorix_test`. Escribirlas primero y comprobar que fallan antes de implementar.

**Organización**: Las tareas se agrupan por historia de usuario para implementarlas y probarlas de forma independiente.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Historia]**: Historia de usuario a la que pertenece (US1, US2, ...)
- Todas las rutas son relativas a la raíz del repositorio (`C:\sdd\motorix`)

## Convenciones

- Backend en `server/` (ES Modules, sin carpeta `src/`); frontend en `client/lib/` y `client/test/`; SQL en `database/`.
- Comentarios, mensajes al usuario y nombres de pruebas en español; identificadores en inglés (constitución y `CLAUDE.md`).
- Las pruebas de integración y contrato usan SIEMPRE `motorix_test`. Nunca usar `Set-Content`/`Get-Content` sin `-Encoding` para editar archivos con acentos: usar las herramientas de edición.
- Reutilizar lo de los sprints anteriores: `AppError`, `validate`, `authenticate`/`authorize`, `response.js`, `normalizers.js` (`escapeLike`), `withTransaction`, `mileageService`, `orderStatus.js` (`canEditWork`, `isWorkEditable`), `factories.js`, `AppShell`, `AppDataTable`, `Panel`, `PaginationBar`, `StatusChip`, `showConfirmDialog`, `OrderLinesTable`.
- Valores en la base y en la API: mantenimientos `PENDIENTE`, `REALIZADO`, `CANCELADO`; clasificación `OVERDUE`, `UPCOMING`, `LATER`; movimientos `IN`, `OUT`, `ADJUSTMENT`; existencia `OK`, `LOW`, `OUT`.
- Invariante de inventario: `parts.stock = SUM(inventory_movements.quantity)`; la existencia nunca es negativa y solo cambia mediante la función de movimiento atómico de `partModel`.
- Colores de estado (Principio VIII): ámbar para "próximo" y "stock bajo", rojo para "vencido" y "agotada", verde para correcto.

## Mapa de historias

| Historia | Título | Prioridad | Fase |
|----------|--------|:---------:|:----:|
| US5 | Registrar y consultar refacciones | P1 | 3 |
| US6 | Consultar el stock disponible (entradas, ajustes, movimientos) | P1 | 4 |
| US7 | Agregar refacciones utilizadas a una orden | P1 | 5 |
| US1 | Consultar el historial de servicios de un vehículo | P1 | 6 |
| US3 | Establecer el próximo mantenimiento | P1 | 7 |
| US2 | Registrar el kilometraje de cada servicio | P2 | 8 |
| US4 | Consultar mantenimientos próximos y vencidos | P2 | 9 |
| US8 | Visualizar alertas de stock bajo | P2 | 10 |

---

## Fase 1: Preparación

**Propósito**: Constantes y errores compartidos por todo el sprint.

- [X] T001 Agregar a `server/config/constants.js` `MAINTENANCE_STATUS` (`PENDIENTE`, `REALIZADO`, `CANCELADO`), `MAINTENANCE_CLASSIFICATION` (`OVERDUE`, `UPCOMING`, `LATER`), `MOVEMENT_TYPE` (`IN`, `OUT`, `ADJUSTMENT`), `STOCK_STATUS` (`OK`, `LOW`, `OUT`), con sus listas de valores, y los respaldos `DEFAULT_MAINTENANCE_WARNING_DAYS = 30` y `DEFAULT_MAINTENANCE_WARNING_KM = 1000`
- [X] T002 [P] Agregar a `server/utils/AppError.js` las fábricas de `contracts/api.md`: `insufficientStock({ partId, available, requested })` (409 `INSUFFICIENT_STOCK`, `details` con esos tres campos), `partCodeDuplicate()` (409 `PART_CODE_DUPLICATE`), `partInactive()` (409 `PART_INACTIVE`), `maintenancePendingExists(pending)` (409 `MAINTENANCE_PENDING_EXISTS`, `details.pending`), `maintenanceNotPending()` (409 `MAINTENANCE_NOT_PENDING`) y `orderNotFinished()` (409 `ORDER_NOT_FINISHED`), todas con mensajes en español

---

## Fase 2: Fundamentos (prerrequisitos bloqueantes)

**Propósito**: Esquema, reglas puras, configuración y fábricas que necesitan todas las historias.

**⚠️ CRÍTICO**: Ninguna historia puede comenzar hasta terminar esta fase.

- [X] T003 Crear `database/migrations/003_sprint3_maintenance_inventory.sql` (InnoDB, `utf8mb4`, collation `utf8mb4_0900_ai_ci`, todas las FK `ON DELETE RESTRICT`) con: `ALTER TABLE service_orders ADD COLUMN service_mileage INT UNSIGNED NULL`; `ALTER TABLE order_status_history ADD INDEX idx_order_history_order_status (order_id, to_status)`; `app_settings` (`setting_key` VARCHAR(60) PK, `setting_value` VARCHAR(255) NOT NULL, `updated_at` DATETIME con actualización automática) con las filas `maintenance_warning_days = 30` y `maintenance_warning_km = 1000`; `parts` (`code` VARCHAR(40) NOT NULL ÚNICA, `name` VARCHAR(150) NOT NULL, `description` VARCHAR(500) NULL, `price` DECIMAL(10,2) NOT NULL con `CHECK (price >= 0)`, `stock` INT UNSIGNED NOT NULL DEFAULT 0 con `CHECK (stock >= 0)`, `minimum_stock` INT UNSIGNED NOT NULL DEFAULT 0, `active` TINYINT(1) NOT NULL DEFAULT 1, `created_at`, `updated_at`; índices `uq_parts_code`, `idx_parts_name`, `idx_parts_active_stock (active, stock)`); `inventory_movements` (`id` BIGINT UNSIGNED, `part_id` NOT NULL FK, `type` ENUM('IN','OUT','ADJUSTMENT') NOT NULL, `quantity` INT NOT NULL con `CHECK (quantity <> 0)`, `reason` VARCHAR(255) NOT NULL, `order_id` NULL FK, `created_by` NOT NULL FK, `created_at`; `CHECK ((type = 'IN' AND quantity > 0) OR (type = 'OUT' AND quantity < 0 AND order_id IS NOT NULL) OR type = 'ADJUSTMENT')`; índices `idx_movements_part_date (part_id, created_at, id)` e `idx_movements_order (order_id)`); `order_parts` (`order_id` NOT NULL FK, `part_id` NOT NULL FK, `quantity` INT UNSIGNED NOT NULL con `CHECK (quantity > 0)`, `unit_price` DECIMAL(10,2) NOT NULL con `CHECK (unit_price >= 0)`, `amount` DECIMAL(12,2) GENERADA `ROUND(quantity * unit_price, 2)`, `created_at`, `updated_at`, `UNIQUE (order_id, part_id)`); `maintenance` (`vehicle_id` NOT NULL FK, `order_id` NOT NULL FK, `description` VARCHAR(255) NOT NULL, `next_date` DATE NULL, `next_mileage` INT UNSIGNED NULL, `status` ENUM('PENDIENTE','REALIZADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE', `pending_vehicle_id` INT UNSIGNED GENERADA `IF(status = 'PENDIENTE', vehicle_id, NULL)` con índice ÚNICO `uq_maintenance_pending`, `completed_at` DATETIME NULL, `created_by` NOT NULL FK, `created_at`, `updated_at`; `CHECK (next_date IS NOT NULL OR next_mileage IS NOT NULL)`; índices `idx_maintenance_vehicle`, `idx_maintenance_status_date (status, next_date)`). No editar las migraciones 001 ni 002
- [X] T004 [P] Escribir `server/tests/integration/schemaSprint3.test.js` contra `motorix_test`: existen las tablas y columnas nuevas; `CHECK` rechaza `stock` negativo, `quantity` 0, `OUT` positivo o sin `order_id`, y mantenimiento sin fecha ni kilometraje; el índice único rechaza un segundo mantenimiento `PENDIENTE` del mismo vehículo pero acepta varios `REALIZADO`; `UNIQUE (order_id, part_id)` y código de refacción único; la columna generada `amount` calcula el subtotal
- [X] T005 Actualizar `server/tests/helpers/testDb.js` (`cleanTables`) para vaciar `maintenance`, `order_parts`, `inventory_movements` y `parts` antes de las tablas de órdenes, respetando el orden de las llaves foráneas y conservando `app_settings`; aplicar la migración 003 a `motorix_test` con `npm run db:migrate`
- [X] T006 [P] Escribir `server/tests/unit/stockStatus.test.js`: `OUT` con `stock = 0` (incluso con mínimo 0), `LOW` con `0 < stock <= minimum_stock`, `OK` por encima del mínimo, y los límites exactos
- [X] T007 [P] Implementar `server/utils/stockStatus.js` (función pura `getStockStatus({ stock, minimumStock })` y `isAlert`) hasta que pasen las pruebas de T006
- [X] T008 [P] Escribir `server/tests/unit/maintenanceStatus.test.js`: `OVERDUE` cuando `next_date` es anterior a hoy o `next_mileage` es menor al kilometraje actual; `UPCOMING` dentro de `warningDays` o `warningKm` (incluidos los iguales a hoy y al kilometraje actual); `LATER` en el resto; fecha y kilometraje combinados (basta que se cumpla uno); solo fecha o solo kilometraje; `daysRemaining` y `kmRemaining` negativos al vencer y `null` sin dato; mantenimientos no `PENDIENTE` sin clasificación
- [X] T009 [P] Implementar `server/utils/maintenanceStatus.js` (funciones puras `classifyMaintenance({ nextDate, nextMileage, currentMileage, today, warningDays, warningKm })` y `remaining(...)`) hasta que pasen las pruebas de T008
- [X] T010 [P] Crear `server/models/settingsModel.js` con `getMaintenanceThresholds(db)` que lee `app_settings` y usa `DEFAULT_MAINTENANCE_WARNING_DAYS` y `DEFAULT_MAINTENANCE_WARNING_KM` si falta una clave o no es un entero positivo
- [X] T011 Ampliar `server/tests/helpers/factories.js` con `createPart`, `createMovement` (actualiza `parts.stock` con la misma regla del servicio), `createOrderPart` y `createMaintenance`, reutilizando `createOrder` y `createVehicle`; cada fábrica devuelve el registro creado
- [X] T012 [P] Agregar a `client/lib/app_routes.dart` las rutas `inventory`, `inventoryForm`, `inventoryDetail` y `maintenance`; y a `client/lib/utils/validators.dart` y `client/lib/utils/format.dart` los validadores de código de refacción, cantidad entera positiva, existencia no negativa y el formato de fecha `YYYY-MM-DD`

**Punto de control**: migración aplicada, reglas puras probadas y fábricas listas.

---

## Fase 3: Historia de usuario 5 — Registrar y consultar refacciones (Prioridad: P1) 🎯 MVP

**Meta**: Como administrador, quiero registrar y consultar refacciones para controlar el inventario.

**Prueba independiente**: Dar de alta una refacción con existencia inicial, encontrarla por nombre o código, editarla, rechazar un código repetido, darla de baja y comprobar que recepción y mecánico no pueden gestionarla.

### Pruebas de la historia (escribir primero)

- [X] T013 [P] [US5] Escribir `server/tests/contract/parts.contract.test.js` para `POST/GET /api/parts`, `GET/PATCH /api/parts/:id`, `POST /api/parts/:id/deactivate` y `/activate` según `contracts/api.md` (forma del objeto `Part` con `stockStatus`, envoltorio, códigos de error `PART_CODE_DUPLICATE` y `VALIDATION_ERROR`)
- [X] T014 [P] [US5] Escribir `server/tests/integration/parts.test.js`: alta con existencia inicial genera un movimiento `IN` "Existencia inicial" y con 0 no genera ninguno; el código se normaliza a mayúsculas; código duplicado rechazado; precio negativo, mínimo negativo y existencia inicial no entera rechazados; edición no cambia la existencia y no acepta `stock`; búsqueda por nombre o código con filtro `active`; baja y reactivación idempotentes; recepción y mecánico reciben 403 en todo `/api/parts`; sin token 401

### Implementación de la historia

- [X] T015 [US5] Crear `server/models/partModel.js` con `insert`, `findById`, `findByIdForUpdate`, `findByCode`, `list({ search, active, limit, offset })` (búsqueda por código o nombre con `escapeLike`, orden por nombre), `update`, `setActive`, `mapPart` (incluye `stockStatus` con `getStockStatus`) y la función atómica `applyMovement({ partId, type, quantity, reason, orderId, createdBy }, conn)`: bloquea la refacción, ejecuta `UPDATE parts SET stock = stock + ? WHERE id = ? AND stock + ? >= 0`, y si no afecta filas lanza `insufficientStock`; luego inserta el movimiento con signo (`IN` > 0, `OUT` < 0 con `order_id` obligatorio, `ADJUSTMENT` ≠ 0)
- [X] T016 [P] [US5] Crear `server/validators/partValidators.js` con `zod`: `createPartBody` (`code` 1–40 normalizado a mayúsculas sin espacios al borde, `name` 1–150, `description` ≤ 500 opcional, `price` ≥ 0 con hasta dos decimales, `minimumStock` entero ≥ 0, `initialStock` entero ≥ 0 opcional), `updatePartBody` (parcial, rechaza `stock`) y `listPartsQuery` (`search`, `active`, `page`, `pageSize`)
- [X] T017 [US5] Crear `server/services/inventoryService.js` con `createPart` (transacción: inserta la refacción y, si `initialStock > 0`, llama a `applyMovement` `IN` "Existencia inicial"), `getPart`, `listParts`, `updatePart` (código duplicado → `partCodeDuplicate`) y `setPartActive`
- [X] T018 [P] [US5] Crear `server/controllers/partController.js` y `server/routes/partRoutes.js` con `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `POST /:id/deactivate` y `POST /:id/activate`, todas con `authenticate` y `authorize(ROLES.ADMIN)`; montar `/api/parts` en `server/app.js`. Declarar las rutas estáticas (`/alerts`, `/available`) antes de `/:id` en las historias posteriores
- [X] T019 [P] [US5] Crear `client/lib/models/part.dart` (`Part`, `StockStatus`), `client/lib/services/inventory_service.dart` y `client/lib/providers/inventory_provider.dart` con listado paginado, búsqueda, filtro de activas, alta, edición y baja o reactivación
- [X] T020 [P] [US5] Crear `client/lib/widgets/stock_chip.dart` con chips "Normal", "Stock bajo" (ámbar) y "Agotada" (rojo) y "Inactiva" (neutro), usando los tokens de `docs/design-system.md`
- [X] T021 [US5] Crear `client/lib/screens/inventory/inventory_list_screen.dart` (tabla con código, nombre, existencia, mínimo, precio y estado; búsqueda; filtro de activas; botón "Nueva refacción"; estados de carga, vacío y error en español) y `client/lib/screens/inventory/part_form_screen.dart` (alta y edición con validación; "Existencia inicial" solo al crear; confirmación al salir sin guardar)
- [X] T022 [US5] Registrar las rutas de inventario en `client/lib/router.dart` y `client/lib/main.dart`, y agregar la entrada "Inventario" (solo administrador) en `client/lib/widgets/app_shell.dart`
- [X] T023 [P] [US5] Escribir `client/test/inventory_list_screen_test.dart` y `client/test/part_form_screen_test.dart` (listado, búsqueda, vacío, validaciones, código duplicado mostrado como error, la entrada "Inventario" solo para administrador), apoyándose en `client/test/helpers/fake_api.dart`

**Punto de control**: el administrador gestiona el catálogo de punta a punta (CA-4).

---

## Fase 4: Historia de usuario 6 — Consultar el stock disponible (Prioridad: P1)

**Meta**: Como administrador, quiero consultar el stock disponible para saber qué hay en existencia.

**Prueba independiente**: Registrar una entrada y un ajuste, ver los movimientos en orden cronológico y comprobar que la existencia coincide con la suma de sus movimientos; rechazar ajustes que dejarían stock negativo.

### Pruebas de la historia (escribir primero)

- [X] T024 [P] [US6] Escribir `server/tests/contract/inventoryMovements.contract.test.js` para `POST /api/parts/:id/entries`, `POST /api/parts/:id/adjustments` y `GET /api/parts/:id/movements` según `contracts/api.md` (objeto `InventoryMovement`, `{ part, movement }`)
- [X] T025 [P] [US6] Escribir `server/tests/integration/inventoryMovements.test.js`: entrada suma y deja `IN`; ajuste calcula la diferencia desde `newStock` y deja `ADJUSTMENT` con signo; ajuste sin diferencia → 400; entrada o ajuste sin `reason` → 400; cantidad 0, negativa o no entera → 400; `newStock` negativo → 400; movimientos del más reciente al más antiguo y paginados; invariante `stock = SUM(quantity)` tras una secuencia mixta; recepción y mecánico 403

### Implementación de la historia

- [X] T026 [US6] Ampliar `server/models/partModel.js` con `listMovements(partId, { limit, offset })` (une `users` para `createdByName` y `service_orders` para `orderFolio`, orden por `created_at DESC, id DESC`) y `mapMovement`
- [X] T027 [P] [US6] Ampliar `server/validators/partValidators.js` con `entryBody` (`quantity` entero ≥ 1, `reason` 1–255), `adjustmentBody` (`newStock` entero ≥ 0, `reason` 1–255) y `movementsQuery`
- [X] T028 [US6] Ampliar `server/services/inventoryService.js` con `registerEntry` y `registerAdjustment` (una transacción por operación, usando `applyMovement`; el ajuste bloquea la refacción, calcula la diferencia contra el `stock` bloqueado y rechaza diferencia 0) y `listMovements`
- [X] T029 [P] [US6] Ampliar `server/controllers/partController.js` y `server/routes/partRoutes.js` con `POST /:id/entries`, `POST /:id/adjustments` y `GET /:id/movements` (solo `ADMIN`)
- [X] T030 [P] [US6] Ampliar `client/lib/models/part.dart`, `client/lib/services/inventory_service.dart` y `client/lib/providers/inventory_provider.dart` con `InventoryMovement`, entradas, ajustes y movimientos paginados
- [X] T031 [US6] Crear `client/lib/widgets/stock_movement_dialog.dart` (diálogo de entrada con cantidad y motivo, y de ajuste con la existencia contada y motivo; validaciones en español) y `client/lib/screens/inventory/part_detail_screen.dart` (datos de la refacción, existencia, estado, botones "Registrar entrada" y "Ajustar existencia", tabla de movimientos con tipo, cantidad con signo, fecha, usuario, motivo y folio de orden, y paginación)
- [X] T032 [P] [US6] Escribir `client/test/part_detail_screen_test.dart` (movimientos en orden, entrada y ajuste con motivo obligatorio, error por existencia negativa mostrado, la existencia se actualiza tras la operación)

**Punto de control**: el inventario se consulta y se mantiene con trazabilidad completa (CA-4).

---

## Fase 5: Historia de usuario 7 — Agregar refacciones utilizadas a una orden (Prioridad: P1)

**Meta**: Como mecánico, quiero agregar refacciones utilizadas a una orden para reflejar su uso.

**Prueba independiente**: Agregar una refacción con existencia a una orden en reparación y ver que aparece en la orden, que el total sube y que la existencia baja con un movimiento `OUT`; rechazar cantidades mayores a la existencia sin cambiar nada.

### Pruebas de la historia (escribir primero)

- [X] T033 [P] [US7] Escribir `server/tests/contract/orderParts.contract.test.js` para `POST/PATCH/DELETE /api/orders/:id/parts`, `GET /api/parts/available` y los campos nuevos `parts`, `partsSubtotal` y `editable.parts` del detalle de la orden
- [X] T034 [P] [US7] Escribir `server/tests/integration/orderParts.test.js`: agregar genera línea con `unitPrice` vigente y un `OUT` ligado a la orden; agregar de nuevo la misma refacción suma a la línea; el total de la orden incluye refacciones; cambiar el precio del catálogo no altera líneas existentes; aumentar cantidad genera `OUT` y reducir genera `IN`; quitar devuelve todo con `IN` y elimina la línea; cantidad 0, negativa o no entera → 400; cantidad mayor a la existencia → 409 `INSUFFICIENT_STOCK` con `available` y sin cambios; refacción inactiva → 409; orden en `TERMINADO` o `ENTREGADO` → 409 `ORDER_NOT_EDITABLE`; mecánico de otra orden → 404; recepción → 403; administrador sí puede
- [X] T035 [P] [US7] Escribir `server/tests/integration/stockConcurrency.test.js`: dos solicitudes simultáneas por la última pieza (órdenes distintas) → exactamente una responde 200 y la otra 409, la existencia queda en 0 y la invariante se mantiene; una ráfaga de N solicitudes con existencia M < N termina con exactamente M piezas asignadas y stock 0
- [X] T036 [P] [US7] Escribir `server/tests/integration/availableParts.test.js`: `GET /api/parts/available` exige `search` de al menos 2 caracteres, solo devuelve refacciones activas con existencia > 0 y solo los campos `id`, `code`, `name`, `price`, `stock`; administrador y mecánico sí, recepción 403

### Implementación de la historia

- [X] T037 [US7] Ampliar `server/models/orderModel.js`: `ORDER_SELECT` suma `parts_subtotal` (subconsulta sobre `order_parts.amount`), `mapOrder` expone `partsSubtotal` y `total = servicesSubtotal + laborSubtotal + partsSubtotal`; agregar `getParts(orderId)`, `findOrderPart`, `insertOrderPart`, `updateOrderPartQuantity` y `deleteOrderPart` aceptando una conexión transaccional
- [X] T038 [P] [US7] Ampliar `server/validators/orderValidators.js` con `addOrderPartBody` (`partId` entero positivo, `quantity` entero ≥ 1), `updateOrderPartBody` y `orderPartParams`; y `server/validators/partValidators.js` con `availablePartsQuery` (`search` mínimo 2 caracteres, `limit` 1–50, por defecto 20)
- [X] T039 [US7] Crear `server/services/orderPartsService.js` con `addPart`, `updatePartQuantity` y `removePart`: cargar la orden con el mismo control de acceso de `loadForWork` (404 ajena para mecánico, 403 sin permiso), exigir `isWorkEditable`, y en una transacción bloquear primero la orden y después la refacción (D7), rechazar refacción inactiva con `partInactive`, aplicar `applyMovement` (`OUT` con `order_id` al agregar o aumentar; `IN` con `order_id` y motivo "Devolución de la orden OS-…" al reducir o quitar) y actualizar la línea; devolver el detalle con `buildOrderDetail`
- [X] T040 [US7] Ampliar `buildOrderDetail` en `server/services/orderService.js` con `parts` (código, nombre, cantidad, precio unitario, importe), `partsSubtotal` y `editable.parts` (`canEditWork` y `isWorkEditable`); mantener los listados con el nuevo `total`
- [X] T041 [P] [US7] Crear `server/controllers/orderPartsController.js` y ampliar `server/routes/orderRoutes.js` con `POST /:id/parts`, `PATCH /:id/parts/:orderPartId` y `DELETE /:id/parts/:orderPartId`
- [X] T042 [US7] Agregar `searchAvailable` a `server/models/partModel.js` y `searchAvailableParts` a `server/services/inventoryService.js`; exponer `GET /api/parts/available` en `server/routes/partRoutes.js` declarado antes de `/:id`, con `authorize(ROLES.ADMIN, ROLES.MECHANIC)`
- [X] T043 [P] [US7] Ampliar `client/lib/models/service_order.dart` con `OrderPartLine`, `partsSubtotal` y `editable.parts`, y `client/lib/services/orders_service.dart` y `client/lib/providers/orders_provider.dart` con agregar, cambiar cantidad y quitar refacciones; agregar `searchAvailable` a `client/lib/services/inventory_service.dart`
- [X] T044 [P] [US7] Crear `client/lib/widgets/part_picker_dialog.dart` (búsqueda con mínimo de 2 caracteres, resultados con código, nombre, precio y existencia, cantidad con validación de entero positivo y tope de existencia visible) y `client/lib/widgets/order_parts_table.dart` (tabla con acciones editar cantidad y quitar con confirmación, visibles solo con `editable.parts`; solo lectura para recepción)
- [X] T045 [US7] Integrar la sección "Refacciones" y el subtotal en `client/lib/screens/orders/order_detail_screen.dart`, mostrando el error de existencia insuficiente con la cantidad disponible
- [X] T046 [P] [US7] Escribir `client/test/order_parts_test.dart` (agregar, error de existencia, editar, quitar con confirmación, solo lectura para recepción, total actualizado) y ampliar `client/test/helpers/fake_api.dart` con `orderJson(parts: …)` y `partJson`

**Punto de control**: el uso de refacciones refleja salidas de inventario y nunca deja stock negativo (CA-5, CA-6).

---

## Fase 6: Historia de usuario 1 — Consultar el historial de servicios de un vehículo (Prioridad: P1)

**Meta**: Como mecánico, quiero consultar el historial de servicios de un vehículo para conocer su estado y antecedentes.

**Prueba independiente**: Abrir un vehículo con órdenes terminadas y entregadas y ver su historial en orden cronológico descendente, sin las órdenes en proceso.

### Pruebas de la historia (escribir primero)

- [X] T047 [P] [US1] Escribir `server/tests/contract/history.contract.test.js` para `GET /api/vehicles/:id/history` según `contracts/api.md` (campos `orderId`, `folio`, `status`, `serviceDate`, `mileage`, `services`, `labor`, `parts`, `total`, paginación)
- [X] T048 [P] [US1] Escribir `server/tests/integration/history.test.js`: solo `TERMINADO` y `ENTREGADO`; orden descendente por fecha de servicio con `id` como desempate; `serviceDate` toma el cambio a `TERMINADO` del historial de estados y `created_at` si falta; `mileage` usa `service_mileage` o, si falta, `entry_mileage`; incluye servicios, mano de obra, refacciones y total; vehículo sin servicios → `data: []`; vehículo inexistente → 404; los tres roles pueden consultar (el mecánico ve el historial de cualquier vehículo); paginación; sin token 401
- [X] T049 [P] [US1] Escribir en `server/tests/integration/history.test.js` el caso de una orden terminada que cambia (nuevo servicio permitido antes de entrega o refacción devuelta): el historial refleja el estado actual sin duplicados

### Implementación de la historia

- [X] T050 [US1] Agregar a `server/models/vehicleModel.js` (o a un `server/models/historyModel.js` si el archivo crece demasiado) `listHistory(vehicleId, { limit, offset })` y `countHistory`, con una consulta que une `order_status_history` (`to_status = 'TERMINADO'`, la fila más reciente) y recupera servicios, mano de obra y refacciones de las órdenes de la página en consultas agrupadas (sin consultas N+1)
- [X] T051 [US1] Crear `server/services/historyService.js` con `getVehicleHistory(vehicleId, paging)` (404 si el vehículo no existe) y `server/controllers/historyController.js`; agregar `GET /:id/history` a `server/routes/vehicleRoutes.js` con `validate` de `idParams` y paginación, para los tres roles
- [X] T052 [P] [US1] Crear `client/lib/models/history_entry.dart`, ampliar `client/lib/services/vehicles_service.dart` con `fetchHistory` y `client/lib/providers/vehicles_provider.dart` con el estado del historial paginado
- [X] T053 [P] [US1] Crear `client/lib/widgets/history_card.dart` (folio, fecha, kilometraje, mecánico, problema, diagnóstico, recomendaciones y totales; servicios, mano de obra y refacciones desplegables; enlace al detalle de la orden)
- [X] T054 [US1] Agregar a `client/lib/screens/vehicles/vehicle_detail_screen.dart` el panel "Historial de servicios" con estados de carga, vacío ("Aún no tiene servicios registrados"), error y paginación
- [X] T055 [P] [US1] Escribir `client/test/vehicle_history_test.dart` (historial en orden, vacío, error, paginación, visible para los tres roles y sin acciones de edición)

**Punto de control**: el historial se deriva de las órdenes sin captura adicional (CA-1).

---

## Fase 7: Historia de usuario 3 — Establecer el próximo mantenimiento (Prioridad: P1)

**Meta**: Como mecánico, quiero establecer el próximo mantenimiento para programar el siguiente servicio.

**Prueba independiente**: Registrar un próximo mantenimiento por fecha, por kilometraje y por ambos desde una orden terminada, verlo en el vehículo, editarlo, reemplazarlo y marcarlo como realizado.

### Pruebas de la historia (escribir primero)

- [X] T056 [P] [US3] Escribir `server/tests/contract/maintenance.contract.test.js` para `POST /api/maintenance`, `GET /api/maintenance/:id`, `GET /api/vehicles/:id/maintenance`, `PATCH /api/maintenance/:id` y `POST /api/maintenance/:id/complete` y `/cancel` según `contracts/api.md` (objeto `Maintenance`, códigos `MAINTENANCE_PENDING_EXISTS`, `MAINTENANCE_NOT_PENDING`, `ORDER_NOT_FINISHED`)
- [X] T057 [P] [US3] Escribir `server/tests/integration/maintenance.test.js`: alta con fecha, con kilometraje y con ambos; sin ninguno → 400; fecha pasada → 400; kilometraje menor al actual del vehículo → 400; descripción vacía → 400; orden sin terminar → 409 `ORDER_NOT_FINISHED`; orden de otro vehículo o inexistente → 400/404; segundo pendiente sin `replacePending` → 409 con el pendiente en `details`; con `replacePending: true` el anterior queda `CANCELADO` y el nuevo `PENDIENTE` en una sola transacción; dos altas simultáneas dejan un solo pendiente; editar solo `PENDIENTE` (quitar fecha o kilometraje solo si queda el otro); `complete` y `cancel` fijan `completed_at`; cerrar uno ya cerrado → 409
- [X] T058 [P] [US3] Escribir `server/tests/integration/sprint3Permissions.test.js` (parte mantenimiento): mecánico registra solo desde sus órdenes (orden ajena → 404); administrador desde cualquiera; recepción 403 en escritura pero puede leer; mecánico lee `GET /api/vehicles/:id/maintenance`; `GET /api/maintenance/:id` de un mecánico sin relación con el vehículo → 404

### Implementación de la historia

- [X] T059 [US3] Crear `server/models/maintenanceModel.js` con `insert`, `findById`, `findPendingByVehicle(vehicleId, conn)` (con `FOR UPDATE`), `listByVehicle`, `update`, `close(id, status, conn)` y `mapMaintenance` (une vehículo, cliente y orden; calcula `classification`, `daysRemaining` y `kmRemaining` con `maintenanceStatus.js` y los umbrales de `settingsModel`)
- [X] T060 [P] [US3] Crear `server/validators/maintenanceValidators.js` con `zod`: `createMaintenanceBody` (`orderId`, `description` 1–255, `nextDate` formato `YYYY-MM-DD` opcional, `nextMileage` entero ≥ 0 opcional, `replacePending` booleano opcional; al menos uno de fecha o kilometraje), `updateMaintenanceBody` (parcial; permite `null` para quitar uno de los dos) y `idParams`
- [X] T061 [US3] Crear `server/services/maintenanceService.js` con `createMaintenance` (en transacción: cargar la orden y exigir `TERMINADO` o `ENTREGADO`, comprobar que el mecánico es el asignado o que el usuario es administrador, validar fecha no anterior a hoy y kilometraje no menor al actual del vehículo bloqueado, aplicar la regla de un solo pendiente con `replacePending`), `getMaintenance`, `listVehicleMaintenance`, `updateMaintenance`, `completeMaintenance` y `cancelMaintenance`
- [X] T062 [P] [US3] Crear `server/controllers/maintenanceController.js` y `server/routes/maintenanceRoutes.js` con `POST /`, `GET /:id`, `PATCH /:id`, `POST /:id/complete` y `POST /:id/cancel` (autorización por rol en el servicio); agregar `GET /:id/maintenance` a `server/routes/vehicleRoutes.js`; montar `/api/maintenance` en `server/app.js`
- [X] T063 [P] [US3] Crear `client/lib/models/maintenance.dart` (`Maintenance`, `MaintenanceClassification`), `client/lib/services/maintenance_service.dart` y `client/lib/providers/maintenance_provider.dart` con alta, edición, realizar, cancelar y mantenimientos de un vehículo
- [X] T064 [US3] Crear `client/lib/widgets/maintenance_dialog.dart` (descripción, fecha opcional con selector nativo, kilometraje opcional, validación de "al menos uno", y confirmación de reemplazo cuando la API responde `MAINTENANCE_PENDING_EXISTS`)
- [X] T065 [US3] Agregar a `client/lib/screens/orders/order_detail_screen.dart` el botón "Registrar próximo mantenimiento" (visible con orden `TERMINADO` o `ENTREGADO` para el mecánico asignado o el administrador) y a `client/lib/screens/vehicles/vehicle_detail_screen.dart` el panel "Mantenimiento" con el pendiente, sus datos y las acciones editar, marcar como realizado y cancelar (con confirmación) según el rol, más los cerrados como antecedente
- [X] T066 [P] [US3] Escribir `client/test/maintenance_dialog_test.dart` y `client/test/vehicle_maintenance_panel_test.dart` (validación de al menos uno, reemplazo con confirmación, acciones por rol, panel con pendiente y antecedentes)

**Punto de control**: el mecánico deja programado el siguiente servicio (CA-2).

---

## Fase 8: Historia de usuario 2 — Registrar el kilometraje de cada servicio (Prioridad: P2)

**Meta**: Como mecánico, quiero registrar el kilometraje de cada servicio para mantener actualizado el historial.

**Prueba independiente**: Capturar el kilometraje de servicio de una orden y ver que el historial y el kilometraje actual del vehículo lo reflejan; rechazar valores menores al de entrada.

### Pruebas de la historia (escribir primero)

- [X] T067 [P] [US2] Escribir `server/tests/integration/serviceMileage.test.js`: guardar `serviceMileage` ≥ `entryMileage` con `PATCH /api/orders/:id/work`; el kilometraje actual del vehículo pasa a `GREATEST(actual, servicio)` y no disminuye; menor al de entrada → 400 con el de entrada en el mensaje; negativo o no numérico → 400; `null` lo borra; orden `ENTREGADO` → 409 `ORDER_NOT_EDITABLE`; orden `TERMINADO` sí lo admite; el historial muestra `serviceMileage`, o `entryMileage` si no se capturó; terminar la orden sin kilometraje de servicio sigue funcionando; mecánico ajeno 404 y recepción 403
- [X] T068 [P] [US2] Ampliar `server/tests/contract/orderWork.contract.test.js` con el campo `serviceMileage` en la petición y en el detalle de la orden

### Implementación de la historia

- [X] T069 [US2] Ampliar `server/validators/orderValidators.js` (`updateWorkBody` acepta `serviceMileage` entero ≥ 0 o `null`), `server/models/orderModel.js` (`service_mileage` en `ORDER_SELECT`, `mapOrder` y `updateWork`) y `server/services/orderWorkService.js`: validar `serviceMileage >= entryMileage` con mensaje en `details.field = "serviceMileage"`, permitirlo mientras `isNotesEditable`, y actualizar el kilometraje del vehículo bloqueado con `GREATEST` en la misma transacción
- [X] T070 [P] [US2] Ampliar `client/lib/models/service_order.dart` y `client/lib/services/orders_service.dart` con `serviceMileage`, y agregar a `client/lib/screens/orders/order_detail_screen.dart` el campo "Kilometraje de servicio" editable para quien puede documentar el trabajo, con validación local contra el kilometraje de entrada
- [X] T071 [P] [US2] Escribir `client/test/service_mileage_test.dart` (captura válida, error por menor al de entrada, solo lectura en orden entregada)

**Punto de control**: el historial muestra el kilometraje real de cada servicio.

---

## Fase 9: Historia de usuario 4 — Consultar mantenimientos próximos y vencidos (Prioridad: P2)

**Meta**: Como recepcionista, quiero consultar los mantenimientos próximos y vencidos para avisar al cliente.

**Prueba independiente**: Con mantenimientos vencidos, próximos y lejanos de ejemplo, ver el listado con los vencidos primero, filtrar por estado y buscar por cliente o placa, con el teléfono del cliente a la vista.

### Pruebas de la historia (escribir primero)

- [X] T072 [P] [US4] Escribir `server/tests/contract/maintenanceList.contract.test.js` para `GET /api/maintenance` (parámetros `classification`, `status`, `search`; `meta` con `warningDays` y `warningKm`; campos `clientName`, `clientPhone`, `classification`, `daysRemaining`, `kmRemaining`)
- [X] T073 [P] [US4] Escribir `server/tests/integration/maintenanceList.test.js`: por defecto (`ALERT`) devuelve vencidos y próximos y omite lejanos; vencido por fecha, por kilometraje y por cualquiera de los dos; próximo por días y por kilómetros; los umbrales se leen de `app_settings` (cambiar el valor cambia la clasificación sin tocar código); `status=REALIZADO|CANCELADO` ignora la clasificación; orden: vencidos primero y luego próximos por cercanía; búsqueda por cliente y por placa; paginación; el vehículo de un mantenimiento pendiente cuyo kilometraje actual lo supera aparece vencido; mecánico 403 y sin token 401

### Implementación de la historia

- [X] T074 [US4] Agregar a `server/models/maintenanceModel.js` `listAlerts({ classification, status, search, thresholds, limit, offset })` que calcula la clasificación en SQL con las mismas reglas de `maintenanceStatus.js` (vencido: `next_date < CURDATE()` o `next_mileage < v.current_mileage`; próximo: dentro de `warningDays` o `warningKm`), filtra y ordena (vencidos primero, luego por cercanía) y cuenta el total; añadir una prueba en `server/tests/integration/maintenanceList.test.js` que compare la clasificación SQL con la función pura sobre los mismos datos
- [X] T075 [US4] Agregar `listMaintenance` a `server/services/maintenanceService.js` (devuelve `meta` con `warningDays` y `warningKm`) y `GET /` a `server/routes/maintenanceRoutes.js` con `authorize(ROLES.ADMIN, ROLES.RECEPTIONIST)` y `listMaintenanceQuery` en `server/validators/maintenanceValidators.js`
- [X] T076 [P] [US4] Ampliar `client/lib/services/maintenance_service.dart` y `client/lib/providers/maintenance_provider.dart` con el listado filtrado y paginado
- [X] T077 [US4] Crear `client/lib/screens/maintenance/maintenance_list_screen.dart` (tabla con cliente, teléfono, vehículo y placa, descripción, fecha y kilometraje objetivo, días o km restantes y chip "Vencido" en rojo o "Próximo" en ámbar; filtro por estado, búsqueda por cliente o placa, vacío "No hay mantenimientos por avisar", enlace al vehículo) y agregar la entrada "Mantenimientos" (administrador y recepcionista) en `client/lib/widgets/app_shell.dart` y las rutas en `client/lib/router.dart`
- [X] T078 [P] [US4] Escribir `client/test/maintenance_list_screen_test.dart` y ampliar `client/test/app_shell_menu_test.dart` (listado, chips de color, filtros, búsqueda, entrada de menú por rol)

**Punto de control**: recepción identifica a qué clientes avisar (CA-3).

---

## Fase 10: Historia de usuario 8 — Visualizar alertas de stock bajo (Prioridad: P2)

**Meta**: Como administrador, quiero visualizar alertas de stock bajo para reabastecer a tiempo.

**Prueba independiente**: Dejar una refacción en o por debajo de su mínimo y otra en cero, ver la insignia en el menú y el aviso en el inventario, filtrar solo las alertas y comprobar que desaparecen al registrar una entrada.

### Pruebas de la historia (escribir primero)

- [X] T079 [P] [US8] Escribir `server/tests/contract/partAlerts.contract.test.js` para `GET /api/parts/alerts` (`{ low, out, total }`) y el filtro `alert=LOW|OUT|ANY` de `GET /api/parts`
- [X] T080 [P] [US8] Escribir `server/tests/integration/partAlerts.test.js`: `low` cuenta `0 < stock <= minimum_stock`; `out` cuenta `stock = 0`; las inactivas no cuentan; una salida por orden que lleva la existencia al mínimo activa la alerta de inmediato; una entrada que la supera la quita; el filtro devuelve las coincidencias correctas; recepción y mecánico 403

### Implementación de la historia

- [X] T081 [US8] Agregar a `server/models/partModel.js` `countAlerts()` y el filtro `alert` en `list`, con las reglas de `stockStatus.js`; `getAlerts` a `server/services/inventoryService.js`; y `GET /alerts` a `server/routes/partRoutes.js` (solo `ADMIN`, declarado antes de `/:id`); ampliar `listPartsQuery` con `alert`
- [X] T082 [P] [US8] Ampliar `client/lib/services/inventory_service.dart` y `client/lib/providers/inventory_provider.dart` con `fetchAlerts` y el contador observable, que se actualiza al iniciar sesión como administrador y tras cada operación de inventario o de refacciones en una orden
- [X] T083 [US8] Agregar a `client/lib/widgets/app_shell.dart` la insignia con el número de alertas junto a "Inventario" (oculta en 0), y a `client/lib/screens/inventory/inventory_list_screen.dart` el aviso "N refacciones con stock bajo o agotadas" con acceso directo al filtro de alertas y el filtro `Todas | Stock bajo | Agotadas`; sin alertas no se muestra aviso
- [X] T084 [P] [US8] Escribir `client/test/stock_alerts_test.dart` (insignia con conteo y oculta en 0, aviso con filtro, desaparece tras una entrada) y ampliar `client/test/app_shell_menu_test.dart`

**Punto de control**: el administrador ve a tiempo qué reabastecer (CA-7).

---

## Fase 11: Datos de ejemplo, pulido y cierre

**Propósito**: Datos para ver el sprint sin capturar nada, rendimiento, documentación y revisión final.

- [X] T085 Crear `database/seeds/003_sample_maintenance_inventory.sql` idempotente: ≥ 12 refacciones con código único (`INSERT … ON DUPLICATE KEY UPDATE` sin pisar `stock`), con existencia normal, 3 con stock bajo, 2 agotadas y 1 inactiva; movimientos `IN`, `OUT` (ligados a órdenes de ejemplo) y `ADJUSTMENT` con motivo que empieza por "Semilla:" y solo se insertan si no existen; recalcular `parts.stock` desde la suma de movimientos del lote; líneas de `order_parts` en órdenes de ejemplo en estados de trabajo, terminadas y entregadas; ≥ 3 órdenes terminadas o entregadas para un mismo vehículo, algunas con `service_mileage`; mantenimientos: 2 vencidos (uno por fecha y otro por kilometraje), 2 próximos, 1 lejano, 1 realizado y 1 cancelado, con fechas relativas a `CURDATE()`. Sin contraseñas ni secretos
- [X] T086 Verificar que el runner de seeds (`server/scripts/seed.js`) ejecute el seed 003 en orden y escribir `server/tests/integration/sprint3Seeds.test.js`: conteos esperados por estado de existencia y de mantenimiento, invariante `stock = SUM(quantity)` para todas las refacciones, ejecutar los seeds dos veces no duplica ningún registro, y el historial del vehículo de ejemplo muestra ≥ 3 servicios en orden
- [X] T087 [P] Escribir `server/tests/integration/sprint3Performance.test.js` (SC-010): con 5 000 refacciones y 1 000 órdenes terminadas de un vehículo, el listado, la búsqueda, las alertas, `GET /api/parts/available` y el historial paginado responden en menos de 2 segundos; la prueba prepara y limpia sus propios datos
- [X] T088 [P] Escribir `server/tests/integration/sprint3Permissions.test.js` (parte inventario y refacciones de la orden): matriz completa de `contracts/api.md` por rol y por endpoint (200/403/404), incluida la lectura del detalle de la orden por recepción en solo lectura
- [X] T089 [P] Escribir `server/tests/integration/stockInvariant.test.js` (SC-007): tras una secuencia aleatoria reproducible de entradas, ajustes, altas, cambios y retiros de refacciones en órdenes, `parts.stock = SUM(inventory_movements.quantity)` para todas las refacciones y ninguna es negativa
- [X] T090 [P] Escribir `client/test/sprint3_narrow_window_test.dart` (ventana de 800 px): inventario, detalle de refacción, mantenimientos, historial del vehículo y el detalle de la orden con refacciones no se desbordan
- [X] T091 [P] Fusionar `specs/003-historial-inventario/contracts/api.md` en `docs/api.md` (matriz de permisos, errores nuevos y endpoints del Sprint 3) y actualizar la referencia de contratos de su encabezado
- [X] T092 [P] Actualizar `README.md` (funciones del Sprint 3, cuentas y flujo de demostración) y `database/README.md` (migración 003, seed 003, tabla `app_settings` y cómo cambiar los umbrales de mantenimiento)
- [X] T093 Revisión de seguridad y de interfaz: permisos solo en el servidor en cada ruta nueva, entradas validadas con `zod`, ningún error expone trazas, ningún secreto en el repositorio, colores y tipografía solo desde los tokens de `docs/design-system.md`, confirmaciones en quitar refacción, reemplazar mantenimiento, cancelar o realizar mantenimiento y dar de baja una refacción
- [X] T094 Ejecutar `npm test` (backend completo contra `motorix_test`), `flutter analyze` y `flutter test`, corregir regresiones de los Sprint 1 y 2 (en particular los totales de órdenes que ahora incluyen refacciones) y compilar el cliente web con `flutter build web`
- [X] T095 Recorrer `specs/003-historial-inventario/quickstart.md` contra la API y la interfaz reales con una base reiniciada (`npm run db:reset`), anotando cada paso comprobado y corrigiendo lo que falle
- [ ] T096 Actualizar `docs/project-context.md` y, si el equipo lo aprueba, la constitución con las decisiones del sprint (modelo de `Part` y `Maintenance`, estados de mantenimiento en español, `app_settings`, umbrales iniciales y bloqueo de refacciones en `TERMINADO`); **requiere aprobación del equipo antes de modificarse**, como T087 del Sprint 2 y T093 del Sprint 1

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (F1)** → **Fundamentos (F2)** → todas las historias.
- **US5 (F3)** es la base del inventario: US6, US7 y US8 dependen de `partModel.applyMovement` y del catálogo.
- **US6 (F4)** depende de US5. **US7 (F5)** depende de US5 (y usa `applyMovement`); no requiere US6.
- **US1 (F6)** depende solo de los Fundamentos y de las órdenes del Sprint 2; muestra refacciones y kilometraje de servicio si existen (US7 y US2), pero funciona sin ellos.
- **US3 (F7)** depende de los Fundamentos; se integra con US1 en el detalle del vehículo.
- **US2 (F8)** depende de los Fundamentos; el historial (US1) lo aprovecha.
- **US4 (F9)** depende de US3 (necesita mantenimientos).
- **US8 (F10)** depende de US5 y se completa con US7 (salidas por orden activan la alerta).
- **Cierre (F11)** al final; T085 requiere que existan todas las tablas y T094–T096 cierran el sprint.

### Dentro de cada historia

Pruebas (que fallen) → modelo → validadores → servicio → controlador y rutas → cliente (modelo, servicio, proveedor) → pantallas → pruebas de Flutter.

### Oportunidades de paralelismo

- Fundamentos: T004, T006–T010 y T012 en paralelo tras T003 (T005 y T011 requieren la migración aplicada).
- US5 y US1/US3/US2 pueden avanzar en paralelo por distintas personas una vez terminados los Fundamentos, porque tocan archivos distintos (la excepción es `order_detail_screen.dart` y `vehicle_detail_screen.dart`, que se editan en US7/US3/US2/US1: coordinar el orden de fusión).
- Dentro de cada fase, las pruebas de contrato e integración marcadas [P] se escriben juntas.
- Backend y cliente de la misma historia pueden desarrollarse en paralelo cuando `contracts/api.md` es el acuerdo.

### Ejemplo de paralelismo (US7)

```text
Pruebas:        T033, T034, T035, T036 en paralelo
Backend:        T037 → T039 → T040; T038 y T041 [P]; T042 tras T037
Cliente:        T043, T044 [P] → T045 → T046
```

## Estrategia de implementación

1. **MVP (inventario usable)**: Preparación + Fundamentos + US5 + US6 + US7. Con esto el administrador mantiene el catálogo y el mecánico descuenta refacciones de las órdenes sin permitir stock negativo (CA-4, CA-5, CA-6).
2. **Historial y mantenimiento**: US1 y US3 completan el flujo "finalizar servicio → historial → próximo mantenimiento" (CA-1, CA-2).
3. **Incrementos P2**: US2 (kilometraje de servicio), US4 (aviso a clientes) y US8 (alertas de stock).
4. **Cierre**: seeds, rendimiento, documentación y recorrido del quickstart. Cada historia se considera terminada solo cuando funciona de extremo a extremo (Principio VII).
5. **Pendiente del equipo**: T096 no se ejecuta sin aprobación.
