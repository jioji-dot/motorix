---

description: "Lista de tareas para implementar el Sprint 4: pagos, tickets y panel de control"
---

# Tareas: Pagos, tickets y panel de control

**Entrada**: Documentos de diseño en `specs/004-pagos-tickets-dashboard/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md. Sprints 1 a 3 completados.

**Pruebas**: Se incluyen porque la constitución (principio VII) exige pruebas para la lógica de negocio y los permisos, y el criterio CA-8 pide pruebas de la lógica de pagos y de la generación de tickets. Backend: Jest y Jest + supertest contra la base `*_test`, con la pasarela de Mercado Pago **simulada** (las pruebas nunca llaman a Mercado Pago). Frontend: `flutter test`. Las pruebas de cada historia se escriben primero y DEBEN fallar antes de implementar.

**Organización**: Las tareas se agrupan por historia de usuario para implementarlas y probarlas de forma independiente. Las fases siguen el orden de prioridad: primero las historias P1 (US1, US2, US4) y después las P2 (US3, US5, US6).

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US1]–[US6]**: Historia de usuario (US1 registrar el pago, US2 método de pago, US3 Mercado Pago, US4 ticket de servicio, US5 consultar el panel, US6 contenido del panel)
- Todas las rutas son relativas a la raíz del repositorio

## Convenciones de rutas

- Backend: `server/` (ES Modules, sin carpeta `src/`); pruebas en `server/tests/{unit,integration,contract}/`
- Frontend: `client/lib/` y `client/test/`
- Base de datos: `database/`

---

## Fase 1: Preparación

**Propósito**: Confirmar la base de los Sprints 1 a 3 antes de extenderla

- [ ] T001 Verificar que los Sprints 1 a 3 siguen en verde ejecutando `npm test` y `npx eslint .` en `server/` y `flutter test` y `flutter analyze` en `client/`, y que `git status` está limpio en la rama `sdd-speckit`
- [ ] T002 [P] Confirmar que `.env` apunta a las bases `motorix_sdd` y `motorix_sdd_test` y que las migraciones 001 a 003 están aplicadas en ambas con `database/scripts/aplicar-migraciones.ps1` (con `-ExecutionPolicy Bypass`)
- [ ] T003 [P] Agregar a `client/pubspec.yaml` las dependencias `url_launcher` y `qr_flutter` (justificadas en `research.md`, punto 9), ejecutar `flutter pub get` y confirmar que `flutter analyze` sigue limpio

---

## Fase 2: Fundamentos (prerrequisitos bloqueantes)

**Propósito**: Esquema, configuración y herramientas compartidas que DEBEN existir antes de cualquier historia

**⚠️ CRÍTICO**: Ninguna historia puede empezar hasta completar esta fase

- [ ] T004 Escribir la migración `database/migrations/004_sprint4_payments_tickets.sql` exactamente según `data-model.md`: `payments.orderId` INT UNSIGNED NOT NULL con llave foránea a `service_orders` e índice; `payments.amount` DECIMAL(10,2) NOT NULL con CHECK (`amount` > 0); `payments.method` ENUM('EFECTIVO','TARJETA','TRANSFERENCIA','MERCADO_PAGO') NOT NULL; `payments.status` ENUM('PENDIENTE','PAGADO','RECHAZADO','CANCELADO') NOT NULL con índice; `payments.reference` VARCHAR(100) NULL; `payments.externalReference` VARCHAR(64) NULL UNIQUE; `payments.externalId` VARCHAR(40) NULL UNIQUE; `payments.paymentLink` VARCHAR(500) NULL; `payments.paidAt` DATETIME NULL; `payments.createdBy` NOT NULL con llave foránea a `users`; CHECK de tabla: `method = 'MERCADO_PAGO' OR status = 'PAGADO'`, `status = 'PAGADO' OR paidAt IS NULL` y `method = 'MERCADO_PAGO' OR (externalReference IS NULL AND externalId IS NULL AND paymentLink IS NULL)`; `tickets.folio` VARCHAR(20) NOT NULL UNIQUE; `tickets.orderId` INT UNSIGNED NOT NULL UNIQUE con llave foránea a `service_orders`; `tickets.paymentId` INT UNSIGNED NULL con llave foránea a `payments`; `tickets.generatedBy` NOT NULL con llave foránea a `users`; `tickets.generatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP; sin ninguna llave foránea en cascada y sin columnas de datos de tarjeta ni de credenciales
- [ ] T005 Aplicar la migración 004 a `motorix_sdd` y a `motorix_sdd_test` con `database/scripts/aplicar-migraciones.ps1`, verificar que la 001, 002 y 003 aparecen como "Ya aplicada" y que repetir el comando no vuelve a ejecutar la 004
- [ ] T006 [P] Ampliar `server/config/env.js` y `.env.example` con `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_NOTIFICATION_URL`, `MP_API_URL` (por defecto la API oficial) y los datos del taller `WORKSHOP_NAME`, `WORKSHOP_ADDRESS` y `WORKSHOP_PHONE` con valores por defecto; las variables de Mercado Pago van sin valor en `.env.example` y nunca se escriben en respuestas, registros ni pruebas
- [ ] T007 [P] Agregar a `server/utils/constants.js` las constantes de métodos de pago (`EFECTIVO`, `TARJETA`, `TRANSFERENCIA`, `MERCADO_PAGO`), estados del pago (`PENDIENTE`, `PAGADO`, `RECHAZADO`, `CANCELADO`), estados de cobro de la orden (`SIN_COBRO`, `SIN_PAGOS`, `PARCIAL`, `PAGADA`) y las órdenes que admiten pagos y ticket (`TERMINADO`, `ENTREGADO`)
- [ ] T008 [P] Ampliar `server/tests/helpers.js`: `limpiarBase` vacía también `tickets` y `payments` antes que las tablas que referencian; y se añaden `crearPago` y `crearOrdenCobrable` (orden Terminada con un servicio que fija su total) para las pruebas
- [ ] T009 [P] Crear `server/utils/money.js` con funciones de aritmética en centavos enteros (`aCentavos`, `deCentavos`, `sumar`) para que ninguna suma de importes use números de punto flotante, y su prueba unitaria en `server/tests/unit/money.test.js` (0.1 + 0.2, redondeo a dos decimales, importes grandes)
- [ ] T010 [P] Crear `server/tests/helpers/fakeGateway.js` con una pasarela de Mercado Pago simulada (`createPaymentLink`, `getPayment`, `isConfigured`) cuyo resultado se controla desde la prueba, y que registra las llamadas recibidas
- [ ] T011 [P] Ampliar `client/lib/widgets/status_chip.dart` con chips para el estado del pago (Pendiente ámbar, Pagado verde, Rechazado rojo, Cancelado gris) y el estado de cobro de la orden (Sin pagos gris, Pago parcial ámbar, Pagada verde, Sin cobro gris) según `docs/design-system.md` sección 5, con etiquetas en español
- [ ] T012 [P] Crear `client/test/helpers/fake_api_s4.dart` con el API simulado de pagos, tickets y panel (extiende `ApiInventario`), reutilizable en las pruebas de widgets
- [ ] T013 Registrar en `client/lib/screens/home_screen.dart` la sección **Panel de control** (solo `UserRole.admin`) con su ícono, sin construirla todavía

