---

description: "Lista de tareas para implementar el Sprint 3: historial, mantenimiento e inventario"
---

# Tareas: Historial, mantenimiento e inventario

**Entrada**: Documentos de diseño en `specs/003-historial-mantenimiento-inventario/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md. Sprints 1 y 2 completados.

**Pruebas**: Se incluyen porque la constitución (principio VII) exige pruebas para la lógica de negocio y los permisos, y el criterio CA-8 pide pruebas de la lógica de inventario y de mantenimiento. Backend: Jest y Jest + supertest contra la base `*_test`. Frontend: `flutter test`. Las pruebas de cada historia se escriben primero y DEBEN fallar antes de implementar.

**Organización**: Las tareas se agrupan por historia de usuario para implementarlas y probarlas de forma independiente.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US1]–[US6]**: Historia de usuario (US1 historial del vehículo, US2 programar el próximo mantenimiento, US3 consultar mantenimientos próximos y vencidos, US4 refacciones y stock, US5 refacciones en la orden, US6 alertas de stock bajo)
- Todas las rutas son relativas a la raíz del repositorio

## Convenciones de rutas

- Backend: `server/` (ES Modules, sin carpeta `src/`); pruebas en `server/tests/{unit,integration,contract}/`
- Frontend: `client/lib/` y `client/test/`
- Base de datos: `database/`

---

## Fase 1: Preparación

**Propósito**: Confirmar la base de los Sprints 1 y 2 antes de extenderla

- [X] T001 Verificar que los Sprints 1 y 2 siguen en verde ejecutando `npm test` y `npx eslint .` en `server/` y `flutter test` y `flutter analyze` en `client/`, y que `git status` está limpio en la rama `sdd-speckit`
- [X] T002 [P] Confirmar que `.env` apunta a las bases `motorix_sdd` y `motorix_sdd_test` y que las migraciones 001 y 002 están aplicadas en ambas con `database/scripts/aplicar-migraciones.ps1`

---

## Fase 2: Fundamentos (prerrequisitos bloqueantes)

**Propósito**: Esquema y herramientas compartidas que DEBEN existir antes de cualquier historia

**⚠️ CRÍTICO**: Ninguna historia puede empezar hasta completar esta fase

- [X] T003 Escribir la migración `database/migrations/003_sprint3_maintenance_inventory.sql` exactamente según `data-model.md`: `parts.code` VARCHAR(40) NOT NULL UNIQUE; `parts.name` VARCHAR(120) NOT NULL con índice; `parts.category` VARCHAR(60) NOT NULL con índice; `parts.brand` VARCHAR(60) NOT NULL; `parts.stock` INT UNSIGNED NOT NULL DEFAULT 0 con CHECK (`stock` >= 0); `parts.minimumStock` INT UNSIGNED NOT NULL DEFAULT 0; `parts.purchasePrice` y `parts.salePrice` DECIMAL(10,2) NOT NULL con CHECK (>= 0); `parts.active` TINYINT(1) NOT NULL DEFAULT 1 con índice; `inventory_movements.type` ENUM('IN','OUT','ADJUSTMENT') NOT NULL; `inventory_movements.quantity` INT NOT NULL con CHECK (`quantity` <> 0) y la coherencia con el tipo (IN > 0, OUT < 0); `inventory_movements.stockAfter` INT UNSIGNED NOT NULL; `inventory_movements.reason` VARCHAR(255) NOT NULL; `inventory_movements.orderId` INT UNSIGNED NULL con llave foránea; índices (`partId`, `createdAt`) y `orderId`; `order_parts.quantity` INT UNSIGNED NOT NULL con CHECK (`quantity` > 0); `order_parts.unitPrice` DECIMAL(10,2) NOT NULL con CHECK (>= 0); `order_parts.partCode` VARCHAR(40) y `order_parts.partName` VARCHAR(120) NOT NULL; `order_parts.amount` columna generada almacenada `ROUND(quantity * unitPrice, 2)`; `UNIQUE (orderId, partId)`; `maintenance.serviceType` VARCHAR(100) NOT NULL; `maintenance.lastServiceDate` DATE NOT NULL; `maintenance.lastMileage` INT UNSIGNED NOT NULL; `maintenance.nextDate` DATE NULL; `maintenance.nextMileage` INT UNSIGNED NULL; `maintenance.status` ENUM('PENDIENTE','ATENDIDO') NOT NULL DEFAULT 'PENDIENTE' con índice; CHECK de tabla: al menos uno de `nextDate` o `nextMileage` no es nulo, `nextDate` nulo o mayor o igual a `lastServiceDate`, `nextMileage` nulo o mayor a `lastMileage`; y `ALTER TABLE service_orders ADD COLUMN serviceMileage INT UNSIGNED NULL`; sin ninguna llave foránea en cascada
- [X] T004 Aplicar la migración 003 a `motorix_sdd` y a `motorix_sdd_test` con `database/scripts/aplicar-migraciones.ps1`, verificar que la 001 y la 002 aparecen como "Ya aplicada" y que repetir el comando no vuelve a ejecutar la 003
- [X] T005 [P] Ampliar `server/tests/helpers.js`: `limpiarBase` vacía también `maintenance`, `order_parts`, `inventory_movements` y `parts` en orden seguro; y se añaden ayudantes `crearRefaccion` (con existencia inicial y su movimiento), `crearMantenimiento` y `sumaDeMovimientos(partId)` para comprobar la invariante `stock = suma de movimientos`
- [X] T006 [P] Agregar a `server/utils/constants.js` las constantes de tipos de movimiento (`IN`, `OUT`, `ADJUSTMENT`), niveles de stock (`OK`, `LOW`, `OUT`), clasificación de mantenimiento (`NORMAL`, `PROXIMO`, `VENCIDO`) y estados (`PENDIENTE`, `ATENDIDO`), y los umbrales de aviso (15 días y 500 km)
- [X] T007 Extender `server/models/orderModel.js` y `server/services/orderService.js`: `recalculateTotal` suma también `order_parts.amount`; `findDetail` devuelve `parts` (id, partId, code, name, quantity, unitPrice, amount) y `serviceMileage`; y las pruebas del Sprint 2 siguen en verde (el total ya incluye las refacciones, vacías por ahora)
- [X] T008 [P] Crear `server/services/serializers.js` con `serializePart(parte, usuario)` que elimina `purchasePrice` salvo para ADMIN, y su prueba unitaria en `server/tests/unit/serializers.test.js`
- [X] T009 [P] Crear `client/lib/widgets/status_chip.dart` (ampliar el existente) con chips para el nivel de stock (OK verde, LOW ámbar, OUT rojo) y la clasificación de mantenimiento (Normal gris, Próximo ámbar, Vencido rojo, Atendido verde) según `docs/design-system.md` sección 5, con etiquetas en español
- [X] T010 [P] Ampliar `client/test/helpers/fake_api_s2.dart` (o un archivo nuevo `fake_api_s3.dart`) con el API simulado de refacciones, movimientos, mantenimientos e historial, reutilizable en las pruebas de widgets
- [X] T011 Registrar en `client/lib/screens/home_screen.dart` las secciones **Inventario** y **Mantenimientos** (los tres roles) con sus íconos, sin construirlas todavía

**Punto de control**: Esquema y herramientas listos; las historias pueden comenzar

---

## Fase 3: Historia de usuario 1 - Consultar el historial de servicios de un vehículo (Prioridad: P1) 🎯 MVP

**Objetivo**: Ver el historial calculado de un vehículo y registrar el kilometraje de cada servicio.

**Prueba independiente**: Abrir el historial de un vehículo con órdenes de todos los estados y comprobar que solo salen las terminadas y entregadas, de la más reciente a la más antigua; registrar el kilometraje del servicio y verlo reflejado (escenarios 1 y 2 de `quickstart.md`).

### Pruebas de la historia 1 ⚠️ (escribir primero; deben fallar)

- [X] T012 [P] [US1] Prueba unitaria del servicio de historial: solo órdenes `TERMINADO` y `ENTREGADO`; orden de la más reciente a la más antigua por la fecha del cambio a `TERMINADO`; kilometraje `serviceMileage` o, si falta, el de entrada; carga de servicios, mano de obra y refacciones por lotes (una consulta por tipo, sin consulta por orden), en `server/tests/unit/vehicleHistoryService.test.js`
- [X] T013 [P] [US1] Prueba unitaria del kilometraje del servicio en `orderService.update`: "entero entre el kilometraje de entrada y 1,500,000"; solo mecánico asignado o ADMIN y con la orden en curso; actualiza el kilometraje del vehículo con `GREATEST` sin disminuirlo, en `server/tests/unit/serviceMileage.test.js`
- [X] T014 [P] [US1] Prueba de contrato de `GET /vehicles/:id/history` (forma de cada entrada, paginación, 404) y del campo `serviceMileage` en `PATCH /orders/:id` en `server/tests/contract/vehicleHistory.contract.test.js`
- [X] T015 [P] [US1] Prueba de integración del historial: las órdenes en curso y canceladas no aparecen; cualquier rol lo consulta; una corrección a una orden se refleja en el historial; el kilometraje del servicio sube el del vehículo y uno menor al de entrada se rechaza, en `server/tests/integration/vehicleHistory.test.js`
- [X] T016 [P] [US1] Prueba de provider y de widgets de la pantalla de historial (estado vacío, cargando, error, entradas con servicios, mano de obra y refacciones) y del campo de kilometraje del servicio en el detalle de la orden en `client/test/screens/vehicle_history_test.dart`

### Implementación de la historia 1

- [X] T017 [US1] Agregar `serviceMileage` al esquema de edición de órdenes en `server/validators/orderValidator.js` con el rango "entre el kilometraje de entrada y 1,500,000" y mensajes en español
- [X] T018 [US1] Implementar la edición de `serviceMileage` en `server/models/orderModel.js` y `server/services/orderService.js` (campo de trabajo del mecánico asignado o ADMIN, orden en curso) con la actualización de `vehicles.currentMileage = GREATEST(currentMileage, serviceMileage)` en la misma transacción
- [X] T019 [P] [US1] Crear `server/models/historyModel.js` con la consulta de órdenes `TERMINADO` y `ENTREGADO` de un vehículo (fecha del cambio a `TERMINADO`, paginación) y las consultas por lotes de servicios, mano de obra y refacciones
- [X] T020 [US1] Implementar `server/services/vehicleHistoryService.js`, `server/controllers/historyController.js` y la ruta `GET /api/vehicles/:id/history` para los tres roles en `server/routes/vehicleRoutes.js`
- [X] T021 [P] [US1] Crear `client/lib/models/history_entry.dart` y agregar `history(vehicleId)` a `client/lib/providers/vehicles_provider.dart`
- [X] T022 [US1] Crear `client/lib/screens/vehicle_history_screen.dart` (línea de tiempo del más reciente al más antiguo, con kilometraje, servicios, mano de obra, refacciones, observaciones y recomendaciones) y el botón **Historial** en `client/lib/screens/vehicle_detail_screen.dart`
- [X] T023 [US1] Agregar el campo **Kilometraje del servicio** a la edición del trabajo en `client/lib/screens/order_detail_screen.dart` (mecánico asignado o ADMIN, orden en curso) y mostrarlo en el detalle

**Punto de control**: El historial funciona de extremo a extremo y de forma independiente

---

## Fase 4: Historia de usuario 2 - Establecer el próximo mantenimiento (Prioridad: P1)

**Objetivo**: Registrar y editar mantenimientos programados con clasificación calculada y reemplazo del anterior.

**Prueba independiente**: Programar "Cambio de aceite" desde una orden terminada, comprobar las validaciones y que registrar otro del mismo tipo deja el anterior como Atendido (escenarios 3 a 5 y 8 de `quickstart.md`).

### Pruebas de la historia 2 ⚠️

- [X] T024 [P] [US2] Prueba unitaria **exhaustiva** de `maintenanceClassifier.classify`: límites de fecha (hoy, +15 días, +16 días, ayer), límites de kilometraje (−501, −500, 0, +1 respecto al próximo), solo fecha, solo kilometraje, ambos valores (gana el más urgente), `daysLeft` y `kmLeft` con signo, en `server/tests/unit/maintenanceClassifier.test.js`
- [X] T025 [P] [US2] Prueba unitaria del validador y del servicio de mantenimientos: `serviceType` "obligatorio, 1 a 100 caracteres"; "al menos uno de nextDate o nextMileage"; `nextDate` mayor o igual a `lastServiceDate`; `nextMileage` mayor a `lastMileage`; kilometrajes hasta 1,500,000; notas hasta 2000; reemplazo de los pendientes del mismo tipo sin distinguir mayúsculas ni espacios; los Atendidos no se editan, en `server/tests/unit/maintenanceService.test.js`
- [X] T026 [P] [US2] Prueba de contrato de `POST /maintenance`, `PATCH /maintenance/:id` y `GET /maintenance/:id` (forma con `classification`, `daysLeft`, `kmLeft`, `vehicle` y `client`; 400 con el campo; 404; 409 `MAINTENANCE_NOT_EDITABLE`) en `server/tests/contract/maintenance.contract.test.js`
- [X] T027 [P] [US2] Prueba de integración de mantenimientos: ADMIN y MECHANIC registran y editan, RECEPTIONIST recibe 403 al escribir pero consulta; el reemplazo deja Atendido al anterior; una orden de origen válida se enlaza, en `server/tests/integration/maintenance.test.js`
- [X] T028 [P] [US2] Prueba de provider y de widgets del formulario de mantenimiento (validaciones en español, precarga desde una orden terminada, mensajes de error de la API) en `client/test/screens/maintenance_form_test.dart`

### Implementación de la historia 2

- [X] T029 [P] [US2] Crear `server/services/maintenanceClassifier.js`: función pura `classify(mantenimiento, kilometrajeActual, hoy)` con los umbrales fijos de 15 días y 500 km
- [X] T030 [P] [US2] Crear `server/validators/maintenanceValidator.js` con los esquemas de alta, edición y consulta
- [X] T031 [P] [US2] Crear `server/models/maintenanceModel.js` con alta transaccional (marca los pendientes del mismo vehículo y tipo como `ATENDIDO` con `completedAt`), detalle con vehículo y cliente, y edición
- [X] T032 [US2] Implementar `server/services/maintenanceService.js` (alta, edición, detalle) con las reglas de validación y la clasificación, y los endpoints `POST /api/maintenance`, `PATCH /api/maintenance/:id` y `GET /api/maintenance/:id` en `server/controllers/maintenanceController.js` y `server/routes/maintenanceRoutes.js` (escritura: ADMIN y MECHANIC; lectura: los tres roles), registrados en `server/app.js`
- [X] T033 [P] [US2] Crear `client/lib/models/maintenance.dart` y `client/lib/providers/maintenance_provider.dart` (alta, edición y detalle; se vacía al cerrar sesión)
- [X] T034 [US2] Crear `client/lib/screens/maintenance_form_screen.dart` (vehículo, tipo de servicio, último servicio, próxima fecha y/o kilometraje, notas; confirmación al salir con cambios) y el botón **Programar próximo mantenimiento** en el detalle de las órdenes `TERMINADO` y `ENTREGADO` para mecánico y administrador, que precarga fecha y kilometraje del servicio

**Punto de control**: Las historias 1 y 2 funcionan de forma independiente

---

## Fase 5: Historia de usuario 3 - Consultar mantenimientos próximos y vencidos (Prioridad: P1)

**Objetivo**: Lista de pendientes clasificados, con contacto del cliente, filtros y orden por urgencia.

**Prueba independiente**: Con mantenimientos normales, próximos y vencidos (por fecha y por kilometraje) y uno atendido, la lista muestra la clasificación correcta y los filtros funcionan (escenarios 6 y 7 de `quickstart.md`).

### Pruebas de la historia 3 ⚠️

- [X] T035 [P] [US3] Prueba unitaria del listado: solo pendientes por defecto; filtro por clasificación (una o varias); orden Vencido, Próximo, Normal y, dentro de cada grupo, el más urgente primero; búsqueda por cliente, placas o tipo; paginación en memoria; recálculo cuando cambia el kilometraje del vehículo, en `server/tests/unit/maintenanceList.test.js`
- [X] T036 [P] [US3] Prueba de contrato de `GET /maintenance` (forma de `data` y `meta`, filtros válidos e inválidos) en `server/tests/contract/maintenance.list.contract.test.js`
- [X] T037 [P] [US3] Prueba de integración del listado con casos de cada clasificación en la base de pruebas: vencido por fecha, vencido por kilometraje, próximo por fecha, próximo por kilometraje, normal y atendido; recepción filtra y lee con teléfono del cliente; subir el kilometraje del vehículo con una orden reclasifica, en `server/tests/integration/maintenance.list.test.js`
- [X] T038 [P] [US3] Prueba de provider y de widgets de la lista (chips de clasificación, filtros, orden, contacto del cliente, estados vacío, cargando y error) en `client/test/screens/maintenance_screen_test.dart`

### Implementación de la historia 3

- [X] T039 [US3] Agregar a `server/models/maintenanceModel.js` el listado de pendientes (o de todos) con vehículo, kilometraje actual y datos del cliente, y los filtros por vehículo, cliente y texto
- [X] T040 [US3] Agregar a `server/services/maintenanceService.js` el listado: clasifica con `maintenanceClassifier`, filtra por clasificación, ordena por urgencia y pagina; implementar `GET /api/maintenance` para los tres roles
- [X] T041 [US3] Crear `client/lib/screens/maintenance_screen.dart`: lista con chips de clasificación, filtros (Próximos, Vencidos, Todos), búsqueda, cliente, teléfono y cuánto falta o cuánto se pasó, y acción **Programar mantenimiento** solo para mecánico y administrador; registrar `MaintenanceProvider` y la sección **Mantenimientos** en `client/lib/main.dart`
- [X] T042 [US3] Crear `database/seeds/007_maintenance.sql` con al menos 6 mantenimientos pendientes en cada clasificación (relativos a `CURDATE()` y al kilometraje de los vehículos de ejemplo) y uno Atendido, de forma idempotente

**Punto de control**: Las historias 1 a 3 funcionan de forma independiente

---

## Fase 6: Historia de usuario 4 - Registrar y consultar refacciones y su stock (Prioridad: P1)

**Objetivo**: Catálogo de refacciones con stock gobernado por movimientos inmutables y sin posibilidad de stock negativo.

**Prueba independiente**: Registrar una refacción con existencia inicial, una entrada y un ajuste; consultar stock y movimientos; comprobar permisos y que el precio de compra no aparece para otros roles (escenarios 9 a 11 y 21 de `quickstart.md`).

### Pruebas de la historia 4 ⚠️

- [X] T043 [P] [US4] Prueba unitaria del servicio de inventario con modelos simulados: entrada "mayor a 0", salida manual "mayor a 0" que se guarda negativa, ajuste "entero distinto de cero con signo"; motivo "obligatorio, hasta 255 caracteres"; rechazo con `INSUFFICIENT_STOCK` y el stock disponible si el resultado fuera negativo; `stockAfter` correcto; bloqueo de la refacción en la transacción, en `server/tests/unit/inventoryService.test.js`
- [X] T044 [P] [US4] Prueba unitaria del validador y del servicio de refacciones: `code` "obligatorio, 1 a 40 caracteres, único sin distinguir mayúsculas y no editable"; `name` 1 a 120; `category` y `brand` 1 a 60; `minimumStock` e `initialStock` enteros de 0 a 1,000,000; precios de 0 a 99,999,999.99 con dos decimales; la existencia inicial crea el movimiento "Existencia inicial"; desactivar y reactivar, en `server/tests/unit/partService.test.js`
- [X] T045 [P] [US4] Prueba de contrato de `GET /parts`, `GET /parts/categories`, `GET /parts/:id`, `POST /parts`, `PATCH /parts/:id`, `POST /parts/:id/movements` y `GET /parts/:id/movements` (formas, paginación, 400, 404, 409 `DUPLICATE_VALUE` e `INSUFFICIENT_STOCK` con `available`) en `server/tests/contract/parts.contract.test.js`
- [X] T046 [P] [US4] Prueba de integración del inventario: solo ADMIN escribe (403 a los demás); entrada, salida y ajuste actualizan el stock y quedan en los movimientos con usuario y fecha; un movimiento que dejaría el stock negativo se rechaza sin cambios; los movimientos no se editan ni se borran (no hay rutas); el precio de compra no aparece en **ninguna** respuesta para mecánico y recepción; una secuencia de operaciones deja `stock` igual a la suma de movimientos, en `server/tests/integration/parts.test.js`
- [X] T047 [P] [US4] Prueba de provider y de widgets de la lista, el formulario y el detalle de refacciones (administrador edita y registra movimientos; mecánico y recepción solo consultan y no ven el precio de compra; confirmación al desactivar; ajuste muestra el stock resultante) en `client/test/screens/parts_screen_test.dart`

### Implementación de la historia 4

- [X] T048 [P] [US4] Crear `server/validators/partValidator.js` con los esquemas de alta, edición, consulta y movimiento
- [X] T049 [P] [US4] Crear `server/models/partModel.js` (alta, edición, listado con filtros, detalle, categorías) y `server/models/inventoryModel.js` (bloqueo de la refacción con `FOR UPDATE`, actualización de `stock`, inserción y consulta de movimientos)
- [X] T050 [US4] Implementar `server/services/inventoryService.js` con `applyMovement` (bloquea la refacción, valida que el stock no quede negativo, actualiza `stock` e inserta el movimiento con `stockAfter` en una sola transacción) y `server/services/partService.js` (alta con existencia inicial, edición, desactivar y reactivar, consultas con `serializePart`)
- [X] T051 [US4] Implementar los endpoints de refacciones y movimientos en `server/controllers/partController.js` y `server/routes/partRoutes.js` (lectura: los tres roles; escritura: solo ADMIN), registrados en `server/app.js`
- [X] T052 [P] [US4] Crear `client/lib/models/part.dart` y `client/lib/providers/parts_provider.dart` (listado con filtros, alta, edición, movimientos; se vacía al cerrar sesión)
- [X] T053 [US4] Crear `client/lib/screens/parts_screen.dart` (lista con búsqueda, categoría, nivel de stock, precio de venta; precio de compra solo para ADMIN), `client/lib/screens/part_form_screen.dart` y `client/lib/screens/part_detail_screen.dart` (datos, historial de movimientos y diálogo de entrada, salida y ajuste con el stock resultante); registrar `PartsProvider` y la sección **Inventario** en `client/lib/main.dart`
- [X] T054 [US4] Crear `database/seeds/005_parts.sql` con al menos 12 refacciones de categorías variadas, existencia inicial y entradas como movimientos, con motivos únicos, una agotada y dos en stock bajo, y fijar `parts.stock` como la suma de sus movimientos, de forma idempotente

**Punto de control**: Las historias 1 a 4 funcionan de forma independiente

---

## Fase 7: Historia de usuario 5 - Agregar refacciones utilizadas a una orden (Prioridad: P1)

**Objetivo**: Cada uso de una refacción en una orden genera una salida de inventario ligada a la orden, sin sobreasignar el stock.

**Prueba independiente**: En una orden en curso, agregar 2 piezas de una refacción con stock 5; el stock baja a 3, aparece la salida ligada a la orden y el total de la orden suma las piezas; dos usos simultáneos de la última pieza dejan solo uno (escenarios 12 a 18 de `quickstart.md`).

### Pruebas de la historia 5 ⚠️

- [X] T055 [P] [US5] Prueba unitaria del servicio de refacciones en la orden: cantidad "entera de 1 a 1,000,000"; el precio unitario siempre es el `salePrice` vigente (un precio enviado se ignora); solo mecánico asignado o ADMIN y solo con la orden en curso; refacción inactiva rechazada; una línea por refacción (`DUPLICATE_ORDER_PART`); cambio de cantidad registra la diferencia como salida o entrada de reversa; quitar regresa las piezas; el total se recalcula, en `server/tests/unit/orderPartService.test.js`
- [X] T056 [P] [US5] Prueba de contrato de `POST`, `PATCH` y `DELETE` de `/orders/:id/parts` (la orden completa con `parts` y `total`, 400, 403, 404, 409 `INSUFFICIENT_STOCK` con `available`, `PART_INACTIVE`, `DUPLICATE_ORDER_PART` y `ORDER_NOT_EDITABLE`) en `server/tests/contract/orderParts.contract.test.js`
- [X] T057 [P] [US5] Prueba de integración de refacciones en órdenes: la salida queda ligada a la orden y baja el stock; cantidad mayor a la disponible rechazada sin cambios; **diez peticiones simultáneas por la última pieza dejan exactamente una aplicada y stock cero**; el precio de la orden no cambia si cambia el catálogo; órdenes terminadas, entregadas y canceladas rechazan cambios; otro mecánico y recepción reciben 403; el total suma servicios, mano de obra y refacciones, en `server/tests/integration/orderParts.test.js`
- [X] T058 [P] [US5] Prueba de integración de la cancelación: cancelar una orden con refacciones regresa todas las piezas con movimientos que indican la cancelación, deja la orden con sus líneas, y la invariante `stock = suma de movimientos` se cumple en todas las refacciones, en `server/tests/integration/orderParts.cancel.test.js`
- [X] T059 [P] [US5] Prueba de widgets del bloque de refacciones del detalle de la orden y del selector de refacción (búsqueda, advertencia de stock bajo o cero, límite por stock disponible, confirmación al quitar, total actualizado, solo lectura en órdenes cerradas) en `client/test/screens/order_parts_test.dart`

### Implementación de la historia 5

- [X] T060 [P] [US5] Agregar a `server/validators/orderValidator.js` los esquemas de alta y edición de refacciones en la orden (solo `partId` y `quantity`; cualquier precio enviado se descarta)
- [X] T061 [P] [US5] Crear `server/models/orderPartModel.js` con alta, edición de cantidad, baja y consulta de las líneas de una orden (para la cancelación)
- [X] T062 [US5] Implementar `server/services/orderPartService.js` usando `inventoryService.applyMovement`: orden bloqueada primero y refacción después, validaciones de estado, asignación y refacción activa, instantánea de código, nombre y precio, movimientos con motivo automático ligados a la orden y recálculo del total, todo en una transacción
- [X] T063 [US5] Implementar `POST /api/orders/:id/parts`, `PATCH /api/orders/:id/parts/:lineId` y `DELETE /api/orders/:id/parts/:lineId` en `server/controllers/orderController.js` y `server/routes/orderRoutes.js` (ADMIN y MECHANIC; el servicio comprueba la asignación)
- [X] T064 [US5] Extender `changeStatus` de `server/services/orderService.js` para que, al cancelar una orden, regrese al stock todas sus refacciones (refacciones bloqueadas en orden ascendente de `id`, movimientos "Cancelación de la orden OS-…") dentro de la misma transacción
- [X] T065 [US5] Crear `client/lib/widgets/part_picker_dialog.dart` (búsqueda en el servidor, nivel de stock, advertencia de stock bajo o cero y cantidad limitada al disponible) y el bloque **Refacciones utilizadas** en `client/lib/screens/order_detail_screen.dart` con agregar, editar cantidad y quitar con confirmación, mostrando precio e importe y el total actualizado
- [X] T066 [US5] Crear `database/seeds/006_order_parts.sql` con refacciones usadas en las órdenes de ejemplo en curso, terminada y entregada, con sus salidas ligadas a la orden, recalcular los totales de esas órdenes, agregar `serviceMileage` a las órdenes de ejemplo terminada y entregada, y volver a fijar `parts.stock` como la suma de movimientos, de forma idempotente

**Punto de control**: Las historias 1 a 5 funcionan de forma independiente

---

## Fase 8: Historia de usuario 6 - Ver alertas de stock bajo (Prioridad: P2)

**Objetivo**: Resumen y marcas de stock bajo y agotado visibles al abrir el inventario.

**Prueba independiente**: Con refacciones por encima, en el límite y por debajo del mínimo y una agotada, la pantalla de inventario las distingue y las cuenta; al registrar una entrada que supera el mínimo, la alerta desaparece (escenarios 19 y 20 de `quickstart.md`).

### Pruebas de la historia 6 ⚠️

- [X] T067 [P] [US6] Prueba unitaria del cálculo del nivel de stock: `OUT` si el stock es 0, `LOW` si es menor o igual al mínimo y mayor que 0, `OK` en otro caso; el límite exacto (stock igual al mínimo) es `LOW`; las refacciones inactivas no cuentan, en `server/tests/unit/stockLevel.test.js`
- [X] T068 [P] [US6] Prueba de contrato de `GET /parts/summary` y del filtro `stockLevel` de `GET /parts` en `server/tests/contract/parts.alerts.contract.test.js`
- [X] T069 [P] [US6] Prueba de integración: el resumen cuenta bien con refacciones en cada nivel; una entrada que supera el mínimo cambia el nivel; un uso en una orden que deja el stock en el mínimo dispara la alerta de inmediato, en `server/tests/integration/parts.alerts.test.js`
- [X] T070 [P] [US6] Prueba de widgets del resumen de alertas, el filtro de stock bajo y las marcas en la lista de inventario (incluido el mensaje "todo el stock está en orden") en `client/test/screens/parts_alerts_test.dart`

### Implementación de la historia 6

- [X] T071 [US6] Implementar el nivel de stock (`stockLevel`) en el modelo y el servicio de refacciones, `GET /api/parts/summary` y el filtro `stockLevel` de `GET /api/parts` (solo refacciones activas)
- [X] T072 [US6] Agregar a `client/lib/screens/parts_screen.dart` el resumen de alertas (cuántas en stock bajo y agotadas, o que todo está en orden), el filtro **Stock bajo** y las marcas en las filas, cargados al abrir la pantalla

**Punto de control**: Las seis historias funcionan de forma independiente

---

## Fase 9: Pulido y temas transversales

**Propósito**: Seguridad, diseño, documentación y validación final

- [X] T073 [P] Extender `server/tests/integration/permissions.test.js` con todos los endpoints nuevos de `contracts/api.md` (sin token 401, token inválido 401, rol sin permiso 403, rol permitido distinto de 401 y 403)
- [X] T074 [P] Extender `client/test/layout_responsive_test.dart` con las secciones Inventario y Mantenimientos, el historial, los formularios de refacción y de mantenimiento, el detalle de refacción y el bloque de refacciones de la orden, en anchos de 1400, 1000, 760 y 600 px, con la barra lateral expandida y colapsada
- [X] T075 [P] Escribir una prueba de auditoría de la invariante `stock = suma de movimientos` para **todas** las refacciones tras ejecutar todas las suites de integración, en `server/tests/integration/stockInvariant.test.js`
- [X] T076 [P] Revisar que no haya valores sueltos de color, espaciado o radio en las pantallas nuevas y que ninguna contraseña, secreto ni precio de compra aparezca en el repositorio, en las respuestas de roles no administradores ni en los seeds
- [X] T077 [P] Actualizar `README.md`, `docs/project-context.md` y `specs/003-historial-mantenimiento-inventario/contracts/api.md` con los endpoints y las decisiones del Sprint 3 (historial calculado, umbrales fijos, ajuste por diferencia, precio fijo del catálogo, precio de compra solo para ADMIN, cancelación que regresa refacciones, total con refacciones)
- [X] T078 Ejecutar la suite completa del backend (`npm test`, `npx eslint .`) y del frontend (`flutter test`, `flutter analyze`) y corregir cualquier fallo
- [X] T079 Ejecutar la validación de `quickstart.md` contra la API real con los 22 escenarios, comprobar la invariante del stock, limpiar los datos temporales y registrar el resultado en `specs/003-historial-mantenimiento-inventario/validacion-quickstart.md`

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias
- **Fundamentos (Fase 2)**: depende de la Fase 1; BLOQUEA todas las historias
- **Historias (Fase 3 en adelante)**: dependen de la Fase 2
- **Pulido (Fase 9)**: depende de las historias deseadas

### Dependencias entre historias

- **US1 (historial)**: tras la Fase 2; sin dependencias de otras historias (las refacciones aparecen en el historial cuando existan, tras US5).
- **US2 (programar mantenimiento)**: tras la Fase 2; independiente.
- **US3 (lista de mantenimientos)**: requiere el modelo, el servicio y el clasificador de US2.
- **US4 (refacciones y stock)**: tras la Fase 2; independiente.
- **US5 (refacciones en la orden)**: requiere `inventoryService` y el catálogo de US4, y extiende las órdenes del Sprint 2.
- **US6 (alertas)**: requiere el catálogo y la pantalla de US4.

### Dentro de cada historia

- Las pruebas se escriben primero y DEBEN fallar antes de implementar
- Validadores y modelos antes de servicios; servicios antes de controladores y rutas
- Backend completo antes de las pantallas que lo consumen

### Oportunidades de paralelismo

- En la Fase 2: las tareas marcadas [P] (ayudantes de pruebas, constantes, serializador, chips y API simulada)
- Todas las pruebas [P] de una historia pueden escribirse juntas
- Validador y modelo de una misma historia ([P]) en paralelo
- Tras la Fase 2, US1, US2 y US4 pueden avanzar a la vez en equipo; US3, US5 y US6 siguen por sus dependencias

---

## Ejemplo de paralelismo: Historia de usuario 4

```bash
# Pruebas de la historia 4 juntas:
Tarea: "Prueba unitaria del servicio de inventario en server/tests/unit/inventoryService.test.js"
Tarea: "Prueba unitaria del servicio de refacciones en server/tests/unit/partService.test.js"
Tarea: "Prueba de contrato de refacciones en server/tests/contract/parts.contract.test.js"
Tarea: "Prueba de integración de inventario en server/tests/integration/parts.test.js"

