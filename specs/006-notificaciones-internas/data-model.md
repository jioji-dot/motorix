# Modelo de datos: Notificaciones internas y clientes por avisar

**Este sprint agrega dos tablas** (migración `005_sprint6_notificaciones.sql`, aditiva y consecutiva a la 004). Los avisos **no se guardan**: se calculan al consultar. Lo único que se guarda es la lectura de cada usuario y el registro de los avisos a clientes. No se modifica ninguna tabla existente.

## Diagrama de relaciones

```text
users 1 ─── N notification_reads            (solo lecturas; los avisos no se guardan)

clients 1 ─── N client_notices N ─── 1 users (quién avisó)

fuentes que se consultan sin cambios:
  maintenance · parts · appointments · service_orders ── order_status_history
```

## Tabla `notification_reads` (nueva)

| Campo | Tipo | Regla |
|-------|------|-------|
| `userId` | `INT UNSIGNED` obligatorio, llave foránea a `users.id` | Parte de la clave primaria |
| `noticeKey` | `VARCHAR(60)` obligatorio | Parte de la clave primaria. Formato `tipo:objeto:estado` (FR-009) |
| `readAt` | `DATETIME` obligatorio, `DEFAULT CURRENT_TIMESTAMP` | Fecha de la lectura |

- **Clave primaria**: `(userId, noticeKey)`; marcar dos veces el mismo aviso no duplica la lectura.
- Las filas de un usuario que ya no corresponden a un aviso vigente se **borran al consultar** (descarte de la lectura, FR-009).
- No hay borrado en cascada: la llave foránea impide eliminar un usuario con lecturas, igual que el resto del esquema; los usuarios no se eliminan, se desactivan.

### Claves de aviso

| Tipo de aviso | Clave | Ejemplo |
|---------------|-------|---------|
| Mantenimiento próximo o vencido | `MANT:{id}:{PROXIMO\|VENCIDO}` | `MANT:12:VENCIDO` |
| Stock bajo o agotado | `STOCK:{refacciónId}:{BAJO\|AGOTADO}` | `STOCK:5:AGOTADO` |
| Cita del día | `CITA:{id}` | `CITA:8` |
| Orden detenida | `ORDEN:{id}` | `ORDEN:7` |

## Tabla `client_notices` (nueva)

| Campo | Tipo | Regla |
|-------|------|-------|
| `id` | `INT UNSIGNED` clave primaria autoincremental | |
| `clientId` | `INT UNSIGNED` obligatorio, llave foránea a `clients.id` | Cliente avisado |
| `kind` | `ENUM('ORDEN_LISTA','CITA_MANANA','MANTENIMIENTO_PROXIMO','MANTENIMIENTO_VENCIDO')` obligatorio | Tipo de hecho; un mantenimiento próximo y uno vencido son hechos distintos (FR-017) |
| `factId` | `INT UNSIGNED` obligatorio | Identificador del objeto del hecho: la orden, la cita o el mantenimiento |
| `noticedBy` | `INT UNSIGNED` obligatorio, llave foránea a `users.id` | Quién avisó |
| `noticedAt` | `DATETIME` obligatorio, `DEFAULT CURRENT_TIMESTAMP` | Cuándo avisó |
| `note` | `VARCHAR(255)` opcional | Nota (por ejemplo, «no contestó») |

- **Restricción única** `uq_client_notices_fact (kind, factId)`: un hecho se avisa una sola vez; un hecho nuevo (otra orden, otra cita, otro mantenimiento u otra clasificación) tiene otra clave y vuelve a aparecer.
- Índice `idx_client_notices_client (clientId)` para consultar el historial de avisos de un cliente.
- Los registros no se editan ni se eliminan desde la aplicación.

## Hechos y avisos (cálculos, no se guardan)

| Concepto | Regla |
|----------|-------|
| Orden detenida | Orden abierta (Recibido, Diagnóstico, En reparación o Esperando refacción) con 72 horas o más desde `COALESCE(MAX(order_status_history.changedAt), service_orders.createdAt)`, medido con la hora de MySQL (FR-005) |
| Cita del día | Cita Pendiente o Confirmada con fecha de hoy (hora local del servidor), hasta el fin del día (FR-004) |
| Stock bajo o agotado | Refacción activa con existencia menor o igual al mínimo (bajo) o igual a cero (agotado), con `partModel.stockLevelOf` (FR-004) |
| Mantenimiento próximo o vencido | Mantenimiento `PENDIENTE` clasificado con `maintenanceClassifier.classify` (15 días o 500 km; Vencido si la fecha pasó o el kilometraje alcanzó el próximo) (FR-004) |
| Hecho `ORDEN_LISTA` | Orden `TERMINADO` sin entregar, sin importar el pago |
| Hecho `CITA_MANANA` | Cita Pendiente o Confirmada con fecha de mañana |
| Hecho `MANTENIMIENTO_*` | Mantenimiento pendiente con esa clasificación |

La lista de clientes por avisar excluye los hechos que ya tienen fila en `client_notices` y a los clientes desactivados.

## Proyección por rol (qué recibe cada rol)

| Dato | Administrador | Recepción | Mecánico |
|------|:-------------:|:---------:|:--------:|
| Avisos de mantenimientos | ✔ | ✔ | ✘ |
| Avisos de citas del día | ✔ | ✔ | ✘ |
| Avisos de stock | ✔ | ✘ | ✘ |
| Avisos de órdenes detenidas | ✔ (todas) | ✔ (todas) | ✔ (solo las asignadas a él) |
| Lista y registro de clientes por avisar | ✔ | ✔ | ✘ (403) |
| Teléfono del cliente | Solo en la lista de clientes por avisar | Solo en la lista de clientes por avisar | ✘ |

El detalle de las rutas y de los campos está en [contracts/api.md](contracts/api.md).

## Datos de ejemplo

El seed `009_notificaciones.sql` es idempotente y usa fechas relativas a `NOW()`. Aprovecha los mantenimientos en cada clasificación, las refacciones con stock bajo y agotado, la orden Terminada OS-000005 y las citas existentes, y agrega: una orden en reparación asignada al mecánico con su último cambio de estado hace 5 días, una cita de hoy y otra de mañana si no existen, y un aviso a cliente de ejemplo ya registrado. Una prueba comprueba que cargar los seeds dos veces no duplica registros.