**Punto de control**: Esquema, configuración y herramientas listos; las historias pueden comenzar

---

## Fase 3: Historia de usuario 1 - Registrar el pago de una orden (Prioridad: P1) 🎯 MVP

**Objetivo**: Registrar pagos parciales o completos de una orden Terminada o Entregada sin que la suma exceda su total, y ver el resumen de cobro.

**Prueba independiente**: Con una orden Terminada de total conocido, recepción registra un pago parcial y luego uno por el saldo exacto; la orden queda Pagada; importes inválidos y órdenes no cobrables se rechazan; dos cobros simultáneos que exceden el saldo aplican solo uno (escenarios 1 a 7 de `quickstart.md`).

### Pruebas de la historia 1 ⚠️ (escribir primero; deben fallar)

- [ ] T014 [P] [US1] Prueba unitaria de las reglas de saldo en `server/tests/unit/paymentSummary.test.js`: `total`, `pagado`, `pendiente`, `saldo` y `disponible`; estado de cobro `SIN_COBRO` (total cero), `SIN_PAGOS`, `PARCIAL` y `PAGADA`; los pagos Rechazados y Cancelados no cuentan; los Pendientes reservan pero no cuentan como pagado
- [ ] T015 [P] [US1] Prueba unitaria del servicio de pagos con modelos simulados en `server/tests/unit/paymentService.test.js`: orden inexistente (404); orden fuera de `TERMINADO` y `ENTREGADO` o con total cero (`ORDER_NOT_PAYABLE`); `amount` "de 0.01 a 99,999,999.99 con hasta dos decimales"; importe mayor al disponible (`PAYMENT_EXCEEDS_BALANCE` con `balance`); el bloqueo de la orden antes de calcular; mecánico sin acceso
- [ ] T016 [P] [US1] Prueba de contrato de `POST /orders/:id/payments` (solo efectivo) y `GET /orders/:id/payments` en `server/tests/contract/payments.contract.test.js`: forma del pago y del resumen, 201, 400 con el campo en `details`, 404, 409 `ORDER_NOT_PAYABLE` y 409 `PAYMENT_EXCEEDS_BALANCE` con `balance`
- [ ] T017 [P] [US1] Prueba de integración en `server/tests/integration/payments.test.js`: pago parcial y luego por el saldo exacto dejan la orden `PAGADA` y rechazan más pagos; recepción y administración pueden, mecánico recibe 403; **diez cobros simultáneos que juntos exceden el saldo dejan la suma de pagos igual o menor al total**; una orden Entregada conserva sus pagos y admite seguir cobrando; ningún pago se puede editar ni eliminar (no hay rutas)
- [ ] T018 [P] [US1] Prueba de provider y de widgets del bloque de pagos del detalle de la orden en `client/test/screens/order_payments_test.dart`: resumen (pagado, saldo y estado), lista de pagos, diálogo de registro con el saldo por defecto, validaciones en español, mensajes de la API, y que recepción y administración lo ven y el mecánico no

