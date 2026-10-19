# Contrato de la API REST: Sprint 2 (citas y órdenes de servicio)

Extiende el contrato del Sprint 1 (`specs/001-base-clientes-vehiculos/contracts/api.md`): misma base `/api`, mismo formato de éxito `{ "data": ..., "meta": ... }` y de error `{ "error": { "code", "message", "details" } }`, y autenticación con `Authorization: Bearer <token>`.

## Códigos de error nuevos

| HTTP | Código | Cuándo |
|------|--------|--------|
| 409 | `DUPLICATE_APPOINTMENT` | Ya hay una cita activa del mismo vehículo a esa fecha y hora (se acepta con `confirmDuplicate: true`) |
| 409 | `APPOINTMENT_HAS_ORDER` | Se intenta cancelar una cita que tiene una orden activa |
| 409 | `APPOINTMENT_NOT_EDITABLE` | La cita está Cancelada, Completada o En proceso |
| 409 | `INVALID_TRANSITION` | La transición de estado no está permitida; `details` incluye las permitidas |
| 409 | `STATE_CONFLICT` | La orden cambió de estado mientras se procesaba la petición; hay que recargar |
| 409 | `ORDER_NOT_EDITABLE` | La orden está Terminada, Entregada o Cancelada y no admite ese cambio |
| 409 | `ORDER_INCOMPLETE` | Se intenta terminar la orden sin diagnóstico o sin servicios ni mano de obra |
| 409 | `MILEAGE_DECREASE` | El kilometraje de entrada es menor al del vehículo (se acepta con `mileageCorrection: true`) |
| 409 | `APPOINTMENT_ALREADY_HAS_ORDER` | La cita ya tiene una orden activa |

Se reutilizan `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_VALUE` y los demás del Sprint 1.

## Estados

- **Cita**: `PENDIENTE`, `CONFIRMADA`, `EN_PROCESO`, `COMPLETADA`, `CANCELADA`.
- **Orden**: `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION`, `ESPERANDO_REFACCION`, `TERMINADO`, `ENTREGADO`, `CANCELADA`.

Importes y horas viajan como cadenas con dos decimales (`"1250.00"`). Las fechas de las citas se envían como `YYYY-MM-DDTHH:mm` (hora local del taller) y se devuelven en ISO 8601.

## Matriz de permisos

| Endpoint | ADMIN | RECEPTIONIST | MECHANIC |
|----------|:-----:|:------------:|:--------:|
| `GET /appointments`, `GET /appointments/:id` | ✔ | ✔ | ✘ |
| `POST /appointments`, `PATCH /appointments/:id` | ✔ | ✔ | ✘ |
| `POST /appointments/:id/confirm`, `POST /appointments/:id/cancel` | ✔ | ✔ | ✘ |
| `GET /mechanics` | ✔ | ✔ | ✘ |
| `GET /orders` | ✔ (todas) | ✔ (todas) | ✔ (solo las suyas) |
| `GET /orders/:id` | ✔ | ✔ | ✔ (solo si es suya) |
| `POST /orders` | ✔ | ✔ | ✘ |
| `PATCH /orders/:id` | ver permisos por campo | ver permisos por campo | ver permisos por campo |
| `POST/PATCH/DELETE /orders/:id/services…` y `/labor…` | ✔ | ✘ | ✔ (solo si es suya) |
| `POST /orders/:id/status` | según la transición | según la transición | según la transición |

**Permisos por campo de `PATCH /orders/:id`**: `diagnosis`, `notes` y `recommendations` → mecánico asignado o ADMIN; `reportedProblem` y `mechanicId` → RECEPTIONIST o ADMIN. Enviar un campo sin permiso responde 403 `FORBIDDEN`.

**Permisos de `POST /orders/:id/status`**: hasta `TERMINADO` (y `ESPERANDO_REFACCION`) → mecánico asignado o ADMIN; `ENTREGADO` y `CANCELADA` → RECEPTIONIST o ADMIN.

## Citas

### `GET /appointments`

Parámetros opcionales: `from` y `to` (fecha `YYYY-MM-DD`, inclusivas), `status`, `clientId`, `vehicleId`, `search` (cliente o placas), `page`, `pageSize`. Orden: por fecha y hora ascendente.

Cada cita: `{ id, clientId, vehicleId, scheduledAt, reason, notes, status, orderId, createdAt, updatedAt, client: { id, name, phone }, vehicle: { id, brand, model, year, licensePlate } }`. `orderId` es el de la orden activa asociada, o `null`.

### `GET /appointments/:id`

La cita con la misma forma. 404 si no existe.

### `POST /appointments`

Solicitud: `{ "clientId", "vehicleId", "scheduledAt", "reason", "notes"?, "confirmDuplicate"? }`. Respuesta 201 en estado `PENDIENTE`.
Errores: 400 (validación, fecha pasada), 404 (cliente o vehículo inexistente), 400 si el vehículo no es del cliente (`details.field = "vehicleId"`), 400 si el cliente está desactivado, 409 `DUPLICATE_APPOINTMENT`.

### `PATCH /appointments/:id`

