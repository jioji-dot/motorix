---

description: "Lista de tareas del Sprint 2: citas y órdenes de servicio"
---

# Tareas: Citas y órdenes de servicio (Sprint 2)

**Entrada**: Documentos de diseño en `/specs/002-citas-ordenes-servicio/`

**Requisitos previos**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Pruebas**: Se incluyen porque la constitución (Principio VII) las exige para la lógica de negocio, los permisos y las transiciones de estado (CA-8), con pruebas de integración y contrato contra `motorix_test`. Escribirlas primero y comprobar que fallan antes de implementar.

**Organización**: Las tareas se agrupan por historia de usuario para implementarlas y probarlas de forma independiente.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Historia]**: Historia de usuario a la que pertenece (US1, US2, ...)
- Todas las rutas son relativas a la raíz del repositorio (`C:\sdd\motorix`)

## Convenciones

- Backend en `server/` (ES Modules, sin carpeta `src/`); frontend en `client/lib/` y `client/test/`; SQL en `database/`.
- Comentarios, mensajes al usuario y nombres de pruebas en español; identificadores en inglés (constitución y `CLAUDE.md`).
- Las pruebas de integración y contrato usan SIEMPRE `motorix_test`. Nunca usar `Set-Content`/`Get-Content` sin `-Encoding` para editar archivos con acentos: usar las herramientas de edición.
- Reutilizar lo del Sprint 1: `AppError`, `validate`, `authenticate`/`authorize`, `response.js`, `normalizers.js`, `withTransaction`, `factories.js`, `OwnerPicker`, `AppShell`, `AppDataTable`, `Panel`, `PaginationBar`, `showConfirmDialog`.
- Cada estado se guarda y se expone como texto en mayúsculas: citas `PENDIENTE`, `CONFIRMADA`, `EN_PROCESO`, `COMPLETADA`, `CANCELADA`; órdenes `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION`, `ESPERANDO_REFACCION`, `TERMINADO`, `ENTREGADO`.

## Mapa de historias

| Historia | Título | Prioridad | Fase |
|----------|--------|:---------:|:----:|
| US1 | Registrar y consultar citas | P1 | 3 |
| US3 | Crear una orden para un cliente y un vehículo | P1 | 4 |
| US4 | Asignar la orden a un mecánico | P1 | 5 |
| US5 | Consultar mis órdenes asignadas | P1 | 6 |
| US6 | Registrar diagnóstico y servicios realizados | P1 | 7 |
| US7 | Actualizar el estado de la orden | P1 | 8 |
| US2 | Modificar y cancelar citas | P2 | 9 |
| US8 | Observaciones y recomendaciones | P2 | 10 |
| US9 | Datos de ejemplo del sprint | P3 | 11 |

---

## Fase 1: Preparación

**Propósito**: Constantes y errores compartidos por todo el sprint.

- [X] T001 Agregar a `server/config/constants.js` los estados `APPOINTMENT_STATUS` (`PENDIENTE`, `CONFIRMADA`, `EN_PROCESO`, `COMPLETADA`, `CANCELADA`) y `ORDER_STATUS` (`RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION`, `ESPERANDO_REFACCION`, `TERMINADO`, `ENTREGADO`) con sus listas de valores, y `MAX_APPOINTMENT_DAYS_AHEAD = 365`
- [X] T002 [P] Agregar a `server/utils/AppError.js` las fábricas de `contracts/api.md`: `appointmentDuplicateWarning(matches)` (409 `APPOINTMENT_DUPLICATE_WARNING`, `details.matches`), `appointmentNotEditable()` (409), `appointmentHasOrder()` (409), `appointmentNotAvailable()` (409), `invalidTransition(from, to, allowed)` (409, `details: { from, to, allowed }`), `mechanicRequired()` (409), `orderIncomplete(missing)` (409, `details.missing`) y `orderNotEditable(status)` (409, `details.status`), todas con mensajes en español

---

## Fase 2: Fundamentos (prerrequisitos bloqueantes)

**Propósito**: Esquema, máquina de estados, utilidades y base visual que necesitan todas las historias.

**⚠️ CRÍTICO**: Ninguna historia puede comenzar hasta terminar esta fase.

### Base de datos

