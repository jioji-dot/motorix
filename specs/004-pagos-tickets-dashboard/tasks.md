---

description: "Lista de tareas del Sprint 4: pagos, tickets y panel de control"
---

# Tareas: Pagos, tickets y panel de control (Sprint 4)

**Entrada**: Documentos de diseño en `/specs/004-pagos-tickets-dashboard/`

**Requisitos previos**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Pruebas**: Se incluyen porque la constitución (Principio VII) las exige para la lógica de negocio (saldo, estados de pago, permisos) y el criterio CA-8 pide pruebas de pagos y de generación de tickets, con pruebas de integración y contrato contra `motorix_test` y un servidor HTTP simulado de Mercado Pago (nunca cuentas reales). Escribirlas primero y comprobar que fallan antes de implementar.

**Organización**: Las tareas se agrupan por historia de usuario para implementarlas y probarlas de forma independiente.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Historia]**: Historia de usuario a la que pertenece (US1, US2, ...)
- Todas las rutas son relativas a la raíz del repositorio (`C:\sdd\motorix`)

## Convenciones

- Backend en `server/` (ES Modules, sin carpeta `src/`); frontend en `client/lib/` y `client/test/`; SQL en `database/`.
- Comentarios, mensajes al usuario y nombres de pruebas en español; identificadores en inglés (constitución y `CLAUDE.md`).
- Las pruebas de integración y contrato usan SIEMPRE `motorix_test`; se ejecutan con `--runInBand` porque comparten la base. Para editar archivos con acentos usar las herramientas de edición (nunca `Set-Content` sin `-Encoding`), y no usar `sed` con comillas inversas.
- Reutilizar lo de los sprints anteriores: `AppError`, `validate`, `authenticate`/`authorize`, `response.js`, `normalizers.js`, `withTransaction`, `orderModel.lockOrder`, `settingsModel`, `maintenanceStatus.js`, `stockStatus.js`, `factories.js`, `AppShell`, `AppDataTable`, `Panel`, `PaginationBar`, `StatusChip`, `showConfirmDialog`, `Format`, `Validators`.
- Valores en la base y en la API: métodos `CASH`, `CARD`, `TRANSFER`, `MERCADO_PAGO`; estados de pago `PENDIENTE`, `APROBADO`, `RECHAZADO`, `CANCELADO`, `ANULADO`; estado de pago de la orden `NO_CHARGE`, `UNPAID`, `PARTIAL`, `PAID`.
- Invariantes: lo aprobado nunca supera el total de la orden y `aprobado + pendiente ≤ total`; los pagos y tickets nunca se eliminan; no se guardan datos de tarjeta ni credenciales; Mercado Pago solo se conoce desde `server/integrations/mercadoPagoClient.js`.
- Colores de estado (Principio VIII): verde para pagada o aprobada, ámbar para pago parcial o pendiente, rojo para rechazada, anulada o vencida, neutro para cancelada.

## Mapa de historias

| Historia | Título | Prioridad | Fase |
|----------|--------|:---------:|:----:|
| US1 | Registrar el pago de una orden | P1 | 3 |
| US2 | Seleccionar el método de pago | P1 | 4 |
| US4 | Generar el ticket de servicio | P1 | 5 |
| US3 | Cobrar con Mercado Pago | P2 | 6 |
| US5 | Consultar información general en el panel de control | P2 | 7 |
| US6 | Visualizar órdenes, citas, mantenimientos y alertas en el panel | P2 | 7 |

---

## Fase 1: Preparación

**Propósito**: Constantes, errores y configuración compartidos por todo el sprint.

- [X] T001 Agregar a `server/config/constants.js` `PAYMENT_METHOD` (`CASH`, `CARD`, `TRANSFER`, `MERCADO_PAGO`), `PAYMENT_STATUS` (`PENDIENTE`, `APROBADO`, `RECHAZADO`, `CANCELADO`, `ANULADO`) y `ORDER_PAYMENT_STATUS` (`NO_CHARGE`, `UNPAID`, `PARTIAL`, `PAID`) con sus listas de valores, el listado de órdenes cobrables (`TERMINADO`, `ENTREGADO`) y los respaldos de los datos del taller (`DEFAULT_WORKSHOP`: nombre `Motorix Taller Mecánico`, dirección `Av. Principal 123, Ciudad de México`, teléfono `5555123456`)
- [X] T002 [P] Agregar a `server/utils/AppError.js` las fábricas de `contracts/api.md`: `paymentOrderNotPayable({ status, total })` (409 `PAYMENT_ORDER_NOT_PAYABLE`), `paymentExceedsBalance({ available, requested })` (409 `PAYMENT_EXCEEDS_BALANCE`), `paymentPendingExists(pending)` (409 `PAYMENT_PENDING_EXISTS`, `details.pending`), `paymentInvalidState()` (409 `PAYMENT_INVALID_STATE`), `ticketOrderNotReady()` (409 `TICKET_ORDER_NOT_READY`) y `paymentProviderUnavailable(message)` (503 `PAYMENT_PROVIDER_UNAVAILABLE`), todas con mensajes en español
- [X] T003 [P] Leer en `server/config/env.js` la configuración opcional de Mercado Pago (`mercadoPago: { accessToken: MP_ACCESS_TOKEN, apiUrl: MP_API_URL por omisión https://api.mercadopago.com, mode: MP_MODE por omisión sandbox }`) sin hacerla obligatoria, y agregar a `.env.example` las variables `MP_ACCESS_TOKEN`, `MP_API_URL` y `MP_MODE` con comentarios y SIN valores (el token de pruebas nunca se escribe en el repositorio)

---

## Fase 2: Fundamentos (prerrequisitos bloqueantes)

**Propósito**: Esquema, reglas puras, resumen de pago de la orden y fábricas que necesitan todas las historias.

**⚠️ CRÍTICO**: Ninguna historia puede comenzar hasta terminar esta fase.

