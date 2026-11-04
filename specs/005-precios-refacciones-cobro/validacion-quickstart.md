# Validación del quickstart: Sprint 5

**Fecha**: 2026-11-03

**Cómo se validó**: se arrancó la API real (`node server.js`, puerto 3055) sobre MySQL real, con la base de pruebas del entorno (`motorix_sdd_test`) vaciada y sembrada con los seeds, para no gastar los datos de demostración de la base de desarrollo. Un guion por HTTP ejecutó los 12 escenarios de [quickstart.md](quickstart.md) con las cuentas de ejemplo de administración, recepción y mecánico. El guion es temporal y no forma parte del repositorio.

| # | Escenario | Resultado |
|---|-----------|-----------|
| 1 | Registrar precios | Alta `201`; la consulta devuelve categoría, marca, compra 100.00 y venta 150.00 |
| 2 | Precios inválidos | `-1`, `abc`, `12.345` y `100000000` responden `400 VALIDATION_ERROR` |
| 3 | Venta menor al costo | Sin confirmar `409 PRICE_BELOW_COST`; con `confirmBelowCost: true`, `201` |
| 4 | Precio de venta 0.00 | Se guarda (`201`) |
| 5 | Instantánea del precio | La línea vieja sigue en 150.00 y el total en 3105.00 tras cambiar el precio a 999.00; la línea nueva toma 999.00 |
| 6 | Total con refacciones | Mano de obra 2.5 h × 99.99 = 249.98; el total (2348.98) es la suma de las líneas |
| 7 | Límite de importes | `409 AMOUNT_LIMIT_EXCEEDED`; los movimientos de inventario (1) y el total (2348.98) no cambian |
| 8 | Cobro y ticket | Pago por el saldo (2080.00); ticket con 1 refacción y subtotal 3580.00 igual al total |
| 9 | Cambiar precios tras el cobro | Con 18 refacciones a 777.00, el pago, el ticket y el total quedan idénticos |
| 10 | Mecánico sin precios | Sin `salePrice`, `unitPrice`, `purchasePrice` ni total en inventario, órdenes e historial; agrega una refacción (`201`); pagos y ticket responden `403` |
| 11 | Recepción | Recibe el precio de venta y el total; nunca el precio de compra |
| 12 | Orden Cancelada | Conserva su estado, su total y sus líneas; un pago responde `409 ORDER_NOT_PAYABLE` |

**Resultado**: **12 de 12 escenarios correctos**.

**Alcance**: esta comprobación cubre la API y los datos. Los tiempos de uso de las pantallas (SC-004) y las capturas de la interfaz se miden y se toman a mano en la aplicación (tarea T057) y se registran en el documento de aseguramiento de la calidad.

**Observación del primer intento**: el escenario 10 falló la primera vez por un error del guion, que intentó agregar al mecánico una refacción que ya estaba en esa orden (`409 DUPLICATE_ORDER_PART`); con otra refacción pasó. No fue un defecto del sistema.
