# Modelo de datos: Historial, mantenimiento e inventario

**Funcionalidad**: [spec.md](spec.md) | **Fecha**: 2026-10-13

Migración nueva e inmutable: `database/migrations/003_sprint3_maintenance_inventory.sql`. Motor InnoDB, `utf8mb4`, collation `utf8mb4_0900_ai_ci`. Columnas en `snake_case` en la base y `camelCase` en la API. Todas las llaves foráneas son `ON DELETE RESTRICT`. Las migraciones 001 y 002 no se editan.

## Diagrama de relaciones

```text
vehicles 1 ──< maintenance >── 1 service_orders        (orden de origen)
parts 1 ──< inventory_movements >── 0..1 service_orders
service_orders 1 ──< order_parts >── 1 parts
users 1 ──< inventory_movements / maintenance          (quién lo registró)
service_orders (TERMINADO/ENTREGADO) ──> historial del vehículo   (consulta, sin tabla)
app_settings                                           (umbrales de mantenimiento)
```

## Cambios a tablas existentes

### `service_orders` (US2)

| Columna | Tipo | Restricciones | Notas |
|---------|------|---------------|-------|
| `service_mileage` | INT UNSIGNED | NULL | Kilometraje al terminar el servicio; debe ser ≥ `entry_mileage` (validado en el servicio) |

### `order_status_history` (US1)

- Índice nuevo `idx_order_history_order_status (order_id, to_status)` para ubicar la fecha en que la orden pasó a `TERMINADO`.

## Tabla `app_settings` (US3, US4)

| Columna | Tipo | Restricciones | Notas |
|---------|------|---------------|-------|
| `setting_key` | VARCHAR(60) | PK | |
| `setting_value` | VARCHAR(255) | NOT NULL | |
| `updated_at` | DATETIME | NOT NULL, actualización automática | |

Valores iniciales insertados por la migración (no son datos de ejemplo): `maintenance_warning_days = 30`, `maintenance_warning_km = 1000`. Se modifican con SQL; no hay pantalla de configuración en este sprint. Si falta una clave, el servicio usa estos mismos valores como respaldo.

## Tabla `maintenance` (US3, US4)

