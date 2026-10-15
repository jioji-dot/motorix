# Investigación (Fase 0): Citas y órdenes de servicio

**Funcionalidad**: [spec.md](spec.md) | **Fecha**: 2026-10-12

El Contexto técnico no tiene marcadores `NEEDS CLARIFICATION`: el stack y las convenciones ya existen desde el Sprint 1 (`specs/001-base-clientes-vehiculos`). Este documento registra las decisiones de diseño propias del Sprint 2.

## D1. Máquina de estados de la orden como módulo puro

- **Decisión**: la lógica de transiciones vive en `server/utils/orderStatus.js` como funciones puras, sin acceso a la base de datos: tabla de transiciones válidas, estados editables y quién puede ejecutar cada transición. El servicio solo la consulta.
- **Transiciones** (FR-023): `RECIBIDO → DIAGNOSTICO → EN_REPARACION → TERMINADO → ENTREGADO` y `EN_REPARACION ⇄ ESPERANDO_REFACCION`. No hay retrocesos ni cancelación.
- **Permisos por transición** (FR-025): hasta `TERMINADO` las ejecuta el mecánico asignado o el administrador; `ENTREGADO` solo recepcionista o administrador.
- **Justificación**: CA-8 exige pruebas de la lógica de transiciones; un módulo puro se prueba exhaustivamente (matriz completa estado × estado × rol) sin base de datos y evita repartir reglas entre controlador y servicio.
- **Alternativas**: reglas dispersas en el servicio (difíciles de probar); tabla de transiciones en la base de datos (complejidad innecesaria con estados fijos).

## D2. Cambio de estado concurrente

- **Decisión**: el cambio de estado se aplica con una actualización condicionada: `UPDATE service_orders SET status = ? WHERE id = ? AND status = ?` dentro de una transacción que también inserta el registro de historial. Si no se afecta ninguna fila, el estado cambió entretanto y se responde `409 INVALID_TRANSITION` con los estados válidos actuales.
- **Justificación**: cubre el caso límite de dos personas cambiando la misma orden a la vez sin bloqueos explícitos y sin estados intermedios.
- **Alternativas**: `SELECT ... FOR UPDATE` (también válido, pero más bloqueos); control de versión por columna (más campos sin ganancia).

## D3. Historial de estados

- **Decisión**: tabla propia `order_status_history` (orden, estado anterior, estado nuevo, usuario, fecha y hora), de solo inserción. La primera fila de cada orden es `NULL → RECIBIDO`.
- **Justificación**: FR-026 exige registrar quién y cuándo; es la base del historial del vehículo del Sprint 3. Es una tabla adicional a las cuatro del insumo, necesaria para el requisito.
- **Alternativas**: columnas `*_at` por estado en la orden (no registran quién ni permiten reintentos como `ESPERANDO_REFACCION`).

## D4. Folio de la orden

- **Decisión**: `OS-` más el identificador de la orden con 6 dígitos (`OS-000123`). Se inserta la orden y, en la misma transacción, se asigna el folio a partir de su `id`; la columna es única. Un script de seeds también completa folios nulos.
- **Justificación**: único por construcción incluso con altas concurrentes, legible y sin tabla de secuencias. Una transacción revertida puede dejar un hueco en la numeración, lo que el requisito permite (solo exige unicidad).
- **Alternativas**: columna generada a partir de `id` (MySQL no permite columnas generadas sobre `AUTO_INCREMENT`); tabla de secuencias (más complejidad y contención).

## D5. Fecha y hora de las citas

