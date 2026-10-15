# Guía de validación rápida: Citas y órdenes de servicio

**Funcionalidad**: [spec.md](spec.md) | **Contrato**: [contracts/api.md](contracts/api.md) | **Modelo**: [data-model.md](data-model.md)

Comprueba de extremo a extremo que el Sprint 2 funciona. Parte de que el Sprint 1 ya está instalado (`specs/001-base-clientes-vehiculos/quickstart.md`).

## Requisitos previos

- MySQL con las bases `motorix` y `motorix_test` y el usuario `motorix_app` creados.
- `.env` y `.env.test` completos (ver `database/README.md`).

## 1. Aplicar el esquema y cargar los datos de ejemplo

Desde `server/`:

- `npm run db:migrate` — aplica la migración `002_sprint2_appointments_service_orders.sql`.
- `npm run db:seed` — agrega citas y órdenes de ejemplo.

**Resultado esperado**:
- Existen las tablas `appointments`, `service_orders`, `order_services`, `order_labor` y `order_status_history`.
- Hay 6 citas y 7 órdenes de ejemplo, con órdenes en los seis estados.
- Ejecutar `npm run db:seed` otra vez no cambia las cantidades (SC-010).
- `npm run db:reset` recrea todo desde cero.

## 2. Iniciar servidor y aplicación

`npm start` en `server/`; luego `flutter run -d chrome --web-port 5000` en `client/`.

## 3. Recorrer el flujo demostrable

| Paso | Acción | Resultado esperado |
|:----:|--------|--------------------|
| 1 | Iniciar sesión como `recepcion` y abrir **Citas** | Ve las citas de ejemplo ordenadas por fecha |
| 2 | Registrar una cita para un cliente y uno de sus vehículos, mañana a las 10:00 | Queda `PENDIENTE` |
| 3 | Intentar otra cita para el mismo vehículo el mismo día | Aviso de coincidencia; se guarda solo al confirmar |
| 4 | Intentar una cita con fecha pasada | Se rechaza |
| 5 | Confirmar la cita y luego modificar su hora | Pasa a `CONFIRMADA`; el cambio se ve en el listado |
| 6 | Crear una orden desde esa cita, con kilometraje y mecánico `mecanico` | Folio `OS-…`, estado `RECIBIDO`; la cita pasa a `EN_PROCESO` |
| 7 | Intentar cancelar esa cita | Se impide: ya tiene orden |
| 8 | Crear otra orden con kilometraje menor al del vehículo | Se rechaza; con corrección explícita se acepta |
| 9 | Cerrar sesión e iniciar como `mecanico`, abrir **Órdenes** | Ve solo las órdenes asignadas a él |
| 10 | Abrir la orden nueva, pasar a `DIAGNOSTICO` y escribir el diagnóstico | Estado y diagnóstico guardados; el historial muestra el cambio |
| 11 | Intentar pasar de `DIAGNOSTICO` a `TERMINADO` | Se rechaza e indica los estados válidos |
| 12 | Pasar a `EN_REPARACION`, agregar dos servicios y una línea de mano de obra | Se muestran subtotales y total |
| 13 | Pasar a `ESPERANDO_REFACCION` y volver a `EN_REPARACION` | Ambos cambios se aceptan |
| 14 | Pasar a `TERMINADO`, agregar recomendaciones | Se acepta; diagnóstico, servicios y mano de obra ya no se editan |
| 15 | Iniciar como `recepcion` y marcar la orden `ENTREGADO` (con confirmación) | Queda como historial; la cita pasa a `COMPLETADA` |
| 16 | Intentar modificar la orden entregada | Se rechaza |

## 4. Verificar permisos en el servidor (CA-7, SC-005)

Con el token de `mecanico`: `GET /api/appointments` → `403`; `POST /api/orders` → `403`; abrir una orden de otro mecánico → `404`. Con el de `recepcion`: `PATCH /api/orders/:id/work` → `403`. Sin token → `401`.

## 5. Ejecutar las pruebas automáticas

- Backend (desde `server/`): `npm test` — incluye la matriz de transiciones de estado (CA-8), integración y contrato contra `motorix_test`.
- Frontend (desde `client/`): `flutter test` y `flutter analyze`.

## 6. Revisión de higiene

- La migración `002` es un archivo nuevo; la `001` no se modificó (el ejecutor lo comprueba con su checksum).
- No hay endpoints ni pantallas para eliminar órdenes o citas (FR-017).
- Cada pantalla nueva cumple la lista de "terminado" de `docs/design-system.md` (CA-12 heredado).
