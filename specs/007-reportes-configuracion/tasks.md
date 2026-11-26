---

description: "Lista de tareas para implementar el Sprint 7: reportes y configuración"
---

# Tareas: Reportes y configuración

**Entrada**: Documentos de diseño en `specs/007-reportes-configuracion/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md. Sprints 1 a 6 completados y constitución v1.2.0.

**Pruebas**: Se incluyen porque la constitución (principio VII) las exige y la especificación las pide (FR-033). **En cada historia, las pruebas van antes del código**: las de comportamiento nuevo («agrega») deben fallar antes de implementar y se comprueba; las de comportamiento existente («mantiene») deben pasar desde el primer intento y se verifican con una prueba de mutación.

**Organización**: Las tareas se agrupan por historia de usuario y en dos entregas. **Entrega 7A**: configuración, catálogo, ticket, términos y seguridad (US1, US2, US3, US8, US9 y US10). **Entrega 7B**: reportes y exportación (US4, US5, US6 y US7). Si el calendario aprieta, la 7B se recorta a ingresos y servicios frecuentes con exportación (R-02). Migración `006`, seeds `010`.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US1]–[US10]**: Historia de usuario (US1 datos del taller, US2 márgenes, US3 catálogo y propuesta, US4 ingresos, US5 servicios y productividad, US6 refacciones y rotación, US7 exportar, US8 próximo servicio en el ticket, US9 términos, US10 seguridad)
- Todas las rutas son relativas a la raíz del repositorio

## Convenciones de rutas

- Backend: `server/` (ES Modules); pruebas en `server/tests/{unit,integration,contract}/`
- Frontend: `client/lib/` y `client/test/`
- Base de datos: `database/migrations/` y `database/seeds/`
- Pruebas del backend: `npm test` en `server/`; del frontend: `flutter test` en `client/`

---

## Fase 1: Preparación

- [X] T001 Confirmar que la rama es `007-reportes-configuracion`, que la línea base está registrada (backend 106 suites y 1462 pruebas; Flutter 308 pruebas, en `docs/evidencias/sprint-6/regresion-backend.txt` y `regresion-frontend.txt`) y que MySQL escucha en el puerto 3307 (FR-033)

---

## Fase 2: Fundamentos (bloquean todas las historias)

- [X] T002 [P] Actualizar `docs/design-system.md` antes de tocar cualquier pantalla (constitución, principio VIII): sección «Configuración» (pestañas Taller, Tipos de servicio, Términos y Bitácora, con sus formularios y estados), sección «Reportes» (selector de reporte, rango de fechas con atajos de mes, tabla, totales, botón Exportar, estados de carga, vacío y error), pantalla de aceptación de términos (texto con desplazamiento, botones Aceptar y Rechazar), mensaje de cierre por inactividad y la línea «Próximo servicio» del ticket (FR-034)
- [X] T003 Crear `database/migrations/006_sprint7_configuracion_seguridad.sql` (aditiva; no modifica migraciones anteriores): tabla `settings` (`settingKey VARCHAR(60)` clave primaria, `settingValue VARCHAR(255)` obligatorio, `updatedBy INT UNSIGNED` nulo con llave foránea a `users.id`, `updatedAt DATETIME` con `ON UPDATE CURRENT_TIMESTAMP`); tabla `service_types` (`id`, `name VARCHAR(100)` obligatorio y único, `intervalDays` y `intervalKm INT UNSIGNED` nulos, `active TINYINT(1) DEFAULT 1`, `CHECK (intervalDays IS NOT NULL OR intervalKm IS NOT NULL)`, marcas de tiempo); columna `order_services.serviceTypeId INT UNSIGNED NULL` con llave foránea sin cascada e índice; columna `users.lastActivityAt DATETIME NULL`; columnas nulas de `tickets` (`shopName VARCHAR(120)`, `shopAddress VARCHAR(200)`, `shopPhone VARCHAR(30)`, `nextServiceName VARCHAR(100)`, `nextServiceDate DATE`, `nextServiceMileage INT UNSIGNED`); tabla `terms_versions` (`version INT UNSIGNED` clave primaria autoincremental, `termsText` y `privacyText TEXT` obligatorios, `publishedBy` nulo con llave foránea, `publishedAt`); tabla `terms_acceptances` (clave primaria `(userId, version)` con llaves foráneas, `acceptedAt`); tabla `audit_log` (`id BIGINT UNSIGNED`, `userId` nulo con llave foránea, `actorLabel VARCHAR(120)`, `action VARCHAR(40)` obligatoria, `entity VARCHAR(40)`, `entityId`, `detail JSON`, `createdAt`, índices `(createdAt)`, `(userId, createdAt)` y `(action, createdAt)`); InnoDB y `utf8mb4`; sin borrado en cascada (FR-001, FR-002, FR-005, FR-018, FR-024, FR-028)
- [X] T004 Aplicar la migración 006 a la base de pruebas y a la de desarrollo con `powershell -ExecutionPolicy Bypass -File database/scripts/aplicar-migraciones.ps1 -Puerto 3307 -Base motorix_sdd_test` y luego `-Base motorix_sdd`; comprobar que registra `006` y que repetirlo no la vuelve a aplicar (FR-032)
- [X] T005 Ajustar las pruebas existentes por las tablas nuevas (riesgo R-09): agregar `audit_log`, `terms_acceptances`, `terms_versions`, `service_types` y `settings` a `limpiarBase` en `server/tests/helpers.js` (antes de `users` y de `order_services`, respetando las llaves foráneas) y a las listas de tablas de `seeds.sprint5.test.js` y `seeds.sprint6.test.js`; agregar el ayudante `aceptarTerminos(usuarios)` que acepta la versión vigente por cada usuario de prueba, y registrar el ajuste en el documento de calidad (FR-033)
- [X] T006 [P] Agregar a `server/utils/constants.js` las constantes del sprint: claves de configuración (`workshop.name`, `workshop.address`, `workshop.phone`, `maintenance.warnDays`, `maintenance.warnKm`), límites (días 1–365, kilómetros 1–100,000, intervalos 1–3650 y 1–1,000,000, textos de términos de hasta 20,000 caracteres, rango de reportes de 366 días), `SESSION_INACTIVITY_MINUTES = 30`, `ACTIVITY_REFRESH_SECONDS = 60`, `EXPORT_LINK_SECONDS = 60`, acciones de la bitácora (`LOGIN_FAILED`, `ACCOUNT_LOCKED`, `USER_CREATED`, `USER_DEACTIVATED`, `USER_REACTIVATED`, `USER_ROLE_CHANGED`, `SETTINGS_CHANGED`, `PART_PRICE_CHANGED`, `SERVICE_TYPE_CREATED`, `SERVICE_TYPE_UPDATED`, `PAYMENT_CANCELLED`, `TERMS_PUBLISHED`) y los nombres de los reportes (FR-003, FR-005, FR-014, FR-016, FR-024, FR-028)
- [X] T007 [P] Crear `server/tests/unit/csv.test.js` (deben fallar antes de T008): BOM al inicio, separador coma, comillas dobles escapadas, saltos de línea CRLF, campos con comas y saltos de línea entre comillas, números y nulos, y neutralización de celdas que empiezan con `=`, `+`, `-`, `@` o tabulación (se antepone `'`), sin alterar un número negativo real (FR-016)
- [X] T008 Crear `server/utils/csv.js` con `toCsv(columnas, filas)` y `neutralizar(valor)` y comprobar que T007 pasa (FR-016)
- [X] T009 [P] Crear `server/tests/integration/foundations7.models.test.js` (deben fallar antes de T010 a T013): `settingsModel` (leer, guardar varios valores en una transacción, `updatedBy`), `serviceTypeModel` (crear, nombre duplicado sin distinguir mayúsculas ni acentos, listar activos, desactivar sin borrar, `CHECK` de intervalos), `termsModel` (publicar asigna números consecutivos, versión vigente = mayor, aceptar dos veces no duplica, aceptaciones y pendientes) y `auditModel` (insertar, listar con filtros por fecha, usuario y acción, paginación y total) (FR-005, FR-018, FR-020, FR-024)
- [X] T010 [P] Crear `server/models/settingsModel.js` con `getAll()` y `saveMany(pares, userId)` (FR-001, FR-003)
- [X] T011 [P] Crear `server/models/serviceTypeModel.js` con `list({ onlyActive })`, `findById`, `create`, `update` y `usedCount(id)` (FR-005, FR-006)
- [X] T012 [P] Crear `server/models/termsModel.js` con `current()`, `publish`, `accept(userId, version)` idempotente, `hasAccepted` y `acceptances(version)` (FR-018, FR-020, FR-022)
- [X] T013 [P] Crear `server/models/auditModel.js` con `insert(conexion, entrada)` y `list(filtros)` paginado, sin funciones de actualización ni de borrado (FR-024, FR-025)
- [X] T014 [P] Crear `server/tests/unit/auditService.test.js` (deben fallar antes de T015): cada acción solo conserva su lista cerrada de campos; se descartan `password`, `passwordHash`, `token`, `cardNumber` y cualquier campo extra aunque se pasen; un inicio de sesión fallido guarda el identificador y nunca la contraseña; `record` con una acción desconocida lanza un error (FR-024, FR-026)
- [X] T015 Crear `server/services/auditService.js` (fábrica con dependencias inyectables): `record(accion, datos)` con un constructor de detalle por acción que aplica la lista cerrada de campos, y `list(filtros)` (FR-024, FR-025, FR-026)
- [X] T016 [P] Crear `server/tests/unit/settingsService.test.js` (deben fallar antes de T017): respaldo a `WORKSHOP_*` y a 15 días y 500 km cuando no hay filas; límites de 1 a 365 y de 1 a 100,000 con mensaje claro; nombre obligatorio de hasta 120 caracteres, dirección de hasta 200 y teléfono de hasta 30; guardar solo lo recibido; la bitácora recibe los cambios `{key, from, to}` solo de lo que cambió (FR-001, FR-003, FR-004, FR-026)
- [X] T017 Crear `server/services/settingsService.js` (fábrica con dependencias inyectables) con `get()`, `update(cambios, usuario)`, `getWorkshop()` y `getMaintenanceMargins()` que leen de la base en cada llamada, sin caché (FR-001, FR-003, FR-004)
- [X] T018 [P] Crear los modelos Dart `client/lib/models/app_settings.dart`, `service_type.dart`, `terms.dart`, `audit_entry.dart` y `report.dart` con los campos del contrato (`contracts/api.md`) y `client/test/helpers/fake_api_s7.dart` con respuestas simuladas para configuración, tipos de servicio, términos, bitácora y los cinco reportes, y con el filtro por rol (403 para recepción y mecánico en lo exclusivo del administrador) (FR-001, FR-009, FR-018, FR-024)
- [X] T019 Ejecutar `npm test -- tests/unit/csv.test.js tests/unit/auditService.test.js tests/unit/settingsService.test.js tests/integration/foundations7.models.test.js` y comprobar que pasan, y que la suite completa del backend sigue verde (fin del punto de control de los fundamentos) (FR-033)