| Columna | Tipo | Restricciones | Notas |
|---------|------|---------------|-------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `vehicle_id` | INT UNSIGNED | NOT NULL, FK → `vehicles.id`, INDEX | |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id` | Orden de origen: de ahí salen el último servicio y su kilometraje |
| `description` | VARCHAR(255) | NOT NULL | Qué servicio toca (ejemplo: "Cambio de aceite y filtro") |
| `next_date` | DATE | NULL | Fecha objetivo |
| `next_mileage` | INT UNSIGNED | NULL | Kilometraje objetivo |
| `status` | ENUM('PENDIENTE','REALIZADO','CANCELADO') | NOT NULL, DEFAULT 'PENDIENTE', INDEX | |
| `pending_vehicle_id` | INT UNSIGNED | GENERADA: `IF(status = 'PENDIENTE', vehicle_id, NULL)`, ÚNICA | Garantiza un solo pendiente por vehículo |
| `completed_at` | DATETIME | NULL | Al pasar a REALIZADO o CANCELADO |
| `created_by` | INT UNSIGNED | NOT NULL, FK → `users.id` | |
| `created_at`, `updated_at` | DATETIME | NOT NULL | |

**Restricciones**: `CHECK (next_date IS NOT NULL OR next_mileage IS NOT NULL)`.

**Índices**: `idx_maintenance_vehicle (vehicle_id)`, `idx_maintenance_status_date (status, next_date)`, `uq_maintenance_pending (pending_vehicle_id)`.

**Reglas**
- Alta: la orden de origen debe estar `TERMINADO` o `ENTREGADO` y ser del vehículo; la fecha no puede ser anterior a hoy; el kilometraje objetivo no puede ser menor al actual del vehículo; con un pendiente existente se exige `replacePending: true` (el anterior pasa a `CANCELADO`).
- Edición: solo `PENDIENTE`; cambia descripción, fecha y kilometraje, con las mismas validaciones.
- Cierre: `PENDIENTE → REALIZADO` o `PENDIENTE → CANCELADO`; los demás cambios se rechazan. Nunca se elimina.
- **Clasificación calculada** (no se guarda): `OVERDUE`, `UPCOMING` o `LATER`, según [research.md](research.md) D4.

## Tabla `parts` (US5, US6, US8)

| Columna | Tipo | Restricciones | Notas |
|---------|------|---------------|-------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `code` | VARCHAR(40) | NOT NULL, ÚNICA | Normalizado a mayúsculas |
| `name` | VARCHAR(150) | NOT NULL | |
| `description` | VARCHAR(500) | NULL | |
| `price` | DECIMAL(10,2) | NOT NULL, `CHECK (price >= 0)` | Precio de venta vigente |
| `stock` | INT UNSIGNED | NOT NULL, DEFAULT 0, `CHECK (stock >= 0)` | Existencia actual; nunca negativa |
| `minimum_stock` | INT UNSIGNED | NOT NULL, DEFAULT 0 | Umbral de la alerta |
| `active` | TINYINT(1) | NOT NULL, DEFAULT 1 | Baja lógica |
| `created_at`, `updated_at` | DATETIME | NOT NULL | |

**Índices**: `uq_parts_code (code)`, `idx_parts_name (name)`, `idx_parts_active_stock (active, stock)`.

**Reglas**
- Alta: la existencia inicial se registra como un movimiento `IN` con motivo "Existencia inicial"; si es 0 no genera movimiento.
- Edición: nombre, descripción, precio y stock mínimo. La existencia NO se edita directamente; solo cambia con movimientos.
- Baja y reactivación: `active` cambia; con la baja la refacción deja de ofrecerse en órdenes pero conserva todo su historial.
- **Estado de alerta calculado**: `OUT` si `stock = 0`; `LOW` si `stock > 0` y `stock <= minimum_stock`; `OK` en otro caso.

## Tabla `inventory_movements` (US5, US6, US7)

| Columna | Tipo | Restricciones | Notas |
|---------|------|---------------|-------|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| `part_id` | INT UNSIGNED | NOT NULL, FK → `parts.id`, INDEX | |
| `type` | ENUM('IN','OUT','ADJUSTMENT') | NOT NULL | |
| `quantity` | INT | NOT NULL, `CHECK (quantity <> 0)` | Con signo: `IN` > 0, `OUT` < 0, `ADJUSTMENT` ≠ 0 |
| `reason` | VARCHAR(255) | NOT NULL | Obligatorio en todos los tipos |
| `order_id` | INT UNSIGNED | NULL, FK → `service_orders.id`, INDEX | Obligatorio en `OUT` |
| `created_by` | INT UNSIGNED | NOT NULL, FK → `users.id` | |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

**Restricciones**: `CHECK ((type = 'IN' AND quantity > 0) OR (type = 'OUT' AND quantity < 0 AND order_id IS NOT NULL) OR type = 'ADJUSTMENT')`.

**Índices**: `idx_movements_part_date (part_id, created_at, id)`, `idx_movements_order (order_id)`.

**Reglas**
- Solo inserción: los movimientos no se editan ni se eliminan.
- **Invariante**: para cada refacción, `parts.stock = SUM(inventory_movements.quantity)`.
- Toda inserción se hace junto con la actualización de `parts.stock` en una misma transacción; si deja el stock por debajo de cero, se revierte todo.

## Tabla `order_parts` (US7)

| Columna | Tipo | Restricciones | Notas |
|---------|------|---------------|-------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, INDEX | |
| `part_id` | INT UNSIGNED | NOT NULL, FK → `parts.id`, INDEX | |
| `quantity` | INT UNSIGNED | NOT NULL, `CHECK (quantity > 0)` | |
| `unit_price` | DECIMAL(10,2) | NOT NULL, `CHECK (unit_price >= 0)` | Copia del precio al agregar |
| `amount` | DECIMAL(12,2) | GENERADA: `ROUND(quantity * unit_price, 2)` | Subtotal |
| `created_at`, `updated_at` | DATETIME | NOT NULL | |

**Restricción**: `UNIQUE (order_id, part_id)`.

**Reglas**
- Solo se modifica en `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION` o `ESPERANDO_REFACCION`, por el administrador o el mecánico asignado.
- Agregar o aumentar → movimiento `OUT` por la diferencia; reducir → `IN` por la diferencia; quitar → `IN` por toda la cantidad y se borra la línea.
- El total de la orden suma `order_parts.amount` (`partsSubtotal`).

## Historial del vehículo (derivado, sin tabla)

Órdenes del vehículo con `status IN ('TERMINADO','ENTREGADO')`, ordenadas por fecha de servicio descendente (con `id` como desempate). Por cada una: folio, estado, `serviceDate` (cambio a `TERMINADO`; si falta, `created_at`), `mileage` = `COALESCE(service_mileage, entry_mileage)`, mecánico, problema reportado, diagnóstico, recomendaciones, servicios, mano de obra, refacciones y total.

## Transiciones y reglas resumidas

| Concepto | Regla |
|----------|-------|
| Existencia | Nunca menor a 0; cambia solo con movimientos |
| Mantenimiento | `PENDIENTE → REALIZADO \| CANCELADO`; uno `PENDIENTE` por vehículo |
| Línea de refacción | Editable solo en estados de trabajo de la orden |
| Orden `TERMINADO`/`ENTREGADO` | Aparece en el historial; sus refacciones ya no se editan |

## Datos de ejemplo (`database/seeds/003_sample_maintenance_inventory.sql`)

Idempotente y sin duplicar al repetirse:
- ≥ 12 refacciones: algunas con existencia normal, 3 con stock bajo, 2 agotadas y 1 inactiva.
- Movimientos de los tres tipos (existencia inicial, entradas, salidas por órdenes y ajustes) y existencia recalculada desde ellos.
- Refacciones usadas en órdenes de ejemplo en estados de trabajo, terminadas y entregadas.
- ≥ 3 órdenes terminadas o entregadas para un mismo vehículo, para mostrar un historial cronológico; con kilometraje de servicio en algunas.
- Mantenimientos: 2 vencidos (por fecha y por kilometraje), 2 próximos, 1 lejano, y 1 realizado y 1 cancelado como antecedentes.
