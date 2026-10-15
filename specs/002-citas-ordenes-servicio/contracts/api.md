# Contrato de la API REST: Sprint 2 (citas y órdenes de servicio)

**Especificación**: [spec.md](../spec.md) | **Modelo**: [data-model.md](../data-model.md) | **Base**: [contrato del Sprint 1](../../001-base-clientes-vehiculos/contracts/api.md)

Amplía el contrato del Sprint 1. Se mantienen las convenciones: prefijo `/api`, JSON en `camelCase`, `Authorization: Bearer`, envoltorio `{ data }` / `{ data, meta }`, errores `{ error: { code, message, details } }`, paginación `page` (1), `pageSize` (20, máx. 100). Al implementar se fusiona en `docs/api.md`.

## Valores y formatos

- **Fecha y hora de cita** `scheduledAt`: hora local del taller sin zona, `YYYY-MM-DDTHH:mm` (ver D5 de research.md).
- **Estados de cita**: `PENDIENTE`, `CONFIRMADA`, `EN_PROCESO`, `COMPLETADA`, `CANCELADA`.
- **Estados de orden**: `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION`, `ESPERANDO_REFACCION`, `TERMINADO`, `ENTREGADO`.
- **Importes**: números con hasta dos decimales; `hours` con hasta dos decimales.

## Errores nuevos

| HTTP | `code` | Cuándo |
|:----:|--------|--------|
| 409 | `APPOINTMENT_DUPLICATE_WARNING` | Hay otra cita no cancelada del mismo vehículo el mismo día y falta `confirmDuplicate: true`; `details.matches` lista `id` y `scheduledAt` |
| 409 | `APPOINTMENT_NOT_EDITABLE` | La cita no está `PENDIENTE` ni `CONFIRMADA` |
| 409 | `APPOINTMENT_HAS_ORDER` | Se intentó cancelar una cita que ya tiene orden |
| 409 | `APPOINTMENT_NOT_AVAILABLE` | Se intentó crear una orden desde una cita que no está `PENDIENTE`/`CONFIRMADA` o que ya tiene orden |
| 409 | `INVALID_TRANSITION` | Cambio de estado no permitido; `details`: `{ from, to, allowed: [...] }` |
| 409 | `MECHANIC_REQUIRED` | Se intentó avanzar una orden `RECIBIDO` sin mecánico asignado |
| 409 | `ORDER_INCOMPLETE` | Se intentó pasar a `TERMINADO` sin lo requerido; `details.missing`: `diagnosis` y/o `servicesOrLabor` |
| 409 | `ORDER_NOT_EDITABLE` | La orden está en un estado que no admite ese cambio (`details.status`) |
| 409 | `MILEAGE_DECREASE` | (del Sprint 1) kilometraje menor al registrado sin `mileageCorrection: true` |

Además: `400 VALIDATION_ERROR` para datos inválidos (incluye vehículo que no es del cliente en `details.field = "vehicleId"`, mecánico inválido en `mechanicId`, fecha pasada o a más de un año en `scheduledAt`); `403 FORBIDDEN` por rol; `404 NOT_FOUND` (incluye órdenes ajenas para un mecánico).

## Matriz de permisos

| Operación | ADMIN | RECEPTIONIST | MECHANIC |
|-----------|:-----:|:------------:|:--------:|
| Gestionar citas (listar, crear, ver, modificar, confirmar, cancelar) | sí | sí | no |
| Listar mecánicos activos (`GET /api/mechanics`) | sí | sí | no |
| Crear orden | sí | sí | no |
| Listar y ver órdenes | todas | todas | solo las asignadas |
| Corregir problema reportado, mecánico o kilometraje de entrada | sí | sí | no |
| Diagnóstico, servicios, mano de obra, observaciones y recomendaciones | sí | no (solo lectura) | solo en órdenes asignadas |
| Cambiar estado hasta `TERMINADO` | sí | no | solo en órdenes asignadas |
| Marcar `ENTREGADO` | sí | sí | no |

## Mecánicos para asignar

### `GET /api/mechanics`

ADMIN y RECEPTIONIST. `200` → `{ "data": [ { "id", "name", "username" } ] }` (usuarios activos con rol MECHANIC, ordenados por nombre).

## Citas — solo ADMIN y RECEPTIONIST

Objeto `Appointment`: `{ "id", "clientId", "vehicleId", "scheduledAt", "reason", "notes", "status", "orderId", "clientName", "vehiclePlate", "vehicleTitle", "createdAt", "updatedAt" }` (`orderId` es `null` si no tiene orden).

| Método y ruta | Descripción | Respuesta |
|---------------|-------------|-----------|
| `GET /api/appointments` | Listado ordenado por `scheduledAt`. Filtros: `date` (`YYYY-MM-DD`), `from`/`to` (fechas), `status`, `clientId`, `vehicleId`, `search` (cliente o placa), `page`, `pageSize` | `200` lista + `meta` |
| `POST /api/appointments` | Alta: `clientId`, `vehicleId`, `scheduledAt`, `reason`, `notes?`, `confirmDuplicate?` | `201` `Appointment` (estado `PENDIENTE`) |
| `GET /api/appointments/:id` | Detalle | `200` |
| `PATCH /api/appointments/:id` | Modifica `scheduledAt`, `reason`, `notes` (no `clientId` ni `vehicleId`) | `200` |
| `POST /api/appointments/:id/confirm` | `PENDIENTE → CONFIRMADA` | `200` |
| `POST /api/appointments/:id/cancel` | `PENDIENTE`/`CONFIRMADA → CANCELADA` sin orden | `200` |