**Punto de control**: la base, los modelos, la bitácora, la configuración y el CSV existen y las pruebas previas siguen en verde.

---

# ENTREGA 7A: configuración, catálogo, ticket, términos y seguridad

## Fase 3: Historia de usuario 1 - Editar los datos del taller (Prioridad: P1)

**Objetivo**: el administrador cambia el nombre, la dirección y el teléfono del taller desde la aplicación y los tickets nuevos los usan con instantánea (FR-001, FR-002, FR-004).

**Prueba independiente**: cambia el nombre y el teléfono, genera un ticket nuevo y ve los datos actualizados; un ticket anterior conserva los suyos.

### Pruebas de la historia 1 (escribir primero)

- [X] T020 [P] [US1] Crear `server/tests/integration/settings.test.js`: `GET /api/settings` trae los valores de respaldo (`.env` o predeterminados) sin filas; `PUT /api/settings` guarda y responde lo nuevo; recepción y mecánico reciben `403` en ambos; un nombre vacío o de más de 120 caracteres responde `400`; el cambio queda en la bitácora con `{key, from, to}`; sin sesión `401` (FR-001, FR-004, FR-024); debe fallar antes de T024
- [X] T021 [P] [US1] Crear `server/tests/contract/settings.contract.test.js`: forma exacta de `GET` y `PUT /api/settings` (`workshop`, `maintenance` y `defaults`) (FR-001)
- [X] T022 [P] [US1] Crear `server/tests/integration/tickets.snapshot.test.js`: el ticket guarda `shopName`, `shopAddress` y `shopPhone` al generarse; cambiar la configuración después no altera ese ticket y sí el siguiente; un ticket sin instantánea (anterior al sprint, columnas nulas) se arma con los datos vigentes; repetir la generación no reescribe la instantánea (FR-002); debe fallar antes de T025
- [X] T023 [P] [US1] Crear `client/test/screens/settings_screen_test.dart` (parte «Taller»): la sección «Configuración» solo la ve el administrador; muestra los datos vigentes, valida el nombre obligatorio, guarda y confirma, muestra el error del servidor, y los estados de carga y error con «Reintentar» (FR-001); debe fallar antes de T027

### Implementación de la historia 1

