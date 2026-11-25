# Plan de implementación: Notificaciones internas y clientes por avisar

**Rama**: `006-notificaciones-internas` | **Fecha**: 2026-11-24 | **Especificación**: [spec.md](spec.md)

**Entrada**: Especificación de la funcionalidad en `specs/006-notificaciones-internas/spec.md`

## Resumen

Hoy el sistema solo tiene piezas sueltas de avisos (el resumen de stock de Inventario, los contadores del panel de control para el administrador y la lista de Mantenimientos). Este plan agrega **un centro de notificaciones calculado al consultar** y **una lista de clientes por avisar**, reutilizando los cálculos que ya existen para que las cifras coincidan:

1. **Cálculo de avisos (FR-001 a FR-007)**: un servicio nuevo `notificationService` arma los avisos del usuario con sus fuentes existentes (clasificador de mantenimientos, alertas de stock, citas del día) y una consulta nueva de órdenes detenidas medida con el último cambio de estado. Un módulo puro `noticeKeys.js` define las claves, los tipos por rol y el orden por urgencia, y se prueba sin base de datos.
2. **Lectura por usuario (FR-008, FR-009)**: la tabla `notification_reads` guarda solo la lectura; al consultar se descartan las lecturas de avisos que ya no existen, de modo que un aviso que reaparece es nuevo.
3. **Clientes por avisar (FR-015 a FR-019)**: `clientNoticeService` calcula los hechos pendientes (orden Terminada sin entregar, cita de mañana, mantenimiento próximo o vencido) y la tabla `client_notices` registra quién avisó, cuándo y la nota; un registro único por hecho.
4. **Cliente Flutter (FR-001, FR-010 a FR-014)**: campana con contador y panel en el encabezado, insignia en el ícono de Inventario (solo administrador), sección «Clientes por avisar» y sondeo cada 60 segundos.
5. **Datos y calidad (FR-020 a FR-023)**: migración aditiva `005`, seeds `009` con fechas relativas, pruebas automáticas y documentación al día.

No se agregan dependencias. Las decisiones técnicas están en [research.md](research.md).

## Contexto técnico

**Lenguaje/Versión**: Node.js 24 con JavaScript ES Modules; Dart con Flutter 3.47.5 (igual que los sprints anteriores)

**Dependencias principales**: ninguna nueva, ni en el backend ni en el frontend

**Almacenamiento**: MySQL 8.0 local, InnoDB, `utf8mb4`; dos tablas nuevas y aditivas (ver [data-model.md](data-model.md))

**Pruebas**: Jest (unitarias de claves, orden y reglas de visibilidad; servicios con modelos simulados) y Jest + supertest (integración y contrato, con prueba de rendimiento) contra la base `*_test`; `flutter test` en el frontend. Las pruebas van antes del código en cada historia

**Plataforma objetivo**: Aplicación Flutter de escritorio/web con prioridad en escritorio; API REST local

**Tipo de proyecto**: Aplicación web con frontend y backend separados (`client/` y `server/`)

**Metas de rendimiento**: la consulta de avisos responde en menos de 1 segundo con los datos de ejemplo y en menos de 3 segundos con 500 mantenimientos pendientes, 500 refacciones y 500 órdenes abiertas (SC-003); el sondeo es de un `GET` cada 60 segundos por sesión

**Restricciones**: el servidor entrega a cada rol solo sus avisos (el stock solo al administrador; el mecánico solo órdenes detenidas suyas) y nunca el teléfono en los avisos del panel; la lista de clientes por avisar es solo de administración y recepción; los avisos se calculan al consultar y no se copian; ningún mensaje se envía al cliente por ningún canal; permisos validados en el backend; toda pantalla sigue `docs/design-system.md`; sin secretos en el repositorio

**Escala/Alcance**: un taller; 2 tablas nuevas; 4 rutas nuevas; alrededor de 10 archivos nuevos en el backend, 7 en el frontend y 4 pantallas o widgets existentes modificados

## Verificación de la constitución

*PUERTA: debe aprobarse antes de la investigación de la Fase 0. Se vuelve a verificar tras el diseño de la Fase 1.*

