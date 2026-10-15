# Investigación (Fase 0): Pagos, tickets y panel de control

**Funcionalidad**: [spec.md](spec.md) | **Fecha**: 2026-10-14

El Contexto técnico no tiene marcadores `NEEDS CLARIFICATION`: el stack y las convenciones existen desde los Sprint 1 a 3. Este documento registra las decisiones de diseño propias del Sprint 4.

## D1. Importes en centavos y cálculo del saldo como función pura

- **Decisión**: los importes se guardan en `DECIMAL(12,2)` y toda la aritmética del servidor se hace en centavos enteros (`utils/money.js`: `toCents`, `fromCents`). El saldo se calcula con una función pura (`utils/paymentBalance.js`) a partir del total, lo aprobado y lo pendiente:
  - `total` = servicios + mano de obra + refacciones de la orden (ya lo calcula `orderModel`);
  - `paid` = suma de pagos `APROBADO`;
  - `pending` = suma de pagos `PENDIENTE` (cobros de Mercado Pago que reservan saldo);
  - `balance` = `total − paid` (lo que falta por cobrar);
  - `available` = `total − paid − pending` (lo que aún se puede registrar o cobrar);
  - `status` = `NO_CHARGE` si `total = 0`; `UNPAID` si `paid = 0`; `PAID` si `paid ≥ total`; `PARTIAL` en otro caso.
- **Justificación**: evita errores de coma flotante (SC-002) y permite probar exhaustivamente la lógica sin base de datos (CA-8).
- **Alternativas**: sumar `DECIMAL` solo en SQL (la regla quedaría repartida y sin pruebas unitarias); guardar el estado de pago en la orden (se desactualiza con cada pago).

## D2. Concurrencia al registrar pagos

- **Decisión**: todo alta, aprobación, cancelación o anulación de un pago se ejecuta en una transacción que primero bloquea la fila de la orden (`SELECT … FOR UPDATE`, ya existe `orderModel.lockOrder`), luego recalcula el saldo con las sumas vigentes de `payments` y finalmente inserta o actualiza. Dos registros simultáneos de la misma orden se serializan; el segundo ve el saldo ya reducido y recibe `409 PAYMENT_EXCEEDS_BALANCE`.
- **Justificación**: es el mismo patrón que el inventario del Sprint 3 (D7) y cumple FR-010 sin condiciones de carrera.
- **Alternativas**: restricción `CHECK` entre tablas (MySQL no lo permite); columna acumulada en la orden (otra copia que sincronizar).

## D3. Estados y transiciones de un pago

- **Decisión**: `PENDIENTE`, `APROBADO`, `RECHAZADO`, `CANCELADO` y `ANULADO`. Transiciones:
  - efectivo, tarjeta y transferencia nacen `APROBADO`;
  - Mercado Pago nace `PENDIENTE` y pasa a `APROBADO` o `RECHAZADO` solo según lo que informa Mercado Pago;
  - `PENDIENTE → CANCELADO` (recepción o administración);
  - `APROBADO → ANULADO` (solo administración, con motivo).
  Cualquier otro cambio responde `409 PAYMENT_INVALID_STATE`. Los pagos nunca se eliminan (RN-9, FR-009).
- **Un cobro de Mercado Pago pendiente por orden**: columna generada `pending_mp_order_id = IF(method = 'MERCADO_PAGO' AND status = 'PENDIENTE', order_id, NULL)` con índice único, igual que el mantenimiento pendiente del Sprint 3 (D3). La base impide un segundo cobro pendiente aunque falle el servicio.
- **Justificación**: la aclaración del 2026-10-14 pide un cobro pendiente por orden que reserve saldo.
- **Alternativas**: estado "Pagado" como en `docs/project-context.md` (se usa `APROBADO` por coherencia con el vocabulario de Mercado Pago; ver decisiones por confirmar del plan).

## D4. Integración con Mercado Pago aislada y sin dependencias nuevas

- **Decisión**: `server/integrations/mercadoPagoClient.js` es la única parte que conoce la API de Mercado Pago. Usa `fetch` de Node 24 (sin SDK ni dependencias) contra `MP_API_URL` (por omisión `https://api.mercadopago.com`) con `Authorization: Bearer ${MP_ACCESS_TOKEN}` y un tiempo de espera de 10 s. Expone dos funciones:
  - `createPreference({ title, amount, externalReference })` → `POST /checkout/preferences`; devuelve el identificador de la preferencia y el enlace de pago (`sandbox_init_point` cuando `MP_MODE=sandbox`, que es el valor por omisión; `init_point` en otro caso);
  - `findPaymentByReference(externalReference)` → `GET /v1/payments/search?external_reference=…&sort=date_created&criteria=desc`; devuelve el pago más relevante (el aprobado si existe, si no el más reciente) con su estado y su identificador.
  El servicio de pagos (`paymentService`) usa el cliente; nada del dominio importa detalles de Mercado Pago.