- [X] T024 [US1] Crear `server/validators/settingsValidator.js`, `server/controllers/settingsController.js` y `server/routes/settingsRoutes.js` (`GET` y `PUT /api/settings`, solo ADMIN) y registrar la ruta en `server/app.js`; `settingsService.update` registra `SETTINGS_CHANGED` con `auditService` (FR-001, FR-024)
- [X] T025 [US1] Modificar `server/models/ticketModel.js` (`create` y `findByOrder` con las columnas de la instantánea) y `server/services/ticketService.js` (`generate` toma `settingsService.getWorkshop()` y la guarda; `contenido` usa la instantánea si existe y los datos vigentes si no) (FR-002)
- [X] T026 [US1] Ajustar `server/services/ticketBuilder.js` y `server/services/ticketPrint.js` para recibir el taller de la instantánea, y actualizar `server/tests/contract/tickets.contract.test.js` por los campos declarados (el ticket agrega `nextService`, nulo por ahora) y registrar el ajuste en el documento de calidad (FR-002)
- [X] T027 [US1] Crear `client/lib/providers/settings_provider.dart` y `client/lib/screens/settings_screen.dart` (pestañas; esta tarea implementa «Taller»); registrar la sección «Configuración» (solo `UserRole.admin`) en `client/lib/screens/home_screen.dart` y el provider con `addSessionEndListener(reset)` y el constructor de la sección en `client/lib/main.dart` (FR-001)
- [X] T028 [US1] Ejecutar `npm test -- tests/integration/settings.test.js tests/contract/settings.contract.test.js tests/integration/tickets.snapshot.test.js` y `flutter test test/screens/settings_screen_test.dart` y comprobar que pasan, y que la suite completa sigue verde; fin del punto de control (FR-001, FR-002, SC-001)

**Punto de control**: los datos del taller se editan desde la aplicación y los tickets conservan su instantánea.

---

## Fase 4: Historia de usuario 2 - Ajustar los márgenes de «Próximo» (Prioridad: P2)

**Objetivo**: los días y kilómetros que hacen «Próximo» a un mantenimiento se editan y los respetan Mantenimientos, el panel y los avisos (FR-003, FR-004).

**Prueba independiente**: cambiar los días de 15 a 30 convierte en Próximo un mantenimiento a 25 días en Mantenimientos, en el panel y en los avisos.

### Pruebas de la historia 2 (escribir primero)

- [X] T029 [P] [US2] Ampliar `server/tests/unit/maintenanceClassifier.test.js` (el comportamiento con 15 días y 500 km no cambia) y crear `server/tests/integration/settings.margins.test.js`: con 15 y 500 un mantenimiento a 25 días es Normal; al guardar `warnDays` 30 pasa a Próximo en `/api/maintenance`, `/api/dashboard` y `/api/notifications` en la siguiente consulta; lo mismo con kilómetros; 0, 400 días o 100,001 km responden `400` y no cambian nada; los límites 1 y 365 y 1 y 100,000 se aceptan (FR-003, FR-004); debe fallar antes de T030
- [X] T030 [US2] Modificar `server/services/maintenanceClassifier.js` (`classify` recibe `margenes = { dias, km }` con los valores de hoy por omisión) y `server/services/maintenanceService.js` (pide `settingsService.getMaintenanceMargins()` una vez por operación y lo pasa a la clasificación en `create`, `get`, `update`, `list` y `listAllClassified`); ajustar las pruebas unitarias de `maintenanceService` que simulan sus dependencias para inyectar los márgenes (FR-003)
- [X] T031 [P] [US2] Ampliar `client/test/screens/settings_screen_test.dart` (parte «Márgenes») y `client/lib/screens/settings_screen.dart`: dos campos numéricos con sus límites, mensajes claros, guardar y confirmar, y el texto que explica qué hace cada margen (FR-003)
- [X] T032 [US2] Ejecutar `npm test -- tests/unit/maintenanceClassifier.test.js tests/integration/settings.margins.test.js` y `flutter test test/screens/settings_screen_test.dart` y comprobar que pasan, y que la suite completa sigue verde (incluidas las pruebas de avisos del Sprint 6); fin del punto de control (FR-003)

**Punto de control**: los márgenes salen de la configuración y los avisos siguen coincidiendo con Mantenimientos y el panel.

---

## Fase 5: Historia de usuario 3 - Catálogo de tipos de servicio y propuesta (Prioridad: P2)

**Objetivo**: catálogo con intervalos, enlace opcional desde las líneas de servicio y propuesta del próximo mantenimiento (FR-005, FR-006, FR-007).

**Prueba independiente**: crear «Cambio de aceite» (180 días y 5,000 km), enlazarlo a un servicio de una orden y recibir la propuesta con fecha y kilometraje corregibles.

### Pruebas de la historia 3 (escribir primero)

- [X] T033 [P] [US3] Crear `server/tests/integration/serviceTypes.test.js`: crear con intervalos válidos (`201`); sin ningún intervalo `400`; fuera de rango `400`; nombre repetido sin distinguir mayúsculas `409 SERVICE_TYPE_DUPLICATE`; editar y desactivar sin borrar; el administrador lista todos y recepción y mecánico solo los activos; recepción y mecánico reciben `403` al crear y editar; cada alta y cambio queda en la bitácora (FR-005, FR-006, FR-024); debe fallar antes de T038
- [X] T034 [P] [US3] Crear `server/tests/integration/orders.serviceType.test.js`: una línea de servicio acepta `serviceTypeId` de un tipo activo y la orden devuelve `serviceTypeId` y `serviceTypeName`; un tipo inexistente o desactivado responde `400`; las líneas sin tipo siguen funcionando; desactivar un tipo no cambia las líneas que ya lo usan; el mecánico solo lo hace en sus órdenes en curso (FR-006); debe fallar antes de T039
- [X] T035 [P] [US3] Crear `server/tests/integration/orders.proposal.test.js`: `GET /api/orders/:id/maintenance-proposal` devuelve por cada tipo con intervalo la fecha (hoy más los días) y el kilometraje (el del servicio o el de entrada más los kilómetros), con nulos si el tipo no tiene ese intervalo; vacío sin tipos; `404` si la orden no existe; un mecánico no accede a una orden ajena (FR-007); debe fallar antes de T040
- [X] T036 [P] [US3] Crear `server/tests/contract/serviceTypes.contract.test.js`: forma exacta de los tipos, de la propuesta y de los servicios de la orden con `serviceTypeId` (FR-005, FR-007)
- [X] T037 [P] [US3] Crear `client/test/screens/service_types_tab_test.dart`: la pestaña «Tipos de servicio» lista, crea, edita y desactiva con los límites y el error de nombre repetido; el diálogo de línea de servicio de la orden ofrece los tipos activos; el formulario de mantenimiento de una orden ofrece «Usar propuesta» y rellena fecha y kilometraje corregibles (FR-005, FR-006, FR-007); debe fallar antes de T041