### Implementación de la historia 1

- [ ] T019 [P] [US1] Crear `server/validators/paymentValidator.js` con los esquemas de alta de pago (`method` obligatorio entre los cuatro valores, `amount` "de 0.01 a 99,999,999.99 con hasta dos decimales", `reference` opcional "hasta 100 caracteres" que se rechaza si parece contener un número de tarjeta de 13 a 19 dígitos) y mensajes en español
- [ ] T020 [P] [US1] Crear `server/models/paymentModel.js` con `lockOrderForPayment` (`SELECT ... FOR UPDATE` de la orden con su total y estado), `sumsByStatus` (suma por estado con aritmética en la base), `create`, `listByOrder` (con el usuario que lo registró, del más reciente al más antiguo) y `findById`
- [ ] T021 [US1] Implementar `server/services/paymentSummary.js` (cálculo puro del resumen con `money.js`) y `server/services/paymentService.js` con `create` para efectivo, tarjeta y transferencia dentro de una transacción que bloquea la orden, valida estado, total y disponible, e inserta el pago en `PAGADO` con `paidAt`
- [ ] T022 [US1] Implementar `GET` y `POST /api/orders/:id/payments` en `server/controllers/paymentController.js` y `server/routes/orderRoutes.js` (solo ADMIN y RECEPTIONIST), registrando los errores `ORDER_NOT_PAYABLE` y `PAYMENT_EXCEEDS_BALANCE` (con `balance`)
- [ ] T023 [P] [US1] Crear `client/lib/models/payment.dart` (pago y resumen de cobro) y `client/lib/providers/payments_provider.dart` (consultar, registrar; se vacía al cerrar sesión) y registrarlo en `client/lib/main.dart`
- [ ] T024 [US1] Crear `client/lib/widgets/payment_section.dart` y `client/lib/widgets/payment_dialogs.dart` con el bloque **Pagos** del detalle de la orden (resumen de cobro, lista de pagos con método, importe, estado, referencia, quién y cuándo, y botón **Registrar pago**) visible para recepción y administración cuando la orden está Terminada o Entregada, y agregarlo a `client/lib/screens/order_detail_screen.dart`

**Punto de control**: Los pagos funcionan de extremo a extremo y de forma independiente

---

## Fase 4: Historia de usuario 2 - Elegir el método de pago (Prioridad: P1)

**Objetivo**: Dejar constancia del método de pago (efectivo, tarjeta, transferencia) con referencia opcional, sin pedir ni guardar datos de tarjeta.

**Prueba independiente**: Se registran pagos con efectivo, tarjeta y transferencia, cada uno conserva su método y referencia; un método inválido y una referencia con forma de número de tarjeta se rechazan; el esquema no tiene columnas de datos de tarjeta (escenario 5 de `quickstart.md`).

### Pruebas de la historia 2 ⚠️

- [ ] T025 [P] [US2] Prueba unitaria del validador en `server/tests/unit/paymentValidator.test.js`: los cuatro métodos válidos, un método inválido o ausente rechazado, referencia hasta 100 caracteres, referencia vacía pasa a nulo, y rechazo de referencias con 13 a 19 dígitos seguidos (con espacios o guiones) sin rechazar números de autorización cortos
- [ ] T026 [P] [US2] Prueba de integración en `server/tests/integration/payments.methods.test.js`: pagos con efectivo, tarjeta y transferencia quedan `PAGADO` con su método y referencia; un método inválido responde 400; **una prueba inspecciona `information_schema` y falla si `payments` o `tickets` tienen columnas de tarjeta (número, vencimiento, cvv, pan) o de credenciales (token, secreto, contraseña)**
- [ ] T027 [P] [US2] Prueba de widgets del diálogo de registro en `client/test/screens/payment_methods_test.dart`: selector con Efectivo, Tarjeta, Transferencia y Mercado Pago; método obligatorio; el campo de referencia no pide número de tarjeta; la nota de que la tarjeta se cobra en terminal externa

