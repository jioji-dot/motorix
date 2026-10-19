# Contrato de la API REST: Sprint 1

Base: `/api`. Formato JSON. Autenticación con cabecera `Authorization: Bearer <token>` en todas las rutas excepto el inicio de sesión.

## Convenciones

**Éxito**: `{ "data": <objeto | arreglo>, "meta": { ... } }` (`meta` solo en listados con paginación: `page`, `pageSize`, `total`).

**Error**: `{ "error": { "code": "<CODIGO>", "message": "<texto en español>", "details": [ { "field": "...", "message": "..." } ] } }`. Nunca incluye trazas internas.

| HTTP | Uso | Códigos de error |
|------|-----|------------------|
| 200 / 201 / 204 | Éxito, creación, sin contenido | — |
| 400 | Validación fallida | `VALIDATION_ERROR` |
| 401 | Sin token, token inválido, credenciales incorrectas, sesión expirada | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` |
| 403 | Rol sin permiso o cuenta desactivada | `FORBIDDEN`, `ACCOUNT_DISABLED` |
| 404 | Recurso inexistente | `NOT_FOUND` |
| 409 | Duplicado o conflicto de regla | `DUPLICATE_VALUE`, `DUPLICATE_PHONE`, `LAST_ADMIN`, `MILEAGE_DECREASE` |
| 423 | Cuenta bloqueada temporalmente | `ACCOUNT_LOCKED` (incluye `retryAfterSeconds`) |
| 500 | Error interno | `INTERNAL_ERROR` (mensaje genérico) |

## Matriz de permisos

| Endpoint | ADMIN | RECEPTIONIST | MECHANIC |
|----------|:-----:|:------------:|:--------:|
| `POST /auth/login` | ✔ | ✔ | ✔ |
| `GET /auth/me`, `POST /auth/change-password` | ✔ | ✔ | ✔ |
| `GET /users`, `GET /users/:id`, `POST /users`, `PATCH /users/:id` | ✔ | ✘ | ✘ |
| `GET /clients`, `GET /clients/:id` | ✔ | ✔ | ✔ |
| `POST /clients`, `PATCH /clients/:id` | ✔ | ✔ | ✘ |
| `GET /vehicles`, `GET /vehicles/:id` | ✔ | ✔ | ✔ |
| `POST /vehicles`, `PATCH /vehicles/:id` | ✔ | ✔ | ✘ |

## Autenticación

### `POST /auth/login`

Solicitud: `{ "identifier": "recepcion" | "recepcion@taller.mx", "password": "..." }`

Respuesta 200: `{ "data": { "token": "<jwt>", "expiresIn": 28800, "user": { "id", "username", "name", "email", "role" } } }`

Errores: 400 (campos vacíos), 401 `INVALID_CREDENTIALS` (mensaje genérico, sin revelar si falló el usuario o la contraseña), 403 `ACCOUNT_DISABLED`, 423 `ACCOUNT_LOCKED`.

### `GET /auth/me`

Respuesta 200: `{ "data": { "id", "username", "name", "email", "role" } }`

### `POST /auth/change-password`

Solicitud: `{ "currentPassword": "...", "newPassword": "..." }`. La nueva contraseña exige 8 o más caracteres, mayúscula, minúscula y número.

Respuesta 204. Errores: 400 (política), 401 (contraseña actual incorrecta).

## Usuarios (solo ADMIN)

### `GET /users`

Parámetros opcionales: `search`, `role`, `active`, `page`, `pageSize`. Respuesta: arreglo de usuarios sin `passwordHash`.

### `GET /users/:id`

### `POST /users`

Solicitud: `{ "username", "name", "email", "role", "password" }`. Respuesta 201 con el usuario creado. Errores: 400, 409 `DUPLICATE_VALUE` (usuario o correo).

### `PATCH /users/:id`

Campos opcionales: `name`, `email`, `role`, `active`, `password` (restablecimiento por ADMIN). Errores: 404, 409 `DUPLICATE_VALUE`, 409 `LAST_ADMIN` (desactivar o quitar el rol al último ADMIN activo).

## Clientes

### `GET /clients`

Parámetros opcionales: `search` (nombre, teléfono o correo), `active`, `page`, `pageSize`.

### `GET /clients/:id`

Respuesta 200: datos del cliente más `vehicles`: arreglo de vehículos asociados (CA-4).

### `POST /clients`

Solicitud: `{ "name", "phone", "email"?, "confirmDuplicatePhone"? }`. Respuesta 201. Si el teléfono ya existe y no se envía `confirmDuplicatePhone: true`, responde 409 `DUPLICATE_PHONE` con los clientes coincidentes en `details`; al reenviar con la confirmación se crea.

### `PATCH /clients/:id`

Campos opcionales: `name`, `phone`, `email`, `active`, `confirmDuplicatePhone`. Misma regla de teléfono repetido.

## Vehículos

### `GET /vehicles`

Parámetros opcionales: `search` (placas, marca, modelo o propietario), `clientId`, `page`, `pageSize`.

### `GET /vehicles/:id`

Respuesta 200: datos del vehículo más `client: { id, name, phone }`.

### `POST /vehicles`

Solicitud: `{ "clientId", "brand", "model", "year", "licensePlate", "vin"?, "currentMileage" }`. Respuesta 201. Errores: 400 (por ejemplo `clientId` ausente), 404 (cliente inexistente), 409 `DUPLICATE_VALUE` (placas o VIN).

### `PATCH /vehicles/:id`

Campos opcionales: los de creación excepto `clientId` fijo en este sprint. Si `currentMileage` es menor al actual, 409 `MILEAGE_DECREASE` salvo que se envíe `mileageCorrection: true`.
