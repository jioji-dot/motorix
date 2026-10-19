# Contrato de la API REST: Sprint 4 (pagos, tickets y panel de control)

Extiende los contratos de los Sprints 1 a 3: misma base `/api`, mismo formato de éxito `{ "data": ..., "meta": ... }` y de error `{ "error": { "code", "message", "details" } }`, y autenticación con `Authorization: Bearer <token>`, salvo las dos rutas públicas indicadas más abajo.

## Códigos de error nuevos

| HTTP | Código | Cuándo |
|------|--------|--------|
| 409 | `ORDER_NOT_PAYABLE` | La orden no está Terminada o Entregada, o su total es cero |
| 409 | `PAYMENT_EXCEEDS_BALANCE` | El importe supera el saldo disponible; incluye `balance` (saldo disponible) |
| 409 | `PAYMENT_NOT_PENDING` | Se intenta cancelar o sincronizar un pago que ya no está Pendiente o que no es de Mercado Pago |
| 409 | `TICKET_NOT_AVAILABLE` | La orden no está Terminada o Entregada y no admite ticket |
| 404 | `NOT_FOUND` | No existe la orden, el pago o el ticket (también para un ticket aún no generado) |
| 503 | `MP_NOT_CONFIGURED` | Faltan las credenciales de Mercado Pago |
| 502 | `MP_UNAVAILABLE` | Mercado Pago no respondió o devolvió un error; no se crea ningún pago |

Se reutilizan `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN` y los demás de los sprints anteriores.

## Valores

- **Método de pago**: `EFECTIVO`, `TARJETA`, `TRANSFERENCIA`, `MERCADO_PAGO`.
- **Estado del pago**: `PENDIENTE`, `PAGADO`, `RECHAZADO`, `CANCELADO`.
- **Estado de cobro de la orden**: `SIN_COBRO` (total cero), `SIN_PAGOS`, `PARCIAL`, `PAGADA`.
- Importes como cadenas con dos decimales. Fechas y horas en ISO 8601 (UTC); los periodos del panel usan la hora local del taller.

## Matriz de permisos

| Endpoint | ADMIN | RECEPTIONIST | MECHANIC |
|----------|:-----:|:------------:|:--------:|
| `GET /orders/:id/payments` | ✔ | ✔ | ✘ |
| `POST /orders/:id/payments` | ✔ | ✔ | ✘ |
| `POST /payments/:id/sync`, `POST /payments/:id/cancel` | ✔ | ✔ | ✘ |
| `POST /orders/:id/ticket`, `GET /orders/:id/ticket`, `POST /orders/:id/ticket/print-link` | ✔ | ✔ | ✘ |
| `GET /dashboard` | ✔ | ✘ | ✘ |
| `POST /payments/mercadopago/webhook` (pública, la verifica el servidor) | — | — | — |
| `GET /tickets/print/:token` (pública, con token de corta vida) | — | — | — |

## Pagos

Forma de un pago: `{ id, orderId, amount, method, status, reference, paymentLink, paidAt, createdBy: { id, name }, createdAt, updatedAt }`. `paymentLink` solo viene en los pagos de Mercado Pago. El servidor nunca devuelve credenciales ni datos de tarjeta.

Resumen de cobro: `{ total, paid, pending, balance, available, status }` donde `balance` = total − pagado, `available` = total − pagado − pendiente y `status` es el estado de cobro de la orden.

### `GET /orders/:id/payments`

Respuesta 200: `{ "data": { "payments": [ ... ], "summary": { ... } } }`; los pagos van del más reciente al más antiguo. 404 si no existe la orden.

### `POST /orders/:id/payments`

Solicitud: `{ "method": "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "MERCADO_PAGO", "amount": 500.00, "reference"?: "..." }`.

- Efectivo, tarjeta y transferencia: respuesta 201 con el pago ya `PAGADO` y el resumen actualizado: `{ "data": { "payment": {...}, "summary": {...} } }`.
- Mercado Pago: el servidor crea el cobro en Mercado Pago (sandbox) y responde 201 con el pago `PENDIENTE` y su `paymentLink`; el importe queda reservado.
- Errores: 400 (con el campo en `details`), 404, 409 `ORDER_NOT_PAYABLE`, 409 `PAYMENT_EXCEEDS_BALANCE` (con `balance`), 503 `MP_NOT_CONFIGURED`, 502 `MP_UNAVAILABLE`.

### `POST /payments/:id/sync`

Solo para pagos de Mercado Pago `PENDIENTE`: consulta el estado real en Mercado Pago y, si cambió, lo aplica. Respuesta 200 con `{ payment, summary }` (el estado puede seguir `PENDIENTE`). Errores: 404, 409 `PAYMENT_NOT_PENDING` (ya final o no es de Mercado Pago), 502 `MP_UNAVAILABLE`.

