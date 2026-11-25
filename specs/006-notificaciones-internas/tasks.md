---

description: "Lista de tareas para implementar el Sprint 6: notificaciones internas y clientes por avisar"
---

# Tareas: Notificaciones internas y clientes por avisar

**Entrada**: Documentos de diseño en `specs/006-notificaciones-internas/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md. Sprints 1 a 5 completados y constitución v1.2.0.

**Pruebas**: Se incluyen porque la constitución (principio VII) las exige para la lógica de negocio y los permisos, y la especificación las pide (FR-022). **En cada historia, las pruebas van antes del código**: las de comportamiento nuevo («agrega») deben fallar antes de implementar y se comprueba; las de comportamiento existente («mantiene») deben pasar desde el primer intento y se verifican con una prueba de mutación (se rompe el código a propósito, la prueba debe fallar y se restaura).

**Organización**: Las tareas se agrupan por historia de usuario. Este sprint **agrega** dos tablas, cuatro rutas y los widgets de avisos, y **reutiliza** los cálculos existentes de mantenimientos, stock y citas para que las cifras coincidan. Migración `005`, seeds `009`.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US1]–[US7]**: Historia de usuario (US1 campana y contador, US2 mantenimientos y citas para recepción, US3 stock para el administrador, US4 órdenes detenidas, US5 mecánico, US6 leer y abrir, US7 clientes por avisar)
- Todas las rutas son relativas a la raíz del repositorio

## Convenciones de rutas

- Backend: `server/` (ES Modules, sin carpeta `src/`); pruebas en `server/tests/{unit,integration,contract}/`
- Frontend: `client/lib/` y `client/test/`
- Base de datos: `database/migrations/` y `database/seeds/`
- Pruebas del backend: `npm test` en `server/`; del frontend: `flutter test` en `client/`

---

## Fase 1: Preparación

- [X] T001 Confirmar que la rama es `006-notificaciones-internas`, que la línea base está registrada (backend 90 suites y 1332 pruebas; Flutter 256 pruebas, en `docs/evidencias/sprint-6/linea-base-backend.txt` y `linea-base-frontend.txt`) y que MySQL escucha en el puerto 3307 (FR-022)

---

## Fase 2: Fundamentos (bloquean todas las historias)

- [X] T002 [P] Actualizar `docs/design-system.md` antes de tocar cualquier pantalla (constitución, principio VIII): agregar el encabezado con la campana y su contador («99+»), el panel de avisos agrupado por tipo con los colores de estado (advertencia para próximo y bajo, peligro para vencido y agotado), las insignias del ícono de Inventario y de la sección «Clientes por avisar», la sección «Clientes por avisar» (tabla, motivo, teléfono y nota) y los estados de carga, vacío y error de ambos; accesibilidad de la campana (descripción emergente «Notificaciones», teclado y cierre con Escape) (FR-014, FR-023)
- [X] T003 Crear `database/migrations/005_sprint6_notificaciones.sql` (aditiva; no modifica migraciones anteriores): tabla `notification_reads` con `userId INT UNSIGNED` obligatorio y llave foránea a `users.id`, `noticeKey VARCHAR(60)` obligatorio, `readAt DATETIME` obligatorio con `DEFAULT CURRENT_TIMESTAMP` y clave primaria `(userId, noticeKey)`; tabla `client_notices` con `id INT UNSIGNED` autoincremental, `clientId INT UNSIGNED` obligatorio con llave foránea a `clients.id`, `kind ENUM('ORDEN_LISTA','CITA_MANANA','MANTENIMIENTO_PROXIMO','MANTENIMIENTO_VENCIDO')` obligatorio, `factId INT UNSIGNED` obligatorio, `noticedBy INT UNSIGNED` obligatorio con llave foránea a `users.id`, `noticedAt DATETIME` obligatorio con `DEFAULT CURRENT_TIMESTAMP`, `note VARCHAR(255)` opcional, restricción única `uq_client_notices_fact (kind, factId)` e índice `idx_client_notices_client (clientId)`; InnoDB y `utf8mb4`; sin borrado en cascada (FR-020)
- [X] T004 Aplicar la migración 005 a la base de pruebas y a la de desarrollo con `powershell -ExecutionPolicy Bypass -File database/scripts/aplicar-migraciones.ps1 -Puerto 3307 -Base motorix_sdd_test` y luego `-Base motorix_sdd`; comprobar que el script registra `005` en `schema_migrations` y que volver a ejecutarlo no la repite (FR-020)
- [X] T005 Ajustar las pruebas existentes por las tablas nuevas (riesgo R-07): agregar `notification_reads` y `client_notices` a la lista de `limpiarBase` en `server/tests/helpers.js` y a la lista `TABLAS` de `server/tests/integration/seeds.sprint5.test.js`; registrar el ajuste en el documento de calidad (FR-022)
- [X] T006 [P] Agregar a `server/utils/constants.js` las constantes del sprint: tipos de aviso (`MAINTENANCE_OVERDUE`, `MAINTENANCE_SOON`, `APPOINTMENT_TODAY`, `STOCK_OUT`, `STOCK_LOW`, `ORDER_STALLED`), `NOTICE_STALLED_HOURS = 72`, `NOTICE_PANEL_LIMIT = 10`, tipos de hecho (`ORDEN_LISTA`, `CITA_MANANA`, `MANTENIMIENTO_PROXIMO`, `MANTENIMIENTO_VENCIDO`) y `CLIENT_NOTICE_NOTE_MAX = 255` (FR-002, FR-005, FR-017)
- [X] T007 [P] Crear `server/tests/unit/noticeKeys.test.js` (deben fallar antes de T008): construir y leer las claves `MANT:{id}:{VENCIDO|PROXIMO}`, `STOCK:{id}:{AGOTADO|BAJO}`, `CITA:{id}` y `ORDEN:{id}`; rechazar claves mal formadas; tipos permitidos por rol (ADMIN todos; RECEPTIONIST mantenimientos, citas y órdenes detenidas; MECHANIC solo órdenes detenidas); orden por urgencia (vencidos antes que próximos y los más pasados primero; agotados antes que bajos; citas por hora; órdenes de más a menos días) (FR-002, FR-006, FR-009)
- [X] T008 Crear `server/services/noticeKeys.js` (módulo puro, sin acceso a la base): funciones para construir y leer claves, `typesForRole(rol)` y comparadores de urgencia por tipo, y comprobar que T007 pasa (FR-002, FR-006, FR-009)
- [X] T009 [P] Crear `server/tests/integration/notices.models.test.js` (deben fallar antes de T010 a T015): `orderModel.listStalled` (72 horas desde el último cambio del historial o desde la creación si no hay registros; solo estados abiertos; filtro por `mechanicId`), `orderModel.listReadyForPickup` (órdenes `TERMINADO` sin entregar), `appointmentModel.listByDay` (Pendientes y Confirmadas con cliente y placa), `partModel.listAlerts` (solo activas, nivel bajo o agotado), `maintenanceService.listAllClassified` (con y sin clientes desactivados), `notificationModel` (guardar una lectura sin duplicar, listar las del usuario y borrar las que no corresponden) y `clientNoticeModel` (insertar con la restricción única `(kind, factId)`) (FR-003, FR-005, FR-008, FR-017)
- [X] T010 [P] Agregar a `server/models/orderModel.js` `listStalled({ hours, mechanicId })` con `TIMESTAMPDIFF(HOUR, COALESCE(MAX(order_status_history.changedAt), service_orders.createdAt), NOW()) >= hours` y `ORDER_OPEN_STATUSES`, y `listReadyForPickup()` para las órdenes `TERMINADO` sin entregar con cliente (con teléfono), vehículo y fecha del último cambio (FR-005, FR-015)
- [X] T011 [P] Agregar a `server/models/appointmentModel.js` `listByDay(fecha)` con las citas `PENDIENTE` y `CONFIRMADA` de ese día (`YYYY-MM-DD`) con hora, cliente (con teléfono) y placa, ordenadas por hora y sin los clientes desactivados (FR-004, FR-015)
- [X] T012 [P] Agregar a `server/models/partModel.js` `listAlerts()` con las refacciones activas de nivel bajo o agotado, usando `stockLevelOf` (id, código, nombre, existencia, mínimo y nivel) (FR-004)
- [X] T013 Agregar a `server/services/maintenanceService.js` `listAllClassified({ classification })`, que devuelve todos los mantenimientos pendientes clasificados sin paginar, reutilizando la función interna que ya clasifica y sin cambiar el comportamiento de `list`, con la opción `onlyActiveClients` para excluir a los clientes desactivados; en `server/models/maintenanceModel.js` exponer `client.active` (hoy el `JOIN clients` de la línea 14 no lo trae) (FR-004, FR-015)
- [X] T014 [P] Crear `server/models/notificationModel.js` con `listReads(userId)`, `saveRead(userId, noticeKey)` (idempotente) y `deleteReads(userId, keys)` (FR-008, FR-009)
- [X] T015 [P] Crear `server/models/clientNoticeModel.js` con `insertIfAbsent`, `findByFact(kind, factId)`, `listNoticedFacts(kind)` y la consulta de quién avisó y cuándo; la unicidad la garantiza la base (FR-017, FR-019)
- [X] T016 [P] Crear `client/lib/models/notification.dart` y `client/lib/models/client_notice.dart` con los campos del contrato (`contracts/api.md`), y `client/test/helpers/fake_api_s6.dart` con respuestas simuladas para administrador, recepción y mecánico, avisos de cada tipo, lista de clientes por avisar y los errores `NOTICE_NOT_APPLICABLE` y `FORBIDDEN` (FR-001, FR-015)
- [X] T017 Ejecutar `npm test -- tests/unit/noticeKeys.test.js tests/integration/notices.models.test.js` y comprobar que pasan con los modelos de T010 a T015, y que la suite completa del backend (`npm test` en `server/`) sigue verde (fin del punto de control de los fundamentos) (FR-020, FR-022)

**Punto de control**: la base, las consultas y el módulo puro existen y las pruebas previas siguen en verde; ya se pueden construir las historias.

---

## Fase 3: Historia de usuario 1 - Ver cuántos avisos tengo en el encabezado (Prioridad: P1)

**Objetivo**: una campana en el encabezado con el número de avisos no leídos que abre un panel agrupado por tipo, con datos reales y actualización cada 60 segundos (FR-001, FR-002, FR-003, FR-011, FR-014).

**Prueba independiente**: con un mantenimiento vencido, una cita de hoy, una refacción con stock bajo y una orden detenida, el administrador inicia sesión, ve la campana con el total y abre el panel con los avisos agrupados.

### Pruebas de la historia 1 (escribir primero)

- [X] T018 [P] [US1] Crear `server/tests/unit/notificationService.test.js` con modelos simulados de una sola fuente (órdenes detenidas): agrupa por tipo, cuenta `unread` y `total` de todos los avisos aunque el panel muestre 10, ordena por urgencia, no incluye teléfonos, descarta las lecturas de avisos que ya no existen y devuelve una respuesta vacía sin avisos (FR-001, FR-002, FR-003, FR-009); deben fallar antes de T022
- [X] T019 [P] [US1] Crear `server/tests/integration/notifications.admin.test.js` con una orden detenida (la única fuente que entrega esta historia): `GET /api/notifications` del administrador devuelve su grupo, `unread` igual al total, `limitPerType: 10` y ningún campo `phone`; los avisos no se guardan en ninguna tabla, solo la lectura; los grupos de mantenimientos, citas y stock se prueban en US2 y US3 (FR-001 a FR-003); debe fallar antes de T022 y T023
- [X] T020 [P] [US1] Crear `server/tests/contract/notifications.contract.test.js`: forma exacta de `GET /api/notifications` (`unread`, `total`, `groups[].items[]` con `key`, `type`, `read`, `title`, `detail`, `data` y `target`) y `401` sin sesión; `stockAlerts` y `clientsToNotify` se agregan a esta prueba en US3 y US7 (FR-001)
- [X] T021 [P] [US1] Crear la carpeta `client/test/providers/` con `notifications_provider_test.dart` y crear `client/test/screens/notification_bell_test.dart`: el provider carga, conserva el último número si falla una consulta, se vacía con `reset()` y repite la consulta cada 60 segundos con un temporizador simulado y se detiene al cerrar sesión; la campana muestra el contador, «99+» cuando pasa de 99, la descripción emergente «Notificaciones», se abre con el teclado y el panel se cierra con Escape y muestra los estados de carga, vacío y error (FR-001, FR-011, FR-014); deben fallar antes de T024 a T026

### Implementación de la historia 1

- [X] T022 [US1] Crear `server/services/notificationService.js` (fábrica `createNotificationService` con dependencias inyectables): `get(usuario)` arma los grupos con `noticeKeys`, calcula `unread` y `total`, aplica el tope de 10 por tipo, marca como leídos los avisos con lectura y borra las lecturas del usuario que ya no corresponden a un aviso vigente (FR-001 a FR-003, FR-009)
- [X] T023 [US1] Crear `server/validators/notificationValidator.js`, `server/controllers/notificationController.js` y `server/routes/notificationRoutes.js` con `GET /api/notifications` (`authenticate` y los tres roles) y registrar la ruta en `server/app.js` (FR-001)
- [X] T024 [P] [US1] Crear `client/lib/providers/notifications_provider.dart`: estado de carga, vacío y error, `refresh()`, `start()` con `Timer.periodic` de 60 segundos (intervalo inyectable para las pruebas) y `reset()` que cancela el temporizador (FR-011)
- [X] T025 [P] [US1] Crear `client/lib/widgets/notification_bell.dart` y `client/lib/widgets/notifications_panel.dart`: campana con `Badge` y `Tooltip('Notificaciones')`, panel agrupado por tipo con los colores de estado, estados de carga, vacío y error con `client/lib/widgets/state_views.dart` y cierre con Escape (FR-001, FR-014)
- [X] T026 [US1] Modificar `client/lib/widgets/app_shell.dart` (campana en `_Header`, líneas 118-144), `client/lib/screens/home_screen.dart` (iniciar el provider al montar, actualizar al cambiar de sección y pasar el callback `onOpenSection`) y `client/lib/main.dart` (registrar `NotificationsProvider` con `addSessionEndListener(reset)`) (FR-001, FR-011)
- [X] T027 [US1] Ejecutar `npm test -- tests/unit/notificationService.test.js tests/integration/notifications.admin.test.js tests/contract/notifications.contract.test.js` y `flutter test test/providers/notifications_provider_test.dart test/screens/notification_bell_test.dart` y comprobar que pasan, y que la suite completa sigue verde; fin del punto de control (FR-001 a FR-003, FR-011, FR-014)

**Punto de control**: el administrador ve la campana con su contador y el panel; la historia 1 funciona.

---

## Fase 4: Historia de usuario 2 - Mantenimientos y citas del día para recepción (Prioridad: P1)

**Objetivo**: avisos de mantenimientos próximos y vencidos y de citas del día, con los mismos criterios del sistema, para recepción (FR-002, FR-004, FR-006).

**Prueba independiente**: con un mantenimiento próximo, uno vencido y una cita para hoy, recepción los ve; el número de mantenimientos coincide con el de la lista de Mantenimientos.

### Pruebas de la historia 2 (escribir primero)

- [X] T028 [P] [US2] Crear `server/tests/integration/notifications.reception.test.js`: recepción recibe mantenimientos próximos (15 días o 500 km, límites inclusivos) y vencidos (fecha pasada o kilometraje alcanzado, rige el más urgente) y citas de hoy Pendientes o Confirmadas, incluso con la hora ya pasada; no aparecen mantenimientos Atendidos ni citas Canceladas o Completadas ni los de clientes desactivados; no recibe avisos de stock; cada aviso trae cliente, vehículo y cuánto falta o se pasó, sin teléfono (FR-002, FR-004, FR-006); debe fallar antes de T029

### Implementación de la historia 2

- [X] T029 [US2] Completar `server/services/notificationService.js` con los avisos de mantenimientos (`maintenanceService.listAllClassified`, claves `MANT:{id}:{PROXIMO|VENCIDO}`) y de citas del día (`appointmentModel.listByDay` con la fecha de `hoyLocal()`, clave `CITA:{id}`), con su título, detalle, datos y destino (FR-002, FR-004)
- [X] T030 [US2] Ejecutar `npm test -- tests/integration/notifications.reception.test.js` y comprobar que pasa, y que la suite sigue verde; fin del punto de control (FR-004, FR-006)

**Punto de control**: recepción recibe los avisos de mantenimientos y citas sin stock; las historias 1 y 2 funcionan.

---

## Fase 5: Historia de usuario 3 - Stock bajo o agotado para el administrador (Prioridad: P2)

**Objetivo**: avisos de stock bajo y agotado solo para el administrador y una insignia con las alertas en el ícono de Inventario (FR-004, FR-006, FR-012, FR-013).

**Prueba independiente**: con una refacción con stock bajo y otra agotada, el administrador ve ambos avisos y la insignia con el mismo número; recepción y mecánico no los reciben.

### Pruebas de la historia 3 (escribir primero)

- [X] T031 [P] [US3] Crear `server/tests/integration/notifications.stock.test.js` y ampliar `notifications.contract.test.js` con `stockAlerts`: el administrador recibe `STOCK_LOW` y `STOCK_OUT` con nombre, código y existencia frente al mínimo, y `stockAlerts` con el total; una refacción desactivada no genera aviso; recepción y mecánico no reciben stock ni `stockAlerts` (FR-004, FR-006, FR-012); debe fallar antes de T033
- [X] T032 [P] [US3] Crear `client/test/screens/inventory_badge_test.dart`: el ícono de Inventario muestra una insignia con las alertas de stock solo para el administrador y no se muestra sin alertas ni para recepción o mecánico; el resumen de Inventario y la tarjeta del panel de control siguen funcionando (FR-012, FR-013); debe fallar antes de T034

### Implementación de la historia 3

- [X] T033 [US3] Completar `server/services/notificationService.js` con los avisos de stock (`partModel.listAlerts`, claves `STOCK:{id}:{BAJO|AGOTADO}`) y el campo `stockAlerts`, solo para el administrador (FR-004, FR-006, FR-012)
- [X] T034 [US3] Modificar `client/lib/screens/home_screen.dart` y `client/lib/widgets/app_shell.dart` para mostrar un `Badge` en el ícono de Inventario con `NotificationsProvider.stockAlerts` solo para el administrador (agregar el dato de insignia a `ShellSection` o resolverlo por etiqueta) (FR-012)
- [X] T035 [US3] Ejecutar `npm test -- tests/integration/notifications.stock.test.js` y `flutter test test/screens/inventory_badge_test.dart` y comprobar que pasan, y que la suite sigue verde; fin del punto de control (FR-004, FR-012, FR-013)

**Punto de control**: el administrador ve el stock en el centro y en el ícono de Inventario; las demás roles no.

---

## Fase 6: Historia de usuario 4 - Órdenes detenidas (Prioridad: P2)

**Objetivo**: aviso de orden detenida para administración y recepción, medido con el último cambio de estado (FR-005).

**Prueba independiente**: una orden en reparación cuyo último cambio de estado fue hace cinco días aparece; otra con un cambio de hoy no.

### Pruebas de la historia 4 (escribir primero)

- [X] T036 [P] [US4] Crear `server/tests/integration/notifications.stalled.test.js`: una orden abierta con 72 horas o más desde su último cambio de estado aparece con folio, placa, estado y días detenida; una con un cambio reciente no; editar una nota o un servicio sin cambiar de estado no la saca ni la reinicia; sin registros en el historial se mide desde su fecha de creación; las Terminadas, Entregadas y Canceladas no generan aviso; administrador y recepción ven todas las órdenes detenidas (FR-005, FR-006); debe fallar antes de T037

### Implementación de la historia 4

- [X] T037 [US4] Completar `server/services/notificationService.js` con los avisos de órdenes detenidas (`orderModel.listStalled` con `NOTICE_STALLED_HOURS`, clave `ORDEN:{id}`, días detenida con `FLOOR(horas / 24)`) (FR-005)
- [X] T038 [US4] Ejecutar `npm test -- tests/integration/notifications.stalled.test.js` y comprobar que pasa, y que la suite sigue verde; fin del punto de control (FR-005)

**Punto de control**: las órdenes detenidas se detectan con el historial de estados.

---

## Fase 7: Historia de usuario 5 - El mecánico solo ve los avisos de sus órdenes (Prioridad: P1)

**Objetivo**: el servidor entrega al mecánico únicamente los avisos de órdenes detenidas asignadas a él (FR-006, FR-007, FR-016).

**Prueba independiente**: con dos mecánicos y una orden detenida de cada uno, cada uno recibe solo la suya; una petición directa no entrega stock, citas ni mantenimientos.

### Pruebas de la historia 5 (escribir primero)

- [X] T039 [P] [US5] Crear `server/tests/integration/notifications.mechanic.test.js`: cada mecánico recibe solo su orden detenida; reasignar la orden mueve el aviso al nuevo mecánico; la petición directa del mecánico no incluye grupos de stock, citas ni mantenimientos aunque existan; ninguna respuesta incluye datos de otras órdenes (FR-006, FR-007); debe fallar antes de T041
- [X] T040 [P] [US5] Crear `client/test/screens/notifications_mechanic_test.dart`: con la sesión del mecánico el panel solo muestra órdenes detenidas, no aparece la sección «Clientes por avisar» ni la insignia de Inventario (FR-006, FR-016); debe fallar antes de T042

### Implementación de la historia 5

- [X] T041 [US5] Ajustar `server/services/notificationService.js` para filtrar por rol con `noticeKeys.typesForRole` y pasar `mechanicId` a `orderModel.listStalled` cuando el usuario es mecánico, sin consultar mantenimientos, citas ni stock (FR-006, FR-007)
- [X] T042 [US5] Verificar en `client/lib/screens/home_screen.dart` y `client/lib/widgets/notifications_panel.dart` que el menú y el panel respetan el rol (la sección de clientes por avisar se registra en T057); ajustar si hace falta (FR-006, FR-016)
- [X] T043 [US5] Ejecutar `npm test -- tests/integration/notifications.mechanic.test.js` y `flutter test test/screens/notifications_mechanic_test.dart` y comprobar que pasan, y que la suite sigue verde; fin del punto de control (FR-006, FR-007)

**Punto de control**: la restricción por rol se cumple en el servidor y en la interfaz.

---

## Fase 8: Historia de usuario 6 - Marcar como leído y abrir el módulo relacionado (Prioridad: P2)

**Objetivo**: la lectura persiste por usuario, se descarta cuando el aviso desaparece y cada aviso abre su pantalla (FR-008, FR-009, FR-010).

**Prueba independiente**: un usuario marca un aviso como leído y el contador baja; cierra sesión, vuelve a entrar y sigue leído; abre un aviso y llega a la pantalla relacionada.

### Pruebas de la historia 6 (escribir primero)

- [X] T044 [P] [US6] Ampliar `server/tests/unit/notificationService.test.js` con `markRead`: guarda la lectura si el aviso es visible; `404` si el tipo no corresponde al rol; `read: false` sin efecto si el aviso ya no existe o es de una orden ajena; repetir no duplica (FR-008, FR-009); debe fallar antes de T046
- [X] T045 [P] [US6] Crear `server/tests/integration/notifications.read.test.js` y ampliar `notifications.contract.test.js`: `POST /api/notifications/read` guarda la lectura por usuario, se conserva con otra sesión, no afecta a otro usuario, `400` con una clave mal formada, `404` con un tipo ajeno al rol; al atender el aviso la lectura se descarta y, si la condición vuelve a cumplirse, el aviso reaparece no leído; un mantenimiento que pasa de próximo a vencido reaparece no leído; las filas de lectura de avisos inexistentes se borran al consultar (FR-008, FR-009); debe fallar antes de T046
- [X] T046 [P] [US6] Crear `client/test/screens/notification_open_test.dart`: marcar un aviso como leído baja el contador; abrir un aviso lo marca leído y navega al detalle de la orden, al detalle de la cita, al detalle de la refacción o a Mantenimientos con la placa escrita en el buscador (FR-010); debe fallar antes de T048 y T049

### Implementación de la historia 6

- [X] T047 [US6] Agregar `markRead(usuario, key)` a `server/services/notificationService.js` y `POST /api/notifications/read` a `server/routes/notificationRoutes.js`, `server/controllers/notificationController.js` y `server/validators/notificationValidator.js` (FR-008, FR-009)
- [X] T048 [US6] Agregar `markRead` y `open` a `client/lib/providers/notifications_provider.dart` y los botones «Marcar como leído» y «Abrir» a `client/lib/widgets/notifications_panel.dart` (FR-008, FR-010)
- [X] T049 [US6] Implementar `onOpenSection` en `client/lib/screens/home_screen.dart` para abrir `order_detail_screen.dart`, `appointment_detail_screen.dart` y `part_detail_screen.dart` con el identificador del aviso, o la sección Mantenimientos; y hacer que `client/lib/screens/maintenance_screen.dart` acepte una búsqueda inicial opcional con la placa (FR-010)
- [X] T050 [US6] Ejecutar `npm test -- tests/unit/notificationService.test.js tests/integration/notifications.read.test.js` y `flutter test test/screens/notification_open_test.dart` y comprobar que pasan, y que la suite sigue verde; fin del punto de control (FR-008 a FR-010)

**Punto de control**: la lectura persiste y cada aviso lleva a su pantalla.

---

## Fase 9: Historia de usuario 7 - Lista de clientes por avisar (Prioridad: P1)

**Objetivo**: administración y recepción ven a quién avisar (vehículo listo, cita de mañana, mantenimiento próximo o vencido) con su teléfono y lo marcan como avisado, sin enviar ningún mensaje (FR-015 a FR-019).

**Prueba independiente**: con una orden Terminada sin entregar, recepción abre «Clientes por avisar», ve al cliente con su teléfono, lo marca avisado y deja de verlo; queda registrado quién y cuándo.

### Pruebas de la historia 7 (escribir primero)

- [X] T051 [P] [US7] Crear `server/tests/integration/clientNotices.list.test.js`: `GET /api/client-notices` devuelve los cuatro motivos con cliente, teléfono, vehículo, motivo y fecha del hecho, ordenados por fecha con el más antiguo primero; una orden Terminada se incluye con o sin saldo; excluye los hechos ya avisados y a los clientes desactivados, y ordena por `factDate` (fecha en que la orden quedó Terminada, fecha y hora de la cita, o próxima fecha del mantenimiento o su fecha de registro si solo tiene kilometraje); `403` para el mecánico y `401` sin sesión (FR-015, FR-016); debe fallar antes de T055
- [X] T052 [P] [US7] Crear `server/tests/integration/clientNotices.mark.test.js`: `POST /api/client-notices` responde `201` con `noticedBy`, `noticedAt` y la nota y saca al cliente de la lista; repetirlo responde `200` con el registro original sin duplicar; dos solicitudes simultáneas dejan un solo registro; un hecho nuevo (otra orden, otra cita, o el mismo mantenimiento con otra clasificación) aparece; `409 NOTICE_NOT_APPLICABLE` si la orden ya se entregó o la cita se canceló; `404` si el objeto no existe; `400` con una nota de más de 255 caracteres; el registro no dispara ninguna integración externa de mensajería (FR-017, FR-018, FR-019); debe fallar antes de T055
- [X] T053 [P] [US7] Crear `server/tests/contract/clientNotices.contract.test.js` y ampliar `notifications.contract.test.js` con `clientsToNotify` (solo ADMIN y RECEPTIONIST): forma exacta de `GET` y `POST /api/client-notices` (`kind`, `factId`, `reason`, `factDate`, `client`, `vehicle`, `detail`, `target`; `meta` con `page`, `pageSize` y `total`) (FR-015, FR-017)
- [X] T054 [P] [US7] Crear `client/test/providers/client_notices_provider_test.dart` y `client/test/screens/client_notices_screen_test.dart`: la lista muestra cliente, teléfono, vehículo y motivo con estados de carga, vacío y error; marcar como avisado con una nota opcional pide la nota, llama a la API y saca al cliente; la insignia de la sección muestra el número pendiente; la sección solo aparece para administrador y recepción (FR-014 a FR-017); deben fallar antes de T056 y T057

### Implementación de la historia 7

- [X] T055 [US7] Crear `server/services/clientNoticeService.js` (fábrica con dependencias inyectables), `server/controllers/clientNoticeController.js`, `server/routes/clientNoticeRoutes.js` (solo ADMIN y RECEPTIONIST) y el esquema de validación en `server/validators/notificationValidator.js`; `list` arma los hechos (`orderModel.listReadyForPickup`, `appointmentModel.listByDay` de mañana, `maintenanceService.listAllClassified`), excluye los avisados y a los clientes desactivados; `mark` verifica en una transacción que el hecho siga aplicando, inserta con `insertIfAbsent` y responde `201`, `200` o `409`; registrar la ruta en `server/app.js` y agregar `clientsToNotify` a la respuesta de `notificationService` (FR-015 a FR-019)
- [X] T056 [P] [US7] Crear `client/lib/providers/client_notices_provider.dart` y `client/lib/screens/client_notices_screen.dart`: tabla con filtros y chips de motivo, diálogo para marcar como avisado con nota opcional de hasta 255 caracteres y mensajes de éxito o error (FR-014, FR-015, FR-017)
- [X] T057 [US7] Registrar en `client/lib/screens/home_screen.dart` la sección «Clientes por avisar» (solo `UserRole.admin` y `UserRole.receptionist`, con `Badge` de `clientsToNotify`) y en `client/lib/main.dart` el provider con `addSessionEndListener(reset)` y el constructor de la sección en `sectionBuilders` (FR-015, FR-016)
- [X] T058 [US7] Ejecutar `npm test -- tests/integration/clientNotices.list.test.js tests/integration/clientNotices.mark.test.js tests/contract/clientNotices.contract.test.js` y `flutter test test/providers/client_notices_provider_test.dart test/screens/client_notices_screen_test.dart` y comprobar que pasan, y que la suite sigue verde; fin del punto de control (FR-015 a FR-019)

**Punto de control**: recepción puede avisar a los clientes sin repetir ni olvidar; las siete historias funcionan.

---

## Fase 10: Datos de ejemplo y rendimiento (transversal)

**Objetivo**: demostrar el sprint con datos reales al arrancar, medir el rendimiento y comprobar que las cifras coinciden con las de otras pantallas (FR-004, FR-013, FR-021, FR-022).

- [X] T059 [P] Crear `server/tests/integration/seeds.sprint6.test.js`: tras `aplicarSeeds()` el administrador recibe al menos un aviso de cada tipo y recepción recibe clientes por avisar de cada motivo; cargar los seeds dos veces no cambia el conteo de ninguna tabla (incluidas `notification_reads` y `client_notices`) (FR-021, SC-007); debe fallar antes de T062
- [X] T060 [P] Crear `server/tests/integration/notifications.performance.test.js`: con 500 mantenimientos pendientes, 500 refacciones y 500 órdenes abiertas, `GET /api/notifications` responde en menos de 3 segundos, y con los datos de ejemplo en menos de 1 segundo (FR-022, SC-003)
- [X] T061 [P] Crear `server/tests/integration/notifications.consistency.test.js`: con los mismos datos, los totales del centro (mantenimientos próximos y vencidos, citas de hoy y stock bajo y agotado) coinciden con `GET /api/dashboard`, `GET /api/maintenance?classification=…` y `GET /api/parts/summary` (FR-004, FR-013, SC-002)
- [X] T062 Crear `database/seeds/009_notificaciones.sql` (idempotente, con `INSERT ... SELECT ... WHERE NOT EXISTS` y fechas relativas a `NOW()`): una orden en reparación asignada al mecánico con su último cambio de estado hace 5 días y su historial, una cita de hoy y otra de mañana si no existen, y un aviso a cliente de ejemplo ya registrado; aprovecha los mantenimientos, el stock bajo y agotado y la orden Terminada OS-000005 existentes (FR-021)
- [X] T063 Si T060 supera las metas, optimizar la consulta (por ejemplo, limitar las columnas de `maintenanceModel.listAll` o agrupar el historial de estados con una sola consulta) sin cambiar el comportamiento, y volver a ejecutar T060 y T061 (FR-022, SC-003)
- [X] T064 Ejecutar `npm test -- tests/integration/seeds.sprint6.test.js tests/integration/notifications.performance.test.js tests/integration/notifications.consistency.test.js` y comprobar que pasan, y que la suite completa del backend sigue verde (FR-021, FR-022)

---

## Fase 11: Cierre

- [X] T065 [P] Actualizar `docs/project-context.md`: sección 6.12 (notificaciones internas y clientes por avisar con las reglas del sprint), sección 14.2 (Sprint 6 implementado) y las decisiones resueltas con Spec Kit para el Sprint 6; retirar de ahí cualquier mención del `StockAlertsProvider` inexistente (FR-023)
- [X] T066 [P] Actualizar `README.md` (sprints, tabla de qué ve cada rol y una sección con las reglas de los avisos) y `database/README.md` (migración 005 y seeds 009) (FR-023)
- [X] T067 Crear `specs/006-notificaciones-internas/validacion-quickstart.md` ejecutando los 15 escenarios de `quickstart.md` contra la API real (arrancada con `node server.js`) sobre la base de pruebas, y registrar el resultado de cada uno (FR-022)
- [X] T068 Ejecutar la regresión completa: `npm test` y `npm run lint` en `server/`, `flutter test` y `flutter analyze lib` en `client/`; guardar la salida en `docs/evidencias/sprint-6/regresion-backend.txt` y `regresion-frontend.txt` y comparar con la línea base (90 suites y 1332 pruebas; 256 pruebas): ninguna prueba anterior debe pasar de verde a rojo (SC-006, FR-022)
- [ ] T069 Tomar las capturas con la API y la app web en local y guardarlas en `docs/evidencias/sprint-6/` (`captura-campana-admin.png`, `captura-panel-de-avisos.png`, `captura-insignia-inventario.png`, `captura-recepcion-sin-stock.png`, `captura-mecanico-sus-ordenes.png`, `captura-clientes-por-avisar.png`, `captura-cliente-avisado.png`); las que no salgan las toma Jorge (SC-004, SC-005)
- [ ] T070 Medir con cronómetro SC-004 (recepción: de «Clientes por avisar» a marcar avisado, menos de 1 minuto) y SC-005 (marcar leído actualiza el contador en menos de 2 segundos y persiste tras cerrar sesión) y registrar los tiempos en `docs/aseguramiento-calidad-sprint-6.md` (SC-004, SC-005)
- [X] T071 Cerrar `docs/aseguramiento-calidad-sprint-6.md`: trazabilidad con tareas y pruebas, hallazgos, regresión (línea base y cierre), el control de calidad final con 5 requisitos en las 9 columnas de la bitácora del reporte integral (ID, requisito, criterio de aceptación verificable, prueba ejecutada, resultado, evidencia o enlace, defecto o incidencia, prioridad y observaciones) con su anexo de evidencias, y la aprobación de Jorge Francisco Dominguez Ramirez (FR-022)
- [X] T072 Corregir `docs/sprints/propuesta-sprints-post-mvp.md` (Sprint 6 «Implementado»), marcar todas las tareas de este archivo como `[X]` y comprobar que los documentos no se contradicen (FR-023)

---

## Dependencias y orden de ejecución

- **Fase 1** (T001) ya está hecha. **Fase 2** (T002 a T017) bloquea todas las historias; T002 va primero que cualquier pantalla.
- **US1** (T018 a T027) crea el servicio, la ruta y la campana; **US2, US3, US4 y US5** completan el mismo servicio con cada tipo de aviso y dependen de US1; **US6** depende de US1; **US7** depende de los fundamentos y de `notificationService.js` (creado en T022) solo para agregar `clientsToNotify` en T055; su servicio, sus rutas y sus pruebas de backend pueden avanzar en paralelo con US2 a US6, pero T055 edita el mismo archivo que T029, T033, T037, T041 y T047, así que esas ediciones se hacen en secuencia.
- **Fase 10** (datos y rendimiento) requiere las siete historias; **Fase 11** (cierre) requiere la Fase 10.

## Oportunidades de paralelismo

- T002, T003, T005, T006 y T007 son independientes entre sí.
- Las pruebas de una misma historia (marcadas `[P]`) están en archivos distintos y se pueden escribir en paralelo: por ejemplo T018 a T021 en US1 y T051 a T054 en US7.
- Los modelos y consultas de T010 a T012 y T014 a T016 están en archivos distintos.
- T065 y T066 (documentación) no dependen del código.

## Estrategia de implementación

1. **Alcance mínimo demostrable**: Fundamentos + US1 + US2 + US5 + US7, que son las historias P1: campana con avisos para recepción y administración, restricción del mecánico y lista de clientes por avisar. Con ellas el sprint ya cumple su objetivo principal.
2. **Entrega incremental**: US3 (stock), US4 (órdenes detenidas) y US6 (leído y abrir) completan los tipos de aviso y la navegación; la Fase 10 asegura datos y rendimiento.
3. **Regla de calidad**: cada historia termina con su punto de control (pruebas nuevas y suite completa en verde) y con un commit pequeño, con las pruebas antes del código.

## Cobertura de requisitos

| Requisito | Tareas |
|-----------|--------|
| FR-001 | T018 a T021, T022, T023, T025, T026 |
| FR-002 | T006 a T008, T018, T028, T029, T031, T033, T037 |
| FR-003 | T009, T018, T019, T022 |
| FR-004 | T009, T011 a T013, T028, T029, T031, T033, T061 |
| FR-005 | T006, T009, T010, T036, T037 |
| FR-006 | T007, T008, T028, T031, T036, T039, T041 |
| FR-007 | T039, T041 |
| FR-008 | T009, T014, T044, T045, T047, T048 |
| FR-009 | T007, T008, T014, T018, T022, T044, T045 |
| FR-010 | T046, T048, T049 |
| FR-011 | T021, T024, T026 |
| FR-012 | T031, T032, T033, T034 |
| FR-013 | T032, T061 |
| FR-014 | T002, T021, T025, T054, T056 |
| FR-015 | T010, T011, T016, T051, T053, T055, T056, T057 |
| FR-016 | T040, T051, T054, T057 |
| FR-017 | T006, T009, T015, T052, T053, T055, T056 |
| FR-018 | T052 |
| FR-019 | T052, T055 |
| FR-020 | T003, T004 |
| FR-021 | T059, T062, T064 |
| FR-022 | T001, T005, T060, T061, T064, T067, T068, T071 (y todas las pruebas de las fases 2 a 9) |
| FR-023 | T002, T065, T066, T072 |

Cada una de las 72 tareas cita al menos un requisito o criterio de éxito (SC-001 a SC-007), con excepción de las de preparación y cierre, que citan FR-022 o FR-023.
