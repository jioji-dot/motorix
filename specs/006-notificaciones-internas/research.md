# Investigación (Fase 0): Notificaciones internas y clientes por avisar

No quedaron marcadores `[NEEDS CLARIFICATION]` en el contexto técnico. Esta investigación registra los hechos del código que sustentan el plan y las decisiones de diseño.

## 1. Qué existe ya y qué no (hallazgos H-02 y H-05)

- **Decisión**: reutilizar los cálculos existentes para que las cifras coincidan; crear solo lo que no existe.
- **Existe**: el clasificador de mantenimientos (`maintenanceClassifier.js`: Próximo a 15 días o 500 km, Vencido, con `daysLeft` y `kmLeft`) y `maintenanceService.list`, que trae cliente (con teléfono) y vehículo; las alertas de stock (`partModel.stockLevelOf`, `summary` y `list` con filtro de nivel, solo refacciones activas); las citas (`appointmentModel.list` con rango de fechas y el conteo del panel de control, que usa Pendiente y Confirmada); el historial de estados (`order_status_history` con índice `(orderId, changedAt)`); los estados abiertos de la orden (`ORDER_OPEN_STATUSES`); el filtro del mecánico en `orderModel.list`; el patrón de módulo (ruta → controlador → servicio con fábrica → modelo → validador) y los errores uniformes.
- **No existe**: un centro de notificaciones, tablas ni rutas para avisos, el criterio de orden detenida, la lista de clientes por avisar, ni `StockAlertsProvider`, la insignia de Inventario o el aviso de la pantalla de inicio que mencionaba el insumo original. El resumen de stock (`PartsProvider.summary`) solo se carga al abrir Inventario.
- **Consecuencia**: el sprint agrega dos tablas, cuatro rutas y los widgets del cliente, y amplía tres modelos y un servicio con consultas pequeñas.

## 2. Dónde se calculan los avisos

- **Decisión**: un `notificationService` (fábrica con dependencias inyectables) consulta las cuatro fuentes y arma los avisos; el módulo puro `noticeKeys.js` decide la clave, los tipos permitidos por rol y el orden por urgencia.
- **Justificación**: el principio II manda la lógica en `services/`; un módulo puro se prueba sin base de datos; y reutilizar `maintenanceService` y `partModel` garantiza que las cifras coincidan con Mantenimientos, Inventario y el panel de control (SC-002).
- **Alternativas descartadas**: calcular en los controladores (viola el principio II); copiar los avisos a una tabla y mantenerla sincronizada (duplica datos y se desfasa, contra FR-003); calcular en el cliente (el servidor debe decidir qué ve cada rol).

## 3. Identidad de un aviso y lectura

- **Decisión**: la clave es `tipo:objeto:estado` y se guarda en `notification_reads(userId, noticeKey, readAt)` con clave primaria compuesta:
  - mantenimiento: `MANT:{id}:{VENCIDO|PROXIMO}`;
  - stock: `STOCK:{refacciónId}:{AGOTADO|BAJO}`;
  - cita del día: `CITA:{id}`;
  - orden detenida: `ORDEN:{id}`.
- Al consultar, el servidor calcula los avisos visibles del usuario, marca como leídos los que tienen fila y **borra las filas del usuario que ya no corresponden a un aviso vigente** (descarte de la lectura, FR-009). Así un aviso que cambia de estado (Próximo a Vencido) tiene otra clave y reaparece como no leído, y uno que se resuelve y vuelve a ocurrir también aparece como nuevo.
- **Justificación**: es la regla aclarada el 2026-11-24 y no necesita una bitácora; el descarte mantiene la tabla pequeña (solo avisos vigentes por usuario).
- **Alternativas descartadas**: guardar la lectura por tipo sin estado (un aviso que empeora seguiría leído); no descartar nunca (la tabla crece y un aviso que reaparece con el mismo estado saldría leído); una fecha de «leído hasta» por usuario (no distingue avisos individuales).
- **Marcar como leído** (`POST /notifications/read`): se guarda solo si la clave está entre los avisos visibles del usuario; si el tipo no está permitido para su rol responde `404`; si el tipo está permitido pero el aviso ya no existe (o es de una orden ajena) responde `200` sin efecto. De este modo un mecánico no puede distinguir una orden ajena de una inexistente y no hay fuga de información.

