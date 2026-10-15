# Contrato de la API REST: Sprint 4 (pagos, tickets y panel de control)

**Especificación**: [spec.md](../spec.md) | **Modelo**: [data-model.md](../data-model.md) | **Base**: [contrato del Sprint 3](../../003-historial-inventario/contracts/api.md)

Amplía los contratos de los Sprint 1 a 3. Se mantienen las convenciones: prefijo `/api`, JSON en `camelCase`, `Authorization: Bearer`, envoltorio `{ data }` / `{ data, meta }`, errores `{ error: { code, message, details } }`, paginación `page` (1), `pageSize` (20, máx. 100). Al implementar se fusiona en `docs/api.md`.

## Valores y formatos

- **Métodos de pago** `method`: `CASH` (efectivo), `CARD` (tarjeta), `TRANSFER` (transferencia), `MERCADO_PAGO`.
- **Estados de pago** `status`: `PENDIENTE`, `APROBADO`, `RECHAZADO`, `CANCELADO`, `ANULADO`.
- **Estado de pago de la orden** `payment.status` (calculado): `NO_CHARGE` (total 0), `UNPAID`, `PARTIAL`, `PAID`.
- **Importes**: números con hasta dos decimales, en pesos mexicanos. **Fechas y horas**: instantes ISO (`createdAt`), igual que el resto de la API.

## Errores nuevos

| HTTP | `code` | Cuándo |
|:----:|--------|--------|
| 409 | `PAYMENT_ORDER_NOT_PAYABLE` | La orden no está `TERMINADO` ni `ENTREGADO`, o su total es cero; `details.status` y `details.total` |
| 409 | `PAYMENT_EXCEEDS_BALANCE` | El importe supera el saldo disponible; `details`: `{ available, requested }` |
| 409 | `PAYMENT_PENDING_EXISTS` | La orden ya tiene un cobro de Mercado Pago pendiente; `details.pending` lleva el pago |
| 409 | `PAYMENT_INVALID_STATE` | La operación no aplica al estado actual del pago (por ejemplo, cancelar un pago aprobado o anular uno pendiente) |
| 409 | `TICKET_ORDER_NOT_READY` | La orden aún no está `TERMINADO` ni `ENTREGADO` |
| 503 | `PAYMENT_PROVIDER_UNAVAILABLE` | Mercado Pago no está configurado o no responde; no se registra ningún pago |

Además: `400 VALIDATION_ERROR` (importe no positivo o con más de dos decimales, método inválido, motivo faltante, importe recibido menor al pago); `403 FORBIDDEN` por rol; `404 NOT_FOUND`.

## Matriz de permisos

| Operación | ADMIN | RECEPTIONIST | MECHANIC |
|-----------|:-----:|:------------:|:--------:|
| Ver pagos de una orden, listado y detalle de pagos | sí | sí | no |
| Registrar pago, crear cobro de Mercado Pago, actualizar su estado | sí | sí | no |
| Cancelar un pago pendiente | sí | sí | no |
| Anular un pago aprobado | sí | no | no |
| Generar y consultar tickets | sí | sí | no |
| Panel de control | sí | no | no |
| Resumen de pago (`payment`) en la orden | sí | sí | `null` |

## Objetos

### `Payment`

```json
{
  "id": 12, "orderId": 7, "orderFolio": "OS-000007", "clientName": "Ana Pérez", "vehiclePlate": "PRD482A",
  "method": "CARD", "amount": 1570.50, "status": "APROBADO",
  "reference": "AUT-4521", "externalReference": null, "paymentUrl": null,
  "voidReason": null, "voidedByName": null, "voidedAt": null,
  "createdByName": "Recepción Motorix", "createdAt": "2026-10-14T16:20:00.000Z",
  "canCancel": false, "canVoid": true, "canRefresh": false
}
```

`canCancel`, `canVoid` y `canRefresh` los calcula el servidor para el usuario que consulta: `canCancel` (pago `PENDIENTE`), `canVoid` (pago `APROBADO` y usuario administrador) y `canRefresh` (cobro de Mercado Pago `PENDIENTE`). La interfaz solo ofrece las acciones cuando son verdaderas.

### `PaymentSummary`

