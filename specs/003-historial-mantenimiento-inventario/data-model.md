# Modelo de datos: Historial, mantenimiento e inventario

Extiende el esquema de los Sprints 1 y 2. Se implementará en `database/migrations/003_sprint3_maintenance_inventory.sql` (MySQL 8.0, InnoDB, `utf8mb4`). Tablas y columnas en inglés; los valores de estado y de tipo usan los nombres de la documentación del proyecto. Ninguna llave foránea es en cascada.

## Diagrama de relaciones

```text
parts 1 ── * inventory_movements * ── 0..1 service_orders
parts 1 ── * order_parts * ── 1 service_orders
vehicles 1 ── * maintenance          (y maintenance → service_orders, opcional: orden de origen)
service_orders (TERMINADO / ENTREGADO) ──► historial del vehículo   [vista calculada, sin tabla]
users ── * inventory_movements (createdBy)   users ── * maintenance (createdBy)
```

## Tabla `parts`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identificador |
| `code` | VARCHAR(40) | NOT NULL, UNIQUE | Código o número de parte |
| `name` | VARCHAR(120) | NOT NULL, INDEX | Nombre |
| `category` | VARCHAR(60) | NOT NULL, INDEX | Categoría |
| `brand` | VARCHAR(60) | NOT NULL | Marca |
| `stock` | INT UNSIGNED | NOT NULL, DEFAULT 0, CHECK (`stock` >= 0) | Existencia actual; solo cambia junto con un movimiento |
| `minimumStock` | INT UNSIGNED | NOT NULL, DEFAULT 0 | Stock mínimo (umbral de alerta) |
| `purchasePrice` | DECIMAL(10,2) | NOT NULL, CHECK (`purchasePrice` >= 0) | Precio de compra (solo lo ve el administrador) |
| `salePrice` | DECIMAL(10,2) | NOT NULL, CHECK (`salePrice` >= 0) | Precio de venta vigente |
| `active` | TINYINT(1) | NOT NULL, DEFAULT 1, INDEX | Refacción activa |
| `createdAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Registro |
| `updatedAt` | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | Última actualización |

**Reglas de validación**
- `code`: obligatorio, 1 a 40 caracteres, sin espacios en los extremos, único sin distinguir mayúsculas; no cambia después del alta.
- `name`: 1 a 120; `category`: 1 a 60; `brand`: 1 a 60.
- `minimumStock`: entero de 0 a 1,000,000; `initialStock` (solo al crear): entero de 0 a 1,000,000.
- `purchasePrice` y `salePrice`: de 0 a 99,999,999.99 con hasta dos decimales.
- Nivel de alerta (derivado, solo refacciones activas): `OUT` si `stock` = 0; `LOW` si `stock` <= `minimumStock` y `stock` > 0; `OK` en otro caso.
- Desactivar (`active` = 0) no borra nada; una refacción con movimientos nunca se elimina.

## Tabla `inventory_movements`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identificador |
| `partId` | INT UNSIGNED | NOT NULL, FK → `parts.id` | Refacción |
| `type` | ENUM('IN','OUT','ADJUSTMENT') | NOT NULL | Tipo de movimiento |
| `quantity` | INT | NOT NULL, CHECK (`quantity` <> 0) | Cambio de stock **con signo** |
| `stockAfter` | INT UNSIGNED | NOT NULL | Stock resultante tras el movimiento |
| `reason` | VARCHAR(255) | NOT NULL | Motivo |
| `orderId` | INT UNSIGNED | NULL, FK → `service_orders.id` | Orden relacionada (usos, reversas y cancelaciones) |
| `createdBy` | INT UNSIGNED | NOT NULL, FK → `users.id` | Quien lo registró |
| `createdAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Fecha y hora |

Índices: (`partId`, `createdAt`) y `orderId`.

**Reglas**
- Coherencia con el tipo (`CHECK`): `IN` → `quantity` > 0; `OUT` → `quantity` < 0; `ADJUSTMENT` → `quantity` distinto de cero (diferencia con signo).
- Inmutables: no existen operaciones de edición ni de baja; las correcciones son ajustes.
- Invariante verificable: para cada refacción, `parts.stock` = SUM(`inventory_movements.quantity`).
- `reason`: obligatorio, 1 a 255 caracteres. Las salidas manuales y los ajustes exigen un motivo escrito por la persona; los usos en órdenes generan motivos automáticos.
- Ningún movimiento puede dejar `stock` negativo.