- **Credenciales**: `MP_ACCESS_TOKEN` (y opcionalmente `MP_API_URL`, `MP_MODE`) solo por variables de entorno, documentadas sin valores en `.env.example`. Nunca se registran en logs ni se devuelven en la API. Sin token, el cliente responde `MP_NOT_CONFIGURED` y el servicio lo traduce a `503 PAYMENT_PROVIDER_UNAVAILABLE` sin crear ningún pago (FR-015).
- **Datos sensibles**: de Mercado Pago solo se guardan la referencia externa propia, el identificador del pago informado por Mercado Pago, el estado y el enlace de pago (una URL del proveedor, no un secreto). El cliente nunca captura datos de tarjeta: el pago ocurre en la página de Mercado Pago (RN-14, CA-3).
- **Justificación**: sin SDK no hay dependencia que justificar (Principio III), y el cliente aislado se prueba con un servidor HTTP simulado (D8).
- **Alternativas**: SDK oficial `mercadopago` (dependencia grande para dos llamadas); Checkout API con tokenización de tarjeta en la app (manejaría datos de tarjeta; descartado).

## D5. Flujo del cobro con Mercado Pago sin dirección pública

- **Decisión**: el MVP corre en una máquina local, sin URL pública donde Mercado Pago pueda notificar (webhook). Por eso el estado se actualiza a pedido: `POST /api/payments/:id/refresh` consulta a Mercado Pago por la referencia externa y aplica el resultado.
  1. Alta (`POST /api/orders/:id/payments/mercado-pago`): validar saldo disponible fuera de la transacción → generar `externalReference = MTX-<folio>-<8 caracteres aleatorios>` → crear la preferencia en Mercado Pago → en una transacción bloquear la orden, volver a validar el saldo y que no haya otro cobro pendiente, e insertar el pago `PENDIENTE`. Si Mercado Pago falla, no se inserta nada. Si la validación final falla por una carrera, la preferencia queda sin usar en el sandbox, sin consecuencias.
  2. Actualización: aprobado → `APROBADO` (solo si seguía `PENDIENTE`; el `UPDATE … WHERE status = 'PENDIENTE'` hace la aprobación idempotente); rechazado o cancelado en Mercado Pago → `RECHAZADO`; pendiente, en proceso o autorizado → sigue `PENDIENTE`; sin resultados → sigue `PENDIENTE`.
  3. Reembolsos o contracargos hechos en el panel de Mercado Pago no se sincronizan; se registran con la anulación manual (D3).
- **Alternativas**: webhook con túnel público (requiere infraestructura fuera del MVP); consulta automática periódica (carga innecesaria para un taller); aprobar manualmente (prohibido por FR-016).

## D6. Ticket: un registro por orden y contenido derivado

- **Decisión**: la tabla `tickets` guarda solo el folio propio (`TK-` + identificador con 6 dígitos), la orden (única), quién lo generó y cuándo. El contenido se arma al consultar a partir de la orden, el cliente, el vehículo, sus líneas y los pagos vigentes (RN-10: sin duplicar). Generar de nuevo devuelve el mismo ticket (`POST` idempotente: 201 al crearlo, 200 si ya existía). Solo se genera para órdenes `TERMINADO` o `ENTREGADO`.
- **Inmutabilidad del contenido**: los servicios, la mano de obra y las refacciones de una orden se bloquean al terminarla (Sprint 2 y 3), así que el contenido de la orden no cambia después de emitir el ticket; solo evolucionan los pagos, que el ticket muestra con su estado vigente (FR-020).
- **Datos del taller**: claves `workshop_name`, `workshop_address` y `workshop_phone` en `app_settings` (migración 004, con valores predeterminados), leídas con un respaldo en código para que nunca salgan vacías (FR-021).
- **Diferencia con `docs/project-context.md`**: allí el ticket lleva `paymentId`; aquí es por orden, porque los abonos pueden ser varios y el ticket resume todos (ver decisiones por confirmar).
- **Alternativas**: un ticket por pago (varios comprobantes por orden, menos claro); guardar una copia del contenido en JSON (duplica información y se desactualiza el estado de pago).

## D7. Impresión del ticket sin archivos en el servidor

- **Decisión**: el servidor solo entrega los datos del ticket en JSON. El cliente Flutter muestra la vista de comprobante y construye el PDF en memoria con los paquetes `pdf` y `printing`, que abren el diálogo de impresión del sistema (en el navegador y en Windows). No se guarda ningún archivo en el servidor (FR-019).
- **Dependencias nuevas** (justificación exigida por el Principio III y VIII): `pdf` (genera el documento) y `printing` (lo envía al diálogo de impresión). Son el estándar de Flutter para imprimir, gratuitas, funcionan en web y escritorio y evitan escribir código por plataforma. La fuente del PDF es la estándar de `pdf` (Helvetica), que cubre los acentos del español.
- **Pruebas**: la construcción del PDF es una función pura que se prueba obteniendo sus bytes; el diálogo de impresión no se prueba automáticamente.
- **Alternativas**: `window.print()` solo en web (sin impresión en escritorio); PDF generado en el servidor (almacenamiento y dependencia en el backend); solo capturar pantalla (no es un comprobante).

