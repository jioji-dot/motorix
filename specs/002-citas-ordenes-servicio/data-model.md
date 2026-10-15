# Modelo de datos: Citas y órdenes de servicio

**Funcionalidad**: [spec.md](spec.md) | **Fecha**: 2026-10-12

Migración nueva e inmutable: `database/migrations/002_sprint2_appointments_service_orders.sql`. Motor InnoDB, `utf8mb4`, collation `utf8mb4_0900_ai_ci`. Columnas en `snake_case` en la base y `camelCase` en la API. Todas las llaves foráneas son `ON DELETE RESTRICT`. Todas las tablas llevan `created_at` y `updated_at` (este último con actualización automática), salvo `order_status_history`, que solo lleva `created_at`.

## Diagrama de relaciones

```text
clients 1 ──< appointments >── 1 vehicles
clients 1 ──< service_orders >── 1 vehicles
appointments 1 ── 0..1 service_orders        (appointment_id único en la orden)
users (MECHANIC) 1 ──< service_orders        (mechanic_id, opcional al inicio)
service_orders 1 ──< order_services
service_orders 1 ──< order_labor
service_orders 1 ──< order_status_history >── 1 users
```

## Tabla `appointments` (US1, US2)

| Columna | Tipo | Restricciones | Notas |
|---------|------|---------------|-------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `client_id` | INT UNSIGNED | NOT NULL, FK → `clients.id` | |
| `vehicle_id` | INT UNSIGNED | NOT NULL, FK → `vehicles.id` | Debe pertenecer al cliente (validado en el servicio) |
| `scheduled_at` | DATETIME | NOT NULL, INDEX | Hora local de pared del taller (D5) |
| `reason` | VARCHAR(255) | NOT NULL | Motivo |
| `notes` | VARCHAR(500) | NULL | Observaciones |
| `status` | ENUM('PENDIENTE','CONFIRMADA','EN_PROCESO','COMPLETADA','CANCELADA') | NOT NULL, DEFAULT 'PENDIENTE', INDEX | |
| `created_by` | INT UNSIGNED | NOT NULL, FK → `users.id` | Quién la registró |
| `created_at`, `updated_at` | DATETIME | NOT NULL | |

**Índices**: `idx_appointments_scheduled (scheduled_at)`, `idx_appointments_status (status)`, `idx_appointments_client (client_id)`, `idx_appointments_vehicle_day (vehicle_id, scheduled_at)`.

**Reglas**
- Alta: `scheduled_at` posterior al momento actual y a un máximo de un año (FR-003); vehículo del cliente indicado; aviso de coincidencia del mismo vehículo el mismo día con otra cita no cancelada (FR-007).
- Modificación: solo `PENDIENTE` o `CONFIRMADA`; cambia fecha, hora, motivo y observaciones (la fecha vuelve a validarse).
- Cancelación: solo `PENDIENTE` o `CONFIRMADA` y sin orden (FR-006). Nunca se elimina.
- `EN_PROCESO` y `COMPLETADA` los fija únicamente la orden (FR-010, FR-027).

## Tabla `service_orders` (US3 a US8)

| Columna | Tipo | Restricciones | Notas |
|---------|------|---------------|-------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `folio` | VARCHAR(12) | NULL, UNIQUE | `OS-` + id con 6 dígitos; se asigna en la misma transacción del alta (D4) |
| `appointment_id` | INT UNSIGNED | NULL, UNIQUE, FK → `appointments.id` | Una cita admite una sola orden |
| `client_id` | INT UNSIGNED | NOT NULL, FK → `clients.id`, INDEX | |
| `vehicle_id` | INT UNSIGNED | NOT NULL, FK → `vehicles.id`, INDEX | Debe pertenecer al cliente (RN-2) |
| `mechanic_id` | INT UNSIGNED | NULL, FK → `users.id` | Usuario activo con rol MECHANIC |
| `entry_mileage` | INT UNSIGNED | NOT NULL | Kilometraje de entrada (RN-3) |
| `reported_problem` | VARCHAR(1000) | NOT NULL | |
| `diagnosis` | TEXT | NULL | |
| `notes` | TEXT | NULL | Observaciones del mecánico |
| `recommendations` | TEXT | NULL | |
| `status` | ENUM('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION','TERMINADO','ENTREGADO') | NOT NULL, DEFAULT 'RECIBIDO', INDEX | |
| `created_by` | INT UNSIGNED | NOT NULL, FK → `users.id` | |
| `delivered_at` | DATETIME | NULL | Se fija al pasar a ENTREGADO |
| `created_at`, `updated_at` | DATETIME | NOT NULL | |