Campos opcionales: `scheduledAt`, `reason`, `notes`, `confirmDuplicate`. Solo citas `PENDIENTE` o `CONFIRMADA`; en otro caso 409 `APPOINTMENT_NOT_EDITABLE`.

### `POST /appointments/:id/confirm`

`PENDIENTE` → `CONFIRMADA`. Respuesta 200 con la cita. 409 `APPOINTMENT_NOT_EDITABLE` si no está Pendiente.

### `POST /appointments/:id/cancel`

`PENDIENTE` o `CONFIRMADA` → `CANCELADA`. Respuesta 200. 409 `APPOINTMENT_HAS_ORDER` si tiene una orden activa; 409 `APPOINTMENT_NOT_EDITABLE` si ya estaba Cancelada o Completada.

## Mecánicos

### `GET /mechanics`

Respuesta 200: `{ "data": [ { "id", "name" } ] }` con los mecánicos activos, ordenados por nombre.

## Órdenes de servicio

Forma de una orden en listados: `{ id, folio, status, clientId, vehicleId, mechanicId, appointmentId, entryMileage, reportedProblem, total, createdAt, updatedAt, client: { id, name }, vehicle: { id, brand, model, year, licensePlate }, mechanic: { id, name } }`.

### `GET /orders`

Parámetros opcionales: `status`, `mechanicId`, `from` y `to` (fecha de creación), `search` (folio, cliente o placas), `page`, `pageSize`. **Si el usuario es mecánico, el servidor fuerza el filtro a sus propias órdenes** y `mechanicId` se ignora. Orden: más recientes primero.

### `GET /orders/:id`

La orden con detalle: además de los campos del listado, `diagnosis`, `notes`, `recommendations`, `cancellationReason`, `deliveredAt`, `services: [ { id, description, amount } ]`, `labor: [ { id, description, hours, hourlyRate, amount } ]`, `history: [ { fromStatus, toStatus, changedBy: { id, name }, reason, changedAt } ]` y `allowedTransitions: [ "DIAGNOSTICO" ]` (las transiciones que **el usuario actual** puede aplicar ahora). 403 `FORBIDDEN` si es mecánico y la orden no es suya; 404 si no existe.

### `POST /orders`

Solicitud: `{ "clientId", "vehicleId", "mechanicId", "entryMileage", "reportedProblem", "appointmentId"?, "mileageCorrection"? }`. Con `appointmentId`, la cita debe estar `CONFIRMADA` y el cliente y vehículo deben coincidir con los de la cita; `reportedProblem` puede omitirse y se toma el motivo de la cita. Respuesta 201 con la orden en `RECIBIDO` y su folio, el kilometraje del vehículo actualizado, la cita en `EN_PROCESO` y el primer registro del historial.
Errores: 400 (validación; mecánico faltante o no válido en `details.field = "mechanicId"`; kilometraje fuera de rango), 404 (cliente, vehículo, cita o mecánico inexistentes), 400 si el vehículo no es del cliente, 409 `MILEAGE_DECREASE`, 409 `APPOINTMENT_NOT_EDITABLE` si la cita no está Confirmada, 409 `APPOINTMENT_ALREADY_HAS_ORDER`.

### `PATCH /orders/:id`

Campos opcionales: `diagnosis`, `notes`, `recommendations`, `reportedProblem`, `mechanicId`. Respuesta 200 con la orden. Errores: 403 `FORBIDDEN` (campo sin permiso u orden ajena), 409 `ORDER_NOT_EDITABLE` (orden Terminada, Entregada o Cancelada; la reasignación de `mechanicId` solo se bloquea en Entregada y Cancelada), 400 (mecánico no válido).

### `POST /orders/:id/services`

Solicitud: `{ "description", "amount" }`. Respuesta 201 con la orden completa (total recalculado). `description` 1 a 255 caracteres; `amount` entre 0 y 99,999,999.99.

### `PATCH /orders/:id/services/:serviceId`  y  `DELETE /orders/:id/services/:serviceId`

Editan o quitan una línea; respuesta 200 con la orden completa. 404 si la línea no pertenece a la orden. 409 `ORDER_NOT_EDITABLE` si la orden ya no está en curso.

### `POST /orders/:id/labor`

Solicitud: `{ "description", "hours", "hourlyRate" }`. `hours` mayor a 0 y hasta 999.99; `hourlyRate` entre 0 y 99,999,999.99. Respuesta 201 con la orden completa. `PATCH` y `DELETE /orders/:id/labor/:laborId` funcionan igual que en servicios.

### `POST /orders/:id/status`

Solicitud: `{ "status": "DIAGNOSTICO", "reason"? }`. `reason` es obligatorio cuando `status` es `CANCELADA`. Respuesta 200 con la orden completa.
Errores: 403 `FORBIDDEN` (rol o asignación), 409 `INVALID_TRANSITION` (con las permitidas en `details`), 409 `ORDER_INCOMPLETE` (al pasar a `TERMINADO`), 409 `STATE_CONFLICT` (cambio simultáneo), 400 (motivo faltante al cancelar). Efectos sobre la cita: cancelar la orden devuelve la cita a `CONFIRMADA`; entregarla la pasa a `COMPLETADA`.
