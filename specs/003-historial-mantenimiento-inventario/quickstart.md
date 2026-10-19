# Guía de validación rápida: Sprint 3

Guía para comprobar de extremo a extremo el historial, los mantenimientos y el inventario. Los detalles de campos y respuestas están en [data-model.md](data-model.md) y [contracts/api.md](contracts/api.md).

## Requisitos previos

- Sprints 1 y 2 funcionando (ver sus `quickstart.md`): entorno creado, `.env` y migraciones 001 y 002 aplicadas.
- Cuentas iniciales `admin`, `recepcion`, `mecanico` y `mecanico2`.

## 1. Preparar la base de datos

1. Aplicar la migración nueva en la base principal y en la de pruebas con `database/scripts/aplicar-migraciones.ps1 -Base <base>`. **Esperado**: tablas `parts`, `inventory_movements`, `order_parts` y `maintenance`, y la columna `serviceMileage` en `service_orders`; la 001 y la 002 aparecen como "Ya aplicada".
2. Cargar los datos de ejemplo con `npm run seed` (en `server/`). **Esperado**: refacciones en todos los niveles de stock (una agotada y dos en stock bajo), refacciones usadas en las órdenes de ejemplo y mantenimientos en cada clasificación.
3. Repetir el paso 2. **Esperado**: sin errores y sin duplicados.
4. Comprobar la invariante. **Esperado**: para cada refacción, `stock` es igual a la suma de sus movimientos.

## 2. Ejecutar la aplicación

1. Backend: `cd server`, `npm start`. Frontend: `cd client`, `flutter run`.
2. **Esperado**: la barra lateral muestra **Inventario** y **Mantenimientos** a los tres roles; desde el detalle de un vehículo se abre su **Historial**.

## 3. Escenarios de validación

| # | Escenario | Pasos | Resultado esperado |
|---|-----------|-------|--------------------|
| 1 | Historial del vehículo | Abrir el historial de un vehículo con órdenes terminadas, entregadas, en curso y canceladas | Solo aparecen las terminadas y entregadas, de la más reciente a la más antigua, con kilometraje, servicios, mano de obra, refacciones, observaciones y recomendaciones |
| 2 | Kilometraje del servicio | Como mecánico asignado, registrar el kilometraje del servicio en una orden en curso (menor al de entrada y luego válido) | Rechazo del menor; el válido se guarda, aparece en el historial y sube el kilometraje del vehículo |
| 3 | Programar mantenimiento | Desde una orden terminada, programar "Cambio de aceite" por fecha y kilometraje | Se precargan fecha y kilometraje del servicio; queda pendiente |
| 4 | Validaciones del mantenimiento | Guardar sin próxima fecha ni kilometraje; con fecha anterior al último servicio; con kilometraje no mayor | Rechazo con mensaje claro en cada caso |
| 5 | Reemplazo | Registrar otro "Cambio de aceite" del mismo vehículo | El anterior pasa a Atendido |
| 6 | Mantenimientos próximos y vencidos | Como recepción, abrir Mantenimientos y filtrar | Clasificación correcta con cliente y teléfono; ordenados por urgencia; los atendidos no aparecen |
| 7 | Límites de la clasificación | Mantenimientos a 15 y 16 días, y a 500 y 501 km | 15 días y 500 km: Próximo; 16 días y 501 km: Normal |
| 8 | Recepción solo consulta | Recepción intenta registrar un mantenimiento | Rechazo (403) |
| 9 | Registrar refacción | Como administrador, crear una refacción con existencia inicial; repetir el código | Queda con su stock y un movimiento "Existencia inicial"; el código repetido se rechaza |
| 10 | Entradas y ajustes | Registrar una entrada y un ajuste con diferencia negativa; un ajuste que dejaría el stock negativo | Stock actualizado y movimientos visibles; el último se rechaza indicando el stock disponible |
| 11 | Precio de compra | Consultar refacciones como mecánico y como recepción | No aparece el precio de compra (ni en la pantalla ni en la API); el administrador lo ve |
| 12 | Usar refacciones | Como mecánico asignado, agregar 2 piezas a una orden en curso | El stock baja en 2, hay una salida ligada a la orden y el total de la orden suma las piezas |
| 13 | Stock insuficiente | Agregar más piezas que las disponibles | Rechazo indicando el stock disponible; no cambia nada |
| 14 | Uso simultáneo | Dos mecánicos usan la última pieza a la vez | Solo uno lo logra; el otro recibe stock insuficiente |
| 15 | Editar y quitar | Cambiar la cantidad y luego quitar la refacción (con confirmación) | El inventario registra la diferencia y luego regresa las piezas |
| 16 | Precio congelado | Cambiar el precio de venta de la refacción y abrir una orden anterior | La orden conserva el precio con el que se usó |
| 17 | Órdenes cerradas | Intentar cambiar refacciones en una orden terminada o entregada; otro mecánico o recepción intentan agregarlas | Rechazo (409 o 403) |
| 18 | Cancelar una orden con refacciones | Cancelar una orden con piezas | Las piezas regresan al stock con movimientos que indican la cancelación |
| 19 | Alertas de stock bajo | Abrir Inventario | Resumen con las refacciones en stock bajo y agotadas, filtro y marcas en la lista; al registrar una entrada que supera el mínimo, la alerta desaparece |
| 20 | Advertencia al usar | Buscar una refacción con stock bajo o cero para agregarla | Advertencia visible; no se puede agregar más de lo disponible |
| 21 | Desactivar | Desactivar una refacción (con confirmación) | Deja de ofrecerse para nuevas órdenes y conserva su historial; no se puede eliminar |
| 22 | Datos de ejemplo | Abrir Inventario, Mantenimientos e Historial tras instalar | Hay información sin capturar nada a mano |

## 4. Ejecutar las pruebas automatizadas

1. Backend: `cd server`, `npm test`. **Esperado**: todas en verde, incluidas la clasificación exhaustiva, la invariante del stock y la concurrencia; las de integración usan la base `*_test`.
2. Frontend: `cd client`, `flutter test`. **Esperado**: todas en verde, incluida la prueba de diseño adaptable con las secciones nuevas.

## 5. Revisión de seguridad

- Ninguna ruta nueva responde sin token; la matriz de permisos de `contracts/api.md` se comprueba con una prueba por rol.
- El precio de compra no aparece en ninguna respuesta para mecánico o recepción.
- Los errores no devuelven trazas ni detalles internos.