- [X] T003 Crear `database/migrations/002_sprint2_appointments_service_orders.sql` (InnoDB, `utf8mb4`, todas las llaves foráneas `ON DELETE RESTRICT`) con las tablas del modelo de datos, citando sus restricciones:
  - `appointments`: `id` INT UNSIGNED PK AUTO_INCREMENT; `client_id` INT UNSIGNED NOT NULL FK → `clients.id`; `vehicle_id` INT UNSIGNED NOT NULL FK → `vehicles.id`; `scheduled_at` DATETIME NOT NULL; `reason` VARCHAR(255) NOT NULL; `notes` VARCHAR(500) NULL; `status` ENUM('PENDIENTE','CONFIRMADA','EN_PROCESO','COMPLETADA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE'; `created_by` INT UNSIGNED NOT NULL FK → `users.id`; `created_at`, `updated_at` DATETIME NOT NULL (este con actualización automática); índices `idx_appointments_scheduled (scheduled_at)`, `idx_appointments_status (status)`, `idx_appointments_client (client_id)`, `idx_appointments_vehicle_day (vehicle_id, scheduled_at)`
  - `service_orders`: `id` INT UNSIGNED PK AUTO_INCREMENT; `folio` VARCHAR(12) NULL UNIQUE; `appointment_id` INT UNSIGNED NULL UNIQUE FK → `appointments.id`; `client_id` INT UNSIGNED NOT NULL FK → `clients.id`; `vehicle_id` INT UNSIGNED NOT NULL FK → `vehicles.id`; `mechanic_id` INT UNSIGNED NULL FK → `users.id`; `entry_mileage` INT UNSIGNED NOT NULL; `reported_problem` VARCHAR(1000) NOT NULL; `diagnosis` TEXT NULL; `notes` TEXT NULL; `recommendations` TEXT NULL; `status` ENUM('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION','TERMINADO','ENTREGADO') NOT NULL DEFAULT 'RECIBIDO'; `created_by` INT UNSIGNED NOT NULL FK → `users.id`; `delivered_at` DATETIME NULL; `created_at`, `updated_at`; índices `idx_orders_mechanic_status (mechanic_id, status)`, `idx_orders_status (status)`, `idx_orders_created (created_at)`
  - `order_services`: `id` PK; `order_id` INT UNSIGNED NOT NULL FK → `service_orders.id` con índice; `description` VARCHAR(255) NOT NULL; `amount` DECIMAL(10,2) NOT NULL con CHECK (`amount` >= 0); `created_at`, `updated_at`
  - `order_labor`: `id` PK; `order_id` FK con índice; `description` VARCHAR(255) NOT NULL; `hours` DECIMAL(6,2) NOT NULL con CHECK (`hours` > 0); `hourly_rate` DECIMAL(10,2) NOT NULL con CHECK (`hourly_rate` >= 0); `amount` DECIMAL(12,2) GENERATED ALWAYS AS (ROUND(`hours` * `hourly_rate`, 2)) STORED; `created_at`, `updated_at`
  - `order_status_history`: `id` PK; `order_id` FK con índice; `from_status` ENUM (los mismos estados de la orden) NULL; `to_status` ENUM (los mismos estados) NOT NULL; `changed_by` INT UNSIGNED NOT NULL FK → `users.id`; `created_at` DATETIME NOT NULL (sin `updated_at`)
- [X] T004 Actualizar `cleanTables` en `server/tests/helpers/testDb.js` para vaciar, en este orden y con las llaves foráneas desactivadas, `order_status_history`, `order_labor`, `order_services`, `service_orders`, `appointments`, `vehicles`, `clients` y `users`
- [X] T005 Ampliar `server/tests/helpers/factories.js` con `createAppointment(clientId, vehicleId, overrides)` (fecha futura por defecto), `createOrder({ clientId, vehicleId, mechanicId, status, ... })` (asigna folio `OS-` + id con 6 dígitos y escribe la primera fila de historial), `createOrderService`, `createOrderLabor` y `createMechanic()`; y una prueba de humo en `server/tests/integration/schemaSprint2.test.js` que verifique que las tablas existen con InnoDB y `utf8mb4`, que el importe de mano de obra se genera con `ROUND(hours * hourly_rate, 2)` y que los `CHECK` rechazan importes negativos, horas 0 y tarifas negativas

### Reglas puras (con pruebas primero)

- [X] T006 [P] Prueba unitaria `server/tests/unit/orderStatus.test.js` con la matriz exhaustiva: los 6 × 6 pares de estado, solo las transiciones `RECIBIDO→DIAGNOSTICO`, `DIAGNOSTICO→EN_REPARACION`, `EN_REPARACION→ESPERANDO_REFACCION`, `ESPERANDO_REFACCION→EN_REPARACION`, `EN_REPARACION→TERMINADO` y `TERMINADO→ENTREGADO` son válidas; ningún retroceso ni salto; quién puede ejecutar cada una (mecánico asignado y administrador hasta `TERMINADO`; recepcionista y administrador `ENTREGADO`; el recepcionista no puede las demás; el mecánico no asignado ninguna); estados donde el diagnóstico, los servicios y la mano de obra son editables (`RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION`, `ESPERANDO_REFACCION`); estados donde observaciones y recomendaciones son editables (todos menos `ENTREGADO`); estados donde se puede reasignar o corregir (todos menos `TERMINADO` y `ENTREGADO`); nombres de pruebas en español
- [X] T007 Implementar `server/utils/orderStatus.js` como módulo puro (sin acceso a base de datos): `canTransition(from, to)`, `allowedTransitions(from)`, `canRoleTransition({ user, order, to })`, `isWorkEditable(status)`, `isNotesEditable(status)`, `isBasicDataEditable(status)`, hasta pasar T006 (depende de T001)
- [X] T008 [P] Prueba unitaria `server/tests/unit/mileageService.test.js` de la regla de kilometraje: entero ≥ 0; menor al registrado sin corrección → `MILEAGE_DECREASE`; con `mileageCorrection: true` se acepta; vehículo en 0 acepta cualquier valor válido; igual o mayor se acepta
- [X] T009 Implementar `server/services/mileageService.js` con `validateEntryMileage({ currentMileage, entryMileage, mileageCorrection })` y refactorizar `server/services/vehicleService.js` para reutilizarla en `updateVehicle` sin cambiar su comportamiento (las pruebas del Sprint 1 deben seguir pasando)
- [X] T010 [P] Prueba unitaria `server/tests/unit/localDateTime.test.js` y utilidad `server/utils/localDateTime.js`: analizar `YYYY-MM-DDTHH:mm` (hora local sin zona), rechazar formatos inválidos, `isFuture`, `isWithinDays(date, 365)`, rango del día (`YYYY-MM-DD 00:00:00` a `23:59:59`) y formato de salida

### Frontend base

- [X] T011 [P] Crear `client/lib/models/order_status.dart` con los enums `OrderStatus` y `AppointmentStatus` (valor de la API, etiqueta en español, color según `docs/design-system.md`: RECIBIDO gris `textSecondary`; DIAGNOSTICO y ESPERANDO_REFACCION `warning`; EN_REPARACION `primary`; TERMINADO y ENTREGADO `success`; Pendiente gris, Confirmada `primary`, En proceso `warning`, Completada `success`, Cancelada `danger`) y `client/lib/widgets/status_chip.dart` que muestra el estado como chip sobrio
- [X] T012 [P] Crear `client/lib/widgets/date_time_field.dart`: campo de fecha y hora con `showDatePicker` y `showTimePicker` de Material, valor `YYYY-MM-DDTHH:mm`, validación de fecha futura y de máximo un año, textos en español
- [X] T013 [P] Ampliar `client/lib/utils/format.dart` (`money(num)` como `$1,234.50`, `dateTime(String)` como `dd/MM/aaaa HH:mm`) y `client/lib/utils/validators.dart` (`amount` ≥ 0 con máximo dos decimales, `hours` > 0 y ≤ 9999,99 con máximo dos decimales, `description` 1–255), con pruebas en `client/test/format_validators_sprint2_test.dart`
- [X] T014 Agregar a `client/lib/app_routes.dart` las rutas `appointments`, `appointmentForm`, `orders`, `orderForm` y `orderDetail`, y a `client/lib/widgets/app_shell.dart` las entradas **Citas** (solo ADMIN y RECEPTIONIST, ícono de calendario de `lucide_icons_flutter`) y **Órdenes** (los tres roles; etiqueta "Mis órdenes" para el mecánico); `AuthGate` en `client/lib/router.dart` abre "Órdenes" para el mecánico y "Clientes" para los demás; actualizar `client/test/app_shell_menu_test.dart` con estos menús por rol

**Punto de control**: `npm run db:migrate` crea las cinco tablas nuevas; las pruebas unitarias de estados, kilometraje y fechas pasan; el menú muestra las entradas nuevas por rol.

---

## Fase 3: Historia de usuario 1 - Registrar y consultar citas (Prioridad: P1) 🎯 MVP

**Objetivo**: Que recepción registre citas válidas y las consulte con filtros.

**Prueba independiente**: Registrar una cita para un cliente y uno de sus vehículos y encontrarla en el listado por fecha, estado y búsqueda.

### Pruebas de la historia 1 ⚠️

- [X] T015 [P] [US1] Prueba de contrato de `GET /api/appointments`, `POST /api/appointments` y `GET /api/appointments/:id` (forma de `Appointment`, `meta`, errores) en `server/tests/contract/appointments.contract.test.js`
- [X] T016 [P] [US1] Prueba de integración en `server/tests/integration/appointments.test.js`: alta válida (estado `PENDIENTE`, `orderId` nulo); `reason` obligatorio de 1–255 y `notes` hasta 500; `scheduledAt` con formato inválido, en el pasado y a más de un año (`400`, campo `scheduledAt`); vehículo que no pertenece al cliente (`400`, campo `vehicleId`); cliente o vehículo inexistentes; aviso `409 APPOINTMENT_DUPLICATE_WARNING` con `matches` para el mismo vehículo el mismo día y alta correcta con `confirmDuplicate: true`, sin contar citas canceladas; listado ordenado por fecha y hora; filtros `date`, `from`/`to`, `status`, `clientId`, `vehicleId` y `search` (cliente o placa); paginación; `403` para MECHANIC en todas las rutas; `401` sin token

### Implementación de la historia 1 (backend)

- [X] T017 [P] [US1] Implementar `server/models/appointmentModel.js` con `insert`, `findById` (con nombre del cliente, placa, título del vehículo y `orderId`), `list` (filtros y paginación), `findSameDayByVehicle(vehicleId, day, excludeId?)`; la fecha se lee con `DATE_FORMAT(scheduled_at, '%Y-%m-%dT%H:%i')` para devolver la hora local de pared
- [X] T018 [P] [US1] Implementar `server/validators/appointmentValidators.js` con `zod`: `clientId` y `vehicleId` enteros positivos obligatorios; `scheduledAt` obligatorio con formato `YYYY-MM-DDTHH:mm`; `reason` obligatorio de 1 a 255 caracteres; `notes` opcional de hasta 500; `confirmDuplicate` booleano opcional; consulta con `date`, `from`, `to`, `status` (valores de `APPOINTMENT_STATUS`), `clientId`, `vehicleId`, `search`, `page`, `pageSize`
- [X] T019 [US1] Implementar `server/services/appointmentService.js` con `createAppointment` (vehículo existente y del cliente; `scheduledAt` futuro y dentro de 365 días con `localDateTime.js`; aviso de coincidencia salvo `confirmDuplicate`; `created_by` = usuario), `listAppointments` y `getAppointment` (`404` si no existe) (depende de T017, T018 y T010)
- [X] T020 [US1] Implementar `server/controllers/appointmentController.js` y `server/routes/appointmentRoutes.js` (`GET /`, `POST /`, `GET /:id`) restringidos con `authorize(ADMIN, RECEPTIONIST)` y montarlos en `server/app.js` como `/api/appointments` (depende de T019)

### Implementación de la historia 1 (frontend)

- [X] T021 [P] [US1] Crear `client/lib/models/appointment.dart` y `client/lib/services/appointments_service.dart` (`list`, `get`, `create` con `confirmDuplicate`)
- [X] T022 [P] [US1] Crear `client/lib/providers/appointments_provider.dart` (listado con filtros de fecha, estado y búsqueda, paginación, detalle y alta; registrarlo en `client/lib/main.dart`)
- [X] T023 [US1] Implementar `client/lib/screens/appointments/appointments_list_screen.dart`: tabla (fecha y hora, cliente, vehículo, motivo, estado con `StatusChip`), filtros de fecha y estado, búsqueda, paginación y estados vacío/cargando/error, con botón "Nueva cita" (depende de T011 y T022)
- [X] T024 [US1] Implementar `client/lib/screens/appointments/appointment_form_screen.dart` en modo alta: selector de cliente (`OwnerPicker`), selector de vehículo del cliente, `DateTimeField`, motivo y observaciones, confirmación cuando hay una cita coincidente, confirmación al salir con cambios sin guardar y mensajes de éxito o error (depende de T012 y T022)
- [X] T025 [US1] Registrar las rutas de citas en `client/lib/router.dart` y mostrar la entrada "Citas" (ya definida en T014)
- [X] T026 [P] [US1] Pruebas de Flutter en `client/test/appointments_provider_test.dart` y `client/test/appointment_form_screen_test.dart` (validaciones, fecha pasada, aviso de coincidencia, mecánico sin acceso a "Citas")

**Punto de control**: US1 funciona por sí sola.

---

## Fase 4: Historia de usuario 3 - Crear una orden para un cliente y un vehículo (Prioridad: P1)

**Objetivo**: Crear órdenes válidas, con folio, kilometraje validado y efecto en el vehículo y en la cita.

**Prueba independiente**: Crear una orden desde cero y otra desde una cita, y comprobar folio, estado `RECIBIDO`, kilometraje del vehículo e historial.

### Pruebas de la historia 3 ⚠️

- [X] T027 [P] [US3] Prueba de contrato de `POST /api/orders` (forma de `Order` con `services`, `labor`, subtotales, `statusHistory`, `allowedTransitions` y `editable`) en `server/tests/contract/orders.contract.test.js`
- [X] T028 [P] [US3] Prueba de integración en `server/tests/integration/orders.test.js`: alta válida (folio `OS-` + 6 dígitos, estado `RECIBIDO`, `current_mileage` del vehículo actualizado, primera fila de historial `NULL → RECIBIDO`); `entryMileage` obligatorio, entero ≥ 0; `reportedProblem` obligatorio de 1 a 1000; vehículo inexistente y vehículo de otro cliente (`400`, `vehicleId`); kilometraje menor al registrado sin corrección (`409 MILEAGE_DECREASE`) y aceptado con `mileageCorrection: true`; vehículo en 0 acepta cualquier valor; alta desde `appointmentId` (precarga cliente, vehículo y motivo; la cita pasa a `EN_PROCESO`); cita cancelada, `EN_PROCESO` o con orden (`409 APPOINTMENT_NOT_AVAILABLE`); dos altas concurrentes de la misma cita (solo una se guarda); folios distintos con altas concurrentes; `403` para MECHANIC; `401` sin token; nada se guarda si falla algún paso (transacción)

### Implementación de la historia 3 (backend)

- [X] T029 [P] [US3] Implementar `server/models/orderModel.js` con `insertOrder`, `setFolio`, `insertHistory`, `findOrderById` (con nombres de cliente, mecánico, placa y título del vehículo), `getLines` (servicios y mano de obra), `getSubtotals` y `getHistory`; los importes se convierten a número
- [X] T030 [P] [US3] Implementar `server/validators/orderValidators.js` con `zod` para el alta: `clientId`, `vehicleId` y `appointmentId` enteros positivos (el cliente y el vehículo son obligatorios salvo que venga `appointmentId`); `entryMileage` entero ≥ 0 obligatorio; `reportedProblem` de 1 a 1000 caracteres (si falta y hay cita, se usa el motivo); `mechanicId` entero positivo opcional; `mileageCorrection` booleano opcional
- [X] T031 [US3] Implementar `server/services/orderService.js` con `createOrder` ejecutado en una sola transacción con `withTransaction`: bloquear la cita con `SELECT ... FOR UPDATE` y validar que esté `PENDIENTE` o `CONFIRMADA` sin orden; validar vehículo y propietario; aplicar `mileageService.validateEntryMileage`; insertar la orden en `RECIBIDO`; asignar el folio `OS-` + id con 6 dígitos; insertar la fila de historial `NULL → RECIBIDO`; actualizar `vehicles.current_mileage`; pasar la cita a `EN_PROCESO`; y `buildOrderDetail(order, user)` que arma la respuesta con `allowedTransitions` y `editable` según `orderStatus.js` (depende de T007, T009, T029 y T030)
- [X] T032 [US3] Implementar `server/controllers/orderController.js` y `server/routes/orderRoutes.js` con `POST /` (ADMIN y RECEPTIONIST) y montar `/api/orders` en `server/app.js` (depende de T031)

### Implementación de la historia 3 (frontend)

- [X] T033 [P] [US3] Crear `client/lib/models/service_order.dart` (orden, resumen, servicio, mano de obra, historial) y `client/lib/services/orders_service.dart` (`create`)
- [X] T034 [P] [US3] Crear `client/lib/providers/orders_provider.dart` (alta, detalle y estados de carga; registrarlo en `client/lib/main.dart`)
- [X] T035 [US3] Implementar `client/lib/screens/orders/order_form_screen.dart` en modo alta: desde cero (selector de cliente, vehículo del cliente, kilometraje de entrada, problema reportado) o desde una cita (argumentos de la ruta con los datos precargados y bloqueados), confirmación de corrección de kilometraje ante `MILEAGE_DECREASE`, confirmación al salir con cambios y mensajes de éxito o error; agregar el botón "Crear orden" en la lista de citas para citas `PENDIENTE` y `CONFIRMADA` (depende de T012, T023 y T034)
- [X] T036 [P] [US3] Pruebas de Flutter en `client/test/order_form_screen_test.dart` (validaciones, precarga desde cita, corrección de kilometraje, ausencia del botón para el mecánico)

**Punto de control**: US1 y US3 funcionan de forma independiente.

---

## Fase 5: Historia de usuario 4 - Asignar la orden a un mecánico (Prioridad: P1)

**Objetivo**: Que recepción asigne y reasigne mecánicos y corrija los datos básicos de la orden.

**Prueba independiente**: Asignar una orden a un mecánico, reasignarla a otro y comprobar las reglas.

### Pruebas de la historia 4 ⚠️

- [X] T037 [P] [US4] Prueba de integración en `server/tests/integration/mechanics.test.js`: `GET /api/mechanics` devuelve solo usuarios activos con rol MECHANIC ordenados por nombre con `id`, `name` y `username`; `403` para MECHANIC; `401` sin token; accesible para ADMIN y RECEPTIONIST
- [X] T038 [P] [US4] Prueba de integración en `server/tests/integration/orderAssignment.test.js`: asignar al crear y con `PATCH /api/orders/:id`; reasignar mientras no sea `TERMINADO` ni `ENTREGADO` (`409 ORDER_NOT_EDITABLE` en otro caso); rechazar usuarios que no son mecánico, inactivos o inexistentes (`400`, campo `mechanicId`); corregir `reportedProblem`; corregir `entryMileage` solo con `mileageCorrection: true` bajo la regla de kilometraje; `403` para MECHANIC; `404` para orden inexistente; una edición vacía responde `400`

### Implementación de la historia 4 (backend)

- [X] T039 [P] [US4] Agregar `listActiveMechanics()` a `server/models/userModel.js` y crear `server/controllers/mechanicController.js` y `server/routes/mechanicRoutes.js` (`GET /api/mechanics`, ADMIN y RECEPTIONIST) montados en `server/app.js`
- [X] T040 [P] [US4] Agregar a `server/validators/orderValidators.js` el esquema de edición básica con `reportedProblem` (1 a 1000), `mechanicId` (entero positivo o `null` solo si la orden está en `RECIBIDO`), `entryMileage` y `mileageCorrection`, todos opcionales y al menos uno presente
- [X] T041 [US4] Agregar `assertAssignableMechanic(id)` y `updateOrderBasics(user, id, datos)` a `server/services/orderService.js` (estados con `orderStatus.isBasicDataEditable`, regla de kilometraje, actualización del kilometraje del vehículo) y usar la validación del mecánico también en `createOrder`; agregar `PATCH /:id` a `server/controllers/orderController.js` y `server/routes/orderRoutes.js` (ADMIN y RECEPTIONIST)

### Implementación de la historia 4 (frontend)

- [X] T042 [P] [US4] Agregar `mechanics()` y `updateBasics()` a `client/lib/services/orders_service.dart` y a `client/lib/providers/orders_provider.dart`
- [X] T043 [US4] Agregar a `client/lib/screens/orders/order_form_screen.dart` el selector de mecánico (opcional al crear) y el modo edición ("Corregir orden": problema reportado, mecánico y kilometraje con corrección explícita) con confirmación obligatoria al reasignar a otro mecánico (depende de T035 y T042)
- [X] T044 [P] [US4] Pruebas de Flutter en `client/test/order_assignment_test.dart` (lista de mecánicos, confirmación de reasignación, orden terminada sin acciones de corrección)

**Punto de control**: US4 funciona de forma independiente.

---

## Fase 6: Historia de usuario 5 - Consultar mis órdenes asignadas (Prioridad: P1)

**Objetivo**: Que el mecánico vea solo sus órdenes y recepción vea todas.

**Prueba independiente**: Entrar como dos mecánicos distintos y como recepcionista y comprobar qué ve cada uno.

### Pruebas de la historia 5 ⚠️

- [X] T045 [P] [US5] Ampliar `server/tests/contract/orders.contract.test.js` con `GET /api/orders` (`OrderSummary`, `meta`) y `GET /api/orders/:id`
- [X] T046 [P] [US5] Prueba de integración en `server/tests/integration/orderVisibility.test.js`: el mecánico solo recibe sus órdenes y nunca las de otro, aunque pase `mechanicId` en la consulta; órdenes abiertas primero para el mecánico; el detalle de una orden ajena y el de una inexistente dan el mismo `404`; filtros `status`, `mechanicId`, `clientId` y `search` (folio, cliente o placa); recepcionista y administrador ven todas; ordenadas con las más recientes primero; paginación; `allowedTransitions` y `editable` del detalle dependen del rol y de la asignación; `401` sin token

### Implementación de la historia 5 (backend)

- [X] T047 [US5] Agregar `listOrders` a `server/models/orderModel.js` (filtros y paginación; ordenar por `id` descendente y, para el mecánico, abiertas primero) y `listOrders(user, filtros)` y `getOrder(user, id)` a `server/services/orderService.js` aplicando la visibilidad por mecánico en el servicio (filtro forzado por `mechanic_id`; orden ajena → `404`) y esquema de consulta en `server/validators/orderValidators.js`; agregar `GET /` y `GET /:id` a `server/controllers/orderController.js` y `server/routes/orderRoutes.js` (todos los roles autenticados) (depende de T031)

### Implementación de la historia 5 (frontend)

- [X] T048 [P] [US5] Agregar `list()` y `get()` a `client/lib/services/orders_service.dart` y listado/detalle con filtros a `client/lib/providers/orders_provider.dart`
- [X] T049 [US5] Implementar `client/lib/screens/orders/orders_list_screen.dart`: título "Mis órdenes" para el mecánico y "Órdenes" para los demás; tabla con folio, vehículo, cliente, mecánico, problema, estado y total; filtros por estado (y por mecánico para recepción/administrador), búsqueda y paginación; mensaje claro cuando el mecánico no tiene órdenes; botón "Nueva orden" solo para ADMIN y RECEPTIONIST (depende de T011 y T048)
- [X] T050 [US5] Implementar `client/lib/screens/orders/order_detail_screen.dart` en modo lectura: datos generales, problema reportado, diagnóstico, servicios, mano de obra con subtotales y total, observaciones, recomendaciones e historial de estados; acciones según `editable` y `allowedTransitions` del servidor; registrar las rutas de órdenes en `client/lib/router.dart`
- [X] T051 [P] [US5] Pruebas de Flutter en `client/test/orders_list_screen_test.dart` y `client/test/order_detail_screen_test.dart` (título por rol, estado vacío del mecánico, detalle completo y su historial)

**Punto de control**: US5 funciona de forma independiente.

---

## Fase 7: Historia de usuario 6 - Registrar diagnóstico y servicios realizados (Prioridad: P1)

**Objetivo**: Que el mecánico asignado documente el trabajo con importes y totales.

**Prueba independiente**: Como mecánico asignado, escribir el diagnóstico, agregar dos servicios y una línea de mano de obra y ver los totales.

### Pruebas de la historia 6 ⚠️

- [X] T052 [P] [US6] Prueba de contrato de `PATCH /api/orders/:id/work`, de los endpoints de servicios y de mano de obra (respuesta `Order` con subtotales) en `server/tests/contract/orderWork.contract.test.js`
- [X] T053 [P] [US6] Prueba de integración en `server/tests/integration/orderWork.test.js`: diagnóstico editable en `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION` y `ESPERANDO_REFACCION` y rechazado (`409 ORDER_NOT_EDITABLE`) en `TERMINADO` y `ENTREGADO`; servicio con `description` de 1 a 255 y `amount` ≥ 0 con dos decimales como máximo; mano de obra con `hours` > 0 (máximo 9999,99), `hourlyRate` ≥ 0 e importe `ROUND(hours * hourly_rate, 2)`; valores negativos, cero en horas y no numéricos rechazados; `servicesSubtotal`, `laborSubtotal` y `total` correctos; editar y quitar líneas mientras sea editable; no permitido en `TERMINADO`/`ENTREGADO`; el administrador y el mecánico asignado pueden; el recepcionista recibe `403`; un mecánico ajeno recibe `404`; `401` sin token

### Implementación de la historia 6 (backend)

- [X] T054 [P] [US6] Agregar a `server/models/orderModel.js` las operaciones de líneas: `insertService`, `updateService`, `deleteService`, `insertLabor`, `updateLabor`, `deleteLabor` (siempre filtrando por `order_id`) y `updateWork` (diagnóstico, observaciones, recomendaciones)
- [X] T055 [P] [US6] Agregar a `server/validators/orderValidators.js`: trabajo (`diagnosis` hasta 5000 caracteres; `notes` y `recommendations` hasta 5000, cada uno opcional y vacío = null; al menos uno presente), servicio (`description` de 1 a 255 caracteres obligatoria; `amount` número ≥ 0 con máximo dos decimales obligatorio) y mano de obra (`description` de 1 a 255; `hours` número > 0 y ≤ 9999,99 con máximo dos decimales; `hourlyRate` número ≥ 0 con máximo dos decimales), y los parámetros `serviceId`/`laborId`
- [X] T056 [US6] Implementar `server/services/orderWorkService.js` con `updateWork`, `addService`, `updateService`, `removeService`, `addLabor`, `updateLabor`, `removeLabor`: comprobar que el usuario es administrador o el mecánico asignado (un mecánico ajeno recibe `404`, el recepcionista `403`), el estado con `orderStatus.isWorkEditable`, y devolver `buildOrderDetail` con totales recalculados (depende de T054, T055 y T047)
- [X] T057 [US6] Agregar `server/controllers/orderWorkController.js` y las rutas `PATCH /:id/work`, `POST|PATCH|DELETE /:id/services[/:serviceId]` y `POST|PATCH|DELETE /:id/labor[/:laborId]` en `server/routes/orderRoutes.js`

### Implementación de la historia 6 (frontend)

- [X] T058 [P] [US6] Agregar a `client/lib/services/orders_service.dart` y `client/lib/providers/orders_provider.dart` las operaciones de trabajo (`updateWork`, `addService`, `updateService`, `removeService`, `addLabor`, `updateLabor`, `removeLabor`)
- [X] T059 [P] [US6] Crear `client/lib/widgets/order_lines_table.dart`: tabla de servicios o de mano de obra con importe, subtotal, acciones de editar y quitar (con confirmación) y diálogo de alta/edición validado
- [X] T060 [US6] Completar `client/lib/screens/orders/order_detail_screen.dart` con la edición del diagnóstico y las secciones de servicios y mano de obra, visibles como editables solo cuando `editable.work` es verdadero (depende de T050, T058 y T059)
- [X] T061 [P] [US6] Pruebas de Flutter en `client/test/order_work_test.dart` (validación de importes y horas, totales, secciones de solo lectura para recepción y en órdenes terminadas)

**Punto de control**: US6 funciona de forma independiente.

---

## Fase 8: Historia de usuario 7 - Actualizar el estado de la orden (Prioridad: P1)

**Objetivo**: Llevar la orden por su secuencia con permisos, requisitos, historial y efecto en la cita.

**Prueba independiente**: Llevar una orden de `RECIBIDO` a `ENTREGADO` y comprobar que cada paso inválido se rechaza.

### Pruebas de la historia 7 ⚠️

- [X] T062 [P] [US7] Prueba de contrato de `POST /api/orders/:id/status` (respuesta `Order`, errores `INVALID_TRANSITION`, `MECHANIC_REQUIRED`, `ORDER_INCOMPLETE`) en `server/tests/contract/orderStatus.contract.test.js`
- [X] T063 [P] [US7] Prueba de integración en `server/tests/integration/orderStatus.test.js`: flujo completo `RECIBIDO → DIAGNOSTICO → EN_REPARACION → ESPERANDO_REFACCION → EN_REPARACION → TERMINADO → ENTREGADO` con una fila de historial por cambio (estado anterior, nuevo, usuario y hora); cada salto o retroceso rechazado con `409 INVALID_TRANSITION` y `details.allowed`; `MECHANIC_REQUIRED` sin mecánico; `ORDER_INCOMPLETE` sin diagnóstico o sin servicios ni mano de obra (con `details.missing`); el mecánico asignado no puede marcar `ENTREGADO`; el recepcionista no puede los demás cambios y sí `ENTREGADO`; mecánico ajeno `404`; `ENTREGADO` fija `deliveredAt`, deja la orden inmodificable (ningún cambio de datos, líneas ni notas) y pasa la cita vinculada a `COMPLETADA`; dos cambios simultáneos de la misma orden (solo uno aplica, el otro `409`); `401` sin token

### Implementación de la historia 7

- [X] T064 [US7] Agregar `changeStatus(user, id, to)` a `server/services/orderService.js`: validar visibilidad y `orderStatus.canTransition`/`canRoleTransition`; exigir mecánico asignado fuera de `RECIBIDO` y los requisitos de `TERMINADO`; en una transacción ejecutar `UPDATE service_orders SET status = ? WHERE id = ? AND status = ?` (si no afecta filas, `409 INVALID_TRANSITION` con los estados válidos actuales), insertar el historial, fijar `delivered_at` al entregar y pasar la cita a `COMPLETADA`; agregar `POST /:id/status` con esquema `{ status }` en `server/validators/orderValidators.js`, `server/controllers/orderController.js` y `server/routes/orderRoutes.js` (depende de T007 y T047)
- [X] T065 [P] [US7] Agregar `changeStatus()` a `client/lib/services/orders_service.dart` y `client/lib/providers/orders_provider.dart`
- [X] T066 [US7] Agregar a `client/lib/screens/orders/order_detail_screen.dart` los botones de avance según `allowedTransitions` con textos claros (por ejemplo "Pasar a diagnóstico", "Esperando refacción", "Marcar como terminado", "Marcar como entregado"), confirmación obligatoria al marcar `ENTREGADO`, mensajes de `INVALID_TRANSITION`, `MECHANIC_REQUIRED` y `ORDER_INCOMPLETE` en español y recarga del historial (depende de T060 y T065)
- [X] T067 [P] [US7] Pruebas de Flutter en `client/test/order_status_actions_test.dart` (botones según el rol y el estado, confirmación de entrega, mensajes de error)

**Punto de control**: el flujo demostrable (cita → orden → asignación → diagnóstico → servicios → estados → entregada) funciona de extremo a extremo.

---

## Fase 9: Historia de usuario 2 - Modificar y cancelar citas (Prioridad: P2)

**Objetivo**: Reprogramar, confirmar y cancelar citas conservando el historial.

**Prueba independiente**: Reprogramar una cita pendiente, confirmarla y cancelar otra sin orden.

### Pruebas de la historia 2 ⚠️

- [X] T068 [P] [US2] Ampliar `server/tests/contract/appointments.contract.test.js` con `PATCH /api/appointments/:id`, `POST /:id/confirm` y `POST /:id/cancel`
- [X] T069 [P] [US2] Ampliar `server/tests/integration/appointments.test.js`: modificar fecha, hora, motivo y observaciones de `PENDIENTE` y `CONFIRMADA` con las mismas validaciones del alta (fecha futura y dentro de un año); no se acepta `clientId` ni `vehicleId` (`400`); confirmar `PENDIENTE → CONFIRMADA`; cancelar `PENDIENTE` y `CONFIRMADA` sin orden y conservar la cita; cancelar con orden (`409 APPOINTMENT_HAS_ORDER`); modificar o confirmar `EN_PROCESO`, `COMPLETADA` o `CANCELADA` (`409 APPOINTMENT_NOT_EDITABLE`); no existe borrado; `403` para MECHANIC

### Implementación de la historia 2

- [X] T070 [US2] Agregar `updateAppointment`, `confirmAppointment` y `cancelAppointment` a `server/services/appointmentService.js`, `update` y `setStatus` condicionado al estado anterior a `server/models/appointmentModel.js`, el esquema de edición (`scheduledAt`, `reason`, `notes`, al menos uno, sin `clientId` ni `vehicleId`) a `server/validators/appointmentValidators.js`, y las rutas `PATCH /:id`, `POST /:id/confirm` y `POST /:id/cancel` a `server/controllers/appointmentController.js` y `server/routes/appointmentRoutes.js`
- [X] T071 [P] [US2] Agregar `update`, `confirm` y `cancel` a `client/lib/services/appointments_service.dart` y `client/lib/providers/appointments_provider.dart`
- [X] T072 [US2] Agregar el modo edición a `client/lib/screens/appointments/appointment_form_screen.dart` y las acciones "Confirmar" y "Cancelar cita" (esta con confirmación obligatoria) a `client/lib/screens/appointments/appointments_list_screen.dart`, ocultas cuando la cita no es modificable o ya tiene orden (depende de T071)
- [X] T073 [P] [US2] Pruebas de Flutter en `client/test/appointment_actions_test.dart` (confirmación al cancelar, acciones ocultas por estado, edición)

**Punto de control**: US2 funciona de forma independiente.

---

## Fase 10: Historia de usuario 8 - Observaciones y recomendaciones (Prioridad: P2)

**Objetivo**: Dejar constancia del estado del vehículo y de lo recomendado, también después de terminar el trabajo.

**Prueba independiente**: Escribir observaciones y recomendaciones en una orden `TERMINADO` y comprobar que una `ENTREGADO` las rechaza.

### Pruebas de la historia 8 ⚠️

- [X] T074 [P] [US8] Ampliar `server/tests/integration/orderWork.test.js`: `notes` y `recommendations` editables en todos los estados menos `ENTREGADO`, incluido `TERMINADO` sin alterar diagnóstico ni importes; en `TERMINADO` el diagnóstico sigue rechazado; en `ENTREGADO` cualquier cambio da `409 ORDER_NOT_EDITABLE`; solo administrador y mecánico asignado; límite de 5000 caracteres; vaciar el campo lo deja en `null`

### Implementación de la historia 8

- [X] T075 [US8] Ajustar `updateWork` en `server/services/orderWorkService.js` para validar por campo (`diagnosis` con `isWorkEditable`; `notes` y `recommendations` con `isNotesEditable`) en lugar de por petición completa
- [X] T076 [US8] Mostrar y editar observaciones y recomendaciones en `client/lib/screens/orders/order_detail_screen.dart` según `editable.notesAndRecommendations`, y agregar sus pruebas en `client/test/order_work_test.dart` (editables en una orden terminada, de solo lectura en una entregada)

**Punto de control**: US8 funciona de forma independiente.

---

## Fase 11: Historia de usuario 9 - Datos de ejemplo del sprint (Prioridad: P3)

**Objetivo**: Que tras instalar existan citas y órdenes de ejemplo en todos los estados, sin duplicarse al recargar.

**Prueba independiente**: Recrear la base, cargar los seeds, entrar con cada rol y ver su información.

### Pruebas de la historia 9 ⚠️

- [X] T077 [P] [US9] Prueba de integración en `server/tests/integration/sprint2Seeds.test.js`: tras `runSeeds` existen 6 citas (dos `PENDIENTE`, una `CONFIRMADA`, una `EN_PROCESO`, una `COMPLETADA`, una `CANCELADA`) y 7 órdenes con los seis estados presentes, varias asignadas al usuario `mecanico` y al menos una sin mecánico; todas las órdenes tienen folio único y historial coherente con su estado; las `TERMINADO` y `ENTREGADO` tienen diagnóstico y al menos un servicio o mano de obra; el mecánico de ejemplo ve solo sus órdenes por la API; una segunda y tercera carga dejan las mismas cantidades (citas, órdenes, líneas e historial)

### Implementación de la historia 9

- [X] T078 [US9] Crear `database/seeds/002_sample_appointments_orders.sql` idempotente (con `SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci`) sobre los clientes y vehículos del Sprint 1: citas con fechas relativas a `NOW()` insertadas solo si no existe otra del mismo cliente, vehículo y motivo; órdenes insertadas solo si no existe otra del mismo vehículo y problema reportado, en los seis estados y asignadas al usuario `mecanico` por su `username`; folios completados con `UPDATE service_orders SET folio = CONCAT('OS-', LPAD(id, 6, '0')) WHERE folio IS NULL`; servicios y mano de obra por (orden, descripción); historial por (orden, estado nuevo); y el kilometraje de los vehículos coherente con las órdenes (depende de T003)
- [X] T079 [US9] Verificar con `npm run db:reset` y `npm run db:seed` (dos veces) que `server/scripts/seed.js` ejecuta el nuevo archivo sin cambios y que las cantidades no varían; actualizar el resumen que imprime el script con las citas y órdenes
- [X] T080 [P] [US9] Actualizar `database/README.md` con las tablas y los datos de ejemplo del Sprint 2

**Punto de control**: US9 funciona; la demostración arranca con datos desde cero.

---

## Fase 12: Pulido y aspectos transversales

**Propósito**: Cierre del sprint.

- [X] T081 [P] Prueba de rendimiento `server/tests/integration/listPerformance.test.js`: con 1 000 órdenes y 1 000 citas insertadas en bloque, los listados (con y sin filtros, y el del mecánico) responden en menos de 2 segundos (SC-009)
- [X] T082 [P] Fusionar `specs/002-citas-ordenes-servicio/contracts/api.md` en `docs/api.md` y mantener ambos sincronizados; actualizar `README.md` con el flujo del Sprint 2
- [X] T083 Revisión de seguridad con `Grep`: sin `require(`/`module.exports` en `server/`; ninguna ruta de citas u órdenes sin `authenticate`; ninguna ruta de eliminación de órdenes o citas; el mecánico nunca recibe órdenes ajenas ni citas; sin secretos en el repositorio; las respuestas no incluyen trazas (SC-005, SC-006)
- [X] T084 Revisión de interfaz contra la lista de "terminado" de `docs/design-system.md` (sección 11) para cada pantalla nueva: solo tokens, sidebar expandido y colapsado, estados vacío/cargando/error, transiciones suaves, confirmaciones obligatorias (cancelar cita, reasignar, entregar, salir sin guardar), colores de estado correctos y ventana angosta sin desbordes
- [X] T085 Ejecutar `npm test` en `server/` y `flutter test` y `flutter analyze` en `client/` hasta que todo pase; confirmar que las pruebas del Sprint 1 siguen pasando
- [X] T086 Recorrer `specs/002-citas-ordenes-servicio/quickstart.md` completo sobre una base recreada con `npm run db:reset`, incluido el flujo de los 16 pasos contra la API real, y registrar cualquier diferencia
- [ ] T087 Actualizar `docs/project-context.md` con los estados de cita en español, el folio `OS-` y la tabla `order_status_history` solo si el equipo aprueba estas decisiones (ver "Decisiones que requieren confirmación" en plan.md)

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias.
- **Fundamentos (Fase 2)**: depende de la Fase 1 y BLOQUEA todas las historias.
- **Historias (Fases 3 a 11)**: dependen de la Fase 2.
- **Pulido (Fase 12)**: depende de las historias que se vayan a entregar.

### Dependencias entre historias

- **US1 (P1)**: tras la Fase 2; no depende de otras historias.
- **US3 (P1)**: tras la Fase 2; crear una orden desde cero no depende de US1, y desde una cita usa el estado y los datos de las citas de US1 (T035 depende de T023).
- **US4 (P1)**: tras US3 (modifica la orden creada y su formulario).
- **US5 (P1)**: tras US3 (lista y detalle de órdenes existentes); sus pruebas se apoyan en las fábricas de la Fase 2.
- **US6 (P1)**: tras US5 (el detalle de la orden y la visibilidad por mecánico).
- **US7 (P1)**: tras US5 y, para probar `TERMINADO`, tras US6 (diagnóstico y líneas).
- **US2 (P2)**: tras US1 (amplía las citas); la regla de "cita con orden" se prueba con US3.
- **US8 (P2)**: tras US6 (comparte `orderWorkService`).
- **US9 (P3)**: tras la Fase 2; su valor se ve al terminar US1 a US7.

### Dentro de cada historia

- Las pruebas se escriben primero y deben fallar antes de implementar.
- Modelos y validadores → servicios → controladores y rutas → frontend.
- Cada historia debe cumplir su punto de control antes de pasar a la siguiente prioridad.

### Oportunidades de paralelismo

- Fase 1: T001 y T002 (T002 no depende de T001).
- Fase 2: T006, T008 y T010 (pruebas puras) y T011 a T013 (frontend base) en paralelo; T007 y T009 tras sus pruebas.
- Dentro de cada historia: las pruebas [P], los modelos y validadores [P] y las tareas de frontend [P] mientras avanza el backend.
- Con varias personas, tras la Fase 2: una persona en US1 y US2 (citas), otra en US3 a US5 (órdenes) y otra en US6 a US8 una vez exista el detalle de la orden.

---

## Ejemplo de paralelismo: Historia 1

```bash
# Pruebas de la historia 1 (a la vez):
Tarea: "Contrato de citas en server/tests/contract/appointments.contract.test.js"
Tarea: "Integración de citas en server/tests/integration/appointments.test.js"

# Modelo y validadores (a la vez):
Tarea: "appointmentModel en server/models/appointmentModel.js"
Tarea: "appointmentValidators en server/validators/appointmentValidators.js"

# Frontend (a la vez):
Tarea: "appointment.dart y appointments_service.dart"
Tarea: "appointments_provider.dart"
```

---

## Estrategia de implementación

### Primero el MVP del sprint

1. Completar las Fases 1 y 2.
2. Completar la Fase 3 (US1): citas.
3. Completar las Fases 4 a 6 (US3, US4, US5): órdenes creadas, asignadas y consultables.
4. **DETENERSE y VALIDAR** con los pasos 1 a 9 del quickstart.

### Entrega incremental

1. Preparación + Fundamentos → base lista.
2. US1 → validar (citas).
3. US3 → US4 → US5 → validar (órdenes y visibilidad por rol).
4. US6 → US7 → validar el flujo completo hasta la entrega.
5. US2 y US8 → mejoras de citas y notas.
6. US9 → datos de ejemplo; Pulido y recorrido del quickstart.

---

## Notas

- [P] = archivos distintos y sin dependencias pendientes.
- La etiqueta [Historia] asocia cada tarea con su historia para dar trazabilidad.
- Comprobar que las pruebas fallan antes de implementar.
- Hacer commit tras cada tarea o grupo lógico, con el formato `tipo(alcance): descripción en español` de `CLAUDE.md`.
- No trabajar sobre `main`; la rama de la funcionalidad es `002-citas-ordenes-servicio`.
- La migración `001` no se modifica (el ejecutor lo detecta por su checksum): todo cambio de esquema va en `002`.
- Evitar tareas vagas, conflictos en un mismo archivo y dependencias entre historias que rompan su independencia.
