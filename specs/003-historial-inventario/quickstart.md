# Guía de validación rápida: Historial, mantenimiento e inventario (Sprint 3)

**Funcionalidad**: [spec.md](spec.md) | **Contrato**: [contracts/api.md](contracts/api.md) | **Modelo**: [data-model.md](data-model.md)

Recorrido para comprobar de extremo a extremo que el Sprint 3 funciona con datos de ejemplo. Los pasos de preparación son los de `database/README.md` y `README.md`.

## 1. Preparación

1. MySQL local activo; `.env` y `.env.test` creados desde `.env.example` (bases `motorix` y `motorix_test`).
2. Desde la raíz: `npm run db:reset` (aplica las migraciones 001 a 003 y los seeds 001 a 003).
3. API: `npm run dev` (puerto 3000). Cliente: `flutter run -d chrome --web-port 5000` desde `client/`.
4. Cuentas de ejemplo: `admin`, `recepcion` y `mecanico` (contraseñas en `.env`).

**Resultado esperado**: el inventario no está vacío (≥ 12 refacciones, con alertas), hay mantenimientos vencidos y próximos, y un vehículo con varios servicios en su historial.

## 2. Recorrido por la interfaz (flujo demostrable)

| # | Rol | Acción | Resultado esperado |
|---|-----|--------|--------------------|
| 1 | Administrador | Entrar. Mirar el menú | "Inventario" muestra una insignia con el número de alertas (FR-018, SC-008) |
| 2 | Administrador | Abrir Inventario y pulsar el aviso de alertas | Lista solo refacciones "Stock bajo" y "Agotada" con color ámbar y rojo |
| 3 | Administrador | Crear la refacción `PRB-001` (existencia inicial 5, mínimo 2, precio 100) | Aparece en la lista; su detalle muestra un movimiento de entrada "Existencia inicial" |
| 4 | Administrador | Repetir con el código `PRB-001` | Error: el código ya existe |
| 5 | Mecánico | Abrir "Mis órdenes" y entrar a una orden en reparación | El detalle muestra la tabla de refacciones |
| 6 | Mecánico | Agregar `PRB-001`, cantidad 2 | Aparece en la orden, el total sube y la existencia baja a 3 |
| 7 | Mecánico | Agregar `PRB-001`, cantidad 9 | Error: existencia insuficiente (disponible 3); nada cambia |
| 8 | Mecánico | Cambiar la cantidad a 1 y luego quitar la línea | La existencia vuelve a 5 con movimientos de devolución |
| 9 | Mecánico | Capturar kilometraje de servicio menor al de entrada | Error con el kilometraje de entrada |
| 10 | Mecánico | Capturar un kilometraje de servicio válido y terminar la orden | La orden pasa a TERMINADO y el kilometraje del vehículo se actualiza |
| 11 | Mecánico | En la orden terminada, registrar el próximo mantenimiento (fecha futura y kilometraje) | Queda "Pendiente" en el vehículo |
| 12 | Mecánico | Registrar otro mantenimiento para el mismo vehículo | Aviso de que existe uno pendiente; al confirmar, el anterior queda cancelado |
| 13 | Mecánico | Intentar agregar una refacción a la orden terminada | Se rechaza: la orden ya no admite cambios |
| 14 | Cualquiera | Abrir el vehículo y ver "Historial" | Las órdenes terminadas y entregadas aparecen de la más reciente a la más antigua, con kilometraje y refacciones; la orden en proceso no aparece |
| 15 | Recepción | Abrir "Mantenimientos" | Se ven vencidos (rojo) y próximos (ámbar) con nombre y teléfono del cliente; no se ven los lejanos |
| 16 | Recepción | Filtrar por placa o cliente | Solo coincidencias, vencidos primero |
| 17 | Administrador | Registrar una entrada de 10 piezas en una refacción con stock bajo | La existencia sube y la alerta desaparece; la insignia baja |
| 18 | Administrador | Registrar un ajuste a una existencia menor sin motivo | Error: el motivo es obligatorio |
| 19 | Administrador | Dar de baja una refacción usada en órdenes | Queda inactiva; el mecánico ya no la encuentra al buscar |
| 20 | Mecánico / Recepción | Intentar abrir el inventario completo (por ejemplo, llamar `/api/parts`) | `403 FORBIDDEN` |

## 3. Recorrido por la API (automatizable)

Con los tokens de cada rol (`POST /api/auth/login`):

1. `GET /api/parts/alerts` (administrador) → `low` y `out` mayores a 0.
2. `POST /api/orders/:id/parts` con una cantidad mayor a la existencia → `409 INSUFFICIENT_STOCK`, sin movimientos nuevos.
3. Dos `POST /api/orders/:id/parts` simultáneos por la última pieza → exactamente uno responde `200`, el otro `409`, y `stock` queda en 0.
4. `GET /api/vehicles/:id/history` → solo `TERMINADO` y `ENTREGADO`, en orden descendente.
5. `GET /api/maintenance` (recepción) → vencidos antes que próximos; `GET /api/maintenance` con token de mecánico → `403`.
6. Comprobar la invariante: para cada refacción, `stock` = suma de `quantity` de `GET /api/parts/:id/movements` (todas las páginas).

## 4. Pruebas automatizadas

```text
npm test                    # unitarias, integración y contrato (contra motorix_test)
cd client && flutter analyze && flutter test
```

**Esperado**: todo en verde, incluidas las pruebas de clasificación de mantenimiento, de movimientos e invariante de inventario, de concurrencia por la última pieza, de permisos por rol y de idempotencia del seed `003` (ejecutarlo dos veces no duplica registros).

## 5. Rendimiento

Con el script de carga de pruebas (5 000 refacciones y 1 000 órdenes terminadas de un vehículo): el listado de inventario, la búsqueda, las alertas y el historial responden en menos de 2 segundos (SC-010).
