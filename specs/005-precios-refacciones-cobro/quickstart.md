# Guía de validación rápida: Sprint 5

Guion para comprobar de extremo a extremo el cobro con refacciones. Los comandos de la API se ejecutan contra la API real; el detalle de cada ruta y de los errores está en [contracts/api.md](contracts/api.md) y el de las reglas en [data-model.md](data-model.md).

## Requisitos previos

- MySQL 8.0 local con las bases de desarrollo y de pruebas (`motorix_sdd` y `motorix_sdd_test` en este entorno) y el archivo `.env` creado (ver `database/README.md`).
- Migraciones 001 a 004 aplicadas y seeds cargados (`npm run seed`). **El Sprint 5 no agrega migración ni seeds.**
- Cuentas de ejemplo de administrador, recepción y mecánico (contraseñas en el `.env`, solo local).

## 1. Preparar y ejecutar

```powershell
cd server
npm install
npm start        # API en http://localhost:3000/api
```

En otra terminal: `cd client` y `flutter run -d chrome`.

## 2. Escenarios de validación

Usa una base de pruebas (`motorix_test`) para no gastar los datos de demostración, o restaura los seeds al terminar.

| # | Escenario | Resultado esperado |
|---|-----------|--------------------|
| 1 | Administrador crea una refacción con categoría, marca, compra 100.00 y venta 150.00 | Se guarda; la consulta devuelve los cuatro datos |
| 2 | Precio inválido: negativo, `abc`, 12.345 o 100,000,000.00 | `400 VALIDATION_ERROR` con el precio que falla y el valor permitido |
| 3 | Venta menor al costo: compra 100.00 y venta 80.00 sin confirmar | `409 PRICE_BELOW_COST`; con `confirmBelowCost: true`, se guarda |
| 4 | Precio de venta 0.00 | Se guarda (pieza sin cargo) |
| 5 | Agregar una refacción de 150.00 a una orden en curso y cambiar después su precio a 999.00 | La línea sigue en 150.00 y el total no cambia; una línea nueva en otra orden toma 999.00 |
| 6 | Total con refacciones: servicios 850.00 + mano de obra (2.5 h × 99.99 = 249.98) + refacciones | El total es la suma, con la mano de obra al centavo más cercano |
| 7 | Límite: agregar una línea cuyo importe supere 99,999,999.99 | `409 AMOUNT_LIMIT_EXCEEDED` y la orden, la línea y el inventario no cambian |
| 8 | Cobro: terminar una orden con refacciones, pagar el saldo y generar el ticket | Pago por el saldo; ticket con cada refacción (cantidad, precio unitario, importe) y subtotal igual al total |
| 9 | Cambiar el precio de todas las refacciones después del cobro | El pago, el ticket y el total de la orden cobrada no cambian |
| 10 | Mecánico: consultar inventario, listado y detalle de órdenes, historial del vehículo y alta de una refacción | No recibe `purchasePrice`, `salePrice`, `unitPrice`, `amount` ni `total`; los pagos y el ticket responden `403` |
| 11 | Recepción: las mismas consultas | Recibe el precio de venta y los importes, nunca `purchasePrice` |
| 12 | Orden Cancelada | Conserva líneas, precios y total; no admite pagos |

## 3. Comprobaciones en la interfaz (las hace una persona)

- Como mecánico: las pantallas de órdenes, detalle de orden, refacciones, selector de refacción e historial del vehículo no muestran ningún precio ni total, y no aparecen ceros ni marcadores.
- Como administrador: guardar una venta menor al costo abre un aviso de confirmación; al confirmar, se guarda.
- Como recepción: cobrar una orden Terminada con refacciones y generar su ticket en menos de 2 minutos (SC-004), medidos con cronómetro desde el detalle de la orden hasta el ticket.

## 4. Ejecutar las pruebas automatizadas

```powershell
cd server
npm test            # backend completo; línea base antes del sprint: 75 suites y 1240 pruebas
cd ../client
flutter test        # frontend completo; línea base antes del sprint: 242 pruebas
flutter analyze lib
```

Ninguna prueba de los Sprints 1 a 4 debe pasar de verde a rojo, salvo las que cambien por un contrato declarado (FR-008 y FR-003), que se registran como hallazgo.