### Implementación de la historia 3

- [X] T038 [US3] Crear `server/validators/serviceTypeValidator.js`, `server/services/serviceTypeService.js`, `server/controllers/serviceTypeController.js` y `server/routes/serviceTypeRoutes.js` (`/api/service-types`: `GET` para los tres roles con los activos para quien no es administrador; `POST` y `PATCH /api/service-types/:id` solo ADMIN) y registrar la ruta; registrar `SERVICE_TYPE_CREATED` y `SERVICE_TYPE_UPDATED` (FR-005, FR-006, FR-024)
- [X] T039 [US3] Modificar `server/models/orderModel.js`, `server/services/orderService.js`, `server/validators/orderValidator.js` y `server/services/serializers.js` para que las líneas de servicio acepten y devuelvan `serviceTypeId` y `serviceTypeName`, validando que el tipo exista y esté activo (FR-006)
- [X] T040 [US3] Agregar `orderService.getMaintenanceProposal(id, usuario)` y la ruta `GET /api/orders/:id/maintenance-proposal` en `server/routes/orderRoutes.js` y su controlador (FR-007)
- [X] T041 [US3] Crear `client/lib/providers/service_types_provider.dart`, la pestaña «Tipos de servicio» en `client/lib/screens/settings_screen.dart`, el selector de tipo en `client/lib/widgets/order_line_dialogs.dart` y el botón «Usar propuesta» en `client/lib/screens/maintenance_form_screen.dart` (revisar primero cómo recibe la orden de origen) (FR-005, FR-006, FR-007)
- [X] T042 [US3] Ejecutar `npm test -- tests/integration/serviceTypes.test.js tests/integration/orders.serviceType.test.js tests/integration/orders.proposal.test.js tests/contract/serviceTypes.contract.test.js` y `flutter test test/screens/service_types_tab_test.dart` y comprobar que pasan, y que la suite sigue verde; fin del punto de control (FR-005, FR-006, FR-007)

**Punto de control**: el catálogo existe, las líneas se enlazan y la propuesta se calcula.

---

## Fase 6: Historia de usuario 8 - El ticket indica el próximo servicio (Prioridad: P2)

**Objetivo**: el ticket nuevo muestra «Próximo servicio» y lo guarda en su instantánea (FR-008, FR-002).

**Prueba independiente**: el ticket de una orden con «Cambio de aceite» muestra la fecha y el kilometraje; sin tipo con intervalo no muestra la línea.

### Pruebas de la historia 8 (escribir primero)

- [X] T043 [P] [US8] Crear `server/tests/integration/tickets.nextService.test.js`: con un tipo con intervalo `nextService` trae nombre, fecha (la de generación más los días) y kilometraje; con varios tipos, la fecha más cercana y el kilometraje menor; con solo días o solo kilómetros el otro dato es nulo; sin tipos con intervalo es `null`; cambiar el catálogo después no cambia el ticket generado; la página imprimible incluye la línea «Próximo servicio» solo cuando existe (FR-008, FR-002); debe fallar antes de T045
- [X] T044 [P] [US8] Crear `client/test/screens/ticket_next_service_test.dart`: el ticket muestra «Próximo servicio» con fecha y kilometraje y no muestra la línea si no hay (FR-008); debe fallar antes de T046

### Implementación de la historia 8

- [X] T045 [US8] Modificar `server/models/ticketModel.js` (consulta de los tipos con intervalo de la orden) y `server/services/ticketService.js` (calcula `nextService`, lo guarda en la instantánea y lo devuelve), y `server/services/ticketBuilder.js` y `ticketPrint.js` para mostrarlo (FR-008, FR-002)
- [X] T046 [US8] Modificar `client/lib/models/ticket.dart` y `client/lib/screens/ticket_screen.dart` para leer y mostrar `nextService` (FR-008)
- [X] T047 [US8] Ejecutar `npm test -- tests/integration/tickets.nextService.test.js tests/integration/tickets.snapshot.test.js tests/contract/tickets.contract.test.js` y `flutter test test/screens/ticket_next_service_test.dart test/screens/ticket_screen_test.dart` y comprobar que pasan, y que la suite sigue verde; fin del punto de control (FR-008)

**Punto de control**: el ticket recuerda al cliente su próximo servicio.

---

## Fase 7: Historia de usuario 9 - Aceptar los términos y condiciones (Prioridad: P1)

**Objetivo**: versiones de términos con aceptación por usuario, validada en el servidor y con pantalla de aceptación (FR-018 a FR-023).

**Prueba independiente**: un usuario sin aceptación vigente ve la pantalla al ingresar y recibe `403 TERMS_NOT_ACCEPTED` si llama directo a la API; aceptar lo deja entrar; una versión nueva se vuelve a pedir.

### Pruebas de la historia 9 (escribir primero)

- [X] T048 [P] [US9] Crear `server/tests/unit/termsService.test.js` con modelos simulados: la vigente es la mayor; `accept` es idempotente; sin versión no se exige nada; publicar valida los textos (obligatorios, hasta 20,000 caracteres) y registra `TERMS_PUBLISHED`; las aceptaciones separan aceptados y pendientes (FR-018, FR-020, FR-022); debe fallar antes de T053
- [X] T049 [P] [US9] Crear `server/tests/integration/terms.test.js`: `GET /terms/current` con y sin versión y con `accepted`; `POST /terms/accept` guarda usuario, versión y fecha y repetirlo no duplica; `POST /terms` solo ADMIN (`403` para los demás) crea la versión siguiente; dos publicaciones simultáneas reciben números distintos; `GET /terms/acceptances` lista aceptados y pendientes solo para ADMIN (FR-018, FR-020, FR-022); debe fallar antes de T053
- [X] T050 [P] [US9] Crear `server/tests/integration/terms.gate.test.js`: con una versión vigente y sin aceptación, cualquier ruta protegida (clientes, órdenes, avisos, reportes, usuarios) responde `403 TERMS_NOT_ACCEPTED`; las rutas exentas (`/auth/me`, `/terms/current`, `/terms/accept`) responden; tras aceptar todo funciona; al publicar una versión nueva vuelve a responder `403` hasta aceptarla; sin versión publicada no se exige nada y las pruebas existentes no se ven afectadas (FR-021, SC-005); debe fallar antes de T054
- [X] T051 [P] [US9] Crear `server/tests/contract/terms.contract.test.js`: forma exacta de `GET /terms/current`, `POST /terms/accept`, `POST /terms`, `GET /terms/acceptances` y del error `TERMS_NOT_ACCEPTED` (FR-018, FR-021)
- [X] T052 [P] [US9] Crear `client/test/screens/terms_screen_test.dart`: al iniciar sesión sin aceptación aparece la pantalla con los términos y el aviso de privacidad; rechazar cierra la sesión; aceptar entra a la aplicación; si una petición responde `TERMS_NOT_ACCEPTED` con la sesión abierta aparece la pantalla; el administrador publica una versión y ve aceptados y pendientes (FR-019, FR-022); debe fallar antes de T055 y T056

