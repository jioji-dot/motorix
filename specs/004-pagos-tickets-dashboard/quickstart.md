# Guía de validación rápida: Sprint 4

Guía para comprobar de extremo a extremo los pagos, el ticket y el panel de control. Los detalles de campos y respuestas están en [data-model.md](data-model.md) y [contracts/api.md](contracts/api.md).

## Requisitos previos

- Sprints 1 a 3 funcionando (ver sus `quickstart.md`): entorno creado, `.env` y migraciones 001 a 003 aplicadas.
- Cuentas iniciales `admin`, `recepcion`, `mecanico` y `mecanico2`.
- Para el escenario de Mercado Pago real: una credencial de **prueba** en `MP_ACCESS_TOKEN` (cuenta de vendedor de prueba de Mercado Pago). Sin ella, el escenario 12 comprueba el mensaje de configuración y el resto del sprint se valida con la pasarela simulada de las pruebas automáticas.

## 1. Preparar la base de datos

1. Aplicar la migración nueva en la base principal y en la de pruebas con `database/scripts/aplicar-migraciones.ps1 -Base <base>`. **Esperado**: tablas `payments` y `tickets`; la 001, 002 y 003 aparecen como "Ya aplicada".
2. Cargar los datos de ejemplo con `npm run seed` (en `server/`). **Esperado**: pagos de ejemplo (una orden Entregada cobrada completa, una Terminada con pago parcial y un pago de Mercado Pago Rechazado) y el ticket de la orden Entregada.
3. Repetir el paso 2. **Esperado**: sin errores y sin duplicados.

## 2. Ejecutar la aplicación

1. Backend: `cd server`, `npm start`. Frontend: `cd client`, `flutter run`.
2. **Esperado**: el administrador ve la sección **Panel de control**; recepción ve pagos y ticket en el detalle de las órdenes Terminadas o Entregadas; el mecánico no ve ni una cosa ni la otra.

## 3. Escenarios de validación

| # | Escenario | Pasos | Resultado esperado |
|---|-----------|-------|--------------------|
| 1 | Pago en efectivo | Como recepción, abrir una orden Terminada y registrar un pago en efectivo por parte del total | Queda Pagado; el resumen muestra pagado, saldo y estado "Pago parcial" |
| 2 | Pago por el saldo | Registrar un segundo pago con tarjeta por el saldo exacto | La orden queda Pagada y ya no admite más pagos |
| 3 | Importe inválido | Registrar cero, negativo, con tres decimales y mayor al saldo | Rechazo con mensaje claro; el de saldo indica el saldo disponible |
| 4 | Orden no cobrable | Intentar registrar un pago en una orden en curso o cancelada | Rechazo explicando que debe estar Terminada o Entregada |
| 5 | Métodos y referencia | Registrar pagos con transferencia (con referencia), tarjeta y efectivo; probar un método inválido | Cada pago conserva su método; el inválido se rechaza; no se pide ningún dato de tarjeta |
| 6 | Pagos simultáneos | Dos cobros a la vez que juntos exceden el saldo | Se aplica uno y el otro recibe el aviso de saldo insuficiente |
| 7 | Mecánico sin acceso | Como mecánico, consultar o registrar pagos y tickets | Rechazo (403) |
| 8 | Generar el ticket | Como recepción, generar el ticket de una orden Terminada con servicios, mano de obra, refacciones y pagos | Folio único `TK-…` y vista con taller, cliente, vehículo, placas, kilometraje, líneas, subtotal, total, método y estado de pago |
| 9 | Regenerar | Generar de nuevo el ticket de la misma orden tras otro pago | Mismo folio; método y estado de pago actualizados |
| 10 | Ticket sin pagos o de orden no elegible | Generar el ticket de una orden sin pagos y de una en curso | Sin pagos: estado "Pendiente"; en curso: rechazo |
| 11 | Imprimir | Pulsar Imprimir en el ticket | Se abre la página del ticket en el navegador con el diálogo de impresión; sin menús ni botones; un token vencido o alterado no abre nada |
| 12 | Mercado Pago sin configurar | Sin `MP_ACCESS_TOKEN`, iniciar un pago con Mercado Pago | Mensaje claro; no se crea ningún pago; se puede cobrar con otro método |
| 13 | Mercado Pago en sandbox | Con credencial de prueba, iniciar un pago con Mercado Pago | Pago Pendiente con enlace y código QR; el importe queda reservado |
| 14 | Resultado de Mercado Pago | Pagar con una tarjeta de prueba y pulsar "Actualizar estado" (o recibir la notificación) | El pago pasa a Pagado y el saldo se actualiza; repetir la actualización no cambia nada |
| 15 | Pago rechazado o cancelado | Cancelar (con confirmación) un pago Pendiente | Pasa a Cancelado, libera el saldo y se conserva en el historial |
| 16 | Notificaciones falsas o repetidas | Enviar a la ruta pública una notificación inexistente, repetida y sin formato | 200 sin cambios en las dos primeras y 400 en la mal formada; ningún pago ajeno cambia |
| 17 | Panel del administrador | Abrir el Panel de control | Órdenes por estado, por cobrar, citas de hoy y próximas, mantenimientos vencidos y próximos, alertas de inventario y cobrado hoy y en el mes |
| 18 | Coincidencia con los módulos | Comparar cada cifra del panel con su módulo | Todas coinciden |
| 19 | Panel sin acceso | Entrar al panel como recepción y como mecánico | La sección no aparece y la API responde 403 |
| 20 | Panel sin datos y con error | Abrir el panel con una base sin pagos; simular un fallo del servidor | Ceros y estados vacíos; en el fallo, mensaje en español con "Reintentar" |
| 21 | Datos de ejemplo | Abrir Panel, una orden Entregada y una Terminada tras instalar | Hay pagos, ticket y cifras sin capturar nada a mano |

## 4. Ejecutar las pruebas automatizadas

1. Backend: `cd server`, `npm test`. **Esperado**: todas en verde, incluidas la concurrencia de pagos, la idempotencia de notificaciones, el contenido del ticket, el esquema sin datos de tarjeta y la coincidencia del panel; las de integración usan la base `*_test` y la pasarela simulada (nunca llaman a Mercado Pago).
2. Frontend: `cd client`, `flutter test`. **Esperado**: todas en verde, incluida la prueba de diseño adaptable con las pantallas nuevas.

## 5. Revisión de seguridad

- Ninguna ruta nueva responde sin token, salvo la notificación de Mercado Pago (verificada contra la API) y la página de impresión (token de 5 minutos); la matriz de permisos de `contracts/api.md` se comprueba con una prueba por rol.
- `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` no aparecen en el repositorio, en las respuestas ni en los registros; `.env.example` los incluye sin valor.
- El esquema no tiene columnas de datos de tarjeta y la referencia del pago rechaza números con forma de tarjeta.
- Los errores no devuelven trazas ni detalles internos.
