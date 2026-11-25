# Contrato de la API REST: Sprint 6 (notificaciones internas y clientes por avisar)

Extiende los contratos de los Sprints 1 a 5: misma base `/api`, mismo formato de éxito `{ "data": ..., "meta": ... }` y de error `{ "error": { "code", "message", "details" } }`, y autenticación con `Authorization: Bearer <token>`. **Se agregan cuatro rutas**; no cambia ninguna respuesta existente.

## Rutas nuevas

| Método | Ruta | Roles | Qué hace |
|--------|------|-------|----------|
| GET | `/notifications` | ADMIN, RECEPTIONIST, MECHANIC | Avisos del usuario, agrupados por tipo, con el conteo de no leídos |
| POST | `/notifications/read` | ADMIN, RECEPTIONIST, MECHANIC | Marca un aviso como leído para el usuario |
| GET | `/client-notices` | ADMIN, RECEPTIONIST | Lista de clientes por avisar (hechos pendientes) |
| POST | `/client-notices` | ADMIN, RECEPTIONIST | Registra que un cliente fue avisado por un hecho |

## Códigos de error nuevos

| HTTP | Código | Cuándo |
|------|--------|--------|
| 409 | `NOTICE_NOT_APPLICABLE` | El hecho que se quiere marcar como avisado ya no aplica (por ejemplo, la orden se entregó o la cita se canceló); no se registra nada (FR-017) |

Se reutilizan `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN` y `NOT_FOUND`.

## `GET /notifications`

Devuelve solo los grupos con avisos y solo los tipos que corresponden al rol (FR-006). Cada grupo trae hasta 10 avisos ordenados por urgencia (FR-002); `total` y `unread` cuentan **todos** los avisos del tipo, no solo los mostrados.

```json
{
  "data": {
    "unread": 4,
    "total": 6,
    "clientsToNotify": 3,
    "stockAlerts": 2,
    "groups": [
      {
        "type": "MAINTENANCE_OVERDUE",
        "total": 2,
        "unread": 1,
        "items": [
          {
            "key": "MANT:12:VENCIDO",
            "type": "MAINTENANCE_OVERDUE",
            "read": false,
            "title": "Cambio de aceite vencido",
            "detail": "Chevrolet Aveo JKL-012-D · Juan Pérez · pasado por 350 km",
            "data": { "serviceType": "Cambio de aceite", "daysLeft": null, "kmLeft": -350,
                      "client": { "id": 3, "name": "Juan Pérez" },
                      "vehicle": { "id": 4, "licensePlate": "JKL-012-D", "title": "Chevrolet Aveo" } },
            "target": { "kind": "maintenance", "id": 12, "search": "JKL-012-D" }
          }
        ]
      }
    ]
  },
  "meta": { "limitPerType": 10 }
}
```

- **Tipos de grupo**: `MAINTENANCE_OVERDUE`, `MAINTENANCE_SOON`, `APPOINTMENT_TODAY`, `STOCK_OUT`, `STOCK_LOW` y `ORDER_STALLED`.
- **`data` por tipo** (sin teléfonos):
  - mantenimiento: `serviceType`, `daysLeft`, `kmLeft`, `client` y `vehicle`;
  - cita: `time`, `client` y `licensePlate`;
  - stock: `code`, `name`, `stock` y `minimumStock`;
  - orden: `folio`, `licensePlate`, `status` y `daysStalled`.
- **`target.kind`**: `order`, `appointment`, `part` o `maintenance` (este último lleva `search` con la placa).
- **`clientsToNotify`**: solo para ADMIN y RECEPTIONIST; alimenta la insignia de la sección «Clientes por avisar».
- **`stockAlerts`**: solo para ADMIN; alimenta la insignia de Inventario.
- **Efecto al consultar**: se descartan las lecturas del usuario cuyos avisos ya no existen (FR-009).

## `POST /notifications/read`

Cuerpo: `{ "key": "STOCK:5:AGOTADO" }`.

| Resultado | Cuándo |
|-----------|--------|
| `200` con `{ "data": { "key": "...", "read": true } }` | El aviso existe y es visible para el usuario; se guarda la lectura (una segunda vez no falla ni duplica) |
| `200` con `{ "data": { "key": "...", "read": false } }` | El tipo está permitido para su rol pero el aviso ya no existe o no es suyo (por ejemplo, la orden de otro mecánico); no hace nada y no revela si existe |
| `400 VALIDATION_ERROR` | La clave no tiene un formato válido |
| `404 NOT_FOUND` | El tipo del aviso no corresponde a su rol (por ejemplo, un mecánico marca un aviso de stock) |

## `GET /client-notices`

Solo ADMIN y RECEPTIONIST (el mecánico recibe `403`). Parámetros opcionales `page` (1 por omisión) y `pageSize` (50 por omisión, máximo 100). Ordenada por `factDate`, la más antigua primero; excluye hechos ya avisados y clientes desactivados.

```json
{
  "data": [
    {
      "kind": "ORDEN_LISTA",
      "factId": 5,
      "reason": "Vehículo listo",
      "factDate": "2026-11-20T18:30:00.000Z",
      "client": { "id": 2, "name": "María López", "phone": "5512345678" },
      "vehicle": { "id": 3, "licensePlate": "ABC-123-D", "title": "Nissan Versa" },
      "detail": "Orden OS-000005 terminada",
      "target": { "kind": "order", "id": 5 }
    }
  ],
  "meta": { "page": 1, "pageSize": 50, "total": 1 }
}
```

- **`kind`**: `ORDEN_LISTA`, `CITA_MANANA`, `MANTENIMIENTO_PROXIMO` o `MANTENIMIENTO_VENCIDO`.
- **`factId`**: la orden, la cita o el mantenimiento que motiva el aviso.

## `POST /client-notices`

Solo ADMIN y RECEPTIONIST. Cuerpo: `{ "kind": "ORDEN_LISTA", "factId": 5, "note": "No contestó" }` (`note` opcional, hasta 255 caracteres).

| Resultado | Cuándo |
|-----------|--------|
| `201` con el registro creado | Primer aviso del hecho: guarda `noticedBy`, `noticedAt` y la nota (FR-017) |
| `200` con el registro original | El hecho ya estaba avisado (doble clic o dos personas a la vez): no duplica ni falla (FR-019) |
| `400 VALIDATION_ERROR` | `kind` desconocido, `factId` inválido o nota de más de 255 caracteres |
| `403 FORBIDDEN` | Rol sin permiso (mecánico) |
| `404 NOT_FOUND` | El objeto del hecho no existe |
| `409 NOTICE_NOT_APPLICABLE` | El hecho ya no aplica; no se registra nada |

**Ningún mensaje se envía al cliente** por ningún canal: el registro solo deja constancia de que una persona avisó (FR-018).

```json
{
  "data": {
    "id": 1, "kind": "ORDEN_LISTA", "factId": 5,
    "client": { "id": 2, "name": "María López" },
    "noticedBy": { "id": 2, "name": "Recepción del taller" },
    "noticedAt": "2026-11-24T20:10:00.000Z",
    "note": "No contestó"
  }
}
```

## Matriz de permisos

| Ruta | ADMIN | RECEPTIONIST | MECHANIC |
|------|:-----:|:------------:|:--------:|
| `GET /notifications` | ✔ (todos los tipos) | ✔ (sin stock) | ✔ (solo órdenes detenidas suyas) |
| `POST /notifications/read` | ✔ | ✔ | ✔ (404 si el tipo no es suyo) |
| `GET /client-notices` | ✔ | ✔ | ✘ (403) |
| `POST /client-notices` | ✔ | ✔ | ✘ (403) |
