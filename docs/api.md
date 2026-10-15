# Contrato de la API REST

**Especificación**: [spec.md](../specs/001-base-clientes-vehiculos/spec.md) | **Modelo de datos**: [data-model.md](../specs/001-base-clientes-vehiculos/data-model.md)

Este documento reúne los contratos de cada sprint y debe mantenerse sincronizado con
`specs/001-base-clientes-vehiculos/contracts/api.md`, `specs/002-citas-ordenes-servicio/contracts/api.md`,
`specs/003-historial-inventario/contracts/api.md` y `specs/004-pagos-tickets-dashboard/contracts/api.md`. Las pruebas de contrato están en `server/tests/contract`.

## Convenciones

- Prefijo `/api`. Cuerpos y respuestas en JSON (`Content-Type: application/json`), campos en `camelCase`.
- Autenticación: cabecera `Authorization: Bearer <token>` en todo endpoint salvo `POST /api/auth/login` y `GET /api/health`.
- Respuesta exitosa: `{ "data": ... }`; en listados, además `"meta": { "page", "pageSize", "total" }`.
- Listados: parámetros `page` (por defecto 1), `pageSize` (por defecto 20, máximo 100) y `search` (texto libre).
- Respuesta de error (nunca incluye trazas internas):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Mensaje en español", "details": [ { "field": "email", "message": "..." } ] } }
```

| HTTP | `code` | Cuándo |
|:----:|--------|--------|
| 400 | `VALIDATION_ERROR` | Datos faltantes o con formato inválido; `details` lista cada campo |
| 401 | `INVALID_CREDENTIALS` | Usuario/correo o contraseña incorrectos (mensaje genérico) |
| 401 | `UNAUTHENTICATED` | Falta el token, es inválido, expiró o el usuario está inactivo |
| 403 | `FORBIDDEN` | El rol no permite la operación |
| 404 | `NOT_FOUND` | El recurso no existe |
| 409 | `DUPLICATE_USERNAME`, `DUPLICATE_EMAIL`, `DUPLICATE_LICENSE_PLATE`, `DUPLICATE_VIN` | Dato único repetido; `details.field` indica el campo |
| 409 | `PHONE_DUPLICATE_WARNING` | Teléfono ya registrado y falta `confirmDuplicatePhone: true`; `details.matches` lista clientes coincidentes (`id`, `name`) |
| 409 | `LAST_ADMIN_PROTECTED` | Se intentó dejar el sistema sin administrador activo, o un administrador intentó desactivarse o cambiar su propio rol |
| 409 | `MILEAGE_DECREASE` | Kilometraje menor al guardado sin `mileageCorrection: true` |
| 423 | `ACCOUNT_LOCKED` | Cuenta bloqueada por intentos fallidos; `details.retryAfterSeconds` |
| 500 | `INTERNAL_ERROR` | Error inesperado, con mensaje genérico |

## Matriz de permisos

| Operación | ADMIN | RECEPTIONIST | MECHANIC |
|-----------|:-----:|:------------:|:--------:|
| Iniciar sesión, ver perfil, cambiar la propia contraseña | sí | sí | sí |
| Consultar clientes y vehículos (listado y detalle) | sí | sí | sí |
| Crear y editar clientes y vehículos | sí | sí | no |
| Gestionar usuarios (listar, crear, editar, activar/desactivar, restablecer contraseña) | sí | no | no |

## Salud

### `GET /api/health`

Sin autenticación. `200` → `{ "data": { "status": "ok" } }`.

## Autenticación (US1)

### `POST /api/auth/login`

```json
{ "identifier": "recepcion", "password": "..." }
```

- `identifier` acepta usuario o correo (si contiene `@` se trata como correo). No distingue mayúsculas ni espacios sobrantes.
- `200` → `{ "data": { "token": "...", "expiresIn": 28800, "user": { "id", "username", "name", "email", "role" } } }`
- Errores: `400`, `401 INVALID_CREDENTIALS`, `423 ACCOUNT_LOCKED`. Una cuenta inactiva responde `401 INVALID_CREDENTIALS`.

### `GET /api/auth/me`

`200` → `{ "data": { "id", "username", "name", "email", "role" } }`.

### `POST /api/auth/change-password`

```json
{ "currentPassword": "...", "newPassword": "..." }
```

- `204` sin cuerpo. Errores: `400` (política mínima incumplida; la nueva debe diferir de la actual), `401 INVALID_CREDENTIALS` si la contraseña actual es incorrecta.

## Usuarios (US2) — solo ADMIN

Objeto `User`: `{ "id", "username", "name", "email", "role", "active", "createdAt", "updatedAt" }` (nunca incluye datos de contraseña).

| Método y ruta | Descripción | Respuesta |
|---------------|-------------|-----------|
| `GET /api/users` | Listado. Filtros: `search`, `role`, `active` | `200` lista de `User` + `meta` |
| `POST /api/users` | Alta. Cuerpo: `username`, `name`, `email`, `role`, `password` | `201` `User` |
| `GET /api/users/:id` | Detalle | `200` `User` |
| `PATCH /api/users/:id` | Edición parcial: `name`, `email`, `role`, `active` | `200` `User` |
| `POST /api/users/:id/reset-password` | Cuerpo: `{ "newPassword" }`; cumple la política mínima | `204` |

Errores específicos: `409 DUPLICATE_USERNAME`, `409 DUPLICATE_EMAIL`, `409 LAST_ADMIN_PROTECTED`. El `username` no se modifica tras el alta.

## Clientes (US3, US4)

Objeto `Client`: `{ "id", "name", "phone", "email", "address", "active", "createdAt", "updatedAt" }`.

| Método y ruta | Permiso | Descripción | Respuesta |
|---------------|---------|-------------|-----------|
| `GET /api/clients` | todos | Listado; `search` busca en nombre, teléfono y correo | `200` lista de `Client` + `meta` |
| `POST /api/clients` | ADMIN, RECEPTIONIST | Alta: `name`, `phone`, `email?`, `address?`, `confirmDuplicatePhone?` | `201` `Client` |
| `GET /api/clients/:id` | todos | Detalle con vehículos: `Client` + `"vehicles": [Vehicle]` | `200` |
| `PATCH /api/clients/:id` | ADMIN, RECEPTIONIST | Edición parcial de `name`, `phone`, `email`, `address`, `confirmDuplicatePhone?` | `200` `Client` |

Errores específicos: `409 PHONE_DUPLICATE_WARNING` (se repite la petición con `confirmDuplicatePhone: true` tras la confirmación del usuario).

## Vehículos (US5)

Objeto `Vehicle`: `{ "id", "clientId", "brand", "model", "year", "licensePlate", "vin", "color", "currentMileage", "createdAt", "updatedAt" }`. En el detalle se añade `"owner": { "id", "name", "phone" }`.

| Método y ruta | Permiso | Descripción | Respuesta |
|---------------|---------|-------------|-----------|
| `GET /api/vehicles` | todos | Listado; filtros `search` (placa, marca, modelo, propietario) y `clientId` | `200` lista de `Vehicle` (con `ownerName`) + `meta` |
| `POST /api/vehicles` | ADMIN, RECEPTIONIST | Alta: `clientId`, `brand`, `model`, `year`, `licensePlate`, `vin?`, `color?`, `currentMileage?` | `201` `Vehicle` |
| `GET /api/vehicles/:id` | todos | Detalle con propietario | `200` `Vehicle` + `owner` |
| `PATCH /api/vehicles/:id` | ADMIN, RECEPTIONIST | Edición parcial (no acepta `clientId`); `mileageCorrection?` | `200` `Vehicle` |

Errores específicos: `400` si `clientId` falta, `404` si el propietario no existe (`details.field = "clientId"`), `409 DUPLICATE_LICENSE_PLATE`, `409 DUPLICATE_VIN`, `409 MILEAGE_DECREASE`.

---

# Sprint 2: citas y órdenes de servicio

Amplía las convenciones del Sprint 1 (prefijo `/api`, envoltorio `{ data }`, errores `{ error }`, paginación).
Especificación: [spec.md](../specs/002-citas-ordenes-servicio/spec.md) | Modelo: [data-model.md](../specs/002-citas-ordenes-servicio/data-model.md)

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

---

# Sprint 3: historial, mantenimiento e inventario

Amplía las convenciones de los sprints anteriores (prefijo `/api`, envoltorio `{ data }`, errores `{ error }`, paginación).
Especificación: [spec.md](../specs/003-historial-inventario/spec.md) | Modelo: [data-model.md](../specs/003-historial-inventario/data-model.md)

## Valores y formatos

- **Fechas de mantenimiento** `nextDate`: `YYYY-MM-DD` (sin hora).
- **Estados de mantenimiento**: `PENDIENTE`, `REALIZADO`, `CANCELADO`.
- **Clasificación de mantenimiento** `classification` (calculada): `OVERDUE` (vencido), `UPCOMING` (próximo), `LATER` (lejano); solo para los `PENDIENTE`, `null` en los demás.
- **Tipos de movimiento**: `IN`, `OUT`, `ADJUSTMENT`. `quantity` lleva signo (`OUT` negativo).
- **Estado de existencia** `stockStatus` (calculado): `OK`, `LOW` (stock bajo), `OUT` (agotada).
- **Importes**: números con hasta dos decimales. **Cantidades** y **existencias**: enteros.

## Errores nuevos

| HTTP | `code` | Cuándo |
|:----:|--------|--------|
| 409 | `INSUFFICIENT_STOCK` | La operación dejaría la existencia en negativo; `details`: `{ partId, available, requested }` |
| 409 | `PART_CODE_DUPLICATE` | Ya existe una refacción con ese código |
| 409 | `PART_INACTIVE` | Se intentó agregar a una orden una refacción inactiva |
| 409 | `MAINTENANCE_PENDING_EXISTS` | El vehículo ya tiene un mantenimiento pendiente y falta `replacePending: true`; `details.pending` lleva el pendiente |
| 409 | `MAINTENANCE_NOT_PENDING` | Se intentó editar o cerrar un mantenimiento que no está `PENDIENTE` |
| 409 | `ORDER_NOT_FINISHED` | Se intentó registrar un mantenimiento desde una orden que aún no está `TERMINADO` ni `ENTREGADO` |
| 409 | `ORDER_NOT_EDITABLE` | (del Sprint 2) refacciones o kilometraje de servicio en una orden que no lo admite |

Además: `400 VALIDATION_ERROR` (cantidad no entera o menor a 1, kilometraje de servicio menor al de entrada, mantenimiento sin fecha ni kilometraje, fecha pasada, kilometraje objetivo menor al actual, motivo faltante en entradas y ajustes, ajuste sin diferencia); `403 FORBIDDEN` por rol o por orden no asignada; `404 NOT_FOUND` (incluye órdenes ajenas para un mecánico).

## Matriz de permisos

| Operación | ADMIN | RECEPTIONIST | MECHANIC |
|-----------|:-----:|:------------:|:--------:|
| Historial del vehículo | sí | sí | sí |
| Mantenimientos de un vehículo (lectura) | sí | sí | sí |
| Listado global de mantenimientos | sí | sí | no |
| Crear, editar, realizar o cancelar mantenimiento | cualquiera | no | solo desde sus órdenes |
| Catálogo de refacciones (listar, ver, crear, editar, baja/alta) | sí | no | no |
| Entradas y ajustes de inventario, movimientos, alertas | sí | no | no |
| Buscar refacciones disponibles (`/parts/available`) | sí | no | sí |
| Agregar, cambiar o quitar refacciones de una orden | cualquiera | no | solo órdenes asignadas |
| Ver las refacciones en el detalle de la orden | sí | sí (solo lectura) | solo órdenes asignadas |

## Cambios a endpoints existentes

### `GET /api/orders/:id` — detalle de la orden

Se agregan al objeto `Order`:

```json
{
  "parts": [ { "id": 3, "partId": 7, "code": "FIL-ACE-01", "name": "Filtro de aceite", "quantity": 1, "unitPrice": 120.00, "amount": 120.00 } ],
  "partsSubtotal": 120.00,
  "serviceMileage": 20450,
  "total": 1790.50
}
```

- `total` = `servicesSubtotal + laborSubtotal + partsSubtotal`. En los listados, `total` también lo incluye.
- `editable.parts` (booleano): el usuario puede agregar, cambiar o quitar refacciones ahora (administrador o mecánico asignado, y orden en estado de trabajo).

### `PATCH /api/orders/:id/work` — trabajo técnico

Acepta además `serviceMileage` (entero ≥ `entryMileage`, o `null` para borrarlo). Se permite mientras la orden no esté `ENTREGADO`; al guardarlo, el kilometraje actual del vehículo pasa a ser el mayor entre el actual y el de servicio. Errores: `400` (menor al de entrada), `409 ORDER_NOT_EDITABLE`.

## Refacciones de la orden — administrador o mecánico asignado

### `POST /api/orders/:id/parts`

```json
{ "partId": 7, "quantity": 2 }
```

- Solo con la orden en `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION` o `ESPERANDO_REFACCION`.
- Guarda el precio vigente como `unitPrice`. Si la refacción ya está en la orden, suma la cantidad a la línea existente.
- Genera un movimiento `OUT` ligado a la orden y reduce la existencia.
- `200` → el objeto `Order` completo actualizado. Errores: `400`, `403`, `404`, `409 INSUFFICIENT_STOCK`, `409 PART_INACTIVE`, `409 ORDER_NOT_EDITABLE`.

### `PATCH /api/orders/:id/parts/:orderPartId`

```json
{ "quantity": 3 }
```

- Aumentar genera `OUT` por la diferencia; reducir genera `IN` por la diferencia. `200` → `Order`. Mismos errores.

### `DELETE /api/orders/:id/parts/:orderPartId`

- Genera `IN` por toda la cantidad (devolución) y elimina la línea. `200` → `Order`.

## Historial del vehículo (US1, US2)

### `GET /api/vehicles/:id/history`

Todos los roles. Parámetros: `page`, `pageSize`. Órdenes del vehículo en `TERMINADO` o `ENTREGADO`, de la más reciente a la más antigua por `serviceDate` (instante ISO del último cambio a `TERMINADO`; si no existe, el de creación de la orden). `200` →

```json
{
  "data": [
    {
      "orderId": 12, "folio": "OS-000012", "status": "ENTREGADO",
      "serviceDate": "2026-09-30T16:20:00.000Z", "mileage": 20450,
      "mechanicName": "Mecánico Motorix", "reportedProblem": "...",
      "diagnosis": "...", "recommendations": "...",
      "services": [ { "description": "Cambio de aceite", "amount": 850.00 } ],
      "labor": [ { "description": "Servicio completo", "hours": 2, "hourlyRate": 300, "amount": 600 } ],
      "parts": [ { "code": "FIL-ACE-01", "name": "Filtro de aceite", "quantity": 1, "unitPrice": 120.00, "amount": 120.00 } ],
      "total": 1670.50
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 3 }
}
```

`404` si el vehículo no existe. Un vehículo sin servicios devuelve `data: []`.

## Mantenimientos (US3, US4)

Objeto `Maintenance`: `{ "id", "vehicleId", "vehiclePlate", "vehicleTitle", "clientId", "clientName", "clientPhone", "orderId", "orderFolio", "description", "nextDate", "nextMileage", "currentMileage", "status", "classification", "daysRemaining", "kmRemaining", "completedAt", "createdAt", "canManage" }`. `daysRemaining` y `kmRemaining` son negativos cuando está vencido y `null` si no hay ese dato. `canManage` indica si el usuario puede editar o cerrar el mantenimiento ahora (pendiente y administrador o mecánico asignado a la orden de origen); la interfaz solo ofrece las acciones cuando es verdadero.

### `GET /api/maintenance` — ADMIN y RECEPTIONIST

Parámetros: `classification` (`OVERDUE`, `UPCOMING` o `ALERT` = ambos; por defecto `ALERT`), `status` (`PENDIENTE`, `REALIZADO`, `CANCELADO`; si se indica, ignora `classification`), `search` (cliente o placa), `page`, `pageSize`. Orden: vencidos primero, luego próximos por cercanía. `200` → `{ data: [Maintenance], meta: { page, pageSize, total, warningDays, warningKm } }`.

### `GET /api/vehicles/:id/maintenance` — todos los roles

Mantenimientos del vehículo (pendiente primero, luego los más recientes). `200` → `{ data: [Maintenance] }`.

### `POST /api/maintenance` — ADMIN y MECHANIC (sus órdenes)

```json
{ "orderId": 12, "description": "Cambio de aceite y filtro", "nextDate": "2027-03-30", "nextMileage": 25450, "replacePending": false }
```

- Se requiere `nextDate`, `nextMileage` o ambos. La fecha no puede ser anterior a hoy; el kilometraje no puede ser menor al actual del vehículo. El vehículo se toma de la orden, que debe estar `TERMINADO` o `ENTREGADO`.
- Con un pendiente en el vehículo y `replacePending` ausente o falso → `409 MAINTENANCE_PENDING_EXISTS`. Con `true`, el anterior pasa a `CANCELADO`.
- `201` → `Maintenance`. Errores: `400`, `403`, `404`, `409 MAINTENANCE_PENDING_EXISTS`, `409 ORDER_NOT_FINISHED`.

### `GET /api/maintenance/:id` — todos los roles

`200` → `Maintenance`. Un mecánico solo ve los de vehículos que ha trabajado en sus órdenes asignadas; los demás responden `404`.

### `PATCH /api/maintenance/:id`

Cuerpo parcial: `description`, `nextDate`, `nextMileage` (se puede quitar uno si queda el otro). Solo `PENDIENTE`. Mismos roles y validaciones que el alta. `200` → `Maintenance`. Errores: `409 MAINTENANCE_NOT_PENDING`.

### `POST /api/maintenance/:id/complete` y `POST /api/maintenance/:id/cancel`

Sin cuerpo. Pasan de `PENDIENTE` a `REALIZADO` o `CANCELADO`. Mismos roles. `200` → `Maintenance`. Errores: `409 MAINTENANCE_NOT_PENDING`.

## Refacciones e inventario — solo ADMIN (salvo `available`)

Objeto `Part`: `{ "id", "code", "name", "description", "price", "stock", "minimumStock", "active", "stockStatus", "createdAt", "updatedAt" }`.

### `GET /api/parts`

Parámetros: `search` (código o nombre), `alert` (`LOW`, `OUT` o `ANY` = bajo o agotada), `active` (`true`/`false`; por defecto ambos), `page`, `pageSize`. Orden por nombre. `200` → `{ data: [Part], meta }`.

### `GET /api/parts/alerts`

`200` → `{ "data": { "low": 3, "out": 2, "total": 5 } }` (solo refacciones activas).

### `GET /api/parts/available` — ADMIN y MECHANIC

Parámetros: `search` (obligatorio, mínimo 2 caracteres), `limit` (por defecto 20, máx. 50). Refacciones **activas** con existencia mayor a 0. `200` → `{ data: [ { "id", "code", "name", "price", "stock" } ] }`.

### `POST /api/parts`

```json
{ "code": "FIL-ACE-01", "name": "Filtro de aceite", "description": "...", "price": 120.00, "minimumStock": 5, "initialStock": 20 }
```

`201` → `Part`. Con `initialStock > 0` registra un movimiento `IN` "Existencia inicial". Errores: `400`, `409 PART_CODE_DUPLICATE`.

### `GET /api/parts/:id`

`200` → `Part`. `404` si no existe.

### `PATCH /api/parts/:id`

Cuerpo parcial: `code`, `name`, `description`, `price`, `minimumStock`. No acepta `stock`. `200` → `Part`. Errores: `400`, `409 PART_CODE_DUPLICATE`. El cambio de precio no afecta a las órdenes ya capturadas.

### `POST /api/parts/:id/deactivate` y `POST /api/parts/:id/activate`

Sin cuerpo. Baja o reactivación lógica; idempotentes. `200` → `Part`.

### `POST /api/parts/:id/entries`

```json
{ "quantity": 10, "reason": "Compra a proveedor" }
```

`quantity` entero ≥ 1; `reason` obligatorio. Genera `IN`. `201` → `{ "data": { "part": Part, "movement": InventoryMovement } }`.

### `POST /api/parts/:id/adjustments`

```json
{ "newStock": 8, "reason": "Conteo físico" }
```

`newStock` es la existencia contada (entero ≥ 0); `reason` obligatorio. El sistema calcula la diferencia y genera `ADJUSTMENT`; sin diferencia responde `400`. `201` → `{ part, movement }`.

### `GET /api/parts/:id/movements`

Parámetros: `page`, `pageSize`. Del más reciente al más antiguo. `200` → `{ data: [InventoryMovement], meta }`.

Objeto `InventoryMovement`: `{ "id", "partId", "type", "quantity", "reason", "orderId", "orderFolio", "createdBy", "createdByName", "createdAt" }`.

---

# Sprint 4: pagos, tickets y panel de control

Amplía las convenciones de los sprints anteriores (prefijo `/api`, envoltorio `{ data }`, errores `{ error }`, paginación).
Especificación: [spec.md](../specs/004-pagos-tickets-dashboard/spec.md) | Modelo: [data-model.md](../specs/004-pagos-tickets-dashboard/data-model.md)

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