### Implementación de la historia 2

- [ ] T028 [US2] Completar en `server/services/paymentService.js` y `server/validators/paymentValidator.js` la captura de `reference` y el rechazo de referencias con forma de número de tarjeta, devolviendo el método y la referencia en cada pago
- [ ] T029 [US2] Completar el diálogo **Registrar pago** de `client/lib/widgets/payment_dialogs.dart` con el selector de método, el campo de referencia (etiquetado según el método: "Número de autorización" o "Referencia de transferencia"), la nota de terminal externa y la validación del importe contra el saldo disponible

**Punto de control**: Las historias 1 y 2 funcionan de forma independiente

---

## Fase 5: Historia de usuario 4 - Generar y consultar el ticket de servicio (Prioridad: P1)

**Objetivo**: Generar un ticket único por orden, consultarlo con todos sus datos e imprimirlo.

**Prueba independiente**: Con una orden Terminada con servicios, mano de obra, refacciones y pagos, recepción genera el ticket, lo visualiza con todos los datos esperados y lo imprime; regenerarlo devuelve el mismo folio (escenarios 8 a 11 de `quickstart.md`).

### Pruebas de la historia 4 ⚠️

- [ ] T030 [P] [US4] Prueba unitaria del armado del ticket en `server/tests/unit/ticketBuilder.test.js`: todos los datos de FR-020 (folio, taller, cliente, vehículo, placas, kilometraje `serviceMileage` o el de entrada, servicios, refacciones, mano de obra, subtotal, total, método y estado de pago); subtotal igual al total y a la suma de líneas; método "Efectivo y tarjeta" con varios métodos; estados `Sin cobro`, `Pendiente`, `Pago parcial` y `Pagado`; los pagos Rechazados y Cancelados no cuentan
- [ ] T031 [P] [US4] Prueba unitaria del ticket y del token de impresión en `server/tests/unit/ticketService.test.js`: orden fuera de `TERMINADO` y `ENTREGADO` (`TICKET_NOT_AVAILABLE`), segunda generación devuelve el mismo registro y actualiza el pago principal, folio `TK-` + id con ceros; el token de impresión se firma con una clave distinta de la de sesión, vence a los 5 minutos, solo sirve para esa orden, y **un token de impresión no autentica como sesión ni un token de sesión abre la impresión**
- [ ] T032 [P] [US4] Prueba unitaria de la página imprimible en `server/tests/unit/ticketPrint.test.js`: contiene todos los datos, incluye `@media print` y la llamada a imprimir, no contiene menús ni botones, y **escapa HTML** en nombres, descripciones y notas (`<script>` y comillas)
- [ ] T033 [P] [US4] Prueba de contrato de `POST` y `GET /orders/:id/ticket`, `POST /orders/:id/ticket/print-link` y `GET /tickets/print/:token` en `server/tests/contract/tickets.contract.test.js`: forma documentada, 201 al crear y 200 al repetir, 404 si aún no existe, 409 `TICKET_NOT_AVAILABLE`, `text/html` en la impresión y 401 con token vencido o alterado
- [ ] T034 [P] [US4] Prueba de integración en `server/tests/integration/tickets.test.js`: los importes del ticket coinciden con la orden y sus pagos tras pagos parciales y completos; regenerar tras otro pago conserva el folio y actualiza el estado; recepción y administración pueden, mecánico recibe 403; una orden en curso o cancelada no tiene ticket; el ticket de una orden con total cero muestra `Sin cobro`
- [ ] T035 [P] [US4] Prueba de provider y de widgets de la pantalla del ticket en `client/test/screens/ticket_screen_test.dart`: muestra todos los datos, el botón **Imprimir** pide el enlace y lo abre con el lanzador de URL simulado, estados de carga y error, y que el mecánico no ve el botón de ticket

### Implementación de la historia 4

