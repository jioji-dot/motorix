# Modelo de datos: Base del sistema, clientes y vehículos

**Funcionalidad**: [spec.md](spec.md) | **Fecha**: 2026-10-12

Motor InnoDB, codificación `utf8mb4`, collation `utf8mb4_0900_ai_ci`. Columnas en `snake_case` en la base y en `camelCase` en el JSON de la API. Todas las tablas incluyen `created_at` y `updated_at` (este último se actualiza automáticamente).

## Diagrama de relaciones

```text
users                      clients 1 ───< vehicles
(independiente en el S1)   (un cliente tiene 0..N vehículos; cada vehículo, exactamente 1 cliente)
```

## Tabla `users` (US1, US2)

| Columna | Tipo | Restricciones | Notas |
|---------|------|---------------|-------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `username` | VARCHAR(50) | NOT NULL, UNIQUE | 3–50 caracteres: letras, números, `.`, `_`, `-` |
| `name` | VARCHAR(100) | NOT NULL | Nombre completo |
| `email` | VARCHAR(150) | NOT NULL, UNIQUE | Formato válido, en minúsculas |
| `password_hash` | VARCHAR(100) | NOT NULL | Hash bcrypt; nunca se devuelve por la API |
| `role` | ENUM('ADMIN','RECEPTIONIST','MECHANIC') | NOT NULL | FR-004 |
| `active` | TINYINT(1) | NOT NULL, DEFAULT 1 | Un usuario inactivo no puede iniciar sesión |
| `failed_login_attempts` | TINYINT UNSIGNED | NOT NULL, DEFAULT 0 | FR-002a |
| `locked_until` | DATETIME | NULL | Bloqueo temporal de 15 min |
| `created_at`, `updated_at` | DATETIME | NOT NULL | |

**Reglas de validación**

- Contraseña nueva o restablecida: mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número (FR-008). Las contraseñas iniciales del estándar del MVP solo se aceptan por el script de seeds.
- Inicio de sesión: si el identificador contiene `@` se busca por `email`; si no, por `username`.
- No se puede desactivar ni quitar el rol ADMIN a la última cuenta de administrador activa, ni un administrador puede hacerlo sobre sí mismo (D12).
- No se eliminan usuarios; se desactivan.

## Tabla `clients` (US3, US4)

| Columna | Tipo | Restricciones | Notas |
|---------|------|---------------|-------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `name` | VARCHAR(120) | NOT NULL | Obligatorio |
| `phone` | VARCHAR(20) | NOT NULL, INDEX | Obligatorio; 7–15 dígitos, admite `+`, espacios y guiones al capturar. No es único (D6) |
| `email` | VARCHAR(150) | NULL | Opcional; formato válido, en minúsculas |
| `address` | VARCHAR(255) | NULL | Opcional |
| `active` | TINYINT(1) | NOT NULL, DEFAULT 1 | Reservado para desactivación futura; en el Sprint 1 siempre 1 |
| `created_at`, `updated_at` | DATETIME | NOT NULL | `created_at` es la fecha de registro |

**Índices**: `idx_clients_name (name)` y `idx_clients_phone (phone)` para la búsqueda (SC-007).

**Reglas**

- No se eliminan clientes en el Sprint 1.
- Un teléfono repetido genera una advertencia confirmable, no un rechazo (FR-011).

## Tabla `vehicles` (US5)

| Columna | Tipo | Restricciones | Notas |
|---------|------|---------------|-------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `client_id` | INT UNSIGNED | NOT NULL, FK → `clients.id` (ON DELETE RESTRICT) | Propietario obligatorio (RN-1, FR-016) |
| `brand` | VARCHAR(60) | NOT NULL | |
| `model` | VARCHAR(60) | NOT NULL | |
| `year` | SMALLINT UNSIGNED | NOT NULL | Entre 1950 y el año actual + 1 |
| `license_plate` | VARCHAR(15) | NOT NULL, UNIQUE | Normalizada: mayúsculas, sin espacios ni guiones |
| `vin` | CHAR(17) | NULL, UNIQUE | Opcional; 17 caracteres alfanuméricos sin I, O ni Q; en mayúsculas |
| `color` | VARCHAR(30) | NULL | Opcional |
| `current_mileage` | INT UNSIGNED | NOT NULL, DEFAULT 0 | Kilometraje actual (D11) |
| `created_at`, `updated_at` | DATETIME | NOT NULL | |

**Índices**: `idx_vehicles_client (client_id)` (lo crea la llave foránea) y los únicos de `license_plate` y `vin`.

**Reglas**

- Un vehículo no existe sin propietario ni con un propietario inexistente (FK + validación en el servicio).
- El propietario no se puede cambiar en el Sprint 1 (traspaso fuera de alcance): la edición no acepta `clientId`.
- Al editar, `current_mileage` no puede ser menor al valor guardado, salvo que la petición incluya `mileageCorrection: true` (Principio V).
- `ON DELETE RESTRICT` impide borrar un cliente con vehículos, aunque en este sprint no existe borrado.

## Tabla `schema_migrations`

| Columna | Tipo | Notas |
|---------|------|-------|
| `filename` | VARCHAR(255) | PK; nombre del script aplicado |
| `checksum` | CHAR(64) | SHA-256 del contenido; detecta ediciones de scripts ya aplicados |
| `applied_at` | DATETIME | Fecha de aplicación |

## Datos de ejemplo (seeds idempotentes)

| Contenido | Cantidad | Clave de idempotencia |
|-----------|:--------:|-----------------------|
| Usuarios `admin`, `recepcion`, `mecanico` (un usuario por rol; contraseñas desde variables de entorno, cifradas) | 3 | `username` |
| Clientes de ejemplo | 8 | (`name`, `phone`) |
| Vehículos de ejemplo repartidos entre los clientes (al menos un cliente con 2 vehículos y otro sin vehículos) | 12 | `license_plate` |

## Transiciones de estado

- **Usuario**: `active` = 1 ⇄ 0 (lo cambia solo un ADMIN). `locked_until` se fija tras 5 fallos y se limpia en el siguiente acceso correcto.
- **Cliente y vehículo**: sin estados en el Sprint 1.
