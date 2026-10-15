# Modelo de datos: Pagos, tickets y panel de control

**Funcionalidad**: [spec.md](spec.md) | **Fecha**: 2026-10-14

Migración nueva e inmutable: `database/migrations/004_sprint4_payments_tickets.sql`. Motor InnoDB, `utf8mb4`, collation `utf8mb4_0900_ai_ci`. Columnas en `snake_case` en la base y `camelCase` en la API. Todas las llaves foráneas son `ON DELETE RESTRICT`. Las migraciones 001 a 003 no se editan.

## Diagrama de relaciones

```text
service_orders 1 ──< payments >── 1 users        (registrado por / anulado por)
service_orders 1 ── 0..1 tickets >── 1 users     (generado por)
app_settings                                      (datos del taller para el ticket)
panel de control = consultas sobre service_orders, appointments, maintenance, parts, payments (sin tablas)
```

## Tabla `payments` (US1, US2, US3)

| Columna | Tipo | Restricciones | Notas |
|---------|------|---------------|-------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, INDEX | Todo pago pertenece a una orden (RN-13) |
| `method` | ENUM('CASH','CARD','TRANSFER','MERCADO_PAGO') | NOT NULL, INDEX | Efectivo, tarjeta, transferencia o Mercado Pago |
| `amount` | DECIMAL(12,2) | NOT NULL, `CHECK (amount > 0)` | Pesos mexicanos |
| `status` | ENUM('PENDIENTE','APROBADO','RECHAZADO','CANCELADO','ANULADO') | NOT NULL, INDEX | |
| `reference` | VARCHAR(100) | NULL | Autorización u operación informativa (tarjeta y transferencia); nunca datos de tarjeta |
| `external_reference` | VARCHAR(80) | NULL, ÚNICA | Referencia propia enviada a Mercado Pago (`MTX-<folio>-<aleatorio>`) |
| `external_id` | VARCHAR(40) | NULL | Identificador del pago informado por Mercado Pago |
| `payment_url` | VARCHAR(500) | NULL | Enlace de pago del proveedor (no es un secreto) |
| `pending_mp_order_id` | INT UNSIGNED | GENERADA: `IF(method = 'MERCADO_PAGO' AND status = 'PENDIENTE', order_id, NULL)`, ÚNICA | Un solo cobro de Mercado Pago pendiente por orden |
| `void_reason` | VARCHAR(255) | NULL | Motivo de la anulación |
| `voided_by` | INT UNSIGNED | NULL, FK → `users.id` | Quién anuló |
| `voided_at` | DATETIME | NULL | |
| `created_by` | INT UNSIGNED | NOT NULL, FK → `users.id` | Quién registró el pago |
| `created_at`, `updated_at` | DATETIME | NOT NULL | |

**Restricciones**: `CHECK (amount > 0)`; `CHECK (status <> 'ANULADO' OR (void_reason IS NOT NULL AND voided_by IS NOT NULL AND voided_at IS NOT NULL))`; `CHECK (method = 'MERCADO_PAGO' OR status IN ('APROBADO','CANCELADO','ANULADO'))` (los métodos manuales nunca quedan pendientes ni rechazados); `CHECK (method <> 'MERCADO_PAGO' OR external_reference IS NOT NULL)`.

**Índices**: `idx_payments_order_status (order_id, status)`, `idx_payments_created (created_at)`, `idx_payments_status_method (status, method)`, `uq_payments_external_reference`, `uq_payments_pending_mp (pending_mp_order_id)`.

**Reglas**
- Alta: la orden debe estar `TERMINADO` o `ENTREGADO`, con total mayor a cero; el importe debe ser positivo con hasta dos decimales y no mayor al saldo disponible (`total − aprobado − pendiente`).
- Efectivo, tarjeta y transferencia → `APROBADO`. Mercado Pago → `PENDIENTE` con su referencia externa y enlace.
- Transiciones permitidas: `PENDIENTE → APROBADO | RECHAZADO | CANCELADO` (el primer par solo por Mercado Pago) y `APROBADO → ANULADO` (administrador, con motivo). Un estado final no cambia.
- Nunca se elimina un pago. Solo cuentan para el saldo los pagos `APROBADO`; los `PENDIENTE` reservan importe.

## Tabla `tickets` (US4)

