# Guía de validación rápida: Pagos, tickets y panel de control (Sprint 4)

**Funcionalidad**: [spec.md](spec.md) | **Contrato**: [contracts/api.md](contracts/api.md) | **Modelo**: [data-model.md](data-model.md)

Recorrido para comprobar de extremo a extremo que el Sprint 4 funciona con datos de ejemplo. La preparación general está en `README.md` y `database/README.md`.

## 1. Preparación

1. MySQL local activo; `.env` y `.env.test` creados desde `.env.example`.
2. **Mercado Pago (solo para la parte digital)**: crea una aplicación en el panel de desarrolladores de Mercado Pago, obtén las credenciales de **pruebas** y una cuenta de comprador de prueba. En `.env` define `MP_ACCESS_TOKEN` con el token de pruebas (nunca en el repositorio). Sin esta variable todo lo demás funciona y el cobro digital responde un mensaje claro.
3. Desde `server/`: `npm run db:reset` (migraciones 001 a 004 y seeds 001 a 004) y `npm start`. Desde `client/`: `flutter run -d chrome --web-port 5000`.
4. Cuentas de ejemplo: `admin`, `recepcion` y `mecanico`.

**Resultado esperado**: la base trae órdenes sin pagar, con pago parcial y pagadas; tickets de ejemplo; y el panel muestra indicadores distintos de cero.

## 2. Recorrido por la interfaz (flujo demostrable)

| # | Rol | Acción | Resultado esperado |
|---|-----|--------|--------------------|
| 1 | Administrador | Iniciar sesión | La pantalla de inicio es el Panel de control con la hora de actualización y los indicadores de órdenes, citas, mantenimientos, inventario y pagos |
| 2 | Administrador | Seleccionar un indicador (por ejemplo, "Alertas de inventario") | Lleva al módulo correspondiente con el filtro aplicado |
| 3 | Recepción | Abrir una orden terminada sin pagos | El detalle muestra el total, "Sin pagar" y el saldo igual al total |
| 4 | Recepción | Registrar un pago en efectivo parcial indicando con cuánto pagó el cliente | Se muestra el cambio; la orden pasa a "Pago parcial" y baja el saldo |
| 5 | Recepción | Intentar registrar un pago mayor al saldo | Error con el saldo disponible; nada cambia |
| 6 | Recepción | Registrar el pago restante con tarjeta y una referencia | La orden pasa a "Pagada" con saldo cero |
| 7 | Recepción | Intentar registrar otro pago en la orden pagada | Se rechaza |
| 8 | Recepción | Abrir una orden en reparación e intentar cobrar | Se rechaza: la orden todavía no está terminada |
| 9 | Recepción | En otra orden terminada, elegir Mercado Pago (saldo completo) | Se crea un cobro "Pendiente" con enlace de pago; el importe queda reservado |
| 10 | Recepción | Intentar un segundo cobro de Mercado Pago en la misma orden | Se rechaza (ya hay uno pendiente) |
| 11 | Recepción | Abrir el enlace y pagar con la cuenta de prueba; volver y pulsar "Actualizar estado" | El cobro pasa a "Aprobado" y la orden a "Pagada" |
| 12 | Recepción | Repetir "Actualizar estado" | No cambia nada (no se cuenta dos veces) |
| 13 | Recepción | Quitar `MP_ACCESS_TOKEN`, reiniciar la API e intentar un cobro de Mercado Pago | Mensaje claro; no se registra ningún pago; el efectivo sigue funcionando |
| 14 | Recepción | Generar el ticket de una orden pagada | Se muestra el comprobante con folio `TK-…`, datos del taller, cliente, vehículo, placas, kilometraje, servicios, refacciones, mano de obra, subtotales, total, métodos, estado del pago y fecha |
| 15 | Recepción | Pulsar "Imprimir" | Se abre el diálogo de impresión del sistema con el comprobante |
| 16 | Recepción | Generar de nuevo el ticket de la misma orden | Se muestra el mismo folio |
| 17 | Recepción | Generar el ticket de una orden con pago parcial | El ticket indica "Pago parcial", lo pagado y el saldo |
| 18 | Recepción | Intentar anular un pago aprobado | La opción no se ofrece (solo administración) |
| 19 | Administrador | Anular un pago aprobado con motivo y confirmar | Queda "Anulado" con su motivo; el saldo de la orden se recupera |
| 20 | Recepción | Cancelar un cobro de Mercado Pago pendiente (con confirmación) | Queda "Cancelado" y libera el importe reservado |
| 21 | Recepción | Entregar una orden con saldo pendiente | Aviso con el saldo y confirmación; luego se entrega y sigue "por cobrar" |
| 22 | Recepción | Abrir el listado de pagos y filtrar por método o fecha | Solo coincidencias, con el total aprobado del filtro |
| 23 | Administrador | Volver al panel y actualizar | "Cobrado hoy", "Saldo pendiente" y "Órdenes por cobrar" reflejan lo hecho |
| 24 | Mecánico | Intentar abrir pagos, tickets o el panel (por ejemplo, llamar `/api/payments`) | `403 FORBIDDEN`; el menú no ofrece esas secciones |

## 3. Recorrido por la API (automatizable)

Con los tokens de cada rol (`POST /api/auth/login`):

1. `GET /api/dashboard` (administrador) → los cinco bloques; con recepción o mecánico → `403`.
2. `POST /api/orders/:id/payments` con `amount` mayor al saldo → `409 PAYMENT_EXCEEDS_BALANCE`; en una orden `RECIBIDO` → `409 PAYMENT_ORDER_NOT_PAYABLE`.
3. Dos `POST` simultáneos que juntos superan el saldo → exactamente uno `201` y el otro `409`; `paid` nunca supera `total`.
4. `POST /api/orders/:id/payments/mercado-pago` sin `MP_ACCESS_TOKEN` → `503` y ningún pago nuevo en `GET /api/orders/:id/payments`.
5. `POST /api/payments/:id/void` con recepción → `403`; con administración y sin `reason` → `400`.
6. `POST /api/orders/:id/ticket` dos veces → `201` y luego `200` con el mismo `id` y `folio`.
7. Comprobar que `GET /api/dashboard` coincide con los listados de los módulos (órdenes por estado, mantenimientos con `GET /api/maintenance`, alertas con `GET /api/parts/alerts`).

## 4. Pruebas automatizadas

```text
npm test                    # unitarias, integración y contrato (contra motorix_test, con Mercado Pago simulado)
cd client && flutter analyze && flutter test
```

**Esperado**: todo en verde, incluidas las pruebas del saldo y los estados de pago, la concurrencia al cobrar, el cliente de Mercado Pago simulado (aprobado, rechazado, pendiente, error y sin configuración), la generación del ticket (contenido y PDF), el panel con sus permisos y la idempotencia del seed `004`.

## 5. Rendimiento

Con 1 000 órdenes, 1 000 citas, 5 000 refacciones y 5 000 pagos, el panel y los listados de pagos y tickets responden en menos de 2 segundos (SC-007).
