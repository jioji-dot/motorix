# Investigación (Fase 0): Precios de refacciones y cobro completo

No quedaron marcadores `[NEEDS CLARIFICATION]` en el contexto técnico. Esta investigación registra los hechos del código que sustentan el plan y las decisiones de diseño.

## 1. Qué existe ya (hallazgo H-02)

- **Decisión**: no se reconstruye nada de lo existente; se protege con pruebas.
- **Hechos verificados en el código**: `parts` ya tiene `category`, `brand`, `purchasePrice` y `salePrice` (migración 003); `order_parts` guarda `unitPrice` (el precio de venta al agregar la línea, en `orderPartService.add`) y `amount` (columna generada); `orderModel.recalculateTotal` suma servicios, mano de obra y refacciones dentro de la transacción de cada cambio de línea; el ticket se arma al consultarlo con las líneas actuales (`ticketBuilder`); `serializePart` ya quita el precio de compra a quien no es administrador; las líneas solo se editan con la orden en curso y solo se cobra en Terminada o Entregada; una orden Terminada solo puede pasar a Entregada.
- **Consecuencia**: el sprint cambia poco código; la mayor parte del trabajo son pruebas que demuestren lo que hoy solo se afirma.

## 2. Ocultar precios al mecánico: serializadores por rol

- **Decisión**: ampliar `services/serializers.js` con proyecciones por rol para el pedido (detalle y listado), la línea de refacción, el historial del vehículo y la refacción. Se aplican en la capa de servicio, justo antes de responder, en todas las rutas que hoy devuelven esos datos (ver el punto 8 y [contracts/api.md](contracts/api.md)).
- **Justificación**: ya existe el patrón (`serializePart`) y el principio IV exige validar en el backend; un solo módulo evita olvidar una ruta y se prueba sin base de datos. Las rutas que escriben líneas devuelven el detalle de la orden, así que también aplican el serializador.
- **Alternativas descartadas**: filtrar en los controladores (duplica la regla, viola el principio II); consultas SQL distintas por rol (duplica las consultas y complica el mantenimiento); ocultar solo en la interfaz (no es seguridad, principio IV).
- **Qué se quita al mecánico**: de la refacción, `purchasePrice` y `salePrice`; del pedido, `total`, y de cada línea de refacción, `unitPrice` y `amount`; del historial del vehículo, `total` y los mismos campos de las líneas. Los servicios y la mano de obra conservan sus importes (aclaración del 2026-11-03).
- **Riesgo**: el campo `total` desaparece del listado del mecánico; las pruebas y pantallas que lo leen se ajustan y se registran como hallazgo H-07.

## 3. Límite de importes

- **Decisión**: un módulo puro `services/orderLimits.js` calcula en centavos el importe de la línea y el nuevo total, y rechaza con `409 AMOUNT_LIMIT_EXCEEDED` si alguno supera 9,999,999,999 centavos (99,999,999.99), con el límite inclusivo. Se invoca dentro de la transacción que ya bloquea la orden, antes de escribir, en los cambios que aumentan el total (agregar o cambiar la cantidad de una refacción, agregar o cambiar un servicio o mano de obra).
- **Justificación**: hoy un importe fuera de rango termina en un error de la base; la columna `total` es `DECIMAL(10,2)` y el máximo que cabe es justo 99,999,999.99. Validar antes da un mensaje claro y evita dejar datos a medias. La cantidad ya tiene límite (1 a 1,000,000).
- **Alternativas descartadas**: confiar en el error de la base (mensaje confuso y sin rollback limpio del movimiento de inventario si fallara a medias); una restricción `CHECK` nueva (exigiría migración y no mejora el mensaje).
- **Aritmética**: centavos como enteros; el producto cantidad por precio no pierde precisión por debajo del límite y, por encima, solo importa que supere el máximo.

## 4. Venta menor al costo

- **Decisión**: en `partService`, al crear o al cambiar alguno de los dos precios, si el precio de venta efectivo es menor al de compra y la solicitud no trae `confirmBelowCost: true`, responder `409 PRICE_BELOW_COST`; con la confirmación, guardar. Editar otros campos sin cambiar los precios no exige confirmación. La confirmación no se guarda.
- **Justificación**: cumple FR-004 sin columnas nuevas, tanto desde la interfaz como desde una petición directa. El formulario muestra un diálogo de confirmación y reenvía con la confirmación (principio VIII: las acciones riesgosas piden confirmación).
- **Alternativas descartadas**: advertencia solo en la interfaz (no protege la API); rechazo definitivo (impediría ventas sin ganancia legítimas); guardar un indicador en la base (sin necesidad y sin historial que lo use).

