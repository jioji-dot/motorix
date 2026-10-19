# Modelo de datos: Base del sistema, clientes y vehículos

Esquema para MySQL 8.0 (InnoDB, `utf8mb4`). Se implementará en `database/migrations/001_sprint1_users_clients_vehicles.sql`. Los nombres de tablas y columnas se mantienen en inglés, según la constitución.

## Diagrama de relaciones

```text
users (rol como columna)

clients 1 ──── * vehicles
```

## Tabla `users`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identificador |
| `username` | VARCHAR(50) | NOT NULL, UNIQUE | Nombre de usuario para iniciar sesión |
| `name` | VARCHAR(120) | NOT NULL | Nombre completo |
| `email` | VARCHAR(120) | NOT NULL, UNIQUE | Correo electrónico |
| `passwordHash` | VARCHAR(100) | NOT NULL | Hash bcrypt; nunca texto plano |
| `role` | ENUM('ADMIN','RECEPTIONIST','MECHANIC') | NOT NULL | Rol de acceso |
| `active` | TINYINT(1) | NOT NULL, DEFAULT 1 | Cuenta activa |
| `failedAttempts` | TINYINT UNSIGNED | NOT NULL, DEFAULT 0 | Intentos fallidos consecutivos |
| `lockedUntil` | DATETIME | NULL | Fin del bloqueo temporal |
| `createdAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| `updatedAt` | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | Última actualización |

**Reglas de validación**
- `username`: 3 a 50 caracteres, sin espacios; único sin distinguir mayúsculas.
- `email`: formato de correo válido; único sin distinguir mayúsculas.
- Contraseña nueva: mínimo 8 caracteres, con mayúscula, minúscula y número.
- Debe existir al menos un usuario `ADMIN` con `active = 1` (FR-013).

**Transiciones de estado**
- `active`: 1 → 0 (desactivar, con confirmación) y 0 → 1 (reactivar), solo por ADMIN.
- Bloqueo: al llegar `failedAttempts` a 5, se fija `lockedUntil` = ahora + 15 min; un inicio de sesión correcto reinicia `failedAttempts` a 0 y `lockedUntil` a `NULL`.

## Tabla `clients`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identificador |
| `name` | VARCHAR(120) | NOT NULL | Nombre del cliente |
| `phone` | VARCHAR(20) | NOT NULL, INDEX | Teléfono (no único: la repetición avisa y pide confirmación) |
| `email` | VARCHAR(120) | NULL | Correo electrónico |
| `active` | TINYINT(1) | NOT NULL, DEFAULT 1 | Cliente activo |
| `createdAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Fecha de registro |
| `updatedAt` | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | Última actualización |

**Reglas de validación**
- `name`: obligatorio, hasta 120 caracteres.
- `phone`: obligatorio; de 10 dígitos, admitiendo espacios y guiones que se normalizan.
- `email`: opcional; si se captura, debe tener formato válido.
- Índices de apoyo para la búsqueda por nombre y correo.

**Transiciones de estado**: `active` 1 → 0 al desactivar (con confirmación); la información y los vehículos asociados se conservan.

## Tabla `vehicles`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identificador |
| `clientId` | INT UNSIGNED | NOT NULL, FK → `clients.id` | Propietario (obligatorio) |
| `brand` | VARCHAR(60) | NOT NULL | Marca |
| `model` | VARCHAR(60) | NOT NULL | Modelo |
| `year` | SMALLINT UNSIGNED | NOT NULL | Año |
| `licensePlate` | VARCHAR(15) | NOT NULL, UNIQUE | Placas |
| `vin` | VARCHAR(17) | NULL, UNIQUE | Número de serie opcional |
| `currentMileage` | INT UNSIGNED | NOT NULL, DEFAULT 0 | Kilometraje actual |
| `createdAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Fecha de registro |
| `updatedAt` | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | Última actualización |

**Reglas de validación**
- `clientId` debe existir; la llave foránea impide vehículos huérfanos (RN-1, FR-021, FR-026).
- `licensePlate`: se guarda en mayúsculas y sin espacios; única.
- `vin`: si se captura, 17 caracteres alfanuméricos; único; admite `NULL` repetido.
- `year`: entre 1950 y el año actual más 1.
- `currentMileage`: entero mayor o igual a 0; no puede disminuir sin corrección explícita (`mileageCorrection: true` en la petición, FR-024).

## Tabla `schema_migrations`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `version` | VARCHAR(100) | PK | Nombre del script aplicado |
| `appliedAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Fecha de aplicación |

## Relaciones

- Un cliente tiene cero o más vehículos; un vehículo pertenece a exactamente un cliente (`vehicles.clientId` → `clients.id`, sin eliminación en cascada: los clientes se desactivan, no se borran).
- Cada usuario tiene exactamente un rol, almacenado en `users.role`.

## Datos de ejemplo (seeds)

Idempotentes, con `ON DUPLICATE KEY UPDATE` sobre las claves únicas:

- Usuarios: `admin`, `recepcion` y `mecanico`, con hash bcrypt generado por el script del backend (nunca contraseñas en texto plano en SQL).
- Al menos 5 clientes de prueba, con 1 a 2 vehículos cada uno, incluyendo un cliente sin vehículos y un vehículo sin VIN.