## Tabla `order_parts`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identificador |
| `orderId` | INT UNSIGNED | NOT NULL, FK → `service_orders.id` | Orden (RN-6) |
| `partId` | INT UNSIGNED | NOT NULL, FK → `parts.id` | Refacción |
| `partCode` | VARCHAR(40) | NOT NULL | Código al momento del uso (instantánea) |
| `partName` | VARCHAR(120) | NOT NULL | Nombre al momento del uso (instantánea) |
| `quantity` | INT UNSIGNED | NOT NULL, CHECK (`quantity` > 0) | Piezas usadas |
| `unitPrice` | DECIMAL(10,2) | NOT NULL, CHECK (`unitPrice` >= 0) | Precio de venta al agregarla (instantánea) |
| `amount` | DECIMAL(10,2) | GENERADA ALMACENADA `ROUND(quantity * unitPrice, 2)` | Importe |
| `createdAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Registro |
| `updatedAt` | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | Actualización |

Restricción: `UNIQUE (orderId, partId)` (una línea por refacción en cada orden).

**Reglas**
- Solo se agregan, cambian o quitan con la orden en `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION` o `ESPERANDO_REFACCION`, por el mecánico asignado o un administrador.
- Solo refacciones activas; `quantity` entera de 1 a 1,000,000 y no mayor al stock disponible.
- `unitPrice` lo fija el servidor con el `salePrice` vigente; nadie lo envía.
- Cada alta, cambio de cantidad, baja o cancelación genera sus movimientos en la misma transacción.
- El total de la orden suma `order_services.amount`, `order_labor.amount` y `order_parts.amount`.

## Cambio en `service_orders` (Sprint 2)

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `serviceMileage` | INT UNSIGNED | NULL | Kilometraje del servicio (opcional) |

**Reglas**: entero entre `entryMileage` y 1,500,000; lo registra el mecánico asignado o un administrador con la orden en curso. Al guardarlo, `vehicles.currentMileage` pasa a `GREATEST(currentMileage, serviceMileage)`. El historial usa `COALESCE(serviceMileage, entryMileage)`.

## Tabla `maintenance`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identificador |
| `vehicleId` | INT UNSIGNED | NOT NULL, FK → `vehicles.id`, INDEX | Vehículo |
| `serviceType` | VARCHAR(100) | NOT NULL | Tipo de servicio (por ejemplo, "Cambio de aceite") |
| `lastServiceDate` | DATE | NOT NULL | Fecha del último servicio |
| `lastMileage` | INT UNSIGNED | NOT NULL | Kilometraje del último servicio |
| `nextDate` | DATE | NULL | Próxima fecha |
| `nextMileage` | INT UNSIGNED | NULL | Próximo kilometraje |
| `notes` | TEXT | NULL | Notas |
| `status` | ENUM('PENDIENTE','ATENDIDO') | NOT NULL, DEFAULT 'PENDIENTE', INDEX | Estado |
| `completedAt` | DATETIME | NULL | Cuándo pasó a Atendido |
| `sourceOrderId` | INT UNSIGNED | NULL, FK → `service_orders.id` | Orden de la que se programó (opcional) |
| `createdBy` | INT UNSIGNED | NOT NULL, FK → `users.id` | Quien lo registró |
| `createdAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Registro |
| `updatedAt` | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | Actualización |

Restricciones de tabla (`CHECK`):
- al menos uno de `nextDate` o `nextMileage` no es nulo;
- `nextDate` es nulo o mayor o igual a `lastServiceDate`;
- `nextMileage` es nulo o mayor a `lastMileage`.

**Reglas**
- `serviceType`: 1 a 100 caracteres; `notes`: hasta 2000; `lastMileage` y `nextMileage`: enteros hasta 1,500,000.
- Al registrar uno nuevo, los pendientes del mismo vehículo y mismo tipo (sin distinguir mayúsculas ni espacios en los extremos) pasan a `ATENDIDO` con `completedAt`.
- Los `ATENDIDO` no se editan.
- **Clasificación (calculada, no se guarda)**, con la fecha de hoy y el `currentMileage` del vehículo: `VENCIDO` si `nextDate` < hoy o `currentMileage` >= `nextMileage`; `PROXIMO` si (`nextDate` - hoy) <= 15 días o (`nextMileage` - `currentMileage`) <= 500 km; `NORMAL` en otro caso. Con ambos valores gana la condición más urgente.
- Solo mecánico y administrador crean o editan; todos los roles consultan.

## Historial del vehículo (vista calculada)

No es una tabla. Cada entrada sale de una orden del vehículo con estado `TERMINADO` o `ENTREGADO`:

| Dato | Origen |
|------|--------|
| Fecha del servicio | `order_status_history.changedAt` del cambio a `TERMINADO` |
| Kilometraje | `COALESCE(service_orders.serviceMileage, service_orders.entryMileage)` |
| Diagnóstico, observaciones, recomendaciones, total, folio, mecánico | `service_orders` |
| Servicios, mano de obra, refacciones | `order_services`, `order_labor`, `order_parts` |

Orden: más reciente primero. Las órdenes en curso o Canceladas no aparecen.

## Relaciones

- Una refacción tiene muchos movimientos; una orden tiene muchas refacciones usadas (una línea por refacción) y cada cambio de esas líneas genera movimientos ligados a la orden.
- Un vehículo tiene muchos mantenimientos programados (pendientes y atendidos) y su historial sale de sus órdenes.

## Datos de ejemplo (seeds)

Idempotentes. Los movimientos de ejemplo llevan motivos únicos para no duplicarse al repetir el seed; al final, `parts.stock` se fija como la suma de sus movimientos (la invariante se cumple por construcción).

- **Refacciones**: al menos 12, en categorías variadas (aceites y filtros, frenos, batería, suspensión, encendido), con existencia inicial y entradas; al menos una agotada (`OUT`), dos en stock bajo (`LOW`) y el resto en orden.
- **Refacciones en órdenes**: las órdenes de ejemplo de los estados en curso, terminada y entregada usan refacciones, con sus salidas ligadas a la orden; los totales de esas órdenes se recalculan.
- **Mantenimientos**: al menos 6 pendientes, con fechas y kilometrajes relativos a hoy y al kilometraje de los vehículos de ejemplo, en cada clasificación (Normal, Próximo, Vencido por fecha, Vencido por kilometraje) y uno Atendido.
- **Kilometraje del servicio**: las órdenes de ejemplo Terminada y Entregada tienen `serviceMileage`, para que el historial muestre datos.