| Principio | Cumplimiento | Evidencia en el plan |
|-----------|--------------|----------------------|
| I. Alcance, MVP y fuente de verdad | Cumple | Sprint 6 aprobado en la enmienda 1.2.0 (2026-11-24); no agrega funciones fuera del insumo; la mensajería al cliente queda fuera y se declara (FR-018); `docs/project-context.md` se actualiza (FR-023) |
| II. Arquitectura con responsabilidades separadas | Cumple | Reglas en `services/` con fábrica de dependencias; claves y orden en un módulo puro; consultas en `models/`; la campana y la lista son widgets y providers sin lógica de negocio |
| III. Stack y base de datos local | Cumple | Sin tecnologías nuevas; migración `005` aditiva y numerada; seeds `009` idempotentes con datos suficientes para ver cada aviso al arrancar; solo el backend toca la base |
| IV. Seguridad | Cumple | Filtro por rol en el servidor; el mecánico no recibe stock, citas ni mantenimientos aunque llame directo a la API; el teléfono solo viaja en la lista de clientes por avisar; sin secretos; errores sin trazas |
| V. Integridad de las reglas de negocio | Cumple | Los avisos reutilizan los criterios existentes de mantenimiento y stock; un hecho se registra una sola vez (restricción única) y la lectura se guarda por usuario con clave primaria compuesta |
| VI. API consistente y manejo de errores | Cumple | Cuatro rutas con el formato `{ data, meta }` y los errores del formato existente; un código nuevo (`NOTICE_NOT_APPLICABLE`); contrato en [contracts/api.md](contracts/api.md) |
| VII. Pruebas | Cumple | Pruebas antes del código en cada historia, contra `motorix_test`; línea base de 90 suites y 1332 pruebas de backend y 256 de frontend |
| VIII. UX/UI profesional y sencilla | Cumple | Campana, panel, insignias y lista con los componentes y tokens existentes; estados de carga, vacío y error; el diseño se actualiza antes de tocar pantallas |

**Resultado de la puerta**: sin violaciones; no se requiere seguimiento de complejidad.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/006-notificaciones-internas/
├── spec.md
├── plan.md              # Este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   └── api.md           # Fase 1: rutas, respuestas y errores nuevos
├── checklists/
│   ├── requirements.md
│   └── notificaciones.md
└── tasks.md             # Fase 2 (lo crea /speckit.tasks)
```

### Código fuente (raíz del repositorio)

```text
database/
├── migrations/005_sprint6_notificaciones.sql    # nuevo: notification_reads y client_notices
└── seeds/009_notificaciones.sql                 # nuevo: un caso de cada aviso, con fechas relativas

server/
├── utils/constants.js              # se amplía: tipos de aviso, 72 horas, 10 por tipo
├── services/
│   ├── noticeKeys.js               # nuevo, puro: claves, tipos por rol, orden por urgencia
│   ├── notificationService.js      # nuevo: arma los avisos del usuario y marca la lectura
│   ├── clientNoticeService.js      # nuevo: hechos por avisar y registro del aviso
│   └── maintenanceService.js       # se amplía: listAllClassified (sin paginar)
├── models/
│   ├── notificationModel.js        # nuevo: lecturas por usuario (consultar, guardar, descartar)
│   ├── clientNoticeModel.js        # nuevo: registro de avisos a clientes y hechos pendientes
│   ├── orderModel.js               # se amplía: listStalled y órdenes Terminadas sin entregar
│   ├── appointmentModel.js         # se amplía: citas de un día con cliente y placa
│   └── partModel.js                # se amplía: listAlerts (stock bajo o agotado, solo activas)
├── controllers/                    # notificationController.js y clientNoticeController.js
├── routes/                         # notificationRoutes.js y clientNoticeRoutes.js (registro en app.js)
├── validators/notificationValidator.js
└── tests/                          # pruebas nuevas y ajuste de helpers.js y seeds.sprint5.test.js

client/lib/
├── models/                         # notification.dart y client_notice.dart
├── providers/                      # notifications_provider.dart y client_notices_provider.dart
├── widgets/                        # notification_bell.dart y notifications_panel.dart; app_shell.dart se modifica
├── screens/                        # client_notices_screen.dart; home_screen.dart y maintenance_screen.dart se modifican
└── main.dart                       # registro de providers y de la sección nueva

docs/                               # project-context.md (6.12) y design-system.md se actualizan (FR-023)
```

**Decisión de estructura**: se conserva la estructura de los sprints anteriores. El módulo puro `noticeKeys.js` permite probar claves, visibilidad por rol y orden sin base de datos.

## Seguimiento de complejidad

Sin violaciones de la constitución que justificar.