**Índices**: `idx_orders_mechanic_status (mechanic_id, status)`, `idx_orders_status (status)`, `idx_orders_created (created_at)`; los de `client_id` y `vehicle_id` los crean las llaves foráneas.

**Reglas**
- Alta (D8): vehículo existente y del cliente; kilometraje según D9; si trae `appointmentId`, la cita debe estar `PENDIENTE` o `CONFIRMADA` y sin orden, y cliente y vehículo se toman de ella.
- `mechanic_id` debe ser un usuario activo con rol MECHANIC; reasignable mientras la orden no esté `TERMINADO` ni `ENTREGADO`. Con `mechanic_id` nulo no se puede salir de `RECIBIDO` (D13).
- Edición por recepción/administrador: `reported_problem`, `mechanic_id` y `entry_mileage` (solo con corrección explícita), mientras no sea `TERMINADO` ni `ENTREGADO` (FR-013a).
- `diagnosis`: editable en `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION` y `ESPERANDO_REFACCION`. `notes` y `recommendations`: editables hasta antes de `ENTREGADO` (FR-021). Una orden `ENTREGADO` no admite ningún cambio (FR-022).
- No se elimina nunca (RN-9).

### Estados y transiciones

| Desde | Hacia | Quién |
|-------|-------|-------|
| RECIBIDO | DIAGNOSTICO | mecánico asignado, administrador |
| DIAGNOSTICO | EN_REPARACION | mecánico asignado, administrador |
| EN_REPARACION | ESPERANDO_REFACCION | mecánico asignado, administrador |
| ESPERANDO_REFACCION | EN_REPARACION | mecánico asignado, administrador |
| EN_REPARACION | TERMINADO | mecánico asignado, administrador (exige D13) |
| TERMINADO | ENTREGADO | recepcionista, administrador |

Cualquier otra combinación se rechaza con `INVALID_TRANSITION`.

## Tabla `order_services` (US6)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, INDEX |
| `description` | VARCHAR(255) | NOT NULL |
| `amount` | DECIMAL(10,2) | NOT NULL, CHECK (`amount` >= 0) |
| `created_at`, `updated_at` | DATETIME | NOT NULL |

## Tabla `order_labor` (US6)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, INDEX |
| `description` | VARCHAR(255) | NOT NULL |
| `hours` | DECIMAL(6,2) | NOT NULL, CHECK (`hours` > 0) |
| `hourly_rate` | DECIMAL(10,2) | NOT NULL, CHECK (`hourly_rate` >= 0) |
| `amount` | DECIMAL(12,2) | GENERATED ALWAYS AS (ROUND(`hours` * `hourly_rate`, 2)) STORED |
| `created_at`, `updated_at` | DATETIME | NOT NULL |

**Totales** (FR-020): `servicesSubtotal = SUM(order_services.amount)`, `laborSubtotal = SUM(order_labor.amount)`, `total = servicesSubtotal + laborSubtotal`; se calculan al consultar, no se almacenan.

**Regla común**: agregar, editar o quitar líneas solo en estados editables y por administrador o mecánico asignado.

## Tabla `order_status_history` (US7, FR-026)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, INDEX |
| `from_status` | ENUM (estados de la orden) | NULL (nulo en el alta) |
| `to_status` | ENUM (estados de la orden) | NOT NULL |
| `changed_by` | INT UNSIGNED | NOT NULL, FK → `users.id` |
| `created_at` | DATETIME | NOT NULL |

Solo inserción: no hay actualizaciones ni borrados.

## Cambios sobre tablas del Sprint 1

Ninguno en el esquema. Al crear una orden se actualiza `vehicles.current_mileage` con el kilometraje de entrada.

## Datos de ejemplo (seeds idempotentes)

| Contenido | Cantidad |
|-----------|:--------:|
| Citas: dos Pendientes, una Confirmada, una En proceso, una Completada y una Cancelada | 6 |
| Órdenes: una por cada estado (RECIBIDO, DIAGNOSTICO, EN_REPARACION, ESPERANDO_REFACCION, TERMINADO, ENTREGADO), varias asignadas a `mecanico` y al menos una sin mecánico | 7 |
| Servicios y líneas de mano de obra en las órdenes avanzadas | 8 y 4 |
| Filas de historial coherentes con el estado de cada orden | las necesarias |
