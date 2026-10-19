# Modelo de datos: Citas y órdenes de servicio

Extiende el esquema del Sprint 1 (`users`, `clients`, `vehicles`). Se implementará en `database/migrations/002_sprint2_appointments_orders.sql` (MySQL 8.0, InnoDB, `utf8mb4`). Tablas y columnas en inglés; los valores de estado usan los nombres de la documentación del proyecto.

## Diagrama de relaciones

```text
clients 1 ── * appointments * ── 1 vehicles
                    │ 0..1
                    ▼
clients 1 ── * service_orders * ── 1 vehicles
users   1 ── * service_orders   (mechanicId)
service_orders 1 ── * order_services
service_orders 1 ── * order_labor
service_orders 1 ── * order_status_history   (changedBy → users)
```

## Tabla `appointments`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identificador |
| `clientId` | INT UNSIGNED | NOT NULL, FK → `clients.id` | Cliente |
| `vehicleId` | INT UNSIGNED | NOT NULL, FK → `vehicles.id` | Vehículo (debe pertenecer al cliente) |
| `scheduledAt` | DATETIME | NOT NULL, INDEX | Fecha y hora de la cita (hora local del taller) |
| `reason` | VARCHAR(255) | NOT NULL | Motivo |
| `notes` | TEXT | NULL | Observaciones |
| `status` | ENUM('PENDIENTE','CONFIRMADA','EN_PROCESO','COMPLETADA','CANCELADA') | NOT NULL, DEFAULT 'PENDIENTE', INDEX | Estado |
| `createdBy` | INT UNSIGNED | NOT NULL, FK → `users.id` | Quien la registró |
| `createdAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Registro |
| `updatedAt` | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | Última actualización |

**Reglas de validación**
- `reason`: obligatorio, 1 a 255 caracteres; `notes`: hasta 2000 caracteres.
- `vehicleId` debe pertenecer a `clientId` (FR-001); cliente y vehículo no pueden estar desactivados al agendar (FR-005). El vehículo del Sprint 1 no tiene bandera de activo: se considera activo si su cliente lo está.
- `scheduledAt` no puede estar en el pasado al crear ni al cambiar la fecha (FR-005).
- Aviso de duplicado: otra cita del mismo `vehicleId` con el mismo `scheduledAt` y estado PENDIENTE, CONFIRMADA o EN_PROCESO (FR-006).

**Transiciones de estado de la cita**
| Desde | Hacia | Cómo ocurre |
|-------|-------|-------------|
| PENDIENTE | CONFIRMADA | Acción "Confirmar" |
| PENDIENTE, CONFIRMADA | CANCELADA | Acción "Cancelar" (solo si no tiene orden activa) |
| CONFIRMADA | EN_PROCESO | Se crea una orden desde la cita |
| EN_PROCESO | CONFIRMADA | La orden asociada se cancela |
| EN_PROCESO | COMPLETADA | La orden asociada se entrega |
| CANCELADA, COMPLETADA | (ninguna) | Solo lectura |

Solo las citas PENDIENTE o CONFIRMADA admiten edición de fecha, hora, motivo y observaciones (FR-003).

## Tabla `service_orders`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identificador |
| `folio` | VARCHAR(20) | NULL, UNIQUE | Folio legible `OS-000123`; se asigna en la misma transacción del alta |
| `appointmentId` | INT UNSIGNED | NULL, FK → `appointments.id`, INDEX | Cita de origen (opcional) |
| `clientId` | INT UNSIGNED | NOT NULL, FK → `clients.id` | Cliente |
| `vehicleId` | INT UNSIGNED | NOT NULL, FK → `vehicles.id`, INDEX | Vehículo (del mismo cliente) |
| `mechanicId` | INT UNSIGNED | NOT NULL, FK → `users.id`, INDEX | Mecánico asignado (obligatorio) |
| `entryMileage` | INT UNSIGNED | NOT NULL | Kilometraje de entrada |
| `reportedProblem` | TEXT | NOT NULL | Problema reportado por el cliente |
| `diagnosis` | TEXT | NULL | Diagnóstico del mecánico |
| `notes` | TEXT | NULL | Observaciones |
| `recommendations` | TEXT | NULL | Recomendaciones |
| `status` | ENUM('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION','TERMINADO','ENTREGADO','CANCELADA') | NOT NULL, DEFAULT 'RECIBIDO', INDEX | Estado |
| `cancellationReason` | VARCHAR(255) | NULL | Motivo de la cancelación (obligatorio si está CANCELADA) |
| `total` | DECIMAL(10,2) | NOT NULL, DEFAULT 0.00 | Suma de servicios y mano de obra |
| `deliveredAt` | DATETIME | NULL | Fecha de entrega |
| `createdBy` | INT UNSIGNED | NOT NULL, FK → `users.id` | Quien la creó |
| `createdAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP, INDEX | Creación |
| `updatedAt` | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | Última actualización |

