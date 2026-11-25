# Investigación (Fase 0): Reportes y configuración

Decisiones técnicas del Sprint 7. Las de producto están en la sección Aclaraciones de [spec.md](spec.md).

## 1. Qué existe ya y qué no (hallazgos H-02 a H-08)

- **Existe**: política de contraseñas (`passwordSchema`), bloqueo por 5 intentos fallidos, JWT de 8 horas, permisos por rol en `authenticate` y `authorize`, el enlace firmado de impresión del ticket (`ticketService.createPrintToken`), `utils/money.js` con centavos enteros y los cálculos de mantenimiento en `maintenanceClassifier.js`.
- **No existe**: `helmet` ni encabezados de seguridad, configuración editable, catálogo de tipos de servicio, instantánea en el ticket, términos, bitácora, actividad del usuario ni reportes.

## 2. Configuración

- **Decisión**: tabla clave-valor `settings` con cinco claves (`workshop.name`, `workshop.address`, `workshop.phone`, `maintenance.warnDays` y `maintenance.warnKm`). Se lee de la base en cada consulta, sin caché, y se completa con `.env` y las constantes de hoy.
- **Razón**: un cambio debe surtir efecto sin reiniciar y sin invalidar cachés entre procesos; la consulta es una lectura por clave primaria de cinco filas.
- **Alternativas**: caché con vencimiento (se descartó por los riesgos de datos viejos en pruebas y en un despliegue con varios procesos); columnas en una tabla de una fila (menos flexible).
- **Impacto**: `classify` recibe los márgenes como parámetro y `maintenanceService` los pide una vez por operación; el panel y los avisos ya usan `maintenanceService`, así que se actualizan solos.

## 3. Catálogo y propuesta del próximo mantenimiento

- **Decisión**: tabla `service_types` (nombre único, intervalos opcionales con al menos uno, `active`) y `order_services.serviceTypeId` nulo por omisión con llave foránea sin cascada. La propuesta es una consulta de solo lectura sobre una orden: fecha = hoy + días y kilometraje = (kilometraje del servicio o de entrada) + kilómetros, por cada tipo con intervalo.
- **Razón**: no cambia el comportamiento de las líneas existentes y respeta RN-12 (intervalos configurables).

## 4. Instantánea del ticket

- **Decisión**: columnas `shopName`, `shopAddress`, `shopPhone`, `nextServiceName`, `nextServiceDate` y `nextServiceMileage` en `tickets`, llenadas al crearlo. `buildTicket` usa la instantánea si existe; si no (tickets anteriores), los datos vigentes y sin próximo servicio.
- **Razón**: cumple CA-1 y CA-14 sin reescribir tickets históricos, que quedaron emitidos con datos que ya no se conocen.

## 5. Términos y condiciones

- **Decisión**: `terms_versions` (el número es la clave autoincremental, así dos publicaciones simultáneas reciben números distintos) y `terms_acceptances` con clave (usuario, versión). `authenticate` consulta la versión vigente y la aceptación del usuario; si hay versión y falta la aceptación y la ruta no está exenta, responde 403 `TERMS_NOT_ACCEPTED`. Rutas exentas: `GET /terms/current`, `POST /terms/accept` y `GET /auth/me`. No hay endpoint de cierre de sesión (el cierre es del cliente).
- **Razón**: el control en `authenticate` cubre todas las rutas presentes y futuras sin tocar cada una. Sin versión publicada no se exige nada, así las pruebas anteriores siguen pasando.

## 6. Inactividad

- **Decisión**: columna `users.lastActivityAt`. En `authenticate`, si pasaron más de 30 minutos desde esa marca se responde 401 `SESSION_INACTIVE`; si no, se actualiza la marca **solo cuando tiene más de 60 segundos** (menos escrituras) y **nunca desde `GET /notifications`**, para que el sondeo de 60 segundos de los avisos no mantenga viva una sesión abandonada. El inicio de sesión fija la marca. Una marca nula (usuarios sin sesión iniciada, tokens de pruebas) se trata como vigente y se fija en la primera petición.
- **Razón**: valida en el servidor (CA-23) sin romper las pruebas que usan tokens emitidos sin iniciar sesión. El cliente cierra la sesión por su cuenta tras 30 minutos sin interacción.
- **Riesgo**: reloj. Se usa la hora de MySQL (`TIMESTAMPDIFF`), no la del proceso.

## 7. Bitácora

- **Decisión**: `audit_log` con `action`, `entity`, `entityId`, `userId`, `actorLabel` (identificador escrito en un inicio de sesión fallido) y `detail` JSON con una lista cerrada de campos por acción (por ejemplo, valores anteriores y nuevos de la configuración, el rol anterior y el nuevo). `auditService.record` no recibe objetos arbitrarios: cada acción tiene su constructor de detalle, que descarta cualquier campo no permitido.
- **Razón**: evita por construcción guardar contraseñas, hashes, tokens o datos de tarjeta (CA-21). Las altas de la tabla solo se hacen con INSERT; no hay rutas de edición ni de borrado.

## 8. Reportes

- **Decisión**: cinco consultas agregadas en `reportModel` sobre `payments`, `service_orders`, `order_services`, `order_labor`, `order_parts`, `parts` e `inventory_movements`, con fechas de término tomadas del historial de estados (último `TERMINADO`) y de cobro de `payments.paidAt`. Los importes pasan a centavos enteros en el servicio con `utils/money.js`. Rango máximo de 366 días.
- **Razón**: RN-10 (no duplicar información) y rendimiento (agregación en SQL con los índices existentes).
- **Limitación declarada**: el costo usa el precio de compra vigente (las líneas no guardan el costo).

## 9. Exportación

- **Decisión**: `GET /reports/:name/export-link` (con sesión) devuelve un token JWT firmado con una clave distinta, con el nombre del reporte y sus parámetros, de 60 segundos; `GET /reports/export/:token` (sin sesión, como la impresión del ticket) responde el CSV con `Content-Disposition`. El CSV se escribe con `utils/csv.js` (BOM, comillas, saltos de línea CRLF y neutralización de `=`, `+`, `-`, `@` y tabulaciones iniciales).
- **Razón**: el navegador no envía encabezados de sesión al abrir un enlace; el patrón ya existe y no agrega dependencias.

## 10. Encabezados de seguridad

- **Decisión**: middleware propio `securityHeaders.js` que fija `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` en `/api` (excepto la página imprimible del ticket y el CSV, que llevan sus propios encabezados) y desactiva `X-Powered-By`.
- **Razón**: `helmet` no existe y no se agregan dependencias.

## 11. Cliente Flutter

- **Decisión**: `ApiClient` reconoce `SESSION_INACTIVE` (cierra la sesión con un mensaje) y `TERMS_NOT_ACCEPTED` (muestra la pantalla de aceptación). `AuthProvider` consulta los términos después del inicio de sesión. Un `InactivityWatcher` reinicia un temporizador de 30 minutos con cada toque, tecla o desplazamiento. Nuevas secciones «Configuración» y «Reportes» solo para el administrador.

## 12. Pruebas y documentos afectados

- Se ajustan `server/tests/helpers.js` (`limpiarBase` con las tablas nuevas, y un ayudante que acepta los términos), `seeds.sprint5.test.js`, `seeds.sprint6.test.js` y `notifications.performance.test.js` (la versión 1 de los términos sembrada exige aceptación), `tickets.contract.test.js` (campos nuevos del ticket) y `maintenanceClassifier.test.js` (nuevo parámetro).
- Documentos: `project-context.md`, `design-system.md`, `README.md`, `database/README.md` y `.env.example`.