# Validador y modelos juntos:
Tarea: "Crear server/validators/partValidator.js"
Tarea: "Crear server/models/partModel.js e inventoryModel.js"
```

---

## Estrategia de implementación

### Primero el MVP (historial y mantenimientos)

1. Completar la Fase 1: Preparación
2. Completar la Fase 2: Fundamentos (CRÍTICA)
3. Completar la Fase 3: Historia 1 (historial)
4. **DETENERSE Y VALIDAR**: probar el historial de forma independiente
5. Continuar con mantenimientos (US2 y US3) y luego con el inventario (US4 y US5)

### Entrega incremental

1. Preparación + Fundamentos → base lista
2. Historia 1 → probar → demostrar
3. Historias 2 y 3 → probar → demostrar (seguimiento de mantenimientos)
4. Historia 4 → probar → demostrar (inventario)
5. Historia 5 → probar → demostrar (uso de refacciones y flujo completo del sprint)
6. Historia 6 → probar → demostrar (alertas)
7. Pulido y validación final

---

## Notas

- [P] = archivos distintos y sin dependencias pendientes
- La etiqueta [Historia] vincula cada tarea con su historia para la trazabilidad
- Verificar que las pruebas fallen antes de implementar
- Un commit por fase o grupo lógico, en la rama `sdd-speckit`, con Conventional Commits y descripción en español, **sin la línea Co-Authored-By** (decisión del 2026-10-19)
- Las migraciones 001 y 002 no se editan; todo cambio de esquema va en la 003
- Las órdenes y los movimientos de inventario nunca se eliminan