## 4. Orden detenida

- **Decisión**: una orden abierta (`ORDER_OPEN_STATUSES`) es detenida cuando `TIMESTAMPDIFF(HOUR, COALESCE(MAX(order_status_history.changedAt), service_orders.createdAt), NOW()) >= 72`. Los días detenida se muestran como `FLOOR(horas / 24)`.
- **Justificación**: `service_orders.updatedAt` cambia al editar líneas o notas y no sirve (H-05); calcular la diferencia con la hora de MySQL evita el desfase de zona horaria entre Node y la base (riesgo R-06); el índice `(orderId, changedAt)` hace barata la agregación.
- **Alternativas descartadas**: usar `updatedAt` (avisos falsos); comparar contra una fecha calculada en Node (desfase de horas); considerar solo `ESPERANDO_REFACCION` (no detecta una orden olvidada en diagnóstico).
- **Mecánico**: la consulta recibe `mechanicId` y limita a sus órdenes; recepción y administración ven todas.

## 5. Citas del día y de mañana

- **Decisión**: una consulta pequeña en `appointmentModel` devuelve las citas Pendientes o Confirmadas de un día, con la hora, el cliente y la placa. «Hoy» y «mañana» se calculan con `hoyLocal()` y se pasan como `YYYY-MM-DD`, igual que el panel de control. La cita sigue siendo aviso hasta el fin del día aunque su hora ya haya pasado.
- **Justificación**: `appointmentModel.list` acepta un solo estado y pagina; una consulta con `status IN (...)` es más simple y evita llamar dos veces. Es el mismo criterio del panel de control.

## 6. Mantenimientos y rendimiento

- **Decisión**: agregar a `maintenanceService` el método `listAllClassified({ classification })`, que devuelve todos los pendientes clasificados sin paginar, reutilizando la función interna que ya clasifica; el aviso toma de ahí los más urgentes (tope de 10 por tipo) y el total.
- **Justificación**: `maintenanceModel.listAll` ya trae todos los pendientes y los clasifica en memoria; paginar a 100 truncaría el conteo de no leídos. Con 500 pendientes el costo es una consulta y un recorrido en memoria, dentro de la meta de 3 segundos (SC-003); se mide con una prueba de rendimiento.
- **Alternativas descartadas**: llamar `list` dos veces con página de 100 (conteo incompleto); clasificar en SQL (duplicaría la regla del clasificador y rompería la coincidencia de cifras).

## 7. Stock

- **Decisión**: `partModel.listAlerts()` devuelve las refacciones activas con nivel bajo o agotado (id, código, nombre, existencia, mínimo y nivel), reutilizando `stockLevelOf`. Solo el administrador recibe estos avisos.
- **Justificación**: coincide con `partModel.summary` y con la tarjeta del panel de control; el stock no se devuelve a recepción ni al mecánico (FR-006).

## 8. Clientes por avisar

- **Decisión**: tres hechos, cada uno con su tipo (`kind`) y el identificador del objeto (`factId`): `ORDEN_LISTA` (orden `TERMINADO` sin entregar, sin importar el pago), `CITA_MANANA` (cita de mañana Pendiente o Confirmada) y `MANTENIMIENTO_PROXIMO` o `MANTENIMIENTO_VENCIDO` (mantenimiento pendiente con esa clasificación). La tabla `client_notices` tiene restricción única `(kind, factId)`: un hecho se avisa una sola vez y un cambio de clasificación es otro `kind`, es decir, un hecho nuevo (FR-017).
- La lista excluye los hechos que ya tienen registro y a los clientes desactivados. Marcar avisado verifica **dentro de una transacción** que el hecho siga aplicando (`409 NOTICE_NOT_APPLICABLE` si no) y usa `INSERT ... ON DUPLICATE KEY` para que el segundo intento no falle ni duplique (FR-019): el primero responde `201` y los siguientes `200` con el registro original.
- **Justificación**: la unicidad en la base resuelve la carrera de dos personas a la vez; el hecho incluye la clasificación por la regla aclarada; no se envía nada al cliente (FR-018).
- **Alternativas descartadas**: guardar el estado del hecho en una columna y permitir varias filas (duplicados); validar la unicidad solo en el servicio (condición de carrera).