### `POST /payments/:id/cancel`

Cancela un pago de Mercado Pago `PENDIENTE` y libera su importe. Respuesta 200 con `{ payment, summary }`. Errores: 404, 409 `PAYMENT_NOT_PENDING`. No existe ninguna operación para editar o eliminar pagos.

### `POST /payments/mercadopago/webhook` (pública)

Recibe la notificación de Mercado Pago (`{ "type": "payment", "data": { "id": "..." } }`, o el formato equivalente con parámetros en la dirección). No usa sesión: el servidor toma solo el identificador, consulta el pago real a Mercado Pago, lo relaciona por la referencia externa y aplica el estado de forma idempotente. Si hay `MP_WEBHOOK_SECRET`, valida la firma `x-signature` y responde 401 si no coincide. Respuestas: 200 `{ "data": { "received": true } }` aunque la notificación no corresponda a ningún pago o ya se haya aplicado; 400 si está mal formada.

## Tickets

Forma del ticket (consulta):

```json
{
  "data": {
    "id": 3, "folio": "TK-000003", "generatedAt": "2026-10-19T18:30:00.000Z",
    "workshop": { "name": "Motorix Taller Mecánico", "address": "...", "phone": "..." },
    "order": { "id": 12, "folio": "OS-000012", "status": "ENTREGADO", "deliveredAt": null },
    "client": { "name": "Roberto Hernández", "phone": "5512345601" },
    "vehicle": { "description": "Nissan Versa 2020", "licensePlate": "ABC-123-A", "mileage": 48200 },
    "services": [ { "description": "...", "amount": "680.00" } ],
    "labor": [ { "description": "...", "hours": "1.50", "hourlyRate": "350.00", "amount": "525.00" } ],
    "parts": [ { "name": "...", "quantity": 2, "unitPrice": "110.00", "amount": "220.00" } ],
    "subtotal": "1425.00", "total": "1425.00",
    "payment": {
      "methods": ["EFECTIVO", "TARJETA"], "status": "PAGADA",
      "paid": "1425.00", "balance": "0.00"
    }
  }
}
```

`payment.status` usa los estados de cobro de la orden. El contenido se arma en cada consulta.

### `POST /orders/:id/ticket`

Genera el ticket de la orden o devuelve el que ya existe. Respuesta 201 si lo crea o 200 si ya existía, con el ticket completo. Errores: 404, 409 `TICKET_NOT_AVAILABLE`.

### `GET /orders/:id/ticket`

Devuelve el ticket vigente de la orden. 404 si todavía no se generó.

### `POST /orders/:id/ticket/print-link`

Emite un token de impresión (vigencia de 5 minutos, solo para esa orden y para tickets) y devuelve `{ "data": { "url": "http://.../api/tickets/print/<token>", "expiresInSeconds": 300 } }`. 404 si la orden no tiene ticket.

### `GET /tickets/print/:token` (pública)

Devuelve la página HTML imprimible del ticket (`text/html`), con estilos de impresión y sin menús, que abre el diálogo de impresión al cargar. Responde 401 en HTML sencillo si el token es inválido o venció. Todo texto se escapa.

## Panel de control

### `GET /dashboard` (solo administrador)

Respuesta 200:

```json
{
  "data": {
    "generatedAt": "2026-10-19T18:30:00.000Z",
    "orders": {
      "byStatus": { "RECIBIDO": 1, "DIAGNOSTICO": 1, "EN_REPARACION": 1, "ESPERANDO_REFACCION": 1, "TERMINADO": 1, "ENTREGADO": 1, "CANCELADA": 1 },
      "withBalance": { "count": 1, "amount": "2080.00" }
    },
    "appointments": {
      "today": 2, "upcoming": 3,
      "next": [ { "id": 4, "scheduledAt": "...", "status": "CONFIRMADA", "clientName": "...", "licensePlate": "...", "reason": "..." } ]
    },
    "maintenance": { "overdue": 2, "soon": 2 },
    "inventory": { "low": 2, "out": 1, "mostUrgent": [ { "id": 5, "code": "SEN-O2-01", "name": "...", "stock": 0, "minimumStock": 2, "stockLevel": "OUT" } ] },
    "payments": { "collectedToday": "0.00", "collectedMonth": "6202.50", "pendingToCollect": "2080.00" }
  }
}
```

Cada cifra coincide con la del módulo de origen (`GET /orders`, `GET /appointments`, `GET /maintenance`, `GET /parts/summary` y `GET /orders/:id/payments`). 403 para los demás roles.