**Reglas de validación**
- `entryMileage`: entero entre 0 y 1,500,000; si es menor al `currentMileage` del vehículo, 409 `MILEAGE_DECREASE` salvo `mileageCorrection: true` (FR-010). Al crear, `vehicles.currentMileage` pasa a `entryMileage`.
- `mechanicId`: usuario activo con rol `MECHANIC` (FR-012).
- `reportedProblem`: obligatorio, 1 a 2000 caracteres; `diagnosis`, `notes`, `recommendations`: hasta 4000 caracteres.
- `cancellationReason`: 1 a 255 caracteres, obligatorio al cancelar.
- Una cita tiene como máximo una orden **no cancelada** (regla del servicio, FR-004/FR-009).
- No existe operación de eliminación (RN-9).

**Transiciones de estado**: ver la tabla de `research.md` (sección 1). `TERMINADO` exige `diagnosis` no vacío y al menos un servicio o una mano de obra (FR-022). `ENTREGADO` fija `deliveredAt`.

**Edición según estado**: el mecánico asignado (o ADMIN) edita diagnóstico, observaciones, recomendaciones, servicios y mano de obra solo mientras la orden esté en RECIBIDO, DIAGNOSTICO, EN_REPARACION o ESPERANDO_REFACCION. En TERMINADO, ENTREGADO y CANCELADA la orden es de solo lectura (la entrega o la cancelación se hacen por cambio de estado).

## Tabla `order_services`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identificador |
| `orderId` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, INDEX | Orden (sin cascada) |
| `description` | VARCHAR(255) | NOT NULL | Servicio realizado |
| `amount` | DECIMAL(10,2) | NOT NULL, CHECK (`amount` >= 0) | Importe |
| `createdAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Registro |
| `updatedAt` | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | Actualización |

## Tabla `order_labor`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identificador |
| `orderId` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, INDEX | Orden (sin cascada) |
| `description` | VARCHAR(255) | NOT NULL | Trabajo realizado |
| `hours` | DECIMAL(5,2) | NOT NULL, CHECK (`hours` > 0) | Horas trabajadas |
| `hourlyRate` | DECIMAL(10,2) | NOT NULL, CHECK (`hourlyRate` >= 0) | Tarifa por hora |
| `amount` | DECIMAL(10,2) | GENERADA ALMACENADA `ROUND(hours * hourlyRate, 2)` | Importe calculado |
| `createdAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Registro |
| `updatedAt` | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | Actualización |

**Total de la orden** = SUM(`order_services.amount`) + SUM(`order_labor.amount`), recalculado y guardado en `service_orders.total` en cada alta, edición o baja de línea (FR-017).

## Tabla `order_status_history`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identificador |
| `orderId` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, INDEX | Orden |
| `fromStatus` | VARCHAR(20) | NULL | Estado anterior (`NULL` en el alta) |
| `toStatus` | VARCHAR(20) | NOT NULL | Estado nuevo |
| `changedBy` | INT UNSIGNED | NOT NULL, FK → `users.id` | Quien hizo el cambio |
| `reason` | VARCHAR(255) | NULL | Motivo (obligatorio al cancelar) |
| `changedAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Fecha y hora |

## Relaciones

- Un cliente y un vehículo pueden tener muchas citas y muchas órdenes; el vehículo de una cita o de una orden debe pertenecer al cliente indicado.
- Una orden tiene exactamente un mecánico asignado y puede originarse en una cita.
- Una orden tiene muchas líneas de servicio, de mano de obra y de historial.
- Ninguna llave foránea es en cascada: las citas y órdenes se cancelan, no se eliminan.

## Datos de ejemplo (seeds)

Idempotentes. Fechas relativas a la fecha de carga (`CURDATE()`), para que la agenda siempre tenga citas próximas:

- Citas: al menos 6, una en cada estado (PENDIENTE, CONFIRMADA, EN_PROCESO, COMPLETADA, CANCELADA) y varias próximas.
- Órdenes: al menos 6, una por estado (RECIBIDO, DIAGNOSTICO, EN_REPARACION, ESPERANDO_REFACCION, TERMINADO, ENTREGADO) y una CANCELADA, repartidas entre más de un mecánico (se agrega un segundo mecánico de ejemplo), con servicios y mano de obra en las que corresponda, y el historial de estados coherente con cada una.
- La orden ENTREGADO corresponde a una cita COMPLETADA; la orden EN_REPARACION, a una cita EN_PROCESO.