| Columna | Tipo | Restricciones | Notas |
|---------|------|---------------|-------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `folio` | VARCHAR(12) | NULL, ÚNICA | `TK-` + identificador con 6 dígitos, asignado en la misma transacción del alta |
| `order_id` | INT UNSIGNED | NOT NULL, ÚNICA, FK → `service_orders.id` | Un ticket por orden |
| `generated_by` | INT UNSIGNED | NOT NULL, FK → `users.id` | |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Fecha de emisión |

**Reglas**: se genera solo para órdenes `TERMINADO` o `ENTREGADO`; si ya existe, se devuelve el mismo. El contenido se arma al consultar (ver "Contenido del ticket"); no se guardan copias.

## Tabla `app_settings` (existente, Sprint 3)

La migración 004 agrega las claves del taller (valores predeterminados, editables con SQL):

| Clave | Valor inicial |
|-------|---------------|
| `workshop_name` | `Motorix Taller Mecánico` |
| `workshop_address` | `Av. Principal 123, Ciudad de México` |
| `workshop_phone` | `5555123456` |

Si falta una clave, el servicio usa estos mismos valores como respaldo.

## Resumen de pago de una orden (derivado, sin tabla)

| Campo | Cálculo |
|-------|---------|
| `total` | Servicios + mano de obra + refacciones de la orden |
| `paid` | Suma de pagos `APROBADO` |
| `pending` | Suma de pagos `PENDIENTE` |
| `balance` | `total − paid` (por cobrar) |
| `available` | `total − paid − pending` (puede registrarse o cobrarse) |
| `status` | `NO_CHARGE` (total 0), `UNPAID` (sin pagos aprobados), `PARTIAL` (abonos) o `PAID` (`paid ≥ total`) |

Siempre `paid ≤ total` y `paid + pending ≤ total` (invariante de pagos, probada).

## Contenido del ticket (derivado, sin tabla)

Folio del ticket y fecha de emisión; datos del taller (`app_settings`); orden (folio, estado, fecha de ingreso y de entrega); cliente (nombre y teléfono); vehículo (marca, modelo, placas, kilometraje de entrada y de servicio); servicios, mano de obra y refacciones con sus importes y subtotales; total; pagos con método, importe, estado y fecha; total pagado, saldo y estado de pago vigentes; quién lo generó.

## Indicadores del panel de control (derivados, sin tabla)

| Sección | Indicadores | Fuente |
|---------|-------------|--------|
| Órdenes | Recibidas, en diagnóstico, en reparación, esperando refacción, terminadas sin entregar, entregadas hoy | `service_orders.status`, `delivered_at` |
| Citas | De hoy, de los próximos 7 días (pendientes o confirmadas) y la siguiente | `appointments` |
| Mantenimientos | Vencidos y próximos (mismas reglas y umbrales del listado de avisos) | `maintenance`, `app_settings` |
| Inventario | Stock bajo, agotadas y las 5 más críticas | `parts` |
| Pagos | Cobrado hoy, saldo pendiente en órdenes `TERMINADO` o `ENTREGADO`, órdenes por cobrar | `payments`, `service_orders` |

## Transiciones y reglas resumidas

| Concepto | Regla |
|----------|-------|
| Pago manual (efectivo, tarjeta, transferencia) | Nace `APROBADO`; solo puede pasar a `ANULADO` (administrador) |
| Cobro de Mercado Pago | Nace `PENDIENTE`; `APROBADO`/`RECHAZADO` solo por Mercado Pago; `CANCELADO` por recepción o administración; `ANULADO` si estaba aprobado |
| Cobro pendiente por orden | A lo sumo uno de Mercado Pago |
| Total pagado | Nunca mayor al total de la orden |
| Ticket | Uno por orden `TERMINADO` o `ENTREGADO`; mismo folio al regenerar |

## Datos de ejemplo (`database/seeds/004_sample_payments_tickets.sql`)

Idempotente (por `external_reference` única en pagos de Mercado Pago y por (orden, método, importe, referencia) en los demás; tickets por orden):
- Órdenes entregadas y terminadas de ejemplo con distintos estados de pago: pagada en efectivo, pagada con tarjeta (con referencia de autorización), con abono por transferencia (parcial), pagada con un cobro de Mercado Pago aprobado, con un cobro de Mercado Pago pendiente y sin pagar.
- Un pago anulado (con motivo) y un cobro cancelado como antecedentes.
- Tickets para las órdenes pagadas y parciales.
- Pagos de hoy y de días anteriores, para que "cobrado hoy" del panel tenga un valor distinto de cero.
