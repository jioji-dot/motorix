# Contrato de la API REST: Sprint 1

**Funcionalidad**: [spec.md](../spec.md) | **Modelo**: [data-model.md](../data-model.md)

Este contrato es la fuente para `docs/api.md` y para las pruebas de contrato (`server/tests/contract`).

## Convenciones

- Prefijo `/api`. Cuerpos y respuestas en JSON (`Content-Type: application/json`), campos en `camelCase`.
- Autenticación: cabecera `Authorization: Bearer <token>` en todo endpoint salvo `POST /api/auth/login` y `GET /api/health`.
- Respuesta exitosa: `{ "data": ... }`; en listados, además `"meta": { "page", "pageSize", "total" }`.
- Listados: parámetros `page` (por defecto 1), `pageSize` (por defecto 20, máximo 100) y `search` (texto libre).
- Respuesta de error (nunca incluye trazas internas):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Mensaje en español", "details": [ { "field": "email", "message": "..." } ] } }
```

| HTTP | `code` | Cuándo |
|:----:|--------|--------|
| 400 | `VALIDATION_ERROR` | Datos faltantes o con formato inválido; `details` lista cada campo |
| 401 | `INVALID_CREDENTIALS` | Usuario/correo o contraseña incorrectos (mensaje genérico) |
| 401 | `UNAUTHENTICATED` | Falta el token, es inválido, expiró o el usuario está inactivo |
| 403 | `FORBIDDEN` | El rol no permite la operación |
| 404 | `NOT_FOUND` | El recurso no existe |
| 409 | `DUPLICATE_USERNAME`, `DUPLICATE_EMAIL`, `DUPLICATE_LICENSE_PLATE`, `DUPLICATE_VIN` | Dato único repetido; `details.field` indica el campo |
| 409 | `PHONE_DUPLICATE_WARNING` | Teléfono ya registrado y falta `confirmDuplicatePhone: true`; `details.matches` lista clientes coincidentes (`id`, `name`) |
| 409 | `LAST_ADMIN_PROTECTED` | Se intentó dejar el sistema sin administrador activo, o un administrador intentó desactivarse o cambiar su propio rol |
| 409 | `MILEAGE_DECREASE` | Kilometraje menor al guardado sin `mileageCorrection: true` |
| 423 | `ACCOUNT_LOCKED` | Cuenta bloqueada por intentos fallidos; `details.retryAfterSeconds` |
| 500 | `INTERNAL_ERROR` | Error inesperado, con mensaje genérico |

## Matriz de permisos

| Operación | ADMIN | RECEPTIONIST | MECHANIC |
|-----------|:-----:|:------------:|:--------:|
| Iniciar sesión, ver perfil, cambiar la propia contraseña | sí | sí | sí |
| Consultar clientes y vehículos (listado y detalle) | sí | sí | sí |
| Crear y editar clientes y vehículos | sí | sí | no |
| Gestionar usuarios (listar, crear, editar, activar/desactivar, restablecer contraseña) | sí | no | no |

## Salud

### `GET /api/health`

Sin autenticación. `200` → `{ "data": { "status": "ok" } }`.

## Autenticación (US1)

### `POST /api/auth/login`

```json
{ "identifier": "recepcion", "password": "..." }
```

- `identifier` acepta usuario o correo (si contiene `@` se trata como correo). No distingue mayúsculas ni espacios sobrantes.
- `200` → `{ "data": { "token": "...", "expiresIn": 28800, "user": { "id", "username", "name", "email", "role" } } }`
- Errores: `400`, `401 INVALID_CREDENTIALS`, `423 ACCOUNT_LOCKED`. Una cuenta inactiva responde `401 INVALID_CREDENTIALS`.

### `GET /api/auth/me`

`200` → `{ "data": { "id", "username", "name", "email", "role" } }`.

### `POST /api/auth/change-password`

```json
{ "currentPassword": "...", "newPassword": "..." }
```

- `204` sin cuerpo. Errores: `400` (política mínima incumplida; la nueva debe diferir de la actual), `401 INVALID_CREDENTIALS` si la contraseña actual es incorrecta.

## Usuarios (US2) — solo ADMIN

Objeto `User`: `{ "id", "username", "name", "email", "role", "active", "createdAt", "updatedAt" }` (nunca incluye datos de contraseña).

| Método y ruta | Descripción | Respuesta |
|---------------|-------------|-----------|
| `GET /api/users` | Listado. Filtros: `search`, `role`, `active` | `200` lista de `User` + `meta` |
| `POST /api/users` | Alta. Cuerpo: `username`, `name`, `email`, `role`, `password` | `201` `User` |
| `GET /api/users/:id` | Detalle | `200` `User` |
| `PATCH /api/users/:id` | Edición parcial: `name`, `email`, `role`, `active` | `200` `User` |
| `POST /api/users/:id/reset-password` | Cuerpo: `{ "newPassword" }`; cumple la política mínima | `204` |

Errores específicos: `409 DUPLICATE_USERNAME`, `409 DUPLICATE_EMAIL`, `409 LAST_ADMIN_PROTECTED`. El `username` no se modifica tras el alta.

## Clientes (US3, US4)

Objeto `Client`: `{ "id", "name", "phone", "email", "address", "active", "createdAt", "updatedAt" }`.

| Método y ruta | Permiso | Descripción | Respuesta |
|---------------|---------|-------------|-----------|
| `GET /api/clients` | todos | Listado; `search` busca en nombre, teléfono y correo | `200` lista de `Client` + `meta` |
| `POST /api/clients` | ADMIN, RECEPTIONIST | Alta: `name`, `phone`, `email?`, `address?`, `confirmDuplicatePhone?` | `201` `Client` |
| `GET /api/clients/:id` | todos | Detalle con vehículos: `Client` + `"vehicles": [Vehicle]` | `200` |
| `PATCH /api/clients/:id` | ADMIN, RECEPTIONIST | Edición parcial de `name`, `phone`, `email`, `address`, `confirmDuplicatePhone?` | `200` `Client` |

Errores específicos: `409 PHONE_DUPLICATE_WARNING` (se repite la petición con `confirmDuplicatePhone: true` tras la confirmación del usuario).

## Vehículos (US5)

Objeto `Vehicle`: `{ "id", "clientId", "brand", "model", "year", "licensePlate", "vin", "color", "currentMileage", "createdAt", "updatedAt" }`. En el detalle se añade `"owner": { "id", "name", "phone" }`.

| Método y ruta | Permiso | Descripción | Respuesta |
|---------------|---------|-------------|-----------|
| `GET /api/vehicles` | todos | Listado; filtros `search` (placa, marca, modelo, propietario) y `clientId` | `200` lista de `Vehicle` (con `ownerName`) + `meta` |
| `POST /api/vehicles` | ADMIN, RECEPTIONIST | Alta: `clientId`, `brand`, `model`, `year`, `licensePlate`, `vin?`, `color?`, `currentMileage?` | `201` `Vehicle` |
| `GET /api/vehicles/:id` | todos | Detalle con propietario | `200` `Vehicle` + `owner` |
| `PATCH /api/vehicles/:id` | ADMIN, RECEPTIONIST | Edición parcial (no acepta `clientId`); `mileageCorrection?` | `200` `Vehicle` |

Errores específicos: `400` si `clientId` falta, `404` si el propietario no existe (`details.field = "clientId"`), `409 DUPLICATE_LICENSE_PLATE`, `409 DUPLICATE_VIN`, `409 MILEAGE_DECREASE`.
