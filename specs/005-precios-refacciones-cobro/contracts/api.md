# Contrato de la API REST: Sprint 5 (precios de refacciones y cobro completo)

Extiende los contratos de los Sprints 1 a 4: misma base `/api`, mismo formato de éxito `{ "data": ..., "meta": ... }` y de error `{ "error": { "code", "message", "details" } }`, y autenticación con `Authorization: Bearer <token>`. **No se agregan rutas**: el sprint cambia lo que algunas respuestas contienen según el rol y agrega dos errores y un campo opcional de solicitud.

## Códigos de error nuevos

| HTTP | Código | Cuándo |
|------|--------|--------|
| 409 | `PRICE_BELOW_COST` | Se crea una refacción o se cambia un precio y el precio de venta resulta menor al de compra sin confirmación (FR-004) |
| 409 | `AMOUNT_LIMIT_EXCEEDED` | El importe de una línea o el total de la orden superaría 99,999,999.99 (FR-003); no se modifica nada |

Se reutilizan `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `ORDER_NOT_EDITABLE`, `PART_INACTIVE` y los demás de los sprints anteriores.

## Campo nuevo de solicitud

| Ruta | Campo | Tipo | Efecto |
|------|-------|------|--------|
| `POST /parts` y `PATCH /parts/:id` | `confirmBelowCost` | booleano, opcional | Con `true`, se guarda una venta menor a la compra; no se almacena. Al editar otros datos sin cambiar los precios no hace falta |

## Cambios de respuesta por rol (H-07)

Solo cambia la respuesta del **mecánico**; administrador y recepción reciben lo mismo que hoy, salvo que recepción nunca recibe `purchasePrice` (ya ocurre).

| Ruta | Campos que el mecánico **ya no recibe** |
|------|----------------------------------------|
| `GET /parts` | `purchasePrice` y `salePrice` de cada refacción |
| `GET /parts/:id` | `purchasePrice` y `salePrice` |
| `GET /orders` | `total` de cada orden |
| `GET /orders/:id` | `total`; en `parts[]`, `unitPrice` y `amount` |
| `PATCH /orders/:id` | los mismos que `GET /orders/:id` |
| `POST /orders/:id/status` | los mismos que `GET /orders/:id` |
| `POST`, `PATCH` y `DELETE` de `/orders/:id/services`, `/orders/:id/labor` y `/orders/:id/parts` | los mismos que `GET /orders/:id` (todas devuelven el detalle) |
| `GET /vehicles/:id/history` | `total` de cada servicio; en `parts[]`, `unitPrice` y `amount` |

Lo que el mecánico **sigue recibiendo**: de las refacciones, código, nombre, categoría, marca, existencia y stock mínimo, y en las líneas de la orden código, nombre y cantidad; el importe de servicios y de mano de obra; estados, diagnóstico y el resto de la orden.

**Rutas que no cambian**: `GET /orders/:id/payments`, `POST /orders/:id/payments`, `POST` y `GET /orders/:id/ticket` y `POST /orders/:id/ticket/print-link` ya responden `403` al mecánico; el panel de control es solo del administrador; los movimientos de inventario no contienen precios.

## Matriz de permisos (resumen de lo que cambia)

| Dato en la respuesta | ADMIN | RECEPTIONIST | MECHANIC |
|----------------------|:-----:|:------------:|:--------:|
| `purchasePrice` | ✔ | ✘ | ✘ |
| `salePrice`, `unitPrice`, `amount` de refacciones | ✔ | ✔ | ✘ |
| `total` de la orden | ✔ | ✔ | ✘ |

## Ejemplos

**Venta menor al costo sin confirmar** (`POST /parts` con `purchasePrice: 100.00` y `salePrice: 80.00`):

```json
{ "error": { "code": "PRICE_BELOW_COST", "message": "El precio de venta es menor al de compra. Confirma para guardar de todos modos.", "details": [{ "field": "salePrice", "message": "La venta (80.00) es menor al costo (100.00)." }] } }
```

**Límite superado** (`POST /orders/:id/parts`):

```json
{ "error": { "code": "AMOUNT_LIMIT_EXCEEDED", "message": "El importe supera el máximo permitido de 99,999,999.99.", "details": [{ "field": "quantity", "message": "El importe de la línea sería 120,000,000.00." }] } }
```
