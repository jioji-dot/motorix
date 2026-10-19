---

description: "Lista de tareas para implementar el Sprint 2: citas y órdenes de servicio"
---

# Tareas: Citas y órdenes de servicio

**Entrada**: Documentos de diseño en `specs/002-citas-ordenes-servicio/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md. Sprint 1 completado.

**Pruebas**: Se incluyen porque la constitución (principio VII) exige pruebas para la lógica de negocio y los permisos, y el criterio CA-8 pide pruebas de las transiciones de estado. Backend: Jest y Jest + supertest contra la base `*_test`. Frontend: `flutter test`. Las pruebas de cada historia se escriben primero y DEBEN fallar antes de implementar.

**Organización**: Las tareas se agrupan por historia de usuario para implementarlas y probarlas de forma independiente.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US1]–[US5]**: Historia de usuario (US1 citas, US2 crear orden, US3 mis órdenes, US4 documentar el trabajo, US5 estados de la orden)
- Todas las rutas son relativas a la raíz del repositorio

## Convenciones de rutas

- Backend: `server/` (ES Modules, sin carpeta `src/`); pruebas en `server/tests/{unit,integration,contract}/`
- Frontend: `client/lib/` y `client/test/`
- Base de datos: `database/`

---

## Fase 1: Preparación

**Propósito**: Confirmar la base del Sprint 1 antes de extenderla

- [X] T001 Verificar que el Sprint 1 sigue en verde ejecutando `npm test` en `server/` y `flutter test` en `client/`, y que `git status` está limpio en la rama `sdd-speckit`
- [X] T002 [P] Confirmar que `.env` (ignorado por Git) apunta a las bases `motorix_sdd` y `motorix_sdd_test` y que la migración 001 está aplicada en ambas con `database/scripts/aplicar-migraciones.ps1`

---

## Fase 2: Fundamentos (prerrequisitos bloqueantes)

**Propósito**: Esquema y herramientas compartidas que DEBEN existir antes de cualquier historia

**⚠️ CRÍTICO**: Ninguna historia puede empezar hasta completar esta fase

- [X] T003 Escribir la migración `database/migrations/002_sprint2_appointments_orders.sql` exactamente según `data-model.md`: `appointments.clientId` y `vehicleId` INT UNSIGNED NOT NULL con llave foránea sin cascada; `appointments.scheduledAt` DATETIME NOT NULL con índice; `appointments.reason` VARCHAR(255) NOT NULL; `appointments.notes` TEXT NULL; `appointments.status` ENUM('PENDIENTE','CONFIRMADA','EN_PROCESO','COMPLETADA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE' con índice; `appointments.createdBy` FK a `users.id`; `service_orders.folio` VARCHAR(20) NULL UNIQUE; `service_orders.appointmentId` INT UNSIGNED NULL FK con índice; `service_orders.mechanicId` INT UNSIGNED NOT NULL FK con índice; `service_orders.entryMileage` INT UNSIGNED NOT NULL; `service_orders.reportedProblem` TEXT NOT NULL; `service_orders.diagnosis`, `notes` y `recommendations` TEXT NULL; `service_orders.status` ENUM('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION','TERMINADO','ENTREGADO','CANCELADA') NOT NULL DEFAULT 'RECIBIDO' con índice; `service_orders.cancellationReason` VARCHAR(255) NULL; `service_orders.total` DECIMAL(10,2) NOT NULL DEFAULT 0.00; `service_orders.deliveredAt` DATETIME NULL; `order_services.amount` DECIMAL(10,2) NOT NULL con CHECK (`amount` >= 0); `order_labor.hours` DECIMAL(5,2) NOT NULL con CHECK (`hours` > 0); `order_labor.hourlyRate` DECIMAL(10,2) NOT NULL con CHECK (`hourlyRate` >= 0); `order_labor.amount` columna generada almacenada `ROUND(hours * hourlyRate, 2)`; `order_status_history.fromStatus` VARCHAR(20) NULL y `toStatus` VARCHAR(20) NOT NULL; todas con `createdAt` y `updatedAt` donde indica el modelo y sin ninguna llave foránea en cascada
- [X] T004 Aplicar la migración 002 a `motorix_sdd` y a `motorix_sdd_test` con `database/scripts/aplicar-migraciones.ps1`, verificar que la 001 aparece como "Ya aplicada" y que repetir el comando no vuelve a ejecutar la 002
- [X] T005 [P] Ampliar `server/tests/helpers.js`: `limpiarBase` vacía también las tablas nuevas en orden seguro (`order_status_history`, `order_labor`, `order_services`, `service_orders`, `appointments`, antes de `vehicles`, `clients`, `users`); `crearUsuariosDePrueba` agrega un segundo mecánico (`MECHANIC2`); y se añaden ayudantes para crear un cliente con vehículo y una cita o una orden de prueba
- [X] T006 [P] Agregar a `server/validators/commonValidator.js` esquemas reutilizables: importe monetario (`amount` entre 0 y 99,999,999.99 con dos decimales, como cadena o número), fecha `YYYY-MM-DD` y fecha-hora local `YYYY-MM-DDTHH:mm`, con mensajes en español
- [X] T007 [P] Agregar las constantes de dominio de estados de cita y de orden en `server/utils/constants.js` (los valores exactos del modelo de datos) para no repetirlos como texto en servicios y validadores
- [X] T008 [P] Crear `client/lib/widgets/status_chip.dart` (ampliar el existente) con los colores de estado de `docs/design-system.md` sección 5 para estados de cita y de orden (Pendiente/Recibido gris; Diagnóstico y Esperando refacción `warning`; En reparación `primary`; Terminado, Completada y Entregado `success`; Cancelada `danger`), con etiquetas en español
- [X] T009 [P] Ampliar `client/test/helpers/fake_api.dart` con el API simulado de citas, órdenes y mecánicos (`citaJson`, `ordenJson`, listados, alta, cambio de estado y errores 409), reutilizable en las pruebas de widgets
- [X] T010 Generalizar `client/lib/screens/home_screen.dart` para registrar las secciones **Citas** (ADMIN y RECEPTIONIST) y **Órdenes de servicio** (los tres roles) con sus íconos, sin construirlas todavía

**Punto de control**: Esquema y herramientas listos; las historias pueden comenzar

---

## Fase 3: Historia de usuario 1 - Registrar y gestionar citas (Prioridad: P1) 🎯 MVP

**Objetivo**: Agendar, consultar, confirmar, modificar y cancelar citas.

**Prueba independiente**: Como `recepcion`, agendar una cita futura, encontrarla en la agenda con filtros, confirmarla, cambiar su hora y cancelarla (escenarios 1 a 4 de `quickstart.md`).

### Pruebas de la historia 1 ⚠️ (escribir primero; deben fallar)

- [X] T011 [P] [US1] Prueba unitaria del validador y del servicio de citas: `reason` "obligatorio, 1 a 255 caracteres"; `notes` "hasta 2000 caracteres"; `scheduledAt` en formato local y no pasado; el vehículo debe pertenecer al cliente; cliente desactivado rechazado; aviso de duplicado (mismo vehículo, misma fecha y hora, estado PENDIENTE, CONFIRMADA o EN_PROCESO); confirmar solo desde PENDIENTE; cancelar solo PENDIENTE o CONFIRMADA sin orden activa (409 `APPOINTMENT_HAS_ORDER`); editar solo PENDIENTE o CONFIRMADA (409 `APPOINTMENT_NOT_EDITABLE`), en `server/tests/unit/appointmentService.test.js`
- [X] T012 [P] [US1] Prueba de contrato de `GET /appointments`, `GET /appointments/:id`, `POST /appointments`, `PATCH /appointments/:id`, `POST /appointments/:id/confirm` y `POST /appointments/:id/cancel` (formas de éxito y de error, 409 `DUPLICATE_APPOINTMENT`) en `server/tests/contract/appointments.contract.test.js`
- [X] T013 [P] [US1] Prueba de integración de citas: ADMIN y RECEPTIONIST gestionan; MECHANIC recibe 403 en todas las rutas; filtros por fecha, estado y búsqueda; el aviso de duplicado se acepta con `confirmDuplicate: true`; la cancelación conserva la cita como historial, en `server/tests/integration/appointments.test.js`
- [X] T014 [P] [US1] Prueba de provider y de widgets de la agenda, el formulario y el detalle de la cita (estados vacío, cargando y error; confirmación al cancelar; aviso de duplicado) en `client/test/screens/appointments_screen_test.dart`

### Implementación de la historia 1

- [X] T015 [P] [US1] Crear `server/validators/appointmentValidator.js` con los esquemas de alta, edición y consulta (filtros `from`, `to`, `status`, `clientId`, `vehicleId`, `search`, paginación)
- [X] T016 [P] [US1] Crear `server/models/appointmentModel.js` con listado (filtros y datos de cliente y vehículo), detalle con `orderId` de la orden activa, alta, edición, cambio de estado y búsqueda de duplicados
- [X] T017 [US1] Implementar `server/services/appointmentService.js` con todas las reglas de la prueba unitaria (vehículo del cliente, fecha no pasada, duplicado con `confirmDuplicate`, confirmar, editar y cancelar según estado y orden activa)
- [X] T018 [US1] Implementar `server/controllers/appointmentController.js` y `server/routes/appointmentRoutes.js` restringidas a ADMIN y RECEPTIONIST, y registrarlas en `server/app.js` bajo `/api/appointments`
- [X] T019 [P] [US1] Crear `client/lib/models/appointment.dart` y `client/lib/providers/appointments_provider.dart` (listado con filtros, alta, edición, confirmar y cancelar; se vacía al cerrar sesión)
- [X] T020 [US1] Crear `client/lib/screens/appointments_screen.dart`: agenda con filtros por rango de fechas y estado, búsqueda, chips de estado y acciones, siguiendo `docs/design-system.md`
- [X] T021 [US1] Crear `client/lib/screens/appointment_form_screen.dart` (selector de cliente, vehículo del cliente, fecha y hora, motivo y observaciones; aviso de duplicado con confirmación; confirmación al salir con cambios) y `client/lib/screens/appointment_detail_screen.dart` (datos, acciones Confirmar, Editar y Cancelar con confirmación según el estado)
- [X] T022 [US1] Registrar `AppointmentsProvider` en `client/lib/main.dart` y la sección **Citas** en la barra lateral para ADMIN y RECEPTIONIST
- [X] T023 [US1] Crear `database/seeds/003_appointments.sql` con al menos 6 citas de ejemplo, una por estado (PENDIENTE, CONFIRMADA, EN_PROCESO, COMPLETADA, CANCELADA) y varias próximas, con fechas relativas a `CURDATE()` y de forma idempotente (`NOT EXISTS` por vehículo, fecha y motivo)

**Punto de control**: La agenda de citas funciona de extremo a extremo y de forma independiente

---

## Fase 4: Historia de usuario 2 - Crear una orden de servicio (Prioridad: P1)

**Objetivo**: Crear órdenes asociadas a cliente, vehículo y mecánico, con kilometraje de entrada, también a partir de una cita confirmada.

**Prueba independiente**: Como `recepcion`, crear una orden desde una cita confirmada y otra directa; verificar folio, estado RECIBIDO, kilometraje del vehículo actualizado y cita en EN_PROCESO (escenarios 5 a 8 de `quickstart.md`).

### Pruebas de la historia 2 ⚠️

- [X] T024 [P] [US2] Prueba unitaria del validador y del servicio de alta de órdenes: `entryMileage` "entero entre 0 y 1,500,000"; 409 `MILEAGE_DECREASE` salvo `mileageCorrection: true`; con 0 km previos se acepta cualquier valor del rango; `mechanicId` obligatorio, activo y con rol MECHANIC; vehículo del cliente; `reportedProblem` "obligatorio, 1 a 2000 caracteres"; con `appointmentId` la cita debe estar CONFIRMADA y coincidir, y el motivo se toma de ella; una sola orden activa por cita; el kilometraje del vehículo se actualiza; el primer registro del historial se crea, en `server/tests/unit/orderCreation.test.js`
- [X] T025 [P] [US2] Prueba de contrato de `POST /orders` y `GET /mechanics` (forma de la orden creada con folio `OS-` más seis dígitos, errores 400, 404 y 409) en `server/tests/contract/orders.create.contract.test.js`
- [X] T026 [P] [US2] Prueba de integración de alta de órdenes: RECEPTIONIST y ADMIN crean, MECHANIC recibe 403; creación directa y desde cita (la cita pasa a EN_PROCESO); kilometraje menor, fuera de rango y con corrección; mecánico inactivo o ajeno al rol; una cita con orden activa no admite otra; el folio es único y legible, en `server/tests/integration/orders.create.test.js`
- [X] T027 [P] [US2] Prueba de provider y de widgets del formulario de orden (campos obligatorios, kilometraje, corrección de kilometraje con confirmación, prellenado desde una cita) en `client/test/screens/order_form_screen_test.dart`

### Implementación de la historia 2

- [X] T028 [P] [US2] Crear `server/validators/orderValidator.js` con el esquema de alta de órdenes con los límites del modelo de datos
- [X] T029 [P] [US2] Crear `server/models/orderModel.js` con alta transaccional (inserción, asignación del folio `OS-` más el `id` con ceros, historial inicial), detalle con cliente, vehículo, mecánico, líneas, historial y `total`, y búsqueda de la orden activa de una cita
- [X] T030 [US2] Implementar `server/services/orderService.js` (función de alta): validaciones de cliente, vehículo, mecánico, cita y kilometraje; actualización de `vehicles.currentMileage` y de la cita a EN_PROCESO en una sola transacción
- [X] T031 [P] [US2] Implementar `GET /api/mechanics` en `server/controllers/mechanicController.js` y `server/routes/mechanicRoutes.js` para ADMIN y RECEPTIONIST
- [X] T032 [US2] Implementar `POST /api/orders` en `server/controllers/orderController.js` y `server/routes/orderRoutes.js` para ADMIN y RECEPTIONIST, y registrar ambas rutas en `server/app.js`
- [X] T033 [P] [US2] Crear `client/lib/models/service_order.dart` (orden, líneas e historial) y `client/lib/providers/orders_provider.dart` (alta y lista de mecánicos; se vacía al cerrar sesión)
- [X] T034 [US2] Crear `client/lib/screens/order_form_screen.dart`: cliente, vehículo del cliente, mecánico, kilometraje de entrada con aviso y confirmación de corrección, y problema reportado; si se abre desde una cita llega prellenado y bloqueado
- [X] T035 [US2] Agregar la acción **Crear orden** al detalle de la cita confirmada en `client/lib/screens/appointment_detail_screen.dart`, y registrar `OrdersProvider` en `client/lib/main.dart`

**Punto de control**: Las historias 1 y 2 funcionan de forma independiente

---

## Fase 5: Historia de usuario 3 - Consultar las órdenes asignadas (Prioridad: P1)

**Objetivo**: El mecánico ve solo sus órdenes; recepción y administración ven todas con filtros y búsqueda.

**Prueba independiente**: Con dos mecánicos y órdenes asignadas a cada uno, cada uno ve únicamente las suyas y recibe 403 al abrir una ajena (escenario 9 de `quickstart.md`).

### Pruebas de la historia 3 ⚠️

- [X] T036 [P] [US3] Prueba unitaria del servicio de consulta: el mecánico siempre se filtra por su propio `mechanicId` aunque envíe otro; recepción y ADMIN ven todas; el detalle de una orden ajena lanza `FORBIDDEN` para el mecánico, en `server/tests/unit/orderAccess.test.js`
- [X] T037 [P] [US3] Prueba de contrato de `GET /orders` y `GET /orders/:id` (listado con `meta`, detalle con `services`, `labor`, `history` y `allowedTransitions`, 403 y 404) en `server/tests/contract/orders.read.contract.test.js`
- [X] T038 [P] [US3] Prueba de integración de consulta con dos mecánicos: cada uno ve solo las suyas, no puede abrir las ajenas ni forzar `mechanicId`; recepción filtra por estado, mecánico y fecha y busca por folio, cliente y placas, en `server/tests/integration/orders.read.test.js`
- [X] T039 [P] [US3] Prueba de provider y de widgets de la lista y del detalle de órdenes (mecánico sin órdenes ve el estado vacío, filtros, búsqueda, error con reintentar) en `client/test/screens/orders_screen_test.dart`

### Implementación de la historia 3

- [X] T040 [P] [US3] Agregar a `server/models/orderModel.js` el listado con filtros (`status`, `mechanicId`, `from`, `to`, `search` por folio, cliente o placas) y paginación
- [X] T041 [US3] Agregar a `server/services/orderService.js` las funciones de consulta con el control de acceso por asignación y el cálculo de `allowedTransitions` para el usuario actual
- [X] T042 [US3] Implementar `GET /api/orders` y `GET /api/orders/:id` en `server/controllers/orderController.js` y `server/routes/orderRoutes.js` para los tres roles
- [X] T043 [US3] Crear `client/lib/screens/orders_screen.dart`: lista con filtros por estado y fecha, búsqueda, chips de estado, botón **Nueva orden** solo para recepción y administración, y estado vacío específico para el mecánico
- [X] T044 [US3] Crear `client/lib/screens/order_detail_screen.dart` en modo lectura (datos de la orden, cliente, vehículo, mecánico, diagnóstico, líneas, total e historial de estados) y registrar la sección **Órdenes de servicio** en `client/lib/main.dart`

**Punto de control**: Las historias 1 a 3 funcionan de forma independiente

---

## Fase 6: Historia de usuario 4 - Registrar diagnóstico, servicios y recomendaciones (Prioridad: P1)

**Objetivo**: El mecánico documenta el trabajo y el total se calcula solo.

**Prueba independiente**: Con una orden asignada, registrar diagnóstico, dos servicios, una mano de obra, observaciones y recomendaciones y comprobar el total (escenario 10 de `quickstart.md`).

### Pruebas de la historia 4 ⚠️

- [X] T045 [P] [US4] Prueba unitaria del servicio de líneas: `description` "obligatoria, 1 a 255 caracteres"; `amount` entre 0 y 99,999,999.99; `hours` "mayor a 0 y hasta 999.99"; `hourlyRate` no negativa; importe de mano de obra `ROUND(hours * hourlyRate, 2)`; total igual a la suma de servicios y mano de obra tras cada alta, edición o baja; solo se edita en RECIBIDO, DIAGNOSTICO, EN_REPARACION o ESPERANDO_REFACCION (409 `ORDER_NOT_EDITABLE` en otro caso); permisos por campo de `PATCH /orders/:id`, en `server/tests/unit/orderLines.test.js`
- [X] T046 [P] [US4] Prueba de contrato de `PATCH /orders/:id` y de `POST`, `PATCH` y `DELETE` de `/orders/:id/services` y `/orders/:id/labor` (respuesta con la orden completa y el total recalculado, 400, 403, 404 y 409) en `server/tests/contract/orders.lines.contract.test.js`
- [X] T047 [P] [US4] Prueba de integración: el mecánico asignado y ADMIN editan; otro mecánico y RECEPTIONIST reciben 403 en diagnóstico y líneas; RECEPTIONIST sí cambia `reportedProblem` y `mechanicId`; las órdenes TERMINADO, ENTREGADO y CANCELADA son de solo lectura; el total coincide siempre con las líneas, en `server/tests/integration/orders.lines.test.js`
- [X] T048 [P] [US4] Prueba de provider y de widgets de la edición en el detalle (guardar diagnóstico, agregar, editar y quitar servicios y mano de obra con confirmación al quitar, total en pantalla, validaciones en español) en `client/test/screens/order_work_test.dart`

### Implementación de la historia 4

- [X] T049 [P] [US4] Agregar a `server/validators/orderValidator.js` los esquemas de edición de la orden, de servicios y de mano de obra
- [X] T050 [P] [US4] Agregar a `server/models/orderModel.js` las operaciones de edición de campos, alta, edición y baja de líneas, y el recálculo del `total` con `SUM` dentro de la transacción
- [X] T051 [US4] Agregar a `server/services/orderService.js` las reglas de edición: permisos por campo y por asignación, estados editables y recálculo del total
- [X] T052 [US4] Implementar `PATCH /api/orders/:id` y las rutas de `/services` y `/labor` en `server/controllers/orderController.js` y `server/routes/orderRoutes.js`
- [X] T053 [US4] Ampliar `client/lib/screens/order_detail_screen.dart` con la edición para el mecánico asignado y ADMIN: diagnóstico, observaciones y recomendaciones; tabla de servicios y de mano de obra con diálogos para agregar y editar, confirmación al quitar, total visible y modo solo lectura según estado

**Punto de control**: Las historias 1 a 4 funcionan de forma independiente

---

## Fase 7: Historia de usuario 5 - Cambiar el estado de una orden (Prioridad: P1)

**Objetivo**: Las transiciones respetan la secuencia, los roles y las validaciones, con historial.

**Prueba independiente**: Una orden recorre RECIBIDO → DIAGNOSTICO → EN_REPARACION → TERMINADO → ENTREGADO; se rechazan saltos y transiciones sin permiso; cancelar pide motivo (escenarios 11 a 16 de `quickstart.md`).

### Pruebas de la historia 5 ⚠️

- [X] T054 [P] [US5] Prueba unitaria **exhaustiva** de `orderStateMachine`: las 7 × 7 combinaciones de estado actual y destino con cada rol (ADMIN, RECEPTIONIST, MECHANIC asignado, MECHANIC no asignado), comprobando que solo las transiciones de la tabla de `research.md` son válidas, que ENTREGADO y CANCELADA no tienen salidas y que `allowedTransitions` devuelve el conjunto correcto, en `server/tests/unit/orderStateMachine.test.js`
- [X] T055 [P] [US5] Prueba unitaria del servicio de cambio de estado: `INVALID_TRANSITION` con las permitidas en `details`; `ORDER_INCOMPLETE` al terminar sin diagnóstico o sin servicios ni mano de obra; motivo obligatorio al cancelar; `STATE_CONFLICT` cuando el estado cambió durante la petición; efectos sobre la cita (cancelar la orden la devuelve a CONFIRMADA, entregarla la pasa a COMPLETADA); `deliveredAt` al entregar; registro del historial, en `server/tests/unit/orderStatus.test.js`
- [X] T056 [P] [US5] Prueba de contrato de `POST /orders/:id/status` (200 con la orden completa, 400, 403, 409 `INVALID_TRANSITION`, `ORDER_INCOMPLETE` y `STATE_CONFLICT`) en `server/tests/contract/orders.status.contract.test.js`
- [X] T057 [P] [US5] Prueba de integración del flujo completo por rol: el mecánico asignado avanza hasta TERMINADO y no puede entregar ni cancelar; RECEPTIONIST entrega y cancela; ADMIN puede todo; otro mecánico recibe 403; una orden ENTREGADA o CANCELADA ya no cambia; dos cambios simultáneos aplican solo uno, en `server/tests/integration/orders.status.test.js`
- [X] T058 [P] [US5] Prueba de widgets de las acciones de estado en el detalle (solo se muestran las de `allowedTransitions`, confirmación obligatoria al entregar, diálogo de motivo al cancelar, aviso de recarga ante `STATE_CONFLICT`, historial visible) en `client/test/screens/order_status_test.dart`

### Implementación de la historia 5

- [X] T059 [US5] Implementar `server/services/orderStateMachine.js`: tabla de transiciones, función `canTransition(from, to, user, order)` y `allowedTransitions(order, user)`, sin acceso a la base de datos
- [X] T060 [US5] Agregar a `server/models/orderModel.js` el cambio de estado con bloqueo optimista (`UPDATE ... WHERE id = ? AND status = ?`), el registro del historial y la actualización de la cita asociada
- [X] T061 [US5] Agregar a `server/services/orderService.js` el cambio de estado con las validaciones de la máquina de estados, `ORDER_INCOMPLETE`, el motivo de cancelación y los efectos sobre la cita, todo en una transacción
- [X] T062 [US5] Implementar `POST /api/orders/:id/status` en `server/controllers/orderController.js` y `server/routes/orderRoutes.js`
- [X] T063 [US5] Ampliar `client/lib/screens/order_detail_screen.dart` con los botones de estado según `allowedTransitions`, el diálogo de confirmación para **Entregar**, el diálogo con motivo obligatorio para **Cancelar orden**, el manejo de `STATE_CONFLICT` y la línea de tiempo del historial

**Punto de control**: Las cinco historias funcionan de forma independiente

---

## Fase 8: Pulido y temas transversales

**Propósito**: Datos de ejemplo, seguridad, diseño y validación final

- [ ] T064 Crear `database/seeds/004_service_orders.sql` con al menos 7 órdenes de ejemplo (una por cada estado, incluida una CANCELADA con motivo), repartidas entre `mecanico` y `mecanico2`, con servicios, mano de obra e historial coherentes, ligadas a las citas COMPLETADA y EN_PROCESO donde corresponda, asignando el folio `OS-` más el `id` con ceros, de forma idempotente
- [ ] T065 Actualizar `server/scripts/seed.js` para crear la cuenta `mecanico2` (segundo mecánico de ejemplo) con la misma variable `SEED_PASSWORD_MECANICO` y ejecutar los seeds nuevos; verificar que correrlo dos veces no duplica registros
- [ ] T066 [P] Extender `server/tests/integration/permissions.test.js` con todos los endpoints nuevos de `contracts/api.md` (sin token 401, token inválido 401, rol sin permiso 403, rol permitido distinto de 401 y 403)
- [ ] T067 [P] Extender `client/test/layout_responsive_test.dart` con las secciones Citas y Órdenes de servicio, el formulario de cita, el de orden y el detalle de la orden en anchos de 1400, 1000, 760 y 600 px, con la barra lateral expandida y colapsada
- [ ] T068 [P] Revisar que no haya valores sueltos de color, espaciado o radio en las pantallas nuevas (`git grep` de `Color(0x`, `Colors.` y números en `EdgeInsets`) y que ninguna contraseña ni secreto aparezca en el repositorio ni en los seeds
- [ ] T069 [P] Actualizar `README.md` y `docs/project-context.md` con los endpoints y las decisiones del Sprint 2 (estado CANCELADA de la orden, mecánico obligatorio, tope de kilometraje, cancelación de citas, `GET /mechanics`)
- [ ] T070 Ejecutar la suite completa del backend (`npm test`, `npx eslint .`) y del frontend (`flutter test`, `flutter analyze`) y corregir cualquier fallo
- [ ] T071 Ejecutar la validación de `quickstart.md` contra la API real con los 17 escenarios, limpiar los datos temporales y registrar el resultado en `specs/002-citas-ordenes-servicio/validacion-quickstart.md`

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias
- **Fundamentos (Fase 2)**: depende de la Fase 1; BLOQUEA todas las historias
- **Historias (Fase 3 en adelante)**: dependen de la Fase 2
- **Pulido (Fase 8)**: depende de las historias deseadas

### Dependencias entre historias

- **US1 (citas)**: tras la Fase 2; sin dependencias de otras historias.
- **US2 (crear orden)**: tras la Fase 2; la creación desde una cita usa el modelo de citas de US1, pero la creación directa se prueba sola.
- **US3 (consultar órdenes)**: requiere el modelo y el detalle de órdenes de US2.
- **US4 (documentar)**: requiere las órdenes de US2 y el detalle de US3 para su pantalla.
- **US5 (estados)**: requiere las órdenes de US2; la regla de TERMINADO usa las líneas de US4, y los efectos sobre citas usan US1.

### Dentro de cada historia

- Las pruebas se escriben primero y DEBEN fallar antes de implementar
- Validadores y modelos antes de servicios; servicios antes de controladores y rutas
- Backend completo antes de las pantallas que lo consumen

### Oportunidades de paralelismo

- En la Fase 2: las tareas marcadas [P] (ayudantes de pruebas, validadores comunes, constantes, chips y API simulada)
- Todas las pruebas [P] de una historia pueden escribirse juntas
- Validador y modelo de una misma historia ([P]) en paralelo
- Tras la Fase 2, US1 y el esquema de US2 pueden avanzar a la vez en equipo; US3 a US5 siguen el orden por sus dependencias

---

## Ejemplo de paralelismo: Historia de usuario 1

```bash
# Pruebas de la historia 1 juntas:
Tarea: "Prueba unitaria del servicio de citas en server/tests/unit/appointmentService.test.js"
Tarea: "Prueba de contrato de citas en server/tests/contract/appointments.contract.test.js"
Tarea: "Prueba de integración de citas en server/tests/integration/appointments.test.js"
Tarea: "Prueba de widgets de citas en client/test/screens/appointments_screen_test.dart"

# Validador y modelo juntos:
Tarea: "Crear server/validators/appointmentValidator.js"
Tarea: "Crear server/models/appointmentModel.js"
```

---

## Estrategia de implementación

### Primero el MVP (historia 1 y creación de órdenes)

1. Completar la Fase 1: Preparación
2. Completar la Fase 2: Fundamentos (CRÍTICA)
3. Completar la Fase 3: Historia 1 (citas)
4. **DETENERSE Y VALIDAR**: probar la agenda de forma independiente
5. Continuar con la Fase 4 (crear orden)

### Entrega incremental

1. Preparación + Fundamentos → base lista
2. Historia 1 → probar → demostrar
3. Historia 2 → probar → demostrar (cita → orden)
4. Historia 3 → probar → demostrar (cada mecánico ve lo suyo)
5. Historia 4 → probar → demostrar (trabajo documentado)
6. Historia 5 → probar → demostrar (flujo completo hasta ENTREGADO)
7. Pulido y validación final

---

## Notas

- [P] = archivos distintos y sin dependencias pendientes
- La etiqueta [Historia] vincula cada tarea con su historia para la trazabilidad
- Verificar que las pruebas fallen antes de implementar
- Un commit por fase o grupo lógico, en la rama `sdd-speckit`, con Conventional Commits y descripción en español
- La migración 001 no se edita; todo cambio de esquema va en la 002
- Las órdenes nunca se eliminan: se cancelan o se entregan