```json
{ "total": 1570.50, "paid": 1000.00, "pending": 0, "balance": 570.50, "available": 570.50, "status": "PARTIAL" }
```

## Cambios a endpoints existentes

### `GET /api/orders/:id` y `GET /api/orders`

- El detalle agrega `payment` (`PaymentSummary`, o `null` para el mecánico) y `ticketId` (identificador del ticket o `null`).
- Cada elemento del listado agrega `paymentStatus` (`NO_CHARGE`, `UNPAID`, `PARTIAL` o `PAID`; `null` para el mecánico).
- El listado acepta el filtro `paymentStatus` (`UNPAID`, `PARTIAL`, `PAID`, o `DUE` = `UNPAID` o `PARTIAL`) solo para administración y recepción; para el mecánico se ignora.

## Pagos de una orden — ADMIN y RECEPTIONIST

### `GET /api/orders/:id/payments`

`200` → `{ "data": { "summary": PaymentSummary, "payments": [ Payment ] } }` con los pagos del más reciente al más antiguo, incluidos los cancelados, rechazados y anulados.

### `POST /api/orders/:id/payments` — efectivo, tarjeta y transferencia

```json
{ "method": "CASH", "amount": 1000.00, "receivedAmount": 1200.00, "reference": null }
```

- `method` ∈ `CASH`, `CARD`, `TRANSFER`. `reference` (opcional, hasta 100 caracteres) solo para tarjeta y transferencia. `receivedAmount` (opcional) solo para efectivo y debe ser mayor o igual a `amount`.
- Solo con la orden `TERMINADO` o `ENTREGADO`, total mayor a cero e `amount` ≤ saldo disponible. El pago nace `APROBADO`.
- `201` → `{ "data": { "payment": Payment, "summary": PaymentSummary, "change": 200.00 } }`. `change` solo aparece con efectivo y `receivedAmount`; no se guarda.
- Errores: `400`, `403`, `404`, `409 PAYMENT_ORDER_NOT_PAYABLE`, `409 PAYMENT_EXCEEDS_BALANCE`.

### `POST /api/orders/:id/payments/mercado-pago`

```json
{ "amount": 500.00 }
```

- `amount` es opcional; por omisión, el saldo disponible. Nunca mayor al saldo disponible.
- Crea el cobro en Mercado Pago (modo de pruebas) y registra un pago `PENDIENTE` con `externalReference` y `paymentUrl`. Solo un cobro pendiente por orden.
- `201` → `{ "data": { "payment": Payment, "summary": PaymentSummary } }`.
- Errores: `400`, `403`, `404`, `409 PAYMENT_ORDER_NOT_PAYABLE`, `409 PAYMENT_EXCEEDS_BALANCE`, `409 PAYMENT_PENDING_EXISTS`, `503 PAYMENT_PROVIDER_UNAVAILABLE` (sin registrar nada).

## Pagos — ADMIN y RECEPTIONIST (salvo la anulación)

### `GET /api/payments`

Parámetros: `status`, `method`, `from` y `to` (`YYYY-MM-DD`, sobre la fecha del pago), `search` (folio de la orden, cliente o placa), `page`, `pageSize`. Del más reciente al más antiguo. `200` → `{ data: [Payment], meta: { page, pageSize, total, approvedTotal } }`, donde `approvedTotal` suma los pagos aprobados que cumplen el filtro.

### `GET /api/payments/:id`

`200` → `Payment`. `404` si no existe.

### `POST /api/payments/:id/refresh`

Solo para cobros de Mercado Pago `PENDIENTE`. Consulta a Mercado Pago y aplica el resultado: aprobado → `APROBADO`; rechazado o cancelado → `RECHAZADO`; pendiente, en proceso o sin resultados → sigue `PENDIENTE`. Es idempotente: un cobro ya aprobado no se aprueba dos veces. `200` → `{ "data": { "payment": Payment, "summary": PaymentSummary } }`. Errores: `409 PAYMENT_INVALID_STATE`, `503 PAYMENT_PROVIDER_UNAVAILABLE`.

### `POST /api/payments/:id/cancel`

Sin cuerpo. Solo pagos `PENDIENTE`: pasan a `CANCELADO` y liberan su importe reservado. `200` → `{ payment, summary }`. Errores: `409 PAYMENT_INVALID_STATE`.