## 5. Atomicidad (FR-024)

- **Decisión**: se conserva la transacción actual de `orderPartService` (movimiento de inventario, línea y recálculo del total juntos) y se agrega una prueba que fuerza un fallo después del movimiento y comprueba que no quedó ningún cambio.
- **Justificación**: el comportamiento ya existe; falta la prueba que lo demuestre.

## 6. Redondeo

- **Decisión**: no se cambia nada. El importe de una línea de refacción es exacto (cantidad entera por precio de dos decimales). La mano de obra (horas con dos decimales por tarifa) se redondea con `ROUND(…, 2)` de la base. Se agregan pruebas de valores límite de la mano de obra.
- **Justificación**: confirma el hallazgo H-08: el «redondeo» de las refacciones no existe y la especificación se corrigió en consecuencia.

## 7. Migración y datos de ejemplo

- **Decisión**: no se crea la migración 005 ni seeds nuevos.
- **Justificación**: ninguna decisión exige columnas o restricciones nuevas; las migraciones 003 y 004 ya dejan los precios con restricciones `CHECK` y `NOT NULL`. Los seeds actuales tienen una orden Terminada con refacción y pago parcial (OS-000005, total 3,580.00, pagado 1,500.00) y una Entregada pagada (OS-000006). Una prueba comprueba que cargar los seeds dos veces no duplica registros.
- **Si el diseño cambiara**: cualquier migración sería aditiva y numerada (`005_...sql`), sin tocar las anteriores.

## 8. Rutas, pruebas y pantallas afectadas por el cambio del mecánico (H-07)

**Rutas del backend que cambian su respuesta para el mecánico** (detalle en [contracts/api.md](contracts/api.md)): `GET /api/parts`, `GET /api/parts/:id`, `GET /api/orders`, `GET /api/orders/:id`, `PATCH /api/orders/:id`, `POST /api/orders/:id/status`, las altas, cambios y bajas de servicios, mano de obra y refacciones de una orden (todas devuelven el detalle) y `GET /api/vehicles/:id/history`. No cambian: pagos y tickets (ya le responden 403), el panel de control (solo administrador) y los movimientos de inventario (no incluyen precios).

**Pruebas del backend candidatas a ajustar** (se confirman al escribir las pruebas nuevas): `tests/unit/serializers.test.js` (se amplía), `tests/integration/parts.test.js`, `tests/integration/orderParts.test.js`, `tests/integration/orders.read.test.js`, `tests/integration/orders.lines.test.js`, `tests/integration/vehicleHistory.test.js` y los contratos `parts.contract`, `parts.alerts.contract`, `orderParts.contract`, `orders.read.contract`, `orders.lines.contract` y `vehicleHistory.contract`.

**Pantallas candidatas** (el cliente deja de mostrar lo que no llega): `orders_screen.dart` (columna del total), `order_detail_screen.dart` (precio y total), `parts_screen.dart` y `part_detail_screen.dart` (precio de venta), `part_picker_dialog.dart` (precio junto al código) y `vehicle_history_screen.dart` (total). Pruebas de Flutter candidatas: `orders_screen_test`, `order_parts_test`, `order_work_test`, `parts_screen_test`, `parts_alerts_test` y `vehicle_history_test`.

**Regla de registro**: cada prueba que cambie se anota en el documento de calidad con su razón; ninguna se borra ni se debilita sin ese registro (SC-006).

## 9. Pruebas nuevas (resumen; el detalle por historia lo da `/speckit.tasks`)

- **Unitarias**: `serializers` por rol (pedido, listado, historial, refacción), `orderLimits` (límite inclusivo y centavos) y la regla de venta menor al costo.
- **Integración y contrato**: precio guardado y total tras un cambio de precio (con concurrencia), totales con mano de obra redondeada, límite del total con servicios y mano de obra, orden Cancelada, pago por el total con refacciones y cobros simultáneos, ticket sin cambios tras cambiar precios, compatibilidad con los pagos y tickets sembrados, recorrido de todas las rutas de lectura con cada rol buscando el precio de compra y de venta, atomicidad con fallo forzado y seeds idempotentes.
- **Frontend**: las pantallas del mecánico no muestran precios ni total; el formulario de refacción pide confirmación ante una venta menor al costo.
- **Orden de trabajo**: en cada historia, las pruebas se escriben primero y se comprueba que fallan antes de escribir el código.
