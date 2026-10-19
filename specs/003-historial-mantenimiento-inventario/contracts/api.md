# Contrato de la API REST: Sprint 3 (historial, mantenimiento e inventario)

Extiende los contratos de los Sprints 1 y 2: misma base `/api`, mismo formato de éxito `{ "data": ..., "meta": ... }` y de error `{ "error": { "code", "message", "details" } }`, y autenticación con `Authorization: Bearer <token>`.

## Códigos de error nuevos

| HTTP | Código | Cuándo |
|------|--------|--------|
| 409 | `INSUFFICIENT_STOCK` | La operación dejaría el stock negativo; incluye `available` (stock disponible) |
| 409 | `DUPLICATE_ORDER_PART` | La refacción ya está en la orden (se debe editar su cantidad) |
| 409 | `PART_INACTIVE` | Se intenta usar una refacción desactivada |
| 409 | `MAINTENANCE_NOT_EDITABLE` | El mantenimiento ya está Atendido |
| 409 | `DUPLICATE_VALUE` | El código de la refacción ya existe (campo `code` en `details`) |

Se reutilizan `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `ORDER_NOT_EDITABLE` y los demás de los sprints anteriores.

## Valores

- **Tipo de movimiento**: `IN`, `OUT`, `ADJUSTMENT`. `quantity` en las respuestas es el **cambio de stock con signo** (entradas positivas, salidas negativas).
- **Nivel de stock**: `OK`, `LOW` (stock menor o igual al mínimo y mayor que 0), `OUT` (stock 0). Solo para refacciones activas.
- **Clasificación de mantenimiento**: `NORMAL`, `PROXIMO`, `VENCIDO`. **Estado**: `PENDIENTE`, `ATENDIDO`.
- Importes y precios como cadenas con dos decimales. Fechas de mantenimiento como `YYYY-MM-DD`.

## Matriz de permisos

| Endpoint | ADMIN | RECEPTIONIST | MECHANIC |
|----------|:-----:|:------------:|:--------:|
| `GET /parts`, `/parts/summary`, `/parts/categories`, `/parts/:id`, `/parts/:id/movements` | ✔ | ✔ (sin precio de compra) | ✔ (sin precio de compra) |
| `POST /parts`, `PATCH /parts/:id`, `POST /parts/:id/movements` | ✔ | ✘ | ✘ |
| `POST/PATCH/DELETE /orders/:id/parts…` | ✔ | ✘ | ✔ (solo si la orden es suya) |
| `GET /maintenance`, `GET /maintenance/:id` | ✔ | ✔ | ✔ |
| `POST /maintenance`, `PATCH /maintenance/:id` | ✔ | ✘ | ✔ |
| `GET /vehicles/:id/history` | ✔ | ✔ | ✔ |
| `PATCH /orders/:id` con `serviceMileage` | ✔ | ✘ | ✔ (solo si la orden es suya) |

**Precio de compra**: el campo `purchasePrice` solo aparece en las respuestas de un administrador; para los demás roles el servidor no lo envía.

## Refacciones

Forma de una refacción: `{ id, code, name, category, brand, stock, minimumStock, stockLevel, salePrice, active, createdAt, updatedAt, purchasePrice? }` (`purchasePrice` solo para ADMIN).

### `GET /parts`

Parámetros opcionales: `search` (código, nombre, categoría o marca), `category`, `stockLevel` (`LOW`, `OUT` o `LOW,OUT`), `active` (`true` por defecto para quien no es administrador; el administrador puede pedir `false` o `all`), `page`, `pageSize`. Orden: nombre ascendente. Respuesta 200 con `data` y `meta`.

### `GET /parts/summary`

Respuesta 200: `{ "data": { "total": 14, "ok": 11, "low": 2, "out": 1 } }` (solo refacciones activas).

### `GET /parts/categories`

Respuesta 200: `{ "data": ["Aceites y filtros", "Frenos"] }`.

### `GET /parts/:id`

La refacción más `movements`: los 100 movimientos más recientes `{ id, type, quantity, stockAfter, reason, orderId, orderFolio, createdBy: { id, name }, createdAt }`. 404 si no existe.

### `POST /parts` (ADMIN)

Solicitud: `{ "code", "name", "category", "brand", "minimumStock", "purchasePrice", "salePrice", "initialStock"? }`. Respuesta 201 con la refacción; si `initialStock` > 0 se crea un movimiento `IN` con motivo "Existencia inicial". Errores: 400, 409 `DUPLICATE_VALUE` (campo `code`).

### `PATCH /parts/:id` (ADMIN)

Campos opcionales: `name`, `category`, `brand`, `minimumStock`, `purchasePrice`, `salePrice`, `active`. El código y el stock no se editan (un `stock` enviado se ignora). Respuesta 200. Las órdenes pasadas conservan sus precios.

### `POST /parts/:id/movements` (ADMIN)

Solicitud: `{ "type": "IN" | "OUT" | "ADJUSTMENT", "quantity": <entero>, "reason": "..." }`.
- `IN` y `OUT`: `quantity` entero mayor a 0 (el servidor aplica el signo).
- `ADJUSTMENT`: `quantity` entero distinto de 0, **con signo** (la diferencia).
- `reason` obligatorio, hasta 255 caracteres.

Respuesta 201 con el movimiento y la refacción actualizada: `{ "data": { "movement": {...}, "part": {...} } }`. Errores: 400, 404, 409 `INSUFFICIENT_STOCK` (con `available`).

### `GET /parts/:id/movements`

Parámetros `page`, `pageSize`; orden del más reciente al más antiguo; respuesta 200 con `data` y `meta`.

## Refacciones en una orden

La orden completa (respuestas de los endpoints de líneas y de `GET /orders/:id`) incluye ahora `parts: [ { id, partId, code, name, quantity, unitPrice, amount } ]`, `serviceMileage` y un `total` que suma servicios, mano de obra y refacciones.

### `POST /orders/:id/parts` (ADMIN o mecánico asignado)

Solicitud: `{ "partId", "quantity" }` (cualquier `unitPrice` enviado se ignora). Respuesta 201 con la orden completa. Errores: 400, 403, 404 (orden o refacción), 409 `ORDER_NOT_EDITABLE`, `PART_INACTIVE`, `DUPLICATE_ORDER_PART`, `INSUFFICIENT_STOCK`.

### `PATCH /orders/:id/parts/:lineId` (ADMIN o mecánico asignado)

Solicitud: `{ "quantity" }`. Registra la diferencia en el inventario. Respuesta 200 con la orden. Mismos errores; 404 si la línea no es de la orden.

### `DELETE /orders/:id/parts/:lineId` (ADMIN o mecánico asignado)

Regresa las piezas al stock. Respuesta 200 con la orden.

### `PATCH /orders/:id` con `serviceMileage`

Campo nuevo: `serviceMileage` (entero entre el kilometraje de entrada y 1,500,000). Mismos permisos que `diagnosis`. Actualiza el kilometraje actual del vehículo si es mayor. 400 si es menor al de entrada o está fuera de rango.

**Cancelar una orden** (`POST /orders/:id/status` con `CANCELADA`): regresa al stock las refacciones de la orden con movimientos de entrada que indican la cancelación.

## Historial del vehículo

### `GET /vehicles/:id/history`

Parámetros `page`, `pageSize`. Respuesta 200:

```json
{
  "data": [
    {
      "orderId": 12, "folio": "OS-000012", "status": "ENTREGADO",
      "serviceDate": "2026-10-05T16:30:00.000Z", "mileage": 48200,
      "mechanic": { "id": 3, "name": "Mario Mecánico" },
      "diagnosis": "...", "notes": "...", "recommendations": "...", "total": "2482.50",
      "services": [ { "id", "description", "amount" } ],
      "labor": [ { "id", "description", "hours", "hourlyRate", "amount" } ],
      "parts": [ { "id", "partId", "code", "name", "quantity", "unitPrice", "amount" } ]
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1 }
}
```

Solo órdenes `TERMINADO` o `ENTREGADO`, de la más reciente a la más antigua. 404 si el vehículo no existe.

## Mantenimientos

Forma de un mantenimiento: `{ id, vehicleId, serviceType, lastServiceDate, lastMileage, nextDate, nextMileage, notes, status, completedAt, sourceOrderId, classification, daysLeft, kmLeft, createdAt, updatedAt, vehicle: { id, brand, model, year, licensePlate, currentMileage }, client: { id, name, phone } }`. `classification`, `daysLeft` y `kmLeft` son nulos si el mantenimiento está Atendido; `daysLeft` y `kmLeft` son negativos cuando ya se pasó y nulos si el mantenimiento no tiene ese valor.

### `GET /maintenance`

Parámetros opcionales: `classification` (`NORMAL`, `PROXIMO`, `VENCIDO`, o varios separados por coma), `status` (`PENDIENTE` por defecto; `ATENDIDO` o `all`), `vehicleId`, `clientId`, `search` (cliente, placas o tipo de servicio), `page`, `pageSize`. Orden: Vencido, Próximo, Normal; dentro de cada grupo, el más urgente primero. Respuesta 200 con `data` y `meta`.

### `GET /maintenance/:id`

El mantenimiento; 404 si no existe.

### `POST /maintenance` (ADMIN o mecánico)

Solicitud: `{ "vehicleId", "serviceType", "lastServiceDate", "lastMileage", "nextDate"?, "nextMileage"?, "notes"?, "sourceOrderId"? }`. Exige al menos `nextDate` o `nextMileage`; `nextDate` >= `lastServiceDate`; `nextMileage` > `lastMileage`. Respuesta 201. En la misma operación los pendientes del mismo vehículo y tipo pasan a `ATENDIDO`. Errores: 400 (con el campo en `details`), 404 (vehículo u orden).

### `PATCH /maintenance/:id` (ADMIN o mecánico)

Campos opcionales: `serviceType`, `lastServiceDate`, `lastMileage`, `nextDate`, `nextMileage`, `notes` (se pueden enviar `nextDate` o `nextMileage` en `null` mientras quede al menos uno). Respuesta 200. 409 `MAINTENANCE_NOT_EDITABLE` si está Atendido.
