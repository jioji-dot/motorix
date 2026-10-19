# Guía de validación rápida: Sprint 2

Guía para comprobar de extremo a extremo citas y órdenes de servicio. Los detalles de campos y respuestas están en [data-model.md](data-model.md) y [contracts/api.md](contracts/api.md).

## Requisitos previos

- Sprint 1 funcionando (ver `specs/001-base-clientes-vehiculos/quickstart.md`): entorno creado, `.env` y migración 001 aplicada.
- Cuentas iniciales `recepcion`, `mecanico` y `admin`; para los escenarios con dos mecánicos, el seed del Sprint 2 agrega el mecánico de ejemplo `mecanico2`.

## 1. Preparar la base de datos

1. Aplicar la migración nueva en la base principal y en la de pruebas con `database/scripts/aplicar-migraciones.ps1 -Base <base>`. **Esperado**: tablas `appointments`, `service_orders`, `order_services`, `order_labor` y `order_status_history`; la 001 aparece como "Ya aplicada".
2. Cargar los datos de ejemplo con `npm run seed` (en `server/`). **Esperado**: citas y órdenes en distintos estados, repartidas entre dos mecánicos.
3. Repetir el paso 2. **Esperado**: sin errores y sin registros duplicados (FR-027).

## 2. Ejecutar la aplicación

1. Backend: `cd server`, `npm start`. Frontend: `cd client`, `flutter run`.
2. **Esperado**: la barra lateral muestra **Citas** y **Órdenes de servicio** a recepción y administración, y solo **Órdenes de servicio** al mecánico.

## 3. Escenarios de validación

| # | Escenario | Pasos | Resultado esperado |
|---|-----------|-------|--------------------|
| 1 | Agendar y consultar cita | Como `recepcion`, registrar una cita futura para un cliente y su vehículo | Cita PENDIENTE visible en la agenda; el filtro por fecha y estado la encuentra |
| 2 | Vehículo ajeno | Elegir un vehículo de otro cliente | Rechazo indicando que el vehículo no es de ese cliente |
| 3 | Fecha pasada y duplicado | Agendar en el pasado; repetir fecha y hora del mismo vehículo | Rechazo por fecha pasada; aviso y confirmación por duplicado |
| 4 | Confirmar y modificar | Confirmar la cita y cambiar su hora | CONFIRMADA con la hora nueva |
| 5 | Crear orden desde la cita | Crear la orden desde la cita confirmada con mecánico y kilometraje | Orden RECIBIDO con folio; cita EN_PROCESO; kilometraje del vehículo actualizado |
| 6 | Cancelar cita con orden | Intentar cancelar esa cita | Rechazo: primero debe cancelarse la orden |
| 7 | Kilometraje | Crear una orden con un kilometraje menor al del vehículo; luego mayor a 1,500,000 | Rechazo sin corrección explícita; rechazo por fuera de rango |
| 8 | Mecánico obligatorio | Crear una orden sin mecánico o con uno inactivo | Rechazo |
| 9 | Mis órdenes | Entrar como `mecanico` y como `mecanico2` | Cada uno ve solo las suyas; abrir una ajena por su dirección da 403 |
| 10 | Documentar el trabajo | Como mecánico, registrar diagnóstico, dos servicios y una mano de obra, observaciones y recomendaciones | Total = suma de servicios y mano de obra |
| 11 | Secuencia de estados | Avanzar RECIBIDO → DIAGNOSTICO → EN_REPARACION; intentar saltar a ENTREGADO | Cada avance se guarda en el historial; el salto se rechaza mostrando las transiciones permitidas |
| 12 | Terminar con validación | Intentar TERMINADO sin diagnóstico o sin servicios | Rechazo indicando qué falta; con todo completo, pasa a TERMINADO |
| 13 | Esperando refacción | Desde EN_REPARACION ir a ESPERANDO_REFACCION y volver | Ambos cambios permitidos |
| 14 | Entregar | El mecánico intenta ENTREGADO; luego `recepcion` lo hace con confirmación | Rechazo al mecánico; recepción entrega, la cita queda COMPLETADA y la orden ya no se edita |
| 15 | Cancelar orden | Como `recepcion`, cancelar una orden en curso con motivo; el mecánico intenta lo mismo | Orden CANCELADA y cita vuelve a CONFIRMADA; el mecánico recibe 403; sin motivo, 400 |
| 16 | Cambio simultáneo | Dos pestañas cambian el mismo estado a la vez | Una aplica y la otra recibe aviso de recargar |
| 17 | Datos de ejemplo | Abrir Citas y Órdenes tras instalar | Hay información sin capturar nada a mano |

## 4. Ejecutar las pruebas automatizadas

1. Backend: `cd server`, `npm test`. **Esperado**: todas en verde, incluida la prueba exhaustiva de transiciones; las de integración usan la base `*_test`.
2. Frontend: `cd client`, `flutter test`. **Esperado**: todas en verde, incluida la prueba de diseño adaptable con las secciones nuevas.

## 5. Revisión de seguridad

- Ninguna ruta nueva responde sin token; la matriz de permisos de `contracts/api.md` se comprueba con una prueba por rol.
- Un mecánico nunca recibe órdenes de otro, ni por el listado ni por el detalle.
- Los errores no devuelven trazas ni detalles internos.