## D8. Pruebas de Mercado Pago contra un servidor simulado

- **Decisión**: las pruebas de integración levantan un servidor HTTP local (`http.createServer`) que imita las dos rutas de Mercado Pago y apuntan `MP_API_URL` y `MP_ACCESS_TOKEN` de prueba hacia él. Así se prueban las respuestas aprobada, rechazada, pendiente, sin resultados, error 500, tiempo de espera y la falta de configuración, sin red ni cuentas reales (FR-032). La validación con cuentas de prueba reales de Mercado Pago es manual (quickstart).
- **Alternativas**: simular `fetch` (acopla las pruebas a la implementación); llamar al sandbox real en las pruebas (lento, requiere red y credenciales).

## D9. Panel de control: consultas en paralelo sin tablas nuevas

- **Decisión**: `GET /api/dashboard` (solo administrador) arma el resumen en `dashboardService` ejecutando en paralelo consultas de conteo y suma sobre las tablas existentes, reutilizando las reglas de los módulos de origen:
  - órdenes: conteo por estado (`service_orders`) y entregadas hoy (`delivered_at`);
  - citas: de hoy y de los próximos 7 días, pendientes o confirmadas (`appointments`), y la siguiente;
  - mantenimientos: vencidos y próximos con las mismas expresiones SQL y umbrales de `app_settings` que el listado de avisos (se extrae `listForAlerts` para compartir la condición y se agrega un conteo);
  - inventario: `partModel.countAlerts()` y las 5 refacciones más críticas (agotadas primero, luego las de menor proporción entre existencia y mínimo);
  - pagos: cobrado hoy (suma de `APROBADO` de hoy), saldo pendiente y órdenes por cobrar (órdenes `TERMINADO` o `ENTREGADO` con saldo mayor a cero).
  No se guardan datos derivados y no hay caché: cada consulta calcula con datos vigentes (SC-006, "sin duplicar información").
- **"Hoy"**: el día local del servidor (`CURDATE()` para las columnas escritas con `NOW()` de MySQL y `todayLocal()` para las fechas de calendario), igual que en los módulos de origen.
- **Justificación**: un taller tiene cientos de órdenes abiertas como máximo; con los índices existentes cada consulta es inmediata.
- **Alternativas**: tabla de métricas precalculadas (duplica y se desactualiza); un endpoint por tarjeta (más viajes y estados parciales en la interfaz).

## D10. Resumen de pago de la orden

- **Decisión**: el detalle de la orden (y el listado) agrega un resumen de pago para administración y recepción: `payment: { total, paid, pending, balance, available, status }`. Para el mecánico el campo es `null`: no accede a pagos (FR-028). El cálculo usa la función pura de D1 con una subconsulta de pagos aprobados y pendientes por orden.
- **Entrega con saldo**: el estado de la orden sigue su propia máquina de estados (Sprint 2); entregar con saldo pendiente se permite. La interfaz muestra un aviso con el saldo y pide confirmación (aclaración del 2026-10-14); el servidor no lo exige.
- **Alternativas**: bloquear la entrega hasta pagar (cambia reglas del Sprint 2 y no fue pedido).

## D11. Permisos

| Recurso | ADMIN | RECEPTIONIST | MECHANIC |
|---------|:-----:|:------------:|:--------:|
| Ver pagos de una orden y el listado de pagos | sí | sí | no |
| Registrar pagos, crear cobro de Mercado Pago, actualizar su estado, cancelar un pendiente | sí | sí | no |
| Anular un pago aprobado | sí | no | no |
| Generar y consultar tickets | sí | sí | no |
| Panel de control | sí | no | no |
| Resumen de pago en la orden | sí | sí | no (`null`) |

## D12. Datos de ejemplo y pruebas

- **Seed**: `004_sample_payments_tickets.sql`, idempotente. Pagos sobre las órdenes entregadas y terminadas de ejemplo: una pagada en efectivo, una pagada con tarjeta, una con abono por transferencia (parcial), una con cobro de Mercado Pago aprobado, otra con un cobro de Mercado Pago pendiente, un pago anulado y uno cancelado, y órdenes sin pagar; y tickets para varias de ellas. Los pagos de Mercado Pago de ejemplo llevan referencias ficticias que dicen "ejemplo" y nunca se consultan en Mercado Pago real.
- **Pruebas**: unitarias de `money`, `paymentBalance` y `ticketBuilder`; integración (pagos, concurrencia, Mercado Pago simulado, tickets, panel, permisos, semillas, rendimiento); contrato de los endpoints nuevos; Flutter para formularios, detalle de pago, ticket (vista y PDF) y panel.