- [ ] T036 [P] [US4] Crear `server/models/ticketModel.js` con alta (asigna el folio `TK-000123` con el id), consulta por orden, actualización del pago principal y la lectura de las líneas de la orden y de sus pagos para armar el contenido
- [ ] T037 [US4] Implementar `server/services/ticketBuilder.js` (armado puro del contenido a partir de la orden, sus líneas, el cliente, el vehículo y los pagos, con `money.js`) y `server/services/ticketService.js` (generar o devolver, consultar, emitir el token de impresión firmado con `JWT_SECRET` más un sufijo propio y verificarlo)
- [ ] T038 [US4] Implementar `server/services/ticketPrint.js` con la página HTML imprimible: estilos `@media print`, sin menús, escape de todo texto variable y la llamada a imprimir al cargar
- [ ] T039 [US4] Implementar los endpoints `POST` y `GET /api/orders/:id/ticket`, `POST /api/orders/:id/ticket/print-link` (ADMIN y RECEPTIONIST) y la ruta pública `GET /api/tickets/print/:token` en `server/controllers/ticketController.js`, `server/routes/orderRoutes.js` y `server/routes/ticketRoutes.js`, registrados en `server/app.js`
- [ ] T040 [P] [US4] Crear `client/lib/models/ticket.dart` y agregar a `client/lib/providers/payments_provider.dart` las operaciones de generar, consultar y pedir el enlace de impresión
- [ ] T041 [US4] Crear `client/lib/screens/ticket_screen.dart` (vista del ticket con todos los datos, botón **Imprimir** que abre el enlace con `url_launcher`, estados de carga, vacío y error) y el botón **Generar ticket** o **Ver ticket** en el bloque de pagos del detalle de la orden

**Punto de control**: Las historias 1, 2 y 4 funcionan de forma independiente (flujo orden → pago → ticket)

---

## Fase 6: Historia de usuario 3 - Cobrar con Mercado Pago (Prioridad: P2)

**Objetivo**: Cobrar con un enlace de pago de Mercado Pago en sandbox, con estados que se actualizan por notificación o por consulta, sin datos de tarjeta.

**Prueba independiente**: Con la pasarela simulada, recepción inicia un pago con Mercado Pago, obtiene el enlace, el pago queda Pendiente reservando el saldo y, al aprobarse, rechazarse o cancelarse, su estado cambia una sola vez aunque la notificación se repita (escenarios 12 a 16 de `quickstart.md`).

### Pruebas de la historia 3 ⚠️

- [ ] T042 [P] [US3] Prueba unitaria de la pasarela en `server/tests/unit/mercadoPagoGateway.test.js` con `fetch` simulado: sin `MP_ACCESS_TOKEN` responde no configurada sin llamar a la red; arma la preferencia con importe, descripción, `external_reference` y `notification_url` solo si está configurada; traduce errores de red, tiempo de espera de 10 segundos y respuestas 4xx o 5xx a `MP_UNAVAILABLE`; **el token nunca aparece en los errores ni en los mensajes**
- [ ] T043 [P] [US3] Prueba unitaria del servicio de Mercado Pago en `server/tests/unit/mercadoPagoService.test.js`: iniciar un pago crea el pago `PENDIENTE` con enlace y reserva el importe; si la pasarela falla no se crea ningún pago; aplicar `approved`, `rejected` y `cancelled` con la actualización condicionada `WHERE status = 'PENDIENTE'`; repetir la misma notificación no cambia nada; el importe informado debe coincidir; un pago ajeno o inexistente se ignora; una aprobación tardía de un pago ya `CANCELADO` se ignora y se registra una advertencia
- [ ] T044 [P] [US3] Prueba unitaria de la verificación del webhook en `server/tests/unit/webhookVerifier.test.js`: firma `x-signature` válida, alterada y ausente según haya o no `MP_WEBHOOK_SECRET`, y rechazo de formatos mal formados
- [ ] T045 [P] [US3] Prueba de contrato de `POST /orders/:id/payments` con Mercado Pago, `POST /payments/:id/sync`, `POST /payments/:id/cancel` y `POST /payments/mercadopago/webhook` en `server/tests/contract/payments.mercadopago.contract.test.js`: 201 con `paymentLink` y `PENDIENTE`, 503 `MP_NOT_CONFIGURED`, 502 `MP_UNAVAILABLE`, 409 `PAYMENT_NOT_PENDING`, 200 `{ received: true }` en el webhook (también si no corresponde a ningún pago), 400 si está mal formado y 401 con firma inválida
- [ ] T046 [P] [US3] Prueba de integración en `server/tests/integration/payments.mercadopago.test.js` con la pasarela simulada: el flujo Pendiente → Pagado por webhook y por sincronización; Pendiente → Rechazado y → Cancelado liberan el saldo; **diez notificaciones idénticas simultáneas dejan un solo cambio**; una notificación cuyo estado real (consultado a la pasarela) es distinto del que afirma el cuerpo prevalece el real; el pago de Mercado Pago pendiente reserva saldo y bloquea sobrecobros; cancelar con el pago ya Pagado responde 409; el webhook funciona sin sesión y las demás rutas no
- [ ] T047 [P] [US3] Prueba de widgets del flujo de Mercado Pago en `client/test/screens/mercadopago_payment_test.dart`: el diálogo muestra el enlace con botón **Copiar** y el código QR, el estado Pendiente, **Actualizar estado**, **Cancelar pago** con confirmación, el mensaje en español cuando no está configurado o no responde, y que permite elegir otro método