### Implementación de la historia 9

- [X] T053 [US9] Crear `server/validators/termsValidator.js`, `server/services/termsService.js`, `server/controllers/termsController.js` y `server/routes/termsRoutes.js` y registrar la ruta en `server/app.js` (FR-018, FR-020, FR-022)
- [X] T054 [US9] Modificar `server/middlewares/authenticate.js`: después de cargar al usuario, si existe una versión vigente que no aceptó y la ruta no es una de las exentas, responder `403 TERMS_NOT_ACCEPTED` (código nuevo en `server/utils/httpError.js`); sin versión publicada no consulta la aceptación (FR-021)
- [X] T055 [US9] Modificar `client/lib/services/api_client.dart` (`onTermsRequired` ante `TERMS_NOT_ACCEPTED`), `client/lib/providers/auth_provider.dart` (consulta los términos tras el inicio de sesión y expone `termsPending`; rechazar cierra la sesión), crear `client/lib/providers/terms_provider.dart` y `client/lib/screens/terms_screen.dart` y mostrarla desde `_AuthGate` en `client/lib/main.dart` (FR-019)
- [X] T056 [US9] Agregar a `client/lib/screens/settings_screen.dart` la pestaña «Términos»: texto vigente, aceptados y pendientes y el formulario para publicar una versión nueva (FR-022)
- [X] T057 [US9] Ejecutar `npm test -- tests/unit/termsService.test.js tests/integration/terms.test.js tests/integration/terms.gate.test.js tests/contract/terms.contract.test.js` y `flutter test test/screens/terms_screen_test.dart` y comprobar que pasan, y que la suite completa sigue verde; fin del punto de control (FR-018 a FR-022, SC-005)

**Punto de control**: nadie usa el sistema sin aceptar los términos vigentes.

---

## Fase 8: Historia de usuario 10 - Seguridad de la información (Prioridad: P1)

**Objetivo**: bitácora consultable, política de contraseñas probada, cierre por inactividad, encabezados de seguridad y pruebas de no exposición e inyección (FR-024 a FR-031).

**Prueba independiente**: cambiar un rol deja una entrada en la bitácora sin secretos; una sesión inactiva más de 30 minutos es rechazada; ninguna respuesta incluye datos reservados.

### Pruebas de la historia 10 (escribir primero)