## 9. Cliente Flutter

- **Decisión**: `NotificationsProvider` se registra en `main.dart` con `addSessionEndListener(reset)`, igual que los demás providers; `HomeScreen` lo inicia al montarse, lo actualiza al cambiar de sección y mantiene un `Timer.periodic` de 60 segundos que `reset()` cancela. La campana (`notification_bell.dart`) se coloca en `_Header` (`app_shell.dart`); como el encabezado no conoce la navegación, `HomeScreen` le pasa un callback `onOpenSection`.
- Los avisos abren el detalle de la orden, de la cita o de la refacción (pantallas existentes) o la sección Mantenimientos con el buscador prellenado con la placa (`MaintenanceScreen` recibe una búsqueda inicial opcional). La insignia de Inventario y la de «Clientes por avisar» salen de los mismos datos del provider (`stockAlerts` y `clientsToNotify`, este último incluido en la respuesta de avisos para no hacer una segunda consulta periódica).
- **Justificación**: sigue el patrón vigente; evita dependencias; una sola consulta periódica alimenta la campana y las dos insignias.
- **Alternativas descartadas**: `WebSocket` (fuera de alcance); consultar cada insignia por separado (el triple de tráfico).

## 10. Migración, datos de ejemplo y pruebas

- **Migración**: `005_sprint6_notificaciones.sql` es consecutiva (la última existente es la 004; el insumo mencionaba la 006, H-04) y solo crea las dos tablas. El script de migraciones no es transaccional: se aplica primero a la base de pruebas.
- **Seeds**: `009_notificaciones.sql`, idempotente, con fechas relativas a `NOW()`. Aprovecha los datos existentes (mantenimientos en cada clasificación, refacciones con stock bajo y agotado, la orden Terminada OS-000005, citas) y agrega solo lo que falta: una orden en reparación con su último cambio de estado hace 5 días, una cita de hoy y otra de mañana si no existen, y un aviso a cliente de ejemplo ya registrado.
- **Pruebas que se ajustan** (riesgo R-07): `limpiarBase` en `server/tests/helpers.js` agrega las dos tablas nuevas; `seeds.sprint5.test.js` las suma a su lista de tablas; las demás pruebas no listan tablas.
- **Pruebas nuevas**: unitarias de `noticeKeys` y de los servicios con modelos simulados; integración y contrato de las cuatro rutas con los tres roles; coincidencia de cifras con el panel de control, `GET /maintenance` y `GET /parts/summary`; lectura y descarte; hechos de clientes y concurrencia; rendimiento con 500 mantenimientos, 500 refacciones y 500 órdenes abiertas; y en Flutter el provider, la campana, el panel, las insignias y la lista.

## 11. Pantallas, pruebas y documentos afectados

**Cliente**: `app_shell.dart` (campana e insignia de Inventario), `home_screen.dart` (sección nueva, callback y actualización al navegar), `main.dart` (provider y sección), `maintenance_screen.dart` (búsqueda inicial). **Documentos**: `docs/design-system.md` (campana, panel, insignias y lista, antes de tocar pantallas), `docs/project-context.md` (6.12, 14.2 y decisiones del sprint), `README.md` y `database/README.md`.

**Regla de registro**: cualquier prueba de los Sprints 1 a 5 que cambie se anota en el documento de calidad con su razón; ninguna se borra ni se debilita sin ese registro (SC-006).