### Implementación de la historia 3

- [ ] T048 [US3] Crear `server/integrations/mercadoPagoGateway.js` (única pieza que conoce la API externa) con `isConfigured`, `createPaymentLink` (preferencia de pago con el `fetch` nativo, tiempo de espera de 10 segundos) y `getPayment`, sin dependencias nuevas y sin escribir nunca el token en errores ni registros
- [ ] T049 [US3] Implementar `server/services/webhookVerifier.js` (validación opcional de la firma `x-signature` con `MP_WEBHOOK_SECRET` y extracción segura del identificador del pago) y `server/services/mercadoPagoService.js` con `startPayment`, `applyExternalPayment` (consulta el pago real, lo relaciona por `externalReference`, comprueba el importe y aplica el estado de forma idempotente), `sync` y `cancel`, recibiendo la pasarela por inyección
- [ ] T050 [US3] Agregar al modelo de pagos las operaciones `createPending`, `transitionFromPending` (actualización condicionada) y `findByExternalReference`, y conectar `paymentService.create` con el método `MERCADO_PAGO` para reservar el saldo dentro de la misma transacción que bloquea la orden
- [ ] T051 [US3] Implementar los endpoints `POST /api/payments/:id/sync`, `POST /api/payments/:id/cancel` (ADMIN y RECEPTIONIST) y la ruta pública `POST /api/payments/mercadopago/webhook` en `server/controllers/paymentController.js` y `server/routes/paymentRoutes.js`, registrados en `server/app.js`, con los errores `MP_NOT_CONFIGURED`, `MP_UNAVAILABLE` y `PAYMENT_NOT_PENDING`
- [ ] T052 [US3] Ampliar `client/lib/providers/payments_provider.dart` y `client/lib/widgets/payment_dialogs.dart` con el inicio del pago de Mercado Pago, el diálogo del enlace (copiar, abrir con `url_launcher`, código QR con `qr_flutter`), **Actualizar estado** y **Cancelar pago** con confirmación, y mostrar los pagos Pendientes en el bloque de pagos

**Punto de control**: Los pagos, el ticket y Mercado Pago funcionan de forma independiente

---

## Fase 7: Historia de usuario 5 - Consultar el panel de control (Prioridad: P2)

**Objetivo**: El administrador abre un panel con los indicadores del taller; los demás roles no tienen acceso.

**Prueba independiente**: Con los datos de ejemplo, el administrador abre el panel y ve sus indicadores; recepción y mecánico reciben 403; sin datos muestra ceros; con un fallo muestra el mensaje con **Reintentar** (escenarios 17, 19 y 20 de `quickstart.md`).

### Pruebas de la historia 5 ⚠️

- [ ] T053 [P] [US5] Prueba de contrato de `GET /dashboard` en `server/tests/contract/dashboard.contract.test.js`: forma documentada completa (`orders`, `appointments`, `maintenance`, `inventory`, `payments`), 401 sin token y 403 para recepción y mecánico
- [ ] T054 [P] [US5] Prueba de integración en `server/tests/integration/dashboard.empty.test.js`: con la base sin pagos ni órdenes todo vale cero o lista vacía y no hay errores
- [ ] T055 [P] [US5] Prueba de provider y de widgets de la pantalla en `client/test/screens/dashboard_screen_test.dart`: el administrador ve la sección y las tarjetas, el estado de carga, el error en español con **Reintentar** y el vacío con ceros; recepción y mecánico no ven la sección

### Implementación de la historia 5

- [ ] T056 [US5] Crear `server/services/dashboardService.js`, `server/controllers/dashboardController.js` y `server/routes/dashboardRoutes.js` con `GET /api/dashboard` solo para ADMIN, que arma la respuesta llamando a los bloques de la historia 6 y devuelve `generatedAt`; registrarlo en `server/app.js`
- [ ] T057 [P] [US5] Crear `client/lib/models/dashboard.dart` y `client/lib/providers/dashboard_provider.dart` (se vacía al cerrar sesión) y registrarlo en `client/lib/main.dart`
- [ ] T058 [US5] Crear `client/lib/screens/dashboard_screen.dart` con la estructura del panel (encabezado con la hora de actualización, botón de recarga, estados de carga, vacío y error con **Reintentar**) y registrar la sección **Panel de control** en `client/lib/main.dart`