### `POST /api/payments/:id/void` — solo ADMIN

```json
{ "reason": "Cobro duplicado por error" }
```

`reason` obligatorio (1 a 255 caracteres). Solo pagos `APROBADO`: pasan a `ANULADO` con motivo, usuario y fecha; su importe deja de contar como pagado. `200` → `{ payment, summary }`. Errores: `400`, `403` (recepción), `409 PAYMENT_INVALID_STATE`.

## Tickets — ADMIN y RECEPTIONIST

Objeto `Ticket`:

```json
{
  "id": 3, "folio": "TK-000003", "issuedAt": "2026-10-14T16:25:00.000Z", "generatedByName": "Recepción Motorix",
  "workshop": { "name": "Motorix Taller Mecánico", "address": "Av. Principal 123, Ciudad de México", "phone": "5555123456" },
  "order": { "id": 7, "folio": "OS-000007", "status": "ENTREGADO", "createdAt": "…", "deliveredAt": "…" },
  "client": { "name": "Ana Pérez", "phone": "5511223344" },
  "vehicle": { "brand": "Nissan", "model": "Versa", "licensePlate": "PRD482A", "entryMileage": 47000, "serviceMileage": 47150 },
  "services": [ { "description": "…", "amount": 450.00 } ],
  "labor": [ { "description": "…", "hours": 2.5, "hourlyRate": 350.00, "amount": 875.00 } ],
  "parts": [ { "code": "BUJ-NGK", "name": "Bujía de iridio", "quantity": 4, "unitPrice": 95.00, "amount": 380.00 } ],
  "subtotals": { "services": 450.00, "labor": 875.00, "parts": 380.00 },
  "total": 1705.00,
  "payments": [ { "method": "CARD", "amount": 1000.00, "status": "APROBADO", "reference": "AUT-4521", "createdAt": "…" } ],
  "summary": PaymentSummary
}
```

`payments` incluye solo los pagos `APROBADO` y `PENDIENTE`; los cancelados, rechazados y anulados no aparecen en el comprobante.

### `POST /api/orders/:id/ticket`

Sin cuerpo. Genera el ticket de la orden o devuelve el existente. `201` → `Ticket` si lo crea y `200` → `Ticket` si ya existía. Errores: `403`, `404`, `409 TICKET_ORDER_NOT_READY`.

### `GET /api/tickets/:id`

`200` → `Ticket` con los pagos y el estado vigentes. `404` si no existe.

### `GET /api/tickets`

Parámetros: `search` (folio del ticket o de la orden, cliente o placa), `page`, `pageSize`. `200` → `{ data: [ { id, folio, issuedAt, orderId, orderFolio, clientName, vehiclePlate, total, paymentStatus } ], meta }`.

## Panel de control — solo ADMIN

### `GET /api/dashboard`

`200` →

```json
{
  "data": {
    "generatedAt": "2026-10-14T17:00:00.000Z",
    "orders": { "received": 2, "diagnosis": 1, "inRepair": 1, "waitingPart": 1, "finishedNotDelivered": 1, "deliveredToday": 0 },
    "appointments": {
      "today": 1, "next7Days": 4,
      "next": { "id": 3, "scheduledAt": "2026-10-15T10:00", "clientName": "Ana Pérez", "vehiclePlate": "PRD482A", "reason": "Revisión de frenos" }
    },
    "maintenance": { "overdue": 2, "upcoming": 2, "warningDays": 30, "warningKm": 1000 },
    "inventory": {
      "low": 3, "out": 2,
      "critical": [ { "id": 8, "code": "DIS-DEL", "name": "Disco de freno delantero", "stock": 0, "minimumStock": 2, "stockStatus": "OUT" } ]
    },
    "payments": { "collectedToday": 2300.00, "pendingBalance": 4150.00, "ordersToCollect": 3 }
  }
}
```

- `appointments.next` es `null` si no hay citas próximas. `inventory.critical` lista hasta 5 refacciones activas en alerta, las agotadas primero.
- `payments.ordersToCollect` cuenta las órdenes `TERMINADO` o `ENTREGADO` con saldo mayor a cero; `pendingBalance` suma esos saldos.
- Errores: `403` para recepción y mecánico, `401` sin token.