- [X] T004 Crear `database/migrations/004_sprint4_payments_tickets.sql` (InnoDB, `utf8mb4`, collation `utf8mb4_0900_ai_ci`, todas las FK `ON DELETE RESTRICT`) con: `payments` (`id` INT UNSIGNED PK, `order_id` INT UNSIGNED NOT NULL FK, `method` ENUM('CASH','CARD','TRANSFER','MERCADO_PAGO') NOT NULL, `amount` DECIMAL(12,2) NOT NULL con `CHECK (amount > 0)`, `status` ENUM('PENDIENTE','APROBADO','RECHAZADO','CANCELADO','ANULADO') NOT NULL, `reference` VARCHAR(100) NULL, `external_reference` VARCHAR(80) NULL ÚNICA, `external_id` VARCHAR(40) NULL, `payment_url` VARCHAR(500) NULL, `pending_mp_order_id` INT UNSIGNED GENERADA `IF(method = 'MERCADO_PAGO' AND status = 'PENDIENTE', order_id, NULL)` con índice ÚNICO `uq_payments_pending_mp`, `void_reason` VARCHAR(255) NULL, `voided_by` INT UNSIGNED NULL FK → users, `voided_at` DATETIME NULL, `created_by` INT UNSIGNED NOT NULL FK → users, `created_at`, `updated_at`; `CHECK (status <> 'ANULADO' OR (void_reason IS NOT NULL AND voided_by IS NOT NULL AND voided_at IS NOT NULL))`; `CHECK (method = 'MERCADO_PAGO' OR status IN ('APROBADO','CANCELADO','ANULADO'))`; `CHECK (method <> 'MERCADO_PAGO' OR external_reference IS NOT NULL)`; índices `idx_payments_order_status (order_id, status)`, `idx_payments_created (created_at)`, `idx_payments_status_method (status, method)`); `tickets` (`id` INT UNSIGNED PK, `folio` VARCHAR(12) NULL ÚNICA, `order_id` INT UNSIGNED NOT NULL ÚNICA FK → service_orders, `generated_by` INT UNSIGNED NOT NULL FK → users, `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP); y las filas de `app_settings` `workshop_name`, `workshop_address` y `workshop_phone` con los valores de `DEFAULT_WORKSHOP`. No editar las migraciones 001 a 003
- [X] T005 [P] Escribir `server/tests/integration/schemaSprint4.test.js` contra `motorix_test`: existen las tablas con InnoDB y `utf8mb4`; las FK usan `RESTRICT`; `CHECK` rechaza importe cero o negativo, `ANULADO` sin motivo, usuario o fecha, un método manual en `PENDIENTE` o `RECHAZADO`, y Mercado Pago sin `external_reference`; el índice único rechaza un segundo cobro de Mercado Pago `PENDIENTE` de la misma orden pero acepta varios cerrados, uno pendiente por orden distinta y varios pagos manuales; `external_reference` única; un ticket por orden; existen las tres claves del taller en `app_settings`
- [X] T006 Actualizar `server/tests/helpers/testDb.js` (`cleanTables`) para vaciar `payments` y `tickets` antes de las tablas de órdenes, conservando `app_settings`, y aplicar la migración 004 a `motorix_test` con `npm run db:migrate` (con `--env-file=../.env.test`)
- [X] T007 [P] Escribir `server/tests/unit/money.test.js`: `toCents` convierte 1234.5 a 123450, `0.1 + 0.2` en pesos suma 30 centavos exactos, redondea a centavos, rechaza más de dos decimales y valores no numéricos, y `fromCents` regresa el número con dos decimales
- [X] T008 [P] Implementar `server/utils/money.js` (`toCents`, `fromCents`, `hasAtMostTwoDecimals`) hasta que pasen las pruebas de T007
- [X] T009 [P] Escribir `server/tests/unit/paymentBalance.test.js`: `computeBalance({ totalCents, paidCents, pendingCents })` devuelve `balance = total − paid`, `available = total − paid − pending` y el estado `NO_CHARGE` (total 0), `UNPAID` (sin aprobados), `PARTIAL` (abonos) y `PAID` (aprobado ≥ total); un pendiente reserva saldo sin contar como pagado; límites exactos (un centavo de diferencia); nunca devuelve `available` negativo; y `canRegisterPayment({ orderStatus, totalCents })` solo es verdadero para `TERMINADO` o `ENTREGADO` con total mayor a cero
- [X] T010 [P] Implementar `server/utils/paymentBalance.js` (funciones puras `computeBalance`, `toPaymentSummary` en pesos y `canRegisterPayment`) hasta que pasen las pruebas de T009
- [X] T011 [P] Ampliar `server/models/settingsModel.js` con `getWorkshopSettings(db)`, que lee `workshop_name`, `workshop_address` y `workshop_phone` de `app_settings` y usa `DEFAULT_WORKSHOP` cuando falta una clave o está vacía
- [X] T012 Ampliar `server/models/orderModel.js`: `ORDER_SELECT` agrega las subconsultas `paid_amount` (suma de `payments.amount` con estado `APROBADO`) y `pending_amount` (estado `PENDIENTE`) y `ticket_id`; `mapOrder` expone `paidAmount`, `pendingAmount` y `ticketId`; `listOrders` acepta el filtro `paymentStatus` (`UNPAID`, `PARTIAL`, `PAID` o `DUE`) calculado con las mismas reglas de `paymentBalance.js`
- [X] T013 Ampliar `server/tests/helpers/factories.js` con `createPayment(orderId, overrides)` (por omisión efectivo `APROBADO` de 100; los de Mercado Pago llevan `external_reference` única y estado `PENDIENTE`) y `createTicket(orderId, overrides)` (folio `TK-` + id con 6 dígitos), reutilizando `createOrder` y los usuarios existentes
- [X] T014 [P] Agregar a `client/pubspec.yaml` las dependencias `pdf`, `printing` y `url_launcher` (justificadas en `research.md` D7 y D5: imprimir el ticket y abrir el enlace de pago) y ejecutar `flutter pub get`; agregar a `client/lib/app_routes.dart` las rutas `dashboard`, `payments`, `ticket`; y a `client/lib/utils/format.dart` el formato de fecha y hora del ticket

**Punto de control**: migración aplicada, reglas puras probadas y resumen de pago disponible en el modelo de órdenes.

---

## Fase 3: Historia de usuario 1 — Registrar el pago de una orden (Prioridad: P1) 🎯 MVP

**Meta**: Como recepcionista, quiero registrar el pago de una orden para cerrar el ciclo del servicio.

**Prueba independiente**: Abrir una orden terminada con total mayor a cero, registrar abonos que sumen el total y comprobar que pasa de "Sin pagar" a "Pago parcial" y a "Pagada", que se rechaza un importe mayor al saldo o en una orden en proceso, y que un mecánico no tiene acceso.

### Pruebas de la historia (escribir primero)

- [X] T015 [P] [US1] Escribir `server/tests/contract/payments.contract.test.js` para `GET /api/orders/:id/payments`, `POST /api/orders/:id/payments`, `GET /api/payments`, `GET /api/payments/:id`, `POST /api/payments/:id/cancel` y `POST /api/payments/:id/void` según `contracts/api.md` (forma de `Payment` y `PaymentSummary`, `meta.approvedTotal`, errores `PAYMENT_ORDER_NOT_PAYABLE`, `PAYMENT_EXCEEDS_BALANCE` con `details`, `PAYMENT_INVALID_STATE`)
- [X] T016 [P] [US1] Escribir `server/tests/contract/orderPayment.contract.test.js`: el detalle de la orden trae `payment` (`PaymentSummary`) y `ticketId`, el listado trae `paymentStatus`, el mecánico recibe `payment: null` y `paymentStatus: null`, y el filtro `paymentStatus` solo se aplica para administración y recepción; actualizar `server/tests/contract/orders.contract.test.js` y `server/tests/contract/orderWork.contract.test.js` con los campos nuevos
- [X] T017 [P] [US1] Escribir `server/tests/integration/payments.test.js`: un pago por el total deja la orden `PAID` con saldo 0; abonos llevan `UNPAID → PARTIAL → PAID`; el resumen se actualiza con cada pago; importe mayor al saldo, cero, negativo o con tres decimales → rechazado sin cambios; orden `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION` o `ESPERANDO_REFACCION` → 409 `PAYMENT_ORDER_NOT_PAYABLE`; orden con total 0 → 409; orden `TERMINADO` y `ENTREGADO` aceptan pagos; orden pagada por completo → 409; el pago guarda orden, usuario, fecha e importe exacto (centavos); cancelar un `PENDIENTE` libera su importe y un `APROBADO` no se cancela (409); anular exige administrador y motivo, deja `ANULADO` con motivo, usuario y fecha, recupera el saldo y no se puede anular dos veces; los pagos nunca se eliminan (sin ruta `DELETE`); el listado filtra por estado, método, rango de fechas y búsqueda por folio, cliente o placa, y `meta.approvedTotal` suma los aprobados del filtro; detalle inexistente → 404
- [X] T018 [P] [US1] Escribir `server/tests/integration/paymentConcurrency.test.js`: dos pagos simultáneos que juntos superan el saldo → exactamente uno `201` y el otro `409 PAYMENT_EXCEEDS_BALANCE`; una ráfaga de N pagos pequeños nunca deja `paid > total`; un pago y una anulación simultáneos mantienen el resumen coherente; la suma de pagos aprobados nunca supera el total en ninguna orden al terminar

### Implementación de la historia

- [X] T019 [US1] Crear `server/models/paymentModel.js` con `mapPayment`, `insert`, `findById` (une orden, cliente y placa), `listByOrder`, `list({ status, method, from, to, search, limit, offset })` con `approvedTotal` (búsqueda con `escapeLike`), `sumsByOrder(orderId, db)` (aprobado y pendiente), `updateStatus(id, desde, hacia, campos, db)` condicionado a `WHERE status = ?` y `markVoided`; el campo `amount` se devuelve como número
- [X] T020 [P] [US1] Crear `server/validators/paymentValidators.js` con `zod`: `registerPaymentBody` (importe positivo con hasta dos decimales y máximo 99999999.99), `voidPaymentBody` (`reason` 1 a 255 caracteres), `listPaymentsQuery` (`status`, `method`, `from`, `to` en `YYYY-MM-DD`, `search`, `page`, `pageSize`) y `paymentParams`
- [X] T021 [US1] Crear `server/services/paymentService.js` con `getOrderPayments`, `registerPayment`, `listPayments`, `getPayment`, `cancelPayment` y `voidPayment`: cada operación que cambia pagos bloquea la orden con `orderModel.lockOrder`, recalcula las sumas con `paymentModel.sumsByOrder` y `computeBalance`, valida con `canRegisterPayment` y rechaza con las fábricas de error; los campos `canCancel`, `canVoid` y `canRefresh` de `Payment` se calculan según el usuario
- [X] T022 [US1] Ampliar `server/services/orderService.js` (`toSummary` y `buildOrderDetail`) con `payment` (`PaymentSummary` solo para administración y recepción; `null` para el mecánico), `paymentStatus` en el listado y `ticketId`; aplicar el filtro `paymentStatus` solo para esos roles; y ampliar `listOrdersQuery` en `server/validators/orderValidators.js`
- [X] T023 [P] [US1] Crear `server/controllers/paymentController.js` y `server/routes/paymentRoutes.js` con `GET /` y `GET /:id`, `POST /:id/cancel` y `POST /:id/void` (esta última solo `ADMIN`), todas con `authenticate` y `authorize(ROLES.ADMIN, ROLES.RECEPTIONIST)`; montar `/api/payments` en `server/app.js`
- [X] T024 [US1] Agregar a `server/routes/orderRoutes.js` `GET /:id/payments` y `POST /:id/payments` (solo `ADMIN` y `RECEPTIONIST`) usando `paymentController`
- [X] T025 [P] [US1] Crear `client/lib/models/payment.dart` (`PaymentMethod`, `PaymentStatus`, `OrderPaymentStatus` con etiquetas y colores del sistema de diseño, `Payment`, `PaymentSummary`) y ampliar `client/lib/models/service_order.dart` con `payment`, `paymentStatus` y `ticketId`
- [X] T026 [P] [US1] Crear `client/lib/services/payments_service.dart` y `client/lib/providers/payments_provider.dart` con pagos de una orden, registro, listado con filtros y paginación, cancelar y anular; registrar el proveedor en `client/lib/main.dart`
- [X] T027 [P] [US1] Crear `client/lib/widgets/payment_summary_card.dart` (total, pagado, pendiente, saldo y chip del estado de pago), `client/lib/widgets/payments_table.dart` (fecha, método, importe, estado, referencia, usuario y acciones según `canCancel`/`canVoid`) y `client/lib/widgets/void_payment_dialog.dart` (motivo obligatorio y confirmación)
- [X] T028 [US1] Agregar a `client/lib/screens/orders/order_detail_screen.dart` la sección "Pagos" (solo administración y recepción, con el resumen, la tabla y el botón "Registrar pago" que se habilita con la orden `TERMINADO` o `ENTREGADO` y saldo disponible), con confirmación al cancelar un cobro pendiente y al anular un pago
- [X] T029 [US1] Crear `client/lib/screens/payments/payments_list_screen.dart` (tabla con orden, cliente, placa, método, importe y estado; filtros por estado, método y fechas; búsqueda; total aprobado del filtro; estados de carga, vacío y error en español), registrar la ruta en `client/lib/router.dart` y agregar "Pagos" (administración y recepción) a `client/lib/widgets/app_shell.dart`
- [X] T030 [US1] Mostrar en `client/lib/screens/orders/orders_list_screen.dart` el chip de estado de pago y el filtro "Por cobrar" para administración y recepción; y en `order_detail_screen.dart` pedir confirmación al entregar una orden con saldo pendiente mostrando el saldo (aclaración del 2026-10-14)
- [X] T031 [P] [US1] Escribir `client/test/payment_summary_test.dart`, `client/test/order_payments_section_test.dart` y `client/test/payments_list_screen_test.dart` (resumen y chips, sección de pagos por rol, botón deshabilitado en orden en proceso, cancelar y anular con confirmación y motivo obligatorio, listado con filtros, vacío y error, entrega con aviso del saldo) apoyándose en `client/test/helpers/fake_api.dart`, al que se agregan `paymentJson` y `paymentSummaryJson`

**Punto de control**: se registran y consultan pagos con saldo correcto y sin posibilidad de cobrar de más (CA-1).

---

## Fase 4: Historia de usuario 2 — Seleccionar el método de pago (Prioridad: P1)

**Meta**: Como recepcionista, quiero seleccionar el método de pago para dejar constancia de cómo se cobró.

**Prueba independiente**: Registrar un pago con cada método manual, comprobar el cambio en efectivo, la referencia en tarjeta y transferencia y que nunca se pide ni se guarda un dato de tarjeta.

### Pruebas de la historia (escribir primero)

- [X] T032 [P] [US2] Escribir `server/tests/integration/paymentMethods.test.js`: efectivo, tarjeta y transferencia quedan `APROBADO` de inmediato; efectivo con `receivedAmount` devuelve `change` y no lo guarda (no existe columna ni campo en el pago); `receivedAmount` menor al importe → 400; `receivedAmount` con tarjeta o transferencia → 400; `reference` con tarjeta y transferencia se conserva, hasta 100 caracteres (101 → 400), y con efectivo → 400; un método fuera de los cuatro → 400; `MERCADO_PAGO` en el endpoint manual → 400 (se usa su propio endpoint); campos de tarjeta como `cardNumber`, `cvv` o `expiry` → 400 y ninguno se guarda; el cuerpo de la respuesta y las columnas de `payments` no contienen datos de tarjeta; recepción y administración pueden, mecánico 403

### Implementación de la historia

- [X] T033 [US2] Ampliar `registerPaymentBody` en `server/validators/paymentValidators.js` con `method` (enum de los tres métodos manuales), `reference` opcional (máximo 100, solo tarjeta y transferencia), `receivedAmount` opcional (solo efectivo, mayor o igual al importe) y rechazo de cualquier campo desconocido (`.strict()`), y ajustar `registerPayment` en `server/services/paymentService.js` para calcular y devolver `change` sin guardarlo
- [X] T034 [P] [US2] Crear `client/lib/widgets/payment_dialog.dart` con el selector de método (efectivo, tarjeta, transferencia), importe (por omisión el saldo disponible, validado contra el saldo), importe recibido y cambio calculado para efectivo, referencia opcional para tarjeta y transferencia, y mensajes de error del servidor; conectarlo al botón "Registrar pago" de la sección "Pagos" de `order_detail_screen.dart`
- [X] T035 [P] [US2] Escribir `client/test/payment_dialog_test.dart` (los tres métodos, importe por omisión igual al saldo, importe mayor al saldo rechazado en el formulario, cambio calculado, referencia solo con tarjeta y transferencia, ningún campo de tarjeta en el formulario, error `PAYMENT_EXCEEDS_BALANCE` mostrado, confirmación del éxito con el cambio)

**Punto de control**: los cuatro métodos están definidos y los tres manuales funcionan de punta a punta (CA-2).

---

## Fase 5: Historia de usuario 4 — Generar el ticket de servicio (Prioridad: P1)

**Meta**: Como recepcionista, quiero generar tickets de servicio para entregar comprobante al cliente.

**Prueba independiente**: Generar el ticket de una orden con servicios, refacciones y mano de obra, comprobar que trae todos los datos, que regenerarlo devuelve el mismo folio, y que se ve en pantalla y se manda a imprimir.

### Pruebas de la historia (escribir primero)

- [X] T036 [P] [US4] Escribir `server/tests/unit/ticketBuilder.test.js` para `buildTicket(...)` (función pura): incluye folio del ticket y de la orden, datos del taller, cliente, vehículo con placas y kilometraje de entrada y de servicio, servicios, mano de obra y refacciones con importes, subtotales por tipo, total, pagos, total pagado, saldo y estado de pago; solo lista pagos `APROBADO` y `PENDIENTE`; usa los datos predeterminados del taller cuando faltan; un pago anulado, cancelado o rechazado no aparece pero no altera el total; las sumas coinciden con las de la orden al centavo
- [X] T037 [P] [US4] Escribir `server/tests/contract/tickets.contract.test.js` para `POST /api/orders/:id/ticket`, `GET /api/tickets/:id` y `GET /api/tickets` según `contracts/api.md` (forma de `Ticket` completa, `201` al crear y `200` al reutilizar, `meta`)
- [X] T038 [P] [US4] Escribir `server/tests/integration/tickets.test.js`: se genera para `TERMINADO` y `ENTREGADO` y se rechaza (409 `TICKET_ORDER_NOT_READY`) para los demás estados; regenerar devuelve el mismo `id` y `folio` (`TK-` + 6 dígitos) sin crear otro registro; dos solicitudes simultáneas crean un solo ticket; el contenido coincide con la orden, el cliente, el vehículo y sus líneas; el estado de pago del ticket refleja los pagos vigentes (sin pagar, parcial, pagada) y cambia después de nuevos pagos o de una anulación mientras el contenido de la orden no cambia; guarda quién lo generó; los datos del taller salen de `app_settings` o de los predeterminados; el listado busca por folio del ticket o de la orden, cliente y placa y pagina; mecánico 403 y sin token 401; ticket inexistente → 404

### Implementación de la historia

- [X] T039 [US4] Crear `server/models/ticketModel.js` con `insert`, `setFolio` (`TK-` + id con 6 dígitos en la misma transacción del alta), `findById`, `findByOrderId` y `list({ search, limit, offset })` con orden, cliente y placa
- [X] T040 [US4] Crear `server/utils/ticketBuilder.js` con `buildTicket({ ticket, order, client, vehicle, services, labor, parts, payments, workshop, generatedBy })` que arma el objeto `Ticket` del contrato usando `money.js` y `paymentBalance.js`, hasta que pasen las pruebas de T036
- [X] T041 [US4] Crear `server/services/ticketService.js` con `generateTicket` (en transacción: bloquea la orden, valida `TERMINADO`/`ENTREGADO`, devuelve el existente o inserta uno con folio), `getTicket` y `listTickets`, reutilizando `orderModel`, `paymentModel` y `settingsModel.getWorkshopSettings`
- [X] T042 [P] [US4] Crear `server/validators/ticketValidators.js`, `server/controllers/ticketController.js` y `server/routes/ticketRoutes.js` con `GET /` y `GET /:id` (solo `ADMIN` y `RECEPTIONIST`); montar `/api/tickets` en `server/app.js` y agregar `POST /:id/ticket` a `server/routes/orderRoutes.js`
- [X] T043 [P] [US4] Crear `client/lib/models/ticket.dart`, `client/lib/services/tickets_service.dart` y `client/lib/providers/tickets_provider.dart` con generar y consultar; registrar el proveedor en `client/lib/main.dart`
- [X] T044 [P] [US4] Crear `client/lib/utils/ticket_pdf.dart` con `buildTicketPdf(Ticket)` (función pura que devuelve los bytes del PDF con la fuente estándar, a un ancho de comprobante, con todos los datos del ticket)
- [X] T045 [US4] Crear `client/lib/widgets/ticket_view.dart` (comprobante en pantalla con los datos del taller, folio, cliente, vehículo, tablas de servicios, mano de obra y refacciones, subtotales, total, pagos y estado de pago, con los tokens del sistema de diseño) y `client/lib/screens/tickets/ticket_screen.dart` con el botón "Imprimir" (`Printing.layoutPdf`) y estados de carga y error; registrar la ruta en `client/lib/router.dart`
- [X] T046 [US4] Agregar a `client/lib/screens/orders/order_detail_screen.dart` el botón "Generar ticket" / "Ver ticket" (administración y recepción, con la orden `TERMINADO` o `ENTREGADO`) que genera o abre el ticket
- [X] T047 [P] [US4] Escribir `client/test/ticket_view_test.dart`, `client/test/ticket_pdf_test.dart` (los bytes empiezan con `%PDF` y no están vacíos; contienen folio y total) y `client/test/ticket_screen_test.dart` (muestra los datos, el botón Imprimir, error con reintento, el botón de la orden por rol y estado)

**Punto de control**: el cliente recibe un comprobante completo que se ve e imprime (CA-4, CA-5).

---

## Fase 6: Historia de usuario 3 — Cobrar con Mercado Pago (Prioridad: P2)

**Meta**: Como recepcionista, quiero gestionar pagos mediante Mercado Pago para ofrecer una opción digital.

**Prueba independiente**: Con Mercado Pago simulado, crear un cobro, ver su enlace y su importe reservado, actualizar el estado hasta `APROBADO` (una sola vez), y comprobar los casos rechazado, pendiente, cancelado y sin configuración.

### Pruebas de la historia (escribir primero)

- [X] T048 [P] [US3] Crear `server/tests/helpers/mercadoPagoStub.js`: servidor HTTP local (`http.createServer`, puerto 0) que imita `POST /checkout/preferences` (valida `Authorization: Bearer`, devuelve `id`, `init_point` y `sandbox_init_point` y registra la solicitud recibida) y `GET /v1/payments/search` (devuelve los resultados configurados por referencia), con modos de falla (500, respuesta lenta, JSON inválido) y funciones `start()`, `stop()`, `setPayments(reference, [...])` y `requests`
- [X] T049 [P] [US3] Escribir `server/tests/integration/mercadoPagoClient.test.js` contra el servidor simulado: `createPreference` envía título, importe, moneda `MXN` y `external_reference`, usa `sandbox_init_point` con `MP_MODE=sandbox` y `init_point` en otro caso; `findPaymentByReference` prefiere el pago aprobado y si no el más reciente; sin `MP_ACCESS_TOKEN` lanza `MP_NOT_CONFIGURED`; error 500, respuesta inválida y tiempo de espera agotado (10 s, se prueba con un tiempo corto configurable) lanzan un error controlado; el token nunca aparece en mensajes de error ni en los registros
- [X] T050 [P] [US3] Escribir `server/tests/integration/mercadoPago.test.js` (servicio y API con el servidor simulado): el alta crea un pago `PENDIENTE` con `externalReference` `MTX-<folio>-…`, `paymentUrl` y el importe indicado o el saldo disponible; reserva saldo (`available` baja y `paid` no cambia); importe mayor al disponible → 409; un segundo cobro con uno pendiente → 409 `PAYMENT_PENDING_EXISTS` con el pendiente en `details`; un pago manual que supera el saldo disponible por la reserva → 409; `refresh` aprobado → `APROBADO` y el saldo baja, repetirlo no cambia nada; rechazado o cancelado en Mercado Pago → `RECHAZADO` y libera la reserva; en proceso, pendiente o sin resultados → sigue `PENDIENTE`; cancelar un cobro pendiente → `CANCELADO` y libera la reserva; `refresh` de un pago manual o ya cerrado → 409; no existe forma de aprobar un cobro a mano; anular un cobro aprobado (administración) recupera el saldo; sin configuración o con Mercado Pago caído → 503 y ningún pago nuevo; ninguna respuesta de la API ni columna de `payments` contiene el token ni datos de tarjeta; recepción y administración pueden, mecánico 403
- [X] T051 [P] [US3] Escribir `server/tests/contract/mercadoPago.contract.test.js` para `POST /api/orders/:id/payments/mercado-pago` y `POST /api/payments/:id/refresh` según `contracts/api.md`, incluidos `201`, `409 PAYMENT_PENDING_EXISTS` y `503 PAYMENT_PROVIDER_UNAVAILABLE`

### Implementación de la historia

- [X] T052 [US3] Crear `server/integrations/mercadoPagoClient.js` con `createPreference({ title, amount, externalReference })` y `findPaymentByReference(externalReference)` usando `fetch`, `Authorization: Bearer` desde `env.mercadoPago.accessToken`, `AbortSignal.timeout` y errores controlados (`MP_NOT_CONFIGURED`, `MP_UNAVAILABLE`); no registrar en logs ni propagar el token; la URL base y el tiempo de espera configurables para las pruebas
- [X] T053 [US3] Ampliar `server/models/paymentModel.js` con `insertPending` (Mercado Pago), `findByExternalReference` y `markApproved`/`markRejected` condicionados a `status = 'PENDIENTE'`, y `server/services/paymentService.js` con `createMercadoPagoCharge` (validar saldo disponible, generar la referencia, crear la preferencia fuera de la transacción y registrar el pago con la orden bloqueada, revalidando saldo y cobro pendiente) y `refreshPayment` (consulta, traduce el estado y aplica el cambio de forma idempotente con la orden bloqueada); traducir los errores del cliente a `paymentProviderUnavailable`
- [X] T054 [P] [US3] Ampliar `server/validators/paymentValidators.js` (`mercadoPagoBody`: `amount` opcional) y `server/controllers/paymentController.js`; agregar `POST /:id/payments/mercado-pago` a `server/routes/orderRoutes.js` y `POST /:id/refresh` a `server/routes/paymentRoutes.js`
- [X] T055 [P] [US3] Ampliar `client/lib/services/payments_service.dart` y `client/lib/providers/payments_provider.dart` con crear cobro de Mercado Pago, actualizar estado y cancelar
- [X] T056 [US3] Crear `client/lib/widgets/mercado_pago_dialog.dart` (importe por omisión el saldo disponible, creación del cobro, enlace de pago visible con "Abrir enlace" mediante `url_launcher` y "Copiar enlace", aviso de que el pago se completa en la página de Mercado Pago y de que nunca se piden datos de tarjeta) y agregar la opción "Mercado Pago" al selector de `payment_dialog.dart`
- [X] T057 [US3] Agregar a `client/lib/widgets/payments_table.dart` y a la sección "Pagos" las acciones "Actualizar estado" (cuando `canRefresh`), "Abrir enlace" y "Cancelar cobro" (con confirmación), y los mensajes claros cuando Mercado Pago no está disponible
- [X] T058 [P] [US3] Escribir `client/test/mercado_pago_dialog_test.dart` (crear cobro, enlace mostrado, copiar, error 503 con mensaje claro y sin cobro registrado, importe mayor al saldo, cobro pendiente existente) y ampliar `client/test/order_payments_section_test.dart` (actualizar estado cambia a aprobado, cancelar con confirmación)

**Punto de control**: el cobro digital funciona de punta a punta en modo de pruebas y sin datos sensibles (CA-3, CA-7).

---

## Fase 7: Historias de usuario 5 y 6 — Panel de control (Prioridad: P2)

**Meta (US5)**: Como administrador, quiero consultar información general desde el panel de control para supervisar el taller. **Meta (US6)**: Como administrador, quiero visualizar órdenes, citas, mantenimientos y alertas de inventario en el panel.

**Prueba independiente**: Iniciar sesión como administrador, ver el panel como pantalla de inicio con indicadores que coinciden con los listados de los módulos, actualizar, abrir cada módulo desde su indicador y comprobar que recepción y mecánico no acceden.

### Pruebas de la historia (escribir primero)

- [X] T059 [P] [US5] Escribir `server/tests/contract/dashboard.contract.test.js` para `GET /api/dashboard` según `contracts/api.md` (forma completa: `generatedAt`, `orders`, `appointments` con `next`, `maintenance`, `inventory` con `critical`, `payments`), `403` para recepción y mecánico y `401` sin token
- [X] T060 [P] [US6] Escribir `server/tests/integration/dashboard.test.js`: las órdenes por estado y las entregadas hoy coinciden con `GET /api/orders`; las citas de hoy y de los próximos 7 días solo cuentan pendientes y confirmadas y `next` es la siguiente por fecha; los mantenimientos vencidos y próximos coinciden con `GET /api/maintenance` y los umbrales cambian el resultado; las alertas de inventario coinciden con `GET /api/parts/alerts` y `critical` trae hasta 5 con las agotadas primero; cobrado hoy suma solo pagos `APROBADO` de hoy (no anulados), saldo pendiente y órdenes por cobrar coinciden con los saldos de las órdenes `TERMINADO` y `ENTREGADO`; sin datos devuelve ceros, `next: null` y `critical: []`; ningún dato se duplica (un pago anulado cambia los tres importes); `generatedAt` es reciente
- [X] T061 [P] [US5] Escribir en `server/tests/integration/dashboard.test.js` los casos de permisos (administrador 200; recepción y mecánico 403 sin exponer datos; sin token 401) y de recalculo (tras registrar un pago o entregar una orden, la siguiente consulta refleja el cambio)

### Implementación de la historia

- [X] T062 [US6] Extraer en `server/models/maintenanceModel.js` las expresiones SQL de vencido y próximo para compartirlas y agregar `countByClassification({ today, thresholds })` (vencidos y próximos de mantenimientos pendientes), sin cambiar el comportamiento de `listForAlerts` (las pruebas del Sprint 3 deben seguir pasando)
- [X] T063 [US6] Crear `server/models/dashboardModel.js` con las consultas de conteo y suma: `ordersByStatus`, `deliveredToday` (`DATE(delivered_at) = CURDATE()`), `appointmentCounts` y `nextAppointment`, `criticalParts(limit)`, `collectedToday`, `receivableTotals` (saldo y número de órdenes `TERMINADO` o `ENTREGADO` con saldo mayor a cero, con las mismas reglas de `paymentBalance.js`)
- [X] T064 [US6] Crear `server/services/dashboardService.js` que ejecuta en paralelo las consultas de `dashboardModel`, `maintenanceModel.countByClassification`, `partModel.countAlerts` y los umbrales de `settingsModel`, y arma el objeto del contrato con `generatedAt`
- [X] T065 [P] [US5] Crear `server/controllers/dashboardController.js` y `server/routes/dashboardRoutes.js` con `GET /` solo para `ADMIN`; montar `/api/dashboard` en `server/app.js`
- [X] T066 [P] [US5] Crear `client/lib/models/dashboard.dart`, `client/lib/services/dashboard_service.dart` y `client/lib/providers/dashboard_provider.dart` (carga, error, actualizar); registrar el proveedor en `client/lib/main.dart`
- [X] T067 [P] [US6] Crear `client/lib/widgets/dashboard_tile.dart` (tarjeta con título, cifra principal, detalle y acción; estado vacío y colores de estado: ámbar para próximo o stock bajo, rojo para vencido o agotada, verde para cobrado) con los tokens del sistema de diseño
- [X] T068 [US6] Crear `client/lib/screens/dashboard/dashboard_screen.dart` con las secciones Órdenes, Citas, Mantenimientos, Inventario y Pagos, la lista de refacciones críticas y la siguiente cita; cada indicador lleva a su módulo (órdenes, citas, mantenimientos, inventario con el filtro de alertas o pagos); mensaje de vacío por sección
- [X] T069 [US5] Mostrar en el panel la hora de la última actualización, el botón "Actualizar", los estados de carga y el error con reintento; registrar la ruta en `client/lib/router.dart`; agregar "Panel" (solo administrador) a `client/lib/widgets/app_shell.dart` y hacer del panel la pantalla de inicio del administrador en `AuthGate`
- [X] T070 [P] [US5] Escribir `client/test/dashboard_screen_test.dart` (todas las secciones con datos, vacíos, error con reintento, actualizar vuelve a pedir y cambia la hora, cada indicador abre su módulo, no se desborda en 800 px) y ampliar `client/test/app_shell_menu_test.dart` (el administrador ve "Panel" y "Pagos", recepción solo "Pagos", el mecánico ninguno) y la prueba de la ruta inicial por rol

**Punto de control**: el administrador supervisa el taller de un vistazo con datos reales (CA-6).

---

## Fase 8: Datos de ejemplo, pulido y cierre

**Propósito**: Datos para ver el sprint sin capturar nada, rendimiento, documentación y revisión final.

- [X] T071 Crear `database/seeds/004_sample_payments_tickets.sql` idempotente: pagos sobre las órdenes terminadas y entregadas de ejemplo (una pagada en efectivo, una pagada con tarjeta con referencia de autorización, una con abono por transferencia, una pagada con un cobro de Mercado Pago aprobado, una con un cobro de Mercado Pago pendiente, un pago anulado con motivo y un cobro cancelado, y órdenes sin pagar), con fechas de hoy y de días anteriores para que "cobrado hoy" sea mayor a cero; los de Mercado Pago llevan referencias ficticias que contienen "EJEMPLO" y nunca se consultan en Mercado Pago real; tickets para las órdenes pagadas y la parcial; idempotente por `external_reference` y por (orden, método, importe, referencia) y por orden en tickets; sin secretos ni datos de tarjeta
- [X] T072 Escribir `server/tests/integration/sprint4Seeds.test.js`: conteos por estado y método, órdenes en `UNPAID`, `PARTIAL` y `PAID`, `aprobado ≤ total` en todas las órdenes, un solo cobro de Mercado Pago pendiente por orden, folios únicos de tickets, "cobrado hoy" mayor a cero en el panel, el panel muestra indicadores distintos de cero, y ejecutar los seeds dos veces más no duplica ningún registro; ajustar `sprint2Seeds.test.js` y `sprint3Seeds.test.js` para cargar solo hasta su número de seed (`runSeeds(conexion, { hasta: '00N' })`)
- [X] T073 [P] Escribir `server/tests/integration/sprint4Performance.test.js` (SC-007): con 1 000 órdenes, 1 000 citas, 5 000 refacciones y 5 000 pagos, `GET /api/dashboard`, el listado de pagos (con filtros y búsqueda) y el de tickets responden en menos de 2 segundos; la prueba prepara y limpia sus propios datos
- [X] T074 [P] Escribir `server/tests/integration/paymentPermissionsMatrix.test.js`: la matriz completa de `contracts/api.md` por rol y por endpoint (200/201/403/404), incluida la anulación solo para administración, el resumen `payment` en `null` para el mecánico y el rechazo sin token (401) en todas las rutas nuevas
- [X] T075 [P] Escribir `client/test/sprint4_narrow_window_test.dart` (ventana de 800 px): panel, pagos de la orden, diálogos de pago y de Mercado Pago, listado de pagos y ticket no se desbordan
- [X] T076 [P] Fusionar `specs/004-pagos-tickets-dashboard/contracts/api.md` en `docs/api.md` (sección "Sprint 4": pagos, tickets y panel, errores nuevos y matriz de permisos) y actualizar la referencia de contratos de su encabezado
- [X] T077 [P] Actualizar `README.md` (funciones del Sprint 4, variables de Mercado Pago sin valores, cómo obtener las credenciales de pruebas y el flujo de demostración) y `database/README.md` (migración 004, seed 004, claves del taller en `app_settings` y cómo cambiarlas)
- [X] T078 Revisión de seguridad y de interfaz: permisos solo en el servidor en cada ruta nueva; entradas validadas con `zod` con `.strict()` donde corresponde; el token de Mercado Pago no aparece en respuestas, errores, registros ni pruebas; ningún campo de tarjeta en cuerpos, columnas ni formularios; colores y tipografía solo desde los tokens de `docs/design-system.md`; confirmaciones al anular un pago, cancelar un cobro, entregar con saldo y salir de un formulario con cambios; sin `.env` con valores reales en el repositorio
- [X] T079 Ejecutar `npm test` (backend completo contra `motorix_test`), `flutter analyze` y `flutter test`, corregir regresiones de los Sprint 1 a 3 (en particular las formas exactas de la orden y el menú por rol) y compilar con `flutter build web`
- [X] T080 Recorrer `specs/004-pagos-tickets-dashboard/quickstart.md` contra la API y la interfaz reales con una base reiniciada (`npm run db:reset`), usando el servidor simulado de Mercado Pago o, si el equipo las proporciona, credenciales de pruebas en `.env`, anotando cada paso comprobado y corrigiendo lo que falle
- [ ] T081 Actualizar `docs/project-context.md` y, si el equipo lo aprueba, la constitución con las decisiones del sprint (estados de pago en español, ticket por orden, abonos y reserva de saldo, Mercado Pago con enlace de pago y actualización manual, dependencias `pdf`, `printing` y `url_launcher`, panel solo para administradores); **requiere aprobación del equipo antes de modificarse**, como T096 del Sprint 3

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (F1)** → **Fundamentos (F2)** → todas las historias.
- **US1 (F3)** es la base de pagos: US2, US3, US4 (estado de pago en el ticket) y el panel (cobros) dependen de `paymentModel`, `paymentService` y del resumen de pago.
- **US2 (F4)** depende de US1 (amplía el registro con las reglas de cada método).
- **US4 (F5)** depende de US1 para mostrar los pagos, pero puede avanzar en paralelo con US2 una vez terminada la parte backend de US1.
- **US3 (F6)** depende de US1 y de la configuración de T003; se desarrolla contra el servidor simulado de T048.
- **US5 y US6 (F7)** dependen de US1 (cobros), de los módulos de los Sprint 2 y 3 (ya existentes) y de T062; el panel puede avanzar en paralelo con US3.
- **Cierre (F8)** al final; T071 requiere las tablas de la migración y T079–T081 cierran el sprint.

### Dentro de cada historia

Pruebas (que fallen) → modelo → validadores → servicio → controlador y rutas → cliente (modelo, servicio, proveedor) → pantallas → pruebas de Flutter.

### Oportunidades de paralelismo

- Fundamentos: T005, T007–T011 y T014 en paralelo tras T004 (T006, T012 y T013 requieren la migración aplicada).
- Backend de US1 y cliente de US1 pueden avanzar en paralelo una vez fijado `contracts/api.md`.
- Dentro de cada fase, las pruebas de contrato e integración marcadas [P] se escriben juntas.
- US4 (ticket) y US3 (Mercado Pago) y el panel (US5/US6) pueden desarrollarse en paralelo por personas distintas; los conflictos probables están en `order_detail_screen.dart`, `app_shell.dart`, `router.dart`, `main.dart` y `paymentService.js`: coordinar el orden de fusión.

### Ejemplo de paralelismo (US3)

```text
Pruebas:        T048, T049, T050, T051 en paralelo
Backend:        T052 → T053; T054 [P]
Cliente:        T055 [P] → T056 → T057 → T058 [P]
```

## Estrategia de implementación

1. **MVP (cobro y comprobante)**: Preparación + Fundamentos + US1 + US2 + US4. Con esto recepción cobra con efectivo, tarjeta o transferencia y entrega un ticket impreso (CA-1, CA-2, CA-4, CA-5).
2. **Cobro digital**: US3 agrega Mercado Pago en modo de pruebas (CA-3, CA-7).
3. **Supervisión**: US5 y US6 entregan el panel del administrador (CA-6).
4. **Cierre**: seeds, rendimiento, permisos, documentación y recorrido del quickstart. Cada historia se considera terminada solo cuando funciona de extremo a extremo (Principio VII).
5. **Pendiente del equipo**: T081 no se ejecuta sin aprobación.
