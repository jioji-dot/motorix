# Contrato de la API REST: Sprint 7 (reportes y configuración)

Extiende los contratos de los Sprints 1 a 6: misma base `/api`, mismo formato de éxito `{ "data": ..., "meta": ... }` y de error `{ "error": { "code", "message", "details" } }`, y autenticación con `Authorization: Bearer <token>`. Cambian las respuestas del ticket (campos nuevos) y se agregan las rutas de abajo.

## Códigos de error nuevos

| HTTP | Código | Cuándo |
|------|--------|--------|
| 403 | `TERMS_NOT_ACCEPTED` | Hay una versión vigente de los términos que el usuario no ha aceptado; solo se permiten las rutas exentas |
| 401 | `SESSION_INACTIVE` | La sesión pasó más de 30 minutos sin actividad; hay que iniciar sesión de nuevo |
| 409 | `SERVICE_TYPE_DUPLICATE` | Ya existe un tipo de servicio con ese nombre |

Se reutilizan `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN` y `NOT_FOUND`. Un rango de fechas inválido responde `400 VALIDATION_ERROR` con el detalle del campo.

## Rutas nuevas

| Método | Ruta | Roles | Qué hace |
|--------|------|-------|----------|
| GET | `/settings` | ADMIN | Datos del taller y márgenes vigentes |
| PUT | `/settings` | ADMIN | Guarda los datos indicados (y registra la bitácora) |
| GET | `/service-types` | ADMIN, RECEPTIONIST, MECHANIC | Catálogo (los no administradores reciben solo los activos) |
| POST | `/service-types` | ADMIN | Crea un tipo |
| PATCH | `/service-types/:id` | ADMIN | Edita o activa y desactiva un tipo |
| GET | `/orders/:id/maintenance-proposal` | ADMIN, RECEPTIONIST, MECHANIC (con acceso a la orden) | Propone el próximo mantenimiento de la orden |
| GET | `/terms/current` | Cualquier usuario autenticado | Versión vigente y si el usuario la aceptó |
| POST | `/terms/accept` | Cualquier usuario autenticado | Acepta la versión vigente |
| POST | `/terms` | ADMIN | Publica una versión nueva |
| GET | `/terms/acceptances` | ADMIN | Quién aceptó y quién no la versión vigente |
| GET | `/audit-log` | ADMIN | Bitácora paginada con filtros |
| GET | `/reports/income` | ADMIN | Ingresos por periodo |
| GET | `/reports/services` | ADMIN | Servicios más frecuentes |
| GET | `/reports/productivity` | ADMIN | Productividad por mecánico |
| GET | `/reports/parts` | ADMIN | Refacciones: costo, venta y margen |
| GET | `/reports/rotation` | ADMIN | Rotación de inventario |
| GET | `/reports/:name/export-link` | ADMIN | Enlace de descarga de 60 segundos |
| GET | `/reports/export/:token` | Sin sesión (el token firmado) | Descarga el CSV |

**Rutas exentas de la aceptación de términos**: `GET /auth/me`, `GET /terms/current` y `POST /terms/accept`.

## Configuración

`GET /settings` → `{ "data": { "workshop": { "name", "address", "phone" }, "maintenance": { "warnDays", "warnKm" }, "defaults": { "warnDays": 15, "warnKm": 500 } } }`.

`PUT /settings` con cualquier subconjunto de `workshop.name`, `workshop.address`, `workshop.phone`, `maintenance.warnDays` y `maintenance.warnKm` (por ejemplo `{ "workshop": { "phone": "5512345678" }, "maintenance": { "warnDays": 30 } }`). Responde lo mismo que `GET`. `400` si un valor está fuera de límites.

## Tipos de servicio

Elemento: `{ "id", "name", "intervalDays", "intervalKm", "active" }`. `POST` y `PATCH` aceptan `name`, `intervalDays`, `intervalKm` y `active`; al menos un intervalo, `409 SERVICE_TYPE_DUPLICATE` si el nombre ya existe. Nunca se borra.

Las rutas de líneas de servicio de una orden aceptan `serviceTypeId` opcional (un tipo activo; `400` si no existe o está desactivado) y la orden devuelve `serviceTypeId` y `serviceTypeName` en cada servicio.

## Propuesta del próximo mantenimiento