**Punto de control**: El panel responde y es exclusivo del administrador

---

## Fase 8: Historia de usuario 6 - Órdenes, citas, mantenimientos y alertas en el panel (Prioridad: P2)

**Objetivo**: El panel muestra cifras reales que coinciden con las de cada módulo, sin copias.

**Prueba independiente**: Con datos en todos los módulos, cada cifra del panel es igual a la de su módulo de origen y cada tarjeta lleva a su pantalla (escenarios 17 y 18 de `quickstart.md`).

### Pruebas de la historia 6 ⚠️

- [ ] T059 [P] [US6] Prueba unitaria de los bloques del panel con modelos simulados en `server/tests/unit/dashboardService.test.js`: órdenes por estado y con saldo; citas pendientes o confirmadas de hoy y de los próximos 7 días (sin contar hoy ni las canceladas o completadas); periodos "hoy" y "mes en curso" en hora local con fechas en los límites (23:59, 00:00 y cambio de mes); refacciones más urgentes (agotadas primero, luego menor proporción stock/mínimo, hasta 5)
- [ ] T060 [P] [US6] Prueba de integración en `server/tests/integration/dashboard.test.js` que compara cada cifra con su módulo: conteos por estado igual a `GET /orders` filtrado, citas igual a `GET /appointments`, mantenimientos vencidos y próximos igual a `GET /maintenance`, stock bajo y agotadas igual a `GET /parts/summary`, y cobrado y por cobrar igual a la suma de `GET /orders/:id/payments`; los pagos Rechazados, Cancelados y Pendientes no cuentan como cobrados
- [ ] T061 [P] [US6] Prueba de widgets de las tarjetas del panel en `client/test/screens/dashboard_cards_test.dart`: órdenes por estado, por cobrar, citas de hoy y próximas, mantenimientos vencidos y próximos, alertas de inventario con las más urgentes, cobrado hoy y en el mes; cada tarjeta lleva a su sección al tocarla

### Implementación de la historia 6

- [ ] T062 [P] [US6] Crear `server/models/dashboardModel.js` con las consultas agregadas: órdenes por estado, saldos pendientes de órdenes `TERMINADO` y `ENTREGADO` (total menos pagos `PAGADO`), citas de hoy y de los próximos 7 días con su detalle, y pagos `PAGADO` cobrados hoy y en el mes en curso por `paidAt` (fechas en hora local)
- [ ] T063 [US6] Completar `server/services/dashboardService.js` reutilizando `maintenanceService.list` (conteo de vencidos y próximos), `partModel.summary` y `partModel.list` (las 5 refacciones más urgentes) para no duplicar reglas, de modo que cada cifra coincida con su módulo
- [ ] T064 [US6] Completar `client/lib/screens/dashboard_screen.dart` con las tarjetas de órdenes, por cobrar, citas, mantenimientos, alertas de inventario y cobros, adaptables al ancho de la ventana, y la navegación de cada tarjeta a su sección (Órdenes de servicio, Citas, Mantenimientos o Inventario)
- [ ] T065 [US6] Crear `database/seeds/008_payments_tickets.sql` idempotente: la orden Entregada de ejemplo pagada en dos partes (efectivo y tarjeta con una referencia de autorización de ejemplo) con su ticket generado; la orden Terminada con un pago parcial por transferencia y un pago de Mercado Pago Rechazado de historial; importes calculados desde el total real de cada orden y marcados con una referencia de ejemplo para no duplicarse al repetir el seed

**Punto de control**: Las seis historias funcionan de forma independiente

---

## Fase 9: Pulido y temas transversales

**Propósito**: Seguridad, diseño, documentación y validación final

