# Validación del quickstart: Sprint 7

**Fecha**: 2026-11-25 · **Quién ejecutó**: Claude Code (a petición de Jorge Francisco Dominguez Ramirez) · **Entorno**: API real (`node server/server.js`, puerto 3099) sobre la base de pruebas `motorix_sdd_test` (MySQL 8.0, puerto 3307) con las migraciones 001 a 006 y los seeds 001 a 010 cargados; cuentas de ejemplo de administrador, recepción y mecánico.

**Método**: un guion de Node ejecuta cada escenario del [quickstart](quickstart.md) por HTTP contra la API real con los tres roles y compara con la base de datos cuando el escenario lo pide (por ejemplo, la suma de los pagos). Antes de validar se vació la base de pruebas y se cargaron los seeds dos veces. El guion no se guarda en el repositorio porque lee las contraseñas del `.env` local.

## Resultado por escenario

| # | Escenario | Resultado | Evidencia obtenida |
|---|-----------|-----------|--------------------|
| 1 | Administrador lee y cambia los datos del taller | ✅ Cumple | Valores de los seeds leídos; recepción y mecánico reciben `403` en lectura y escritura; el administrador guarda el teléfono |
| 2 | Ticket con instantánea y cambio posterior | ✅ Cumple | El ticket 1 conserva `5599998888` tras cambiar el teléfono; el ticket 2 trae `5500001111`; un ticket anterior al sprint (sin instantánea) se arma con los datos vigentes |
| 3 | Cambiar los márgenes de «Próximo» | ✅ Cumple | Próximos: 2 → 4 con 365 días y 100,000 km, idénticos en el panel, la lista de Mantenimientos y los avisos; 0 y 400 días responden `400`; se restauraron 15 y 500 |
| 4 | Catálogo de tipos de servicio | ✅ Cumple | `201` al crear; `409 SERVICE_TYPE_DUPLICATE` sin distinguir mayúsculas; el tipo desactivado no se ofrece a recepción y el administrador lo sigue viendo; recepción no crea (`403`) |
| 5 | Propuesta del próximo mantenimiento | ✅ Cumple | Fecha de hoy más 180 días y kilometraje 40,000 + 5,000 = 45,000 |
| 6 | Ticket con «Próximo servicio» | ✅ Cumple | Trae nombre, fecha y kilometraje; cambiar el intervalo del catálogo después no lo altera; sin tipo es `null` |
| 7 | Ingresos por periodo | ✅ Cumple | El total (6,202.50) es igual a la suma de los pagos Pagados en la base de datos; un rango de 400 días responde `400` |
| 8 | Servicios, productividad, refacciones y rotación | ✅ Cumple | Servicios: 6; órdenes terminadas 5 (igual al conteo directo en la base); refacciones: 3 (margen total 1,250.00); rotación: 5 |
| 9 | Aceptación de términos validada en el servidor | ✅ Cumple | `403 TERMS_NOT_ACCEPTED` en clientes; `/auth/me` y `/terms/current` responden; tras aceptar la versión 1 todo funciona |
| 10 | Versión nueva de los términos | ✅ Cumple | La versión 2 se publica; recepción vuelve a recibir `403` hasta aceptar; aceptaron 1 y quedaron 3 pendientes; recepción no puede publicar |
| 11 | Bitácora de acciones sensibles | ✅ Cumple | Entradas de cambio de rol, precio de refacción, configuración, tipos de servicio y términos; sin contraseñas ni hashes; recepción `403`; `DELETE` responde `404` |
| 12 | Inicios de sesión fallidos y bloqueo | ✅ Cumple | 5 `LOGIN_FAILED` y 1 `ACCOUNT_LOCKED` con el identificador escrito; la contraseña no aparece |
| 13 | Inactividad | ✅ Cumple | 29 minutos siguen vigentes; 31 minutos → `401 SESSION_INACTIVE`; `GET /notifications` no refresca la marca; volver a iniciar sesión la restablece. La marca se movió en la base de pruebas para simular el tiempo |
| 14 | Encabezados de seguridad | ✅ Cumple | `nosniff`, `DENY`, `no-referrer` y `no-store` y sin `X-Powered-By` en respuestas correctas, de error y de rutas inexistentes |
| 15 | Exportar a CSV | ✅ Cumple | 7 filas igual que la pantalla (2 periodos, 3 métodos, encabezado y total); BOM `EF BB BF`; `Content-Disposition` con el nombre del reporte y el rango; un enlace inválido responde `401`. El vencimiento a 60 segundos y la neutralización de fórmulas los cubren `reports.export.test.js` y `csv.test.js` |
| 16 | Inyección en búsquedas | ✅ Cumple | 6 listados × 3 textos de ataque: `200` y sin filas; la tabla de clientes sigue intacta |
| 17 | Cargar los seeds dos veces | ✅ Cumple | Ninguna de las 21 tablas cambia de conteo en la segunda carga (1 aviso a cliente, 8 órdenes, 9 citas) |
| 18 | Tiempo de cada reporte | ✅ Cumple | Con los datos de ejemplo cada reporte tarda unos milisegundos (meta: menos de 3 s). Con un año de datos (3,000 órdenes) lo mide la prueba automatizada `reports.performance.test.js`, que pasa |

**Resumen**: 18 de 18 escenarios cumplidos, ninguno con defecto abierto. Dos precisiones del método (escenarios 13 y 15), sin cambio de resultado.

## Comprobaciones de la interfaz

Las verifican las pruebas de Flutter (57 nuevas, todas en verde): aceptación de términos y rechazo, cierre por 30 minutos de inactividad (con mensaje), configuración del taller y márgenes con sus límites, tipos de servicio, bitácora, publicación de términos, reportes con sus estados y exportación, tipo de servicio en la línea de la orden, «Usar propuesta» y la línea «Próximo servicio» del ticket. Las capturas de pantalla están en `docs/evidencias/sprint-7/` (2026-11-25); al tomarlas se agregaron los filtros de fecha y usuario de la bitácora que faltaban (hallazgo H-16).