`GET /orders/:id/maintenance-proposal` → `{ "data": [ { "serviceTypeId", "serviceType", "nextDate": "2027-05-24", "nextMileage": 45000 } ] }`, una por cada tipo con intervalo en la orden (vacío si no hay). `nextDate` es hoy más `intervalDays` y `nextMileage` es el kilometraje del servicio (o el de entrada) más `intervalKm`; cada uno es nulo si el tipo no tiene ese intervalo.

## Términos y condiciones

`GET /terms/current` → `{ "data": { "version": 1, "termsText", "privacyText", "publishedAt", "accepted": false } }`, o `{ "data": null }` si no hay versión publicada. `POST /terms/accept` → `{ "data": { "version": 1, "acceptedAt" } }` (repetirlo no falla). `POST /terms` con `{ "termsText", "privacyText" }` (obligatorios, hasta 20,000 caracteres cada uno) → `201` con la versión nueva. `GET /terms/acceptances` → `{ "data": { "version": 1, "accepted": [ { "userId", "name", "acceptedAt" } ], "pending": [ { "userId", "name" } ] } }`.

## Bitácora

`GET /audit-log?from=&to=&userId=&action=&page=&pageSize=` (fechas `YYYY-MM-DD`, `pageSize` de 50 por omisión y 100 como máximo) → `{ "data": [ { "id", "action", "entity", "entityId", "user": { "id", "name" } | null, "actorLabel", "detail", "createdAt" } ], "meta": { "page", "pageSize", "total" } }`, de la más reciente a la más antigua. No hay rutas de edición, borrado ni exportación.

## Reportes

Parámetros comunes: `from` y `to` (`YYYY-MM-DD`, inclusivos, obligatorios, `from` ≤ `to`, máximo 366 días). Los importes son cadenas con dos decimales calculadas en centavos enteros.

- **`/reports/income`** (más `groupBy=day|month`, `day` por omisión) → `{ "data": { "total", "byMethod": [ { "method", "total" } ], "byPeriod": [ { "period": "2026-11-20", "total" } ] } }`.
- **`/reports/services`** → `{ "data": { "items": [ { "name", "typed": true, "count", "amount" } ] } }`, de mayor a menor cantidad.
- **`/reports/productivity`** → `{ "data": { "items": [ { "mechanic": { "id", "name" }, "orders", "laborAmount" } ], "totalOrders", "totalLabor" } }`.
- **`/reports/parts`** → `{ "data": { "items": [ { "part": { "id", "code", "name" }, "units", "cost", "sale", "margin", "noCost": false } ], "totalSale", "totalCost", "totalMargin" } }`; con `noCost` verdadero, `cost` y `margin` son nulos y la refacción no entra en los totales de costo y margen.
- **`/reports/rotation`** → `{ "data": { "items": [ { "part": { "id", "code", "name" }, "unitsOut", "stock", "rotation": 2.5 | null } ] } }` (`rotation` nulo si no hay existencia).

## Exportación

`GET /reports/:name/export-link?from=&to=&groupBy=` (con `:name` igual a `income`, `services`, `productivity`, `parts` o `rotation`) → `{ "data": { "url": "/api/reports/export/<token>", "expiresInSeconds": 60 } }`. `GET /reports/export/<token>` responde `text/csv; charset=utf-8` con BOM y `Content-Disposition: attachment; filename="reporte-<nombre>-<desde>-<hasta>.csv"`; `401` si el token venció o no es válido. El archivo trae las mismas filas y totales que la pantalla.

## Ticket (campos nuevos)

El ticket (`POST /orders/:id/ticket`, `GET /orders/:id/ticket` y la página imprimible) agrega `nextService`: `{ "name", "date", "mileage" } | null`; `workshop` sale de la instantánea del ticket cuando existe.

## Matriz de permisos

| Ruta | ADMIN | RECEPTIONIST | MECHANIC |
|------|:-----:|:------------:|:--------:|
| `/settings` (GET y PUT) | ✔ | ✘ (403) | ✘ (403) |
| `/service-types` GET | ✔ (todos) | ✔ (activos) | ✔ (activos) |
| `/service-types` POST y PATCH | ✔ | ✘ (403) | ✘ (403) |
| `/orders/:id/maintenance-proposal` | ✔ | ✔ | ✔ (solo sus órdenes) |
| `/terms/current` y `/terms/accept` | ✔ | ✔ | ✔ |
| `/terms` POST y `/terms/acceptances` | ✔ | ✘ (403) | ✘ (403) |
| `/audit-log` | ✔ | ✘ (403) | ✘ (403) |
| `/reports/*` y su exportación | ✔ | ✘ (403) | ✘ (403) |