- **Decisión**: `scheduledAt` es la hora local de pared del taller, sin zona horaria, en el formato `YYYY-MM-DDTHH:mm`. Se guarda en una columna `DATETIME` y se devuelve en el mismo formato (`DATE_FORMAT` en la consulta). Las comparaciones "no es pasada" y "máximo un año" usan el reloj local del servidor, que en el MVP corre en el mismo equipo y zona que el taller.
- **Justificación**: una cita es un compromiso en hora del taller; convertir a UTC solo agrega desfases (el `Z` de `mysql2` convertiría la hora de pared). Evita errores al determinar "el mismo día" para el aviso de coincidencias (FR-007).
- **Alternativas**: UTC con conversión en el cliente (el cliente web y el de escritorio pueden estar en zonas distintas); columnas separadas de fecha y hora (consultas por rango más incómodas).
- **Riesgo conocido**: si el servidor se despliega en otra zona horaria deberá configurarse una zona del taller; fuera del alcance del MVP local.

## D6. Citas: estados y transiciones

- **Decisión**: valores de la API en español en mayúsculas, igual que los de la orden: `PENDIENTE`, `CONFIRMADA`, `EN_PROCESO`, `COMPLETADA`, `CANCELADA`. Transiciones: `PENDIENTE → CONFIRMADA`; `PENDIENTE|CONFIRMADA → CANCELADA` (solo sin orden); `PENDIENTE|CONFIRMADA → EN_PROCESO` al crear la orden; `EN_PROCESO → COMPLETADA` al entregar la orden. Los endpoints explícitos son `confirm` y `cancel`; las otras dos las dispara la orden dentro de su transacción.
- **Justificación**: el estado de la cita nunca lo fija el usuario libremente, así se garantiza FR-006 y FR-027 sin estados incoherentes.

## D7. Aviso de citas coincidentes

- **Decisión**: igual que el teléfono duplicado del Sprint 1: si hay otra cita no cancelada del mismo vehículo el mismo día, el alta responde `409 APPOINTMENT_DUPLICATE_WARNING` con las citas coincidentes y se repite la petición con `confirmDuplicate: true` tras la confirmación del usuario.
- **Justificación**: mantiene la regla en el servidor y reutiliza el patrón de interfaz ya probado.

## D8. Creación de la orden (transacción única)

- **Decisión**: crear una orden ejecuta en una sola transacción: validar vehículo/cliente (y cita, si viene), validar el kilometraje (D9), insertar la orden, asignar el folio, insertar la primera fila de historial, actualizar el kilometraje del vehículo y, si hay cita, pasarla a `EN_PROCESO`. Se bloquea la cita (`SELECT ... FOR UPDATE`) para evitar dos órdenes de la misma cita; además `appointment_id` es único en la orden.
- **Justificación**: o todo ocurre o nada; evita vehículos con kilometraje cambiado y órdenes sin historial.

## D9. Validación del kilometraje

- **Decisión**: la regla de FR-012 se centraliza en una función de servicio compartida con el Sprint 1: el kilometraje de entrada debe ser entero ≥ 0; si es menor al `current_mileage` del vehículo se exige `mileageCorrection: true` (409 `MILEAGE_DECREASE` en caso contrario); un vehículo en 0 acepta cualquier valor válido. Al aceptar, `current_mileage` pasa a ser el kilometraje de entrada. Corregir `entryMileage` después de crear la orden aplica la misma regla contra el kilometraje actual del vehículo.
- **Nota**: no se distingue "sin valor previo" de "0 km" porque la columna del Sprint 1 es `NOT NULL DEFAULT 0`.

## D10. Importes

- **Decisión**: `DECIMAL(10,2)` para importes y tarifas, `DECIMAL(6,2)` para horas. El importe de cada línea de mano de obra es una columna generada almacenada: `ROUND(hours * hourly_rate, 2)`. Los subtotales se calculan en SQL con `SUM` y se convierten a número en el servicio. Restricciones `CHECK` (MySQL 8.0.16+): importe ≥ 0, horas > 0, tarifa ≥ 0.
- **Justificación**: sin errores de coma flotante; el cálculo del importe queda garantizado por la base. La moneda es única y no se guarda.
- **Alternativas**: `DOUBLE` (errores de redondeo en dinero); calcular importes solo en JavaScript (se puede desincronizar).

