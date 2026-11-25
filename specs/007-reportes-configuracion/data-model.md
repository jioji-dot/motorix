# Modelo de datos: Reportes y configuración

Migración `database/migrations/006_sprint7_configuracion_seguridad.sql`: **aditiva** (no modifica las migraciones 001 a 005), InnoDB y `utf8mb4`, **5 tablas nuevas y 3 columnas nuevas**. Ninguna llave foránea es en cascada: los usuarios, tipos de servicio y versiones de términos no se borran.

## Diagrama de relaciones

```text
users 1───* settings.updatedBy          users 1───* terms_acceptances *───1 terms_versions
users 1───* terms_versions.publishedBy  users 1───* audit_log.userId (puede ser nulo)
service_types 1───* order_services.serviceTypeId (opcional)
tickets: columnas de instantánea (sin relaciones nuevas)
users: columna lastActivityAt
```

## Tabla `settings` (nueva)

| Campo | Tipo | Reglas |
|-------|------|--------|
| `settingKey` | VARCHAR(60) | **Clave primaria**: `workshop.name`, `workshop.address`, `workshop.phone`, `maintenance.warnDays`, `maintenance.warnKm` |
| `settingValue` | VARCHAR(255) | Obligatorio; texto (los márgenes se guardan como número en texto) |
| `updatedBy` | INT UNSIGNED | Nulo si la fila viene de un seed; llave foránea a `users.id` |
| `updatedAt` | DATETIME | `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |

**Reglas de negocio** (en el servicio): nombre obligatorio de hasta 120 caracteres, dirección de hasta 200 y teléfono de hasta 30; `warnDays` entero de 1 a 365; `warnKm` entero de 1 a 100,000. **Valores de respaldo** cuando falta la fila: `WORKSHOP_*` de `.env` (o los predeterminados) y 15 días y 500 km.

## Tabla `service_types` (nueva)

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | INT UNSIGNED | Clave primaria autoincremental |
| `name` | VARCHAR(100) | Obligatorio y **único** (el cotejo `utf8mb4_0900_ai_ci` no distingue mayúsculas ni acentos) |
| `intervalDays` | INT UNSIGNED | Nulo o de 1 a 3650 |
| `intervalKm` | INT UNSIGNED | Nulo o de 1 a 1,000,000 |
| `active` | TINYINT(1) | `DEFAULT 1`; desactivar no borra |
| `createdAt`, `updatedAt` | DATETIME | Marcas de tiempo |

Restricción `CHECK (intervalDays IS NOT NULL OR intervalKm IS NOT NULL)`.

## Columna `order_services.serviceTypeId` (nueva)

`INT UNSIGNED NULL`, llave foránea a `service_types.id` sin cascada e índice. Las líneas existentes quedan en nulo.

## Columnas de `tickets` (nuevas, todas nulas)

| Campo | Tipo | Significado |
|-------|------|-------------|
| `shopName` | VARCHAR(120) | Nombre del taller al generar el ticket |
| `shopAddress` | VARCHAR(200) | Dirección del taller al generar el ticket |
| `shopPhone` | VARCHAR(30) | Teléfono del taller al generar el ticket |
| `nextServiceName` | VARCHAR(100) | Tipo de servicio que define el próximo servicio |
| `nextServiceDate` | DATE | Fecha del próximo servicio (el menor de hoy + días de los tipos con intervalo) |
| `nextServiceMileage` | INT UNSIGNED | Kilometraje del próximo servicio (el menor de kilometraje + kilómetros) |

Un ticket sin `shopName` es anterior al sprint: se arma con los datos vigentes y sin próximo servicio.

## Columna `users.lastActivityAt` (nueva)

`DATETIME NULL`. Se fija al iniciar sesión y se actualiza con la actividad (no con la consulta automática de avisos). Nulo se trata como vigente.

## Tabla `terms_versions` (nueva)

| Campo | Tipo | Reglas |
|-------|------|--------|
| `version` | INT UNSIGNED | **Clave primaria autoincremental**: el número de versión; la vigente es la mayor |
| `termsText` | TEXT | Obligatorio (términos y condiciones) |
| `privacyText` | TEXT | Obligatorio (aviso de privacidad) |
| `publishedBy` | INT UNSIGNED | Nulo si la versión viene de un seed; llave foránea a `users.id` |
| `publishedAt` | DATETIME | `DEFAULT CURRENT_TIMESTAMP` |

## Tabla `terms_acceptances` (nueva)

| Campo | Tipo | Reglas |
|-------|------|--------|
| `userId` | INT UNSIGNED | Llave foránea a `users.id` |
| `version` | INT UNSIGNED | Llave foránea a `terms_versions.version` |
| `acceptedAt` | DATETIME | `DEFAULT CURRENT_TIMESTAMP` |

**Clave primaria** `(userId, version)`: una aceptación por usuario y versión.

## Tabla `audit_log` (nueva)

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | BIGINT UNSIGNED | Clave primaria autoincremental |
| `userId` | INT UNSIGNED | Nulo si no hay cuenta (inicio de sesión con un identificador inexistente); llave foránea a `users.id` |
| `actorLabel` | VARCHAR(120) | Identificador escrito en un inicio de sesión fallido; nunca la contraseña |
| `action` | VARCHAR(40) | Obligatoria (lista cerrada, abajo) |
| `entity` | VARCHAR(40) | Tipo de entidad afectada |
| `entityId` | INT UNSIGNED | Identificador de la entidad afectada |
| `detail` | JSON | Campos permitidos de la acción; sin secretos |
| `createdAt` | DATETIME | `DEFAULT CURRENT_TIMESTAMP` |

Índices: `(createdAt)`, `(userId, createdAt)` y `(action, createdAt)`. **Acciones**: `LOGIN_FAILED`, `ACCOUNT_LOCKED`, `USER_CREATED`, `USER_DEACTIVATED`, `USER_REACTIVATED`, `USER_ROLE_CHANGED`, `SETTINGS_CHANGED`, `PART_PRICE_CHANGED`, `SERVICE_TYPE_CREATED`, `SERVICE_TYPE_UPDATED`, `PAYMENT_CANCELLED`, `TERMS_PUBLISHED`.

**Campos permitidos por acción** (todo lo demás se descarta): `SETTINGS_CHANGED` guarda `changes[{key, from, to}]`; `PART_PRICE_CHANGED`, `partId`, `field`, `from` y `to`; `USER_ROLE_CHANGED`, `from` y `to`; `PAYMENT_CANCELLED`, `orderId` y `amount`; `TERMS_PUBLISHED`, `version`; las demás, solo la entidad.

## Cálculos (no se guardan)

- **Ingresos**: suma de `payments.amount` con estado `PAGADO` y `paidAt` en el rango, por método y por día o mes.
- **Fecha de término de una orden**: último registro de `order_status_history` con destino `TERMINADO`.
- **Servicios frecuentes**: líneas de `order_services` de órdenes Terminadas o Entregadas con fecha de término en el rango, agrupadas por tipo (o por descripción si no tienen tipo).
- **Productividad**: por `service_orders.mechanicId`, órdenes distintas y suma de `order_labor.amount`.
- **Refacciones**: por `order_parts.partId`, unidades, venta (`SUM(amount)`) y costo (`unidades × parts.purchasePrice`); con precio de compra 0, «sin costo» y fuera del margen total.
- **Rotación**: unidades de `inventory_movements` con tipo `OUT` y orden asociada en el rango, entre `parts.stock`.

## Datos de ejemplo (seeds `010_configuracion.sql`)

Configuración inicial (datos del taller y márgenes de 15 días y 500 km), cuatro tipos de servicio con intervalos (Cambio de aceite: 180 días y 5,000 km; Frenos; Afinación; Llantas), líneas de servicio de órdenes existentes enlazadas a un tipo, la versión 1 de los términos y el aviso de privacidad (plantilla en español) y la aceptación de ninguno de los usuarios sembrados (aceptan en su siguiente ingreso). Los pagos y las órdenes entregadas del seed 008 alimentan los reportes.