Errores específicos: `409 APPOINTMENT_DUPLICATE_WARNING` (solo al crear), `409 APPOINTMENT_NOT_EDITABLE`, `409 APPOINTMENT_HAS_ORDER`.

## Órdenes de servicio

Objeto `OrderSummary` (listados): `{ "id", "folio", "clientId", "clientName", "vehicleId", "vehiclePlate", "vehicleTitle", "mechanicId", "mechanicName", "entryMileage", "reportedProblem", "status", "appointmentId", "total", "createdAt", "updatedAt" }`.

Objeto `Order` (detalle) = `OrderSummary` más:

```json
{
  "diagnosis": null, "notes": null, "recommendations": null, "deliveredAt": null,
  "services": [ { "id", "description", "amount" } ],
  "labor": [ { "id", "description", "hours", "hourlyRate", "amount" } ],
  "servicesSubtotal": 0, "laborSubtotal": 0, "total": 0,
  "statusHistory": [ { "fromStatus", "toStatus", "changedBy": { "id", "name" }, "createdAt" } ],
  "allowedTransitions": [ "DIAGNOSTICO" ],
  "editable": { "work": true, "notesAndRecommendations": true, "basicData": true }
}
```

`allowedTransitions` y `editable` se calculan para el usuario que consulta (según su rol y la asignación), para que la interfaz muestre solo las acciones posibles; el servidor vuelve a validar cada operación.

| Método y ruta | Permiso | Descripción | Respuesta |
|---------------|---------|-------------|-----------|
| `GET /api/orders` | todos* | Listado, más recientes primero. Filtros: `status`, `mechanicId` (ignorado para MECHANIC), `clientId`, `search` (folio, cliente o placa), `page`, `pageSize`. *El MECHANIC solo recibe sus órdenes, con las abiertas primero | `200` lista de `OrderSummary` + `meta` |
| `POST /api/orders` | ADMIN, RECEPTIONIST | Alta: `clientId`, `vehicleId`, `entryMileage`, `reportedProblem`, `mechanicId?`, `mileageCorrection?` — o `appointmentId` (toma cliente y vehículo de la cita y, si falta, `reportedProblem` = motivo) | `201` `Order` en `RECIBIDO` |
| `GET /api/orders/:id` | todos* | Detalle. *Una orden ajena responde `404` al MECHANIC | `200` `Order` |
| `PATCH /api/orders/:id` | ADMIN, RECEPTIONIST | Corrige `reportedProblem`, `mechanicId`, `entryMileage` (+ `mileageCorrection?`); no en `TERMINADO`/`ENTREGADO` | `200` `Order` |
| `PATCH /api/orders/:id/work` | ADMIN, MECHANIC asignado | Edita `diagnosis` (estados de trabajo), `notes` y `recommendations` (hasta antes de `ENTREGADO`) | `200` `Order` |
| `POST /api/orders/:id/services` | ADMIN, MECHANIC asignado | Agrega servicio: `description`, `amount` | `201` `Order` |
| `PATCH /api/orders/:id/services/:serviceId` | ídem | Edita `description`, `amount` | `200` `Order` |
| `DELETE /api/orders/:id/services/:serviceId` | ídem | Quita el servicio (corrección de captura) | `200` `Order` |
| `POST /api/orders/:id/labor` | ídem | Agrega mano de obra: `description`, `hours`, `hourlyRate` | `201` `Order` |
| `PATCH /api/orders/:id/labor/:laborId` | ídem | Edita la línea | `200` `Order` |
| `DELETE /api/orders/:id/labor/:laborId` | ídem | Quita la línea | `200` `Order` |
| `POST /api/orders/:id/status` | según la matriz de permisos | Cuerpo `{ "status": "DIAGNOSTICO" }` | `200` `Order` |

Notas:
- No existe `DELETE /api/orders/:id` ni ruta para eliminar citas: las órdenes y citas se conservan siempre.
- Los servicios y la mano de obra solo se modifican en `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION` y `ESPERANDO_REFACCION` (`409 ORDER_NOT_EDITABLE` en otro caso).
- Al pasar a `ENTREGADO` se fija `deliveredAt` y, si la orden viene de una cita, la cita pasa a `COMPLETADA`. Al crear una orden desde una cita, esta pasa a `EN_PROCESO`.
- Validaciones: `entryMileage` entero ≥ 0 (regla D9); `reportedProblem` 1–1000 caracteres; `diagnosis`, `notes`, `recommendations` hasta 5000; `description` 1–255; `amount` y `hourlyRate` ≥ 0 con dos decimales como máximo; `hours` > 0 y ≤ 9999,99.