## D11. Permisos y visibilidad de órdenes

- **Decisión**: la visibilidad se aplica en el servicio, no en la ruta: el mecánico recibe siempre el filtro `mechanic_id = su id` en el listado y, en el detalle, una orden ajena responde `404 NOT_FOUND` (mismo mensaje que si no existe, para no revelar su existencia). Las operaciones técnicas (diagnóstico, servicios, mano de obra, observaciones) comprueban "administrador o mecánico asignado". Las citas son exclusivas de ADMIN y RECEPTIONIST.
- **Justificación**: Principio IV y RN-15; evita que un middleware de rol por sí solo deje pasar a un mecánico a una orden ajena.

## D12. Catálogo de mecánicos para asignar

- **Decisión**: nuevo endpoint `GET /api/mechanics` (ADMIN y RECEPTIONIST) que devuelve los usuarios activos con rol MECHANIC (`id`, `name`, `username`). `/api/users` sigue siendo exclusivo del administrador.
- **Justificación**: la recepcionista debe elegir mecánico sin acceder a la gestión de usuarios (mínimo privilegio).

## D13. Requisitos para terminar

- **Decisión**: pasar a `TERMINADO` exige diagnóstico no vacío y al menos un servicio o una línea de mano de obra (FR-024a). El rechazo es `409 ORDER_INCOMPLETE` con `details.missing` (`diagnosis`, `servicesOrLabor`). Pasar de `RECIBIDO` a cualquier estado exige mecánico asignado (`409 MECHANIC_REQUIRED`).

## D14. Sin eliminación de órdenes ni citas

- **Decisión**: no existen endpoints de borrado de órdenes, citas ni cambios de estado de orden que las eliminen. Las llaves foráneas son `ON DELETE RESTRICT` para clientes, vehículos y usuarios. Sí se pueden quitar líneas de servicios o mano de obra mientras la orden sea editable (corrección de capturas erróneas, historia 6, escenario 5).
- **Justificación**: RN-9 y FR-017.

## D15. Interfaz

- **Decisión**:
  - Menú lateral: se agregan **Citas** (ADMIN y RECEPTIONIST) y **Órdenes** (los tres roles; el mecánico lo ve como "Mis órdenes" y es su pantalla inicial).
  - Pantallas: listado y formulario de citas; listado de órdenes con filtros; formulario de orden (desde cero o desde una cita); detalle de orden con secciones (datos, diagnóstico, servicios, mano de obra, observaciones y recomendaciones, historial) y acciones de estado.
  - Fecha y hora con `showDatePicker` y `showTimePicker` de Material: sin dependencias nuevas.
  - Colores de estado según `docs/design-system.md`: RECIBIDO gris; DIAGNOSTICO y ESPERANDO_REFACCION `warning`; EN_REPARACION `primary`; TERMINADO y ENTREGADO `success`; citas: Pendiente gris, Confirmada `primary`, En proceso `warning`, Completada `success`, Cancelada `danger`.
  - Confirmaciones obligatorias: cancelar cita, reasignar mecánico, marcar ENTREGADO, citas coincidentes y salir con cambios sin guardar.
- **Justificación**: Principio VIII; sin librerías adicionales.

## D16. Datos de ejemplo

- **Decisión**: `database/seeds/002_sample_appointments_orders.sql` idempotente: citas en los cinco estados con fechas relativas a `NOW()` en el primer alta, y órdenes en los seis estados sobre los vehículos del Sprint 1, varias asignadas al usuario `mecanico`, con servicios, mano de obra e historial coherentes. Claves de idempotencia: citas por (cliente, vehículo, motivo); órdenes por (vehículo, problema reportado); líneas por (orden, descripción); historial por (orden, estado nuevo). El folio se completa con un `UPDATE ... WHERE folio IS NULL`.
- **Justificación**: Principio III y FR-030.