- [ ] T066 [P] Extender `server/tests/integration/permissions.test.js` con todos los endpoints protegidos nuevos de `contracts/api.md` (sin token 401, token inválido 401, rol sin permiso 403, rol permitido distinto de 401 y 403) y agregar una prueba aparte para las dos rutas públicas (webhook y página de impresión) que compruebe que no exigen sesión pero sí validan su contenido
- [ ] T067 [P] Extender `client/test/layout_responsive_test.dart` con el panel de control, el bloque de pagos, los diálogos de registro y de Mercado Pago, y la pantalla del ticket, en anchos de 1400, 1000, 760 y 600 px, con la barra lateral expandida y colapsada
- [ ] T068 [P] Revisar que no haya valores sueltos de color, espaciado o radio en las pantallas nuevas y que ninguna credencial de Mercado Pago, contraseña ni dato de tarjeta aparezca en el repositorio, en el esquema, en las respuestas ni en los registros del servidor
- [ ] T069 [P] Actualizar `README.md`, `docs/project-context.md`, `database/README.md` y `specs/004-pagos-tickets-dashboard/contracts/api.md` con los endpoints, variables de entorno y decisiones del Sprint 4 (pagos parciales, sin reembolsos, ticket imprimible por token, Mercado Pago por enlace, panel con periodos fijos, límite aceptado de la aprobación tardía de un pago cancelado)
- [ ] T070 Ejecutar la suite completa del backend (`npm test`, `npx eslint .`) y del frontend (`flutter test`, `flutter analyze`) y corregir cualquier fallo
- [ ] T071 Ejecutar la validación de `quickstart.md` contra la API real con los 21 escenarios (los de Mercado Pago real solo si hay una credencial de prueba en el entorno; de lo contrario, comprobar el mensaje de configuración), limpiar los datos temporales y registrar el resultado en `specs/004-pagos-tickets-dashboard/validacion-quickstart.md`

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias
- **Fundamentos (Fase 2)**: depende de la Fase 1; BLOQUEA todas las historias
- **Historias (Fase 3 en adelante)**: dependen de la Fase 2
- **Pulido (Fase 9)**: depende de las historias deseadas

### Dependencias entre historias

- **US1 (registrar el pago)**: tras la Fase 2; sin dependencias de otras historias. Es el MVP.
- **US2 (método de pago)**: extiende el registro de US1 (validaciones del método, referencia y esquema).
- **US4 (ticket)**: requiere los pagos de US1 para mostrar método y estado de pago.
- **US3 (Mercado Pago)**: requiere el servicio y el modelo de pagos de US1 (saldo reservado y transiciones).
- **US5 (panel)**: independiente de pagos para su estructura, pero sus cifras de cobro dependen de US1.
- **US6 (contenido del panel)**: requiere la estructura de US5 y los módulos de los sprints anteriores.

### Dentro de cada historia

- Las pruebas se escriben primero y DEBEN fallar antes de implementar
- Validadores y modelos antes de servicios; servicios antes de controladores y rutas
- Backend completo antes de las pantallas que lo consumen

### Oportunidades de paralelismo

- En la Fase 2: las tareas marcadas [P] (configuración, constantes, ayudantes, pasarela simulada, chips y API simulada)
- Todas las pruebas [P] de una historia pueden escribirse juntas
- Validador y modelo de una misma historia ([P]) en paralelo
- Tras US1, las historias US2, US3 y US4 pueden avanzar a la vez en equipo; US5 puede empezar su estructura en paralelo

---

## Ejemplo de paralelismo: Historia de usuario 3

```bash
# Pruebas de la historia 3 juntas:
Tarea: "Prueba unitaria de la pasarela en server/tests/unit/mercadoPagoGateway.test.js"
Tarea: "Prueba unitaria del servicio de Mercado Pago en server/tests/unit/mercadoPagoService.test.js"
Tarea: "Prueba unitaria de la verificación del webhook en server/tests/unit/webhookVerifier.test.js"
Tarea: "Prueba de integración con la pasarela simulada en server/tests/integration/payments.mercadopago.test.js"
```

---

## Estrategia de implementación

### Primero el MVP (pagos y ticket)

1. Completar la Fase 1: Preparación
2. Completar la Fase 2: Fundamentos (CRÍTICA)
3. Completar la Fase 3: Historia 1 (registrar el pago)
4. **DETENERSE Y VALIDAR**: probar el cobro de forma independiente
5. Continuar con el método de pago (US2) y el ticket (US4)

### Entrega incremental

1. Preparación + Fundamentos → base lista
2. Historia 1 → probar → demostrar (cobro de una orden)
3. Historias 2 y 4 → probar → demostrar (métodos de pago y comprobante)
4. Historia 3 → probar → demostrar (cobro digital con Mercado Pago)
5. Historias 5 y 6 → probar → demostrar (panel de control y cierre del flujo del MVP)
6. Pulido y validación final

---

## Notas

- [P] = archivos distintos y sin dependencias pendientes
- La etiqueta [Historia] vincula cada tarea con su historia para la trazabilidad
- Verificar que las pruebas fallen antes de implementar
- Un commit por fase o grupo lógico, en la rama `sdd-speckit`, con Conventional Commits y descripción en español, **sin la línea Co-Authored-By** (decisión del 2026-10-19)
- Las migraciones 001, 002 y 003 no se editan; todo cambio de esquema va en la 004
- Los pagos y los tickets nunca se eliminan, y los pagos finales nunca se modifican
- Las pruebas automáticas nunca llaman a Mercado Pago real; la pasarela se sustituye por un simulador