- [X] T058 [P] [US10] Crear `server/tests/integration/audit.log.test.js`: cada acción de la lista (inicio de sesión fallido, bloqueo tras 5 intentos, alta, baja, reactivación y cambio de rol de usuarios, cambio de configuración, de precio de refacción y del catálogo, pago cancelado y publicación de términos) deja una entrada con usuario, acción, entidad y fecha; `GET /audit-log` filtra por fecha, usuario y acción, pagina y ordena de la más reciente; solo ADMIN (`403` para los demás); no existen rutas de edición, borrado ni exportación (`404`); ninguna entrada contiene contraseñas, hashes, tokens ni datos de tarjeta (se buscan los valores usados en la prueba) (FR-024, FR-025, FR-026, SC-005); debe fallar antes de T065 y T066
- [X] T059 [P] [US10] Crear `server/tests/integration/session.inactivity.test.js`: con la marca de actividad 31 minutos atrás responde `401 SESSION_INACTIVE`; con 30 minutos sigue vigente; la actividad refresca la marca; `GET /api/notifications` no refresca la marca; iniciar sesión la fija; una marca nula se trata como vigente (FR-028); debe fallar antes de T067
- [X] T060 [P] [US10] Crear `server/tests/integration/security.headers.test.js`: las respuestas de la API traen `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` y `Cache-Control: no-store`, incluidas las de error; no hay `X-Powered-By` (FR-029); debe fallar antes de T068
- [X] T061 [P] [US10] Crear `server/tests/integration/security.exposure.test.js`: recorre cada endpoint de usuarios, refacciones, órdenes, pagos y tickets con cada rol y comprueba que ninguna respuesta incluye `passwordHash`, `token`, `failedAttempts` ni `lockedUntil`, y que el mecánico no recibe precios y recepción no recibe `purchasePrice` (FR-030)
- [X] T062 [P] [US10] Crear `server/tests/integration/security.injection.test.js`: textos como `' OR 1=1 --`, `%`, `_`, `\` y comillas en los campos de búsqueda de clientes, vehículos, citas, órdenes, refacciones y mantenimientos se tratan como texto literal: `200`, sin filas de más y sin errores de SQL (FR-031)
- [X] T063 [P] [US10] Crear `server/tests/integration/password.policy.test.js`: al crear un usuario y al cambiar la contraseña se rechazan las de menos de 8 caracteres o sin mayúscula, minúscula o número, con mensajes claros; una válida se acepta y se guarda solo con hash (FR-027)
- [X] T064 [P] [US10] Crear `client/test/screens/inactivity_test.dart` y `client/test/screens/audit_tab_test.dart`: sin interacción durante 30 minutos la sesión se cierra con el mensaje «Tu sesión se cerró por inactividad.»; tocar o escribir reinicia el temporizador; una respuesta `SESSION_INACTIVE` cierra la sesión con el mismo mensaje; la pestaña «Bitácora» filtra por fecha, usuario y acción, pagina y muestra los estados de carga, vacío y error (FR-025, FR-028); deben fallar antes de T069

### Implementación de la historia 10

- [X] T065 [US10] Crear `server/validators/auditValidator.js`, `server/controllers/auditController.js` y `server/routes/auditRoutes.js` (`GET /api/audit-log`, solo ADMIN) y registrar la ruta en `server/app.js` (FR-025)
- [X] T066 [US10] Registrar la bitácora con `auditService` en `server/services/authService.js` (`LOGIN_FAILED` y `ACCOUNT_LOCKED`, sin romper el inicio de sesión si falla el registro), `userService.js` (alta, baja, reactivación y cambio de rol), `partService.js` (precios de compra y venta), `paymentService.js` (pago cancelado) y `termsService.js` (ya hecho en T053), y ajustar las pruebas unitarias que simulan esos servicios (FR-024, FR-026)
- [X] T067 [US10] Modificar `server/middlewares/authenticate.js` y `server/models/userModel.js`: rechazar con `401 SESSION_INACTIVE` (código nuevo) cuando `TIMESTAMPDIFF` sobre `lastActivityAt` supera 30 minutos, refrescar la marca solo si tiene más de 60 segundos y nunca desde `GET /api/notifications`, y fijarla al iniciar sesión (FR-028)
- [X] T068 [US10] Crear `server/middlewares/securityHeaders.js` y registrarlo en `server/app.js` antes de las rutas, con `app.disable('x-powered-by')`; la página imprimible del ticket y la descarga CSV conservan sus propios `Cache-Control` y `Content-Type` (FR-029)
- [X] T069 [US10] Crear `client/lib/widgets/inactivity_watcher.dart` (temporizador de 30 minutos reiniciado con toques, teclas y desplazamientos, que cierra la sesión con el mensaje), usarlo en `client/lib/main.dart` alrededor de la pantalla principal, mostrar el mensaje en `login_screen.dart` mediante `AuthProvider`, tratar `SESSION_INACTIVE` en `api_client.dart` y crear `audit_provider.dart` y la pestaña «Bitácora» de `settings_screen.dart` (FR-025, FR-028)
- [X] T070 [US10] Ejecutar `npm test -- tests/integration/audit.log.test.js tests/integration/session.inactivity.test.js tests/integration/security tests/integration/password.policy.test.js` y `flutter test test/screens/inactivity_test.dart test/screens/audit_tab_test.dart` y comprobar que pasan, y que la suite completa sigue verde; fin de la entrega 7A (FR-024 a FR-031)

**Punto de control de la entrega 7A**: configuración, catálogo, ticket, términos y seguridad funcionan y la suite completa está en verde.

---

# ENTREGA 7B: reportes y exportación

## Fase 9: Historia de usuario 4 - Ingresos por periodo (Prioridad: P1)

**Objetivo**: reporte de ingresos por rango, método y día o mes, con importes en centavos enteros (FR-009, FR-014, FR-015, FR-017).

**Prueba independiente**: con pagos en tres días, el reporte del mes coincide con la suma de los pagos Pagados.

### Pruebas de la historia 4 (escribir primero)

- [X] T071 [P] [US4] Crear `server/tests/integration/reports.income.test.js`: el total y el desglose por método y por día o por mes coinciden con los pagos Pagados del rango (se compara contra la suma directa en centavos); los Pendientes, Rechazados y Cancelados no cuentan; los límites del rango son inclusivos; un rango de un solo día es válido; un rango de más de 366 días, con fecha inicial posterior o con formato inválido responde `400`; sin pagos devuelve ceros y listas vacías; agrupar por día o por mes suma lo mismo; recepción y mecánico reciben `403` (FR-009, FR-014, FR-015, FR-017, SC-002); debe fallar antes de T074
- [X] T072 [P] [US4] Crear `server/tests/contract/reports.contract.test.js` con la forma exacta de `/reports/income` (`total`, `byMethod`, `byPeriod`) y, al avanzar el sprint, de los otros cuatro reportes (FR-009)
- [X] T073 [P] [US4] Crear `client/test/screens/reports_screen_test.dart` (parte «Ingresos»): la sección «Reportes» solo la ve el administrador; muestra el rango con atajos de mes, el total, el desglose y los estados de carga, vacío y error con «Reintentar»; un rango inválido muestra el mensaje del servidor (FR-009, FR-014); debe fallar antes de T075

### Implementación de la historia 4

- [X] T074 [US4] Crear `server/validators/reportValidator.js` (rango, `groupBy`), `server/models/reportModel.js` (`income`), `server/services/reportService.js` (centavos con `utils/money.js`), `server/controllers/reportController.js` y `server/routes/reportRoutes.js` (`GET /api/reports/income`, solo ADMIN) y registrar la ruta (FR-009, FR-014, FR-015, FR-017)
- [X] T075 [US4] Crear `client/lib/providers/reports_provider.dart` y `client/lib/screens/reports_screen.dart` (selector de reporte, rango con atajos de mes, tabla, totales y estados) y registrar la sección «Reportes» (solo administrador) en `home_screen.dart` y `main.dart` (FR-009)
- [X] T076 [US4] Ejecutar `npm test -- tests/integration/reports.income.test.js tests/contract/reports.contract.test.js` y `flutter test test/screens/reports_screen_test.dart` y comprobar que pasan, y que la suite sigue verde; fin del punto de control (FR-009, SC-002)

**Punto de control**: el administrador ve cuánto cobró el taller en cualquier periodo.

---

## Fase 10: Historia de usuario 5 - Servicios frecuentes y productividad (Prioridad: P2)

**Objetivo**: servicios más frecuentes y productividad por mecánico (FR-010, FR-011).

**Prueba independiente**: con órdenes terminadas de dos mecánicos, el reporte muestra sus órdenes y su mano de obra y los servicios por frecuencia.

- [X] T077 [P] [US5] Crear `server/tests/integration/reports.services.test.js` y `server/tests/integration/reports.productivity.test.js`: solo cuentan las órdenes Terminadas o Entregadas con fecha de término en el rango (por el último registro `TERMINADO` del historial); una orden Terminada y luego Entregada cuenta una sola vez; las canceladas y en curso no cuentan; los servicios se agrupan por tipo o por descripción si no tienen tipo y se ordenan de mayor a menor; la productividad suma las órdenes distintas y la mano de obra por mecánico y coincide con las órdenes de origen en centavos; `403` para recepción y mecánico (FR-010, FR-011, FR-015, FR-017); deben fallar antes de T078
- [X] T078 [US5] Agregar `services` y `productivity` a `server/models/reportModel.js`, `server/services/reportService.js`, `reportController.js` y `reportRoutes.js` (FR-010, FR-011)
- [X] T079 [P] [US5] Ampliar `client/test/screens/reports_screen_test.dart` y `client/lib/screens/reports_screen.dart` con «Servicios frecuentes» y «Productividad» (FR-010, FR-011)
- [X] T080 [US5] Ejecutar `npm test -- tests/integration/reports.services.test.js tests/integration/reports.productivity.test.js tests/contract/reports.contract.test.js` y `flutter test test/screens/reports_screen_test.dart` y comprobar que pasan, y que la suite sigue verde; fin del punto de control (FR-010, FR-011)

---

## Fase 11: Historia de usuario 6 - Margen de refacciones y rotación (Prioridad: P2)

**Objetivo**: costo, venta y margen por refacción y rotación del inventario (FR-012, FR-013).

**Prueba independiente**: con refacciones usadas en órdenes del periodo, el reporte muestra unidades, costo, venta y margen y marca «sin costo» la que tiene precio de compra 0.

- [X] T081 [P] [US6] Crear `server/tests/integration/reports.parts.test.js` y `server/tests/integration/reports.rotation.test.js`: unidades, costo (precio de compra vigente por unidades), venta (suma de las líneas) y margen coinciden con los datos de origen en centavos; la refacción con precio de compra 0 sale `noCost` con costo y margen nulos y no entra en los totales de costo y margen; la rotación divide las unidades que salieron por órdenes en el rango entre la existencia actual y es nula con existencia 0; solo ADMIN (`403` para los demás, sin exponer precios de compra) (FR-012, FR-013, FR-015, FR-017); deben fallar antes de T082
- [X] T082 [US6] Agregar `parts` y `rotation` a `server/models/reportModel.js`, `server/services/reportService.js`, `reportController.js` y `reportRoutes.js` (FR-012, FR-013)
- [X] T083 [P] [US6] Ampliar `client/test/screens/reports_screen_test.dart` y `client/lib/screens/reports_screen.dart` con «Refacciones» (con la marca «sin costo») y «Rotación de inventario» (FR-012, FR-013)
- [X] T084 [US6] Ejecutar `npm test -- tests/integration/reports.parts.test.js tests/integration/reports.rotation.test.js tests/contract/reports.contract.test.js` y `flutter test test/screens/reports_screen_test.dart` y comprobar que pasan, y que la suite sigue verde; fin del punto de control (FR-012, FR-013)

---

## Fase 12: Historia de usuario 7 - Exportar cada reporte (Prioridad: P2)

**Objetivo**: exportación a CSV con enlace de 60 segundos, igual a la pantalla (FR-016).

**Prueba independiente**: el CSV de ingresos trae las mismas filas y totales que la pantalla.

- [X] T085 [P] [US7] Crear `server/tests/integration/reports.export.test.js`: para cada uno de los cinco reportes, el CSV descargado tiene las mismas filas y totales que la respuesta JSON del mismo rango; empieza con BOM y se abre como UTF-8; trae `Content-Disposition` con el nombre del reporte y el rango; el enlace deja de servir tras 60 segundos (se comprueba con un token vencido) y no sirve con otro reporte ni otro rango; sin token válido `401`; el enlace solo lo pide el administrador; una descripción que empieza con `=` sale neutralizada (FR-016, FR-017, SC-004); debe fallar antes de T086
- [X] T086 [US7] Crear `server/services/reportExport.js` (token firmado de 60 segundos con clave propia, filas de cada reporte para el CSV con `utils/csv.js`) y las rutas `GET /api/reports/:name/export-link` y `GET /api/reports/export/:token` (esta última sin sesión), con `Content-Type: text/csv; charset=utf-8` y `Cache-Control: no-store` (FR-016)
- [X] T087 [P] [US7] Ampliar `client/test/screens/reports_screen_test.dart` y `client/lib/screens/reports_screen.dart` con el botón «Exportar» que pide el enlace y lo abre con `url_launcher`, con mensaje de error si falla (FR-016)
- [X] T088 [US7] Ejecutar `npm test -- tests/integration/reports.export.test.js tests/contract/reports.contract.test.js` y `flutter test test/screens/reports_screen_test.dart` y comprobar que pasan, y que la suite sigue verde; fin de la entrega 7B (FR-016, SC-004)

---

## Fase 13: Datos de ejemplo y rendimiento (transversal)

**Objetivo**: demostrar el sprint con datos reales al arrancar y medir el rendimiento (FR-032, SC-003, SC-007).

- [X] T089 [P] Crear `server/tests/integration/seeds.sprint7.test.js`: tras `aplicarSeeds()` existen la configuración inicial, al menos cuatro tipos de servicio con intervalos, líneas de servicio enlazadas a un tipo, la versión 1 de los términos, cuyos textos mencionan el uso permitido, la confidencialidad de los datos de clientes y vehículos, la responsabilidad de las cuentas personales y el aviso de privacidad (FR-023), y datos suficientes para que cada reporte muestre información de un rango amplio; cargar los seeds dos veces no cambia el conteo de ninguna tabla (FR-032, SC-007); debe fallar antes de T091
- [X] T090 [P] Crear `server/tests/integration/reports.performance.test.js`: con un año de datos (por ejemplo 3,000 pagos, 3,000 órdenes con sus servicios, mano de obra y refacciones, y los movimientos correspondientes) cada uno de los cinco reportes responde en menos de 3 segundos con un rango de 366 días (FR-014, SC-003)
- [X] T091 Crear `database/seeds/010_configuracion.sql` (idempotente, con `INSERT ... SELECT ... WHERE NOT EXISTS`): configuración inicial, cuatro tipos de servicio (Cambio de aceite: 180 días y 5,000 km; Frenos; Afinación; Llantas), líneas de servicio de órdenes existentes enlazadas a un tipo, la versión 1 de los términos y el aviso de privacidad (plantilla en español que cubre uso permitido, confidencialidad de los datos de clientes y vehículos, responsabilidad de las cuentas personales y aviso de privacidad) y pagos y órdenes suficientes en los últimos meses para los reportes; y ajustar `seeds.sprint5.test.js`, `seeds.sprint6.test.js` y `notifications.performance.test.js` para aceptar los términos con `aceptarTerminos` (FR-023, FR-032)
- [X] T092 Si T090 supera las metas, optimizar las consultas de `server/models/reportModel.js` (índices en una migración nueva solo si hace falta, o agregación) sin cambiar el comportamiento y volver a ejecutar `npm test -- tests/integration/reports.performance.test.js tests/integration/reports.income.test.js tests/integration/reports.services.test.js tests/integration/reports.parts.test.js` (FR-014, SC-003)
- [X] T093 Ejecutar `npm test -- tests/integration/seeds.sprint7.test.js tests/integration/reports.performance.test.js` y comprobar que pasan, y que la suite completa del backend sigue verde (FR-032, FR-033)

---

## Fase 14: Cierre

- [X] T094 [P] Actualizar `docs/project-context.md`: nueva sección de configuración y reportes con las reglas del sprint, términos y seguridad, `14.2` (Sprint 7 implementado, último del proyecto), la lista de decisiones resueltas con Spec Kit para el Sprint 7 y la deuda técnica declarada (FR-034)
- [X] T095 [P] Actualizar `README.md` (sprints, tabla por rol de configuración, reportes, términos y bitácora, y las reglas de inactividad y exportación), `database/README.md` (migración 006 y seeds 010) y `.env.example` (los datos del taller quedan como valor de respaldo) (FR-034)
- [X] T096 Crear `specs/007-reportes-configuracion/validacion-quickstart.md` ejecutando los escenarios de `quickstart.md` contra la API real (arrancada con `node server/server.js`) sobre la base de pruebas, y registrar el resultado de cada uno (FR-033)
- [X] T097 Ejecutar la regresión completa: `npm test` y `npm run lint` en `server/`, `flutter test` y `flutter analyze` en `client/`; guardar la salida en `docs/evidencias/sprint-7/regresion-backend.txt`, `lint-backend.txt` y `regresion-frontend.txt` y compararla con la línea base (106 suites y 1462 pruebas; 308 pruebas): ninguna prueba anterior debe pasar de verde a rojo (SC-006, FR-033)
- [X] T098 Tomar las capturas de los Sprints 6 y 7 con la API y la app web en local y guardarlas en `docs/evidencias/sprint-6/` y `docs/evidencias/sprint-7/` (campana y panel, insignias, clientes por avisar, configuración, tipos de servicio, términos, bitácora, reportes y ticket con próximo servicio); las que no salgan las toma Jorge (SC-001)
- [ ] T099 Medir SC-001 (cambiar los datos del taller y ver el ticket nuevo en menos de 1 minuto) y SC-003 (reportes con un año de datos en menos de 3 segundos) y registrar los tiempos en `docs/aseguramiento-calidad-sprint-7.md` (SC-001, SC-003)
- [X] T100 Cerrar `docs/aseguramiento-calidad-sprint-7.md`: trazabilidad con tareas y pruebas, hallazgos, regresión (línea base y cierre), el control de calidad final con 5 requisitos en las 9 columnas de la bitácora del reporte integral (ID, requisito, criterio de aceptación verificable, prueba ejecutada, resultado, evidencia o enlace, defecto o incidencia, prioridad y observaciones) con su anexo de evidencias, y la aprobación de Jorge Francisco Dominguez Ramirez (FR-033)
- [X] T101 Corregir `docs/sprints/propuesta-sprints-post-mvp.md` (Sprint 7 «Implementado»), marcar todas las tareas de este archivo como `[X]` y comprobar que los documentos no se contradicen (FR-034)

---

## Dependencias y orden de ejecución

- **Fase 1** (T001) ya está hecha. **Fase 2** (T002 a T019) bloquea todas las historias; T002 va primero que cualquier pantalla y T005 antes de cualquier prueba de integración nueva.
- **Entrega 7A**: US1 (T020 a T028) crea la pantalla de Configuración y el ticket con instantánea; US2, US3, US9 y US10 agregan pestañas a esa pantalla y dependen de US1 para la parte del cliente (en el servidor son independientes entre sí); US8 depende de US3 (tipos con intervalo) y de US1 (instantánea del ticket); US9 modifica `authenticate.js` (T054) y US10 también (T067), así que se hacen en secuencia; T066 requiere los servicios de US3, US9 y la configuración de US1.
- **Entrega 7B**: US4 (T071 a T076) crea el módulo de reportes y la pantalla; US5, US6 y US7 lo amplían y dependen de US4; US7 requiere los cinco reportes.
- **Fase 13** (datos y rendimiento) requiere las diez historias; **Fase 14** (cierre) requiere la Fase 13. T091 debe ir antes de correr cualquier prueba que cargue seeds (porque agrega la versión 1 de los términos).

## Oportunidades de paralelismo

- T002, T003, T006, T007 y T014 son independientes entre sí.
- Los modelos T010 a T013 están en archivos distintos.
- Las pruebas de una misma historia (marcadas `[P]`) están en archivos distintos: por ejemplo T058 a T064 en US10 y T071 a T073 en US4.
- T094 y T095 (documentación) no dependen del código.

## Estrategia de implementación

1. **Alcance mínimo demostrable**: Fundamentos + US1 + US9 + US10 + US4, que son las historias P1: datos del taller, términos, seguridad e ingresos. Con ellas el sprint ya cumple su objetivo principal.
2. **Entrega incremental**: US2, US3 y US8 completan la configuración y el ticket (7A); US5, US6 y US7 completan los reportes (7B).
3. **Si el calendario aprieta** (30 de noviembre): se recorta la 7B a ingresos y servicios frecuentes con exportación (US4, US5 y US7) y se declara el resto como deuda técnica.
4. **Regla de calidad**: cada historia termina con su punto de control (pruebas nuevas y suite completa en verde) y con un commit pequeño, con las pruebas antes del código.

## Cobertura de requisitos

| Requisito | Tareas |
|-----------|--------|
| FR-001 | T003, T010, T016, T017, T018, T020, T021, T023, T024, T027 |
| FR-002 | T003, T022, T025, T026, T043, T045 |
| FR-003 | T006, T016, T029, T030, T031 |
| FR-004 | T016, T017, T020, T029 |
| FR-005 | T003, T006, T009, T011, T033, T036, T038, T041 |
| FR-006 | T011, T033, T034, T039, T037, T041 |
| FR-007 | T035, T036, T040, T037, T041 |
| FR-008 | T043, T045, T044, T046 |
| FR-009 | T018, T071, T072, T073, T074, T075 |
| FR-010 | T077, T078, T079 |
| FR-011 | T077, T078, T079 |
| FR-012 | T081, T082, T083 |
| FR-013 | T081, T082, T083 |
| FR-014 | T006, T071, T073, T074, T090 |
| FR-015 | T071, T074, T077, T081 |
| FR-016 | T006, T007, T008, T085, T086, T087 |
| FR-017 | T071, T077, T081, T085 |
| FR-018 | T003, T009, T012, T048, T049, T051, T053 |
| FR-019 | T052, T055 |
| FR-020 | T009, T048, T049, T053 |
| FR-021 | T050, T051, T054 |
| FR-022 | T012, T048, T049, T052, T053, T056 |
| FR-023 | T091 |
| FR-024 | T003, T006, T009, T013, T014, T015, T058, T066 |
| FR-025 | T013, T058, T064, T065, T069 |
| FR-026 | T014, T015, T016, T058, T066 |
| FR-027 | T063 |
| FR-028 | T003, T006, T059, T064, T067, T069 |
| FR-029 | T060, T068 |
| FR-030 | T061 |
| FR-031 | T062 |
| FR-032 | T004, T089, T091, T093 |
| FR-033 | T001, T005, T019, T093, T096, T097, T100 (y todas las pruebas de las fases 2 a 12) |
| FR-034 | T002, T094, T095, T101 |

Criterios de éxito: SC-001 con T022, T028, T098 y T099; SC-002 con T071, T077 y T081; SC-003 con T090, T092 y T099; SC-004 con T085 y T088; SC-005 con T050, T057 y T058; SC-006 con T097; SC-007 con T089 y T093.

Cada una de las 101 tareas cita al menos un requisito o criterio de éxito, con excepción de las de preparación y cierre, que citan FR-033 o FR-034.
