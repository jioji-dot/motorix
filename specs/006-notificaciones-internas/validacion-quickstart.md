# Validación del quickstart: Sprint 6

**Fecha**: 2026-11-25 · **Quién ejecutó**: Claude Code (a petición de Jorge Francisco Dominguez Ramirez) · **Entorno**: API real (`node server/server.js`, puerto 3099) sobre la base de pruebas `motorix_sdd_test` (MySQL 8.0, puerto 3307) con las migraciones 001 a 005 y los seeds 001 a 009 cargados; cuentas de ejemplo de administrador, recepción y mecánico.

**Método**: un guion de Node ejecuta cada escenario del [quickstart](quickstart.md) por HTTP contra la API real, con los tres roles, y compara el resultado con lo esperado. Antes de validar se vació la base de pruebas y se cargaron los seeds dos veces. El guion no se guarda en el repositorio porque lee las contraseñas del `.env` local.

## Resultado por escenario

| # | Escenario | Resultado | Evidencia obtenida |
|---|-----------|-----------|--------------------|
| 1 | Administrador consulta `GET /notifications` con los datos de ejemplo | ✅ Cumple | 6 grupos (mantenimiento vencido y próximo, cita del día, stock agotado y bajo, orden detenida); `unread` igual al total (9); `stockAlerts` 3 y `clientsToNotify` 5 |
| 2 | Recepción consulta lo mismo | ✅ Cumple | Grupos: mantenimientos vencidos y próximos, citas de hoy y órdenes detenidas; sin grupos de stock ni `stockAlerts` |
| 3 | Mecánico consulta lo mismo | ✅ Cumple | Un solo grupo `ORDER_STALLED`; cada orden se pudo abrir con su propia sesión (todas son suyas); sin `stockAlerts` ni `clientsToNotify` |
| 4 | Marcar como leído y volver a consultar | ✅ Cumple | `ORDEN:8`: `unread` 6 → 5 y el total no cambia; persiste al iniciar otra sesión; el administrador lo sigue viendo no leído |
| 5 | Atender el mantenimiento leído | ✅ Cumple | `MANT:3:PROXIMO` desapareció al registrar el servicio nuevo; marcarlo de nuevo responde `200` con `read:false` |
| 6 | Un mantenimiento próximo leído pasa a vencido | ✅ Cumple | `MANT:2:PROXIMO` → `MANT:2:VENCIDO` aparece como no leído |
| 7 | Editar una nota de una orden detenida | ✅ Cumple | La nota no la sacó ni reinició sus 5 días; al cambiar de estado desapareció |
| 8 | Mecánico marca un aviso de stock | ✅ Cumple | `404 NOT_FOUND`; la lectura no se guardó |
| 9 | Recepción consulta `GET /client-notices` | ✅ Cumple | 4 hechos con teléfono de 10 dígitos, vehículo y motivo; ordenados por fecha del hecho |
| 10 | Marcar avisado con la nota «no contestó» | ✅ Cumple | `201` con `noticedBy`, `noticedAt` y la nota; repetirlo responde `200` con el mismo registro (id 2); sale de la lista |
| 11 | Un hecho que ya no aplica | ✅ Cumple (con adaptación) | `409 NOTICE_NOT_APPLICABLE` y no se registró nada. **Adaptación**: se usó una cita de mañana cancelada, porque la única orden Terminada de los datos de ejemplo ya se había marcado como avisada en el escenario 10 (un hecho ya avisado responde `200`, por diseño) |
| 12 | Mecánico en `/client-notices` | ✅ Cumple | `403` en `GET` y en `POST` |
| 13 | Comparar con el panel, Mantenimientos e Inventario | ✅ Cumple | Vencidos 3, próximos 0, agotadas 1, bajas 2 y citas de hoy 1 coinciden con `/dashboard`, `/maintenance` y `/parts/summary` |
| 14 | Rendimiento de `GET /notifications` | ✅ Cumple | Con los datos de ejemplo: máximo 3 ms en 5 consultas (meta: menos de 1 s). Con 500 mantenimientos, 500 refacciones y 500 órdenes abiertas lo mide la prueba automatizada `notifications.performance.test.js` (meta: menos de 3 s), que pasa |
| 15 | Cargar los seeds dos veces | ✅ Cumple | Ninguna de las 16 tablas cambia de conteo en la segunda carga |

**Resumen**: 15 de 15 escenarios cumplidos, ninguno con defecto abierto. Una adaptación documentada (escenario 11).

## Comprobaciones de la interfaz

Las verifican las pruebas de Flutter (52 nuevas, todas en verde) y se muestran en las capturas de `docs/evidencias/sprint-6/` (ver la sección de evidencias del documento de aseguramiento de calidad): contador y «99+», panel agrupado y tope de 10 avisos, estados de carga, vacío y error, apertura de cada aviso, insignia de Inventario solo para el administrador, sección «Clientes por avisar» con su insignia y diálogo de nota, y ausencia de todo ello para el mecánico.
