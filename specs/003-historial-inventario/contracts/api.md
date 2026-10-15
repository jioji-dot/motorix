# Contrato de la API REST: Sprint 3 (historial, mantenimiento e inventario)

**Especificación**: [spec.md](../spec.md) | **Modelo**: [data-model.md](../data-model.md) | **Base**: [contrato del Sprint 2](../../002-citas-ordenes-servicio/contracts/api.md)

Amplía los contratos de los Sprint 1 y 2. Se mantienen las convenciones: prefijo `/api`, JSON en `camelCase`, `Authorization: Bearer`, envoltorio `{ data }` / `{ data, meta }`, errores `{ error: { code, message, details } }`, paginación `page` (1), `pageSize` (20, máx. 100). Al implementar se fusiona en `docs/api.md`.

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
