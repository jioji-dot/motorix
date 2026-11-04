# Modelo de datos: Precios de refacciones y cobro completo

**Este sprint no cambia el esquema.** No hay tablas, columnas ni restricciones nuevas, y por eso no existe la migración `005`. Este documento fija las reglas y las proyecciones de los datos que ya existen.

## Diagrama de relaciones

```text
parts 1 ─── N order_parts N ─── 1 service_orders 1 ─── N payments
                                       │
                                       ├── N order_services
                                       ├── N order_labor
                                       └── 0..1 tickets
```

## Tabla `parts` (existente, migración 003)

| Campo | Tipo | Regla de este sprint |
|-------|------|----------------------|
| `category` | `VARCHAR(60)` obligatorio | Texto libre, hasta 60 caracteres (FR-001) |
| `brand` | `VARCHAR(60)` obligatorio | Texto libre, hasta 60 caracteres (FR-001) |
| `purchasePrice` | `DECIMAL(10,2)` obligatorio, `CHECK >= 0` | De 0 a 99,999,999.99, dos decimales; solo lo recibe el administrador (FR-002, FR-005) |
| `salePrice` | `DECIMAL(10,2)` obligatorio, `CHECK >= 0` | De 0 a 99,999,999.99, dos decimales; 0 se permite (FR-004-b); menor a `purchasePrice` exige confirmación (FR-004); no lo recibe el mecánico (FR-008) |

La confirmación de venta menor al costo **no se guarda**: es un dato de la solicitud, no de la tabla.

## Tabla `order_parts` (existente, migración 003)

| Campo | Regla de este sprint |
|-------|----------------------|
| `unitPrice` | Copia del `salePrice` vigente al agregar la línea; nunca se actualiza después (FR-010, FR-020). `CHECK >= 0` |
| `quantity` | Entero de 1 a 1,000,000 (ya validado) |
| `amount` | Columna generada `ROUND(quantity * unitPrice, 2)`; exacta, porque la cantidad es entera (H-08) |

Restricción única existente: una refacción aparece una sola vez por orden (`orderId`, `partId`); para cambiar el precio de una línea se quita y se agrega de nuevo (FR-020).

## Tabla `service_orders` (existente)

| Campo | Regla de este sprint |
|-------|----------------------|
| `total` | `DECIMAL(10,2)`; igual a servicios + mano de obra + refacciones, recalculado en la misma transacción de cada cambio de línea (FR-011). No puede superar 99,999,999.99; se valida antes de guardar (FR-003). No lo recibe el mecánico (FR-008) |

Una orden Terminada o Entregada no admite cambios de líneas (FR-012); una Cancelada conserva sus líneas, precios y total (FR-012-b).

## Tablas `payments` y `tickets` (existentes, migración 004)

Sin cambios. Un pago Pagado no se modifica; el ticket no guarda contenido propio: se arma al consultarlo con la orden, sus líneas y sus pagos, y como las líneas conservan su precio y la orden cobrada no cambia, el ticket emitido no varía (FR-013).

## Cálculos (no se guardan)

| Cálculo | Regla |
|---------|-------|
| Importe de una línea | `cantidad × precio unitario`, en centavos enteros |
| Total de la orden | servicios + mano de obra (`horas × tarifa`, redondeada al centavo, mitades hacia arriba) + refacciones |
| Saldo disponible | total − pagos Pagados − pagos Pendientes de Mercado Pago |
| Límite | 9,999,999,999 centavos para un precio, una línea y un total; inclusivo |

## Proyección por rol (qué recibe cada rol)

| Dato | Administrador | Recepción | Mecánico |
|------|:-------------:|:---------:|:--------:|
| Precio de compra de la refacción | ✔ | ✘ | ✘ |
| Precio de venta de la refacción | ✔ | ✔ | ✘ |
| Precio unitario e importe de una línea de refacción | ✔ | ✔ | ✘ |
| Total de la orden (detalle, listado, historial) | ✔ | ✔ | ✘ |
| Importe de servicios y mano de obra | ✔ | ✔ | ✔ |
| Pagos y ticket | ✔ | ✔ | ✘ (403) |

El detalle de las rutas y de los campos está en [contracts/api.md](contracts/api.md).

## Datos de ejemplo

Se conservan los seeds 001 a 008, que ya son idempotentes y traen una orden Terminada con refacción y pago parcial (OS-000005) y una Entregada pagada (OS-000006). No se agrega un seed nuevo; una prueba comprueba que cargarlos dos veces no duplica registros.
