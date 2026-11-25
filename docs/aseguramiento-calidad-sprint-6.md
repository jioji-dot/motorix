# Aseguramiento de la calidad - Sprint 6: Notificaciones internas y clientes por avisar

Este documento es el registro de calidad del Sprint 6 de Motorix. Reúne las puertas de calidad, las decisiones, los riesgos, la trazabilidad de los criterios de aceptación, los hallazgos, la regresión de los sprints 1 a 5 y el control de calidad final, con sus evidencias.

Resultado general: **en curso** (se completa al cierre del sprint).

## 0. Datos del documento

| Campo | Valor |
|---|---|
| Sprint | 6 - Notificaciones internas y clientes por avisar |
| Insumo | `docs/sprints/sprint-6-notificaciones-internas.md` |
| Rama | `006-notificaciones-internas` |
| Responsable | Jorge Francisco Dominguez Ramirez, representante del proyecto |
| Fecha de inicio | 2026-11-24 |
| Fecha de cierre | Por definir (se completa al cierre) |
| Estado general | En curso |

## 1. Objetivo y alcance

**Objetivo.** Asegurar que el Sprint 6 salga con calidad: que los requisitos estén completos, sean medibles y no se contradigan, que las pruebas estén planeadas antes del código y que el cambio no rompa lo construido en los sprints 1 a 5.

**Dentro del alcance:** centro de notificaciones en el encabezado con avisos por rol (mantenimientos próximos y vencidos, citas del día, stock bajo o agotado y órdenes detenidas), calculados con datos reales y con la lectura guardada por usuario; insignia de stock en el ícono de Inventario para el administrador; lista de clientes por avisar con su registro de quién avisó y cuándo.

**Fuera del alcance:** lo que el insumo del sprint lista en su sección 8: envío automático de avisos al cliente por cualquier canal, notificaciones en tiempo real o del sistema operativo, preferencias por usuario, historial de avisos pasados, y los reportes y la configuración del taller (Sprint 7).

## 2. Criterios de entrada y de salida

Los criterios se marcan `[x]` solo cuando se cumplen de verdad. Los de entrada se cumplieron el 2026-11-24; los de salida se marcan al cierre.

**Criterios de entrada (para comenzar la implementación):**

- [x] Las 8 puertas de la sección 3 están Aprobadas o Aprobadas con observación.
- [x] La enmienda de la constitución (hallazgo H-01) está aprobada y registrada.
- [x] Las decisiones de la sección 4 están resueltas y registradas.
- [x] No hay hallazgos críticos ni altos abiertos en el análisis de consistencia.
- [x] Cada criterio de aceptación tiene al menos una prueba planeada (sección 6).
- [x] La línea base de regresión está registrada (sección 8).
- [x] La documentación desfasada de los sprints anteriores está identificada (`docs/sprints/propuesta-sprints-post-mvp.md`, el insumo del sprint, `docs/project-context.md` sección 6.12 y `docs/design-system.md`).

**Criterios de salida (para cerrar el sprint):**

- [x] Los 14 criterios de aceptación están Aprobados.
- [x] Todas las pruebas de los sprints 1 a 5 siguen pasando.
- [x] No hay defectos críticos ni altos abiertos (sección 7).
- [x] La matriz de calidad final (sección 9) está completa, con evidencia (las capturas y el cronometraje de SC-004 quedan pendientes y declarados).
- [x] Reporte, análisis y matriz no se contradicen.

## 3. Puertas de calidad

Cada puerta se verifica antes de comenzar la implementación. El detalle de cada una está en los documentos citados en la columna de evidencia.

| ID | Puerta | Estado | Evidencia |
|:--:|---|---|---|
| G-01 | Insumo del sprint revisado contra el código | Aprobado con observación | `docs/sprints/sprint-6-notificaciones-internas.md` corregido el 2026-11-24 (H-02 a H-04). Observación: las decisiones de su sección 9 quedan por resolver en `/speckit.clarify` |
| G-02 | Especificación (`/speckit.specify`) | Aprobado | `specs/006-notificaciones-internas/spec.md`: 7 historias de usuario, 23 requisitos funcionales y 7 criterios de éxito. Cada requisito indica si mantiene lo existente o agrega algo nuevo. Sin marcadores `[NEEDS CLARIFICATION]`; las decisiones abiertas quedan como supuestos recomendados |
| G-03 | Aclaraciones (`/speckit.clarify`) | Aprobado | 5 decisiones resueltas en la sesión del 2026-11-24 (sección 4), todas con la opción recomendada; sin marcadores `[NEEDS CLARIFICATION]`; las 8 decisiones del insumo quedaron resueltas en la especificación (FR-004, FR-005, FR-006, FR-009, FR-011, FR-017) |
| G-04 | Lista de calidad de requisitos (`/speckit.checklist`) | Aprobado | `specs/006-notificaciones-internas/checklists/notificaciones.md`: 40 puntos revisados y resueltos (H-06); los huecos se corrigieron en `spec.md` |
| G-05 | Plan (`/speckit.plan`) | Aprobado | `specs/006-notificaciones-internas/plan.md`, `research.md`, `data-model.md`, `contracts/api.md` y `quickstart.md`. Constitución v1.2.0 sin violaciones (8 de 8 principios); migración `005` aditiva y consecutiva con dos tablas (`notification_reads` y `client_notices`); 4 rutas nuevas; sin dependencias nuevas |
| G-06 | Tareas (`/speckit.tasks`) | Aprobado | `specs/006-notificaciones-internas/tasks.md`: 72 tareas (1 de preparación, 16 de fundamentos, 10 en US1, 3 en US2, 5 en US3, 3 en US4, 5 en US5, 7 en US6, 8 en US7, 6 de datos y rendimiento y 8 de cierre), con las pruebas antes del código en cada historia, el ajuste de `design-system.md` antes de cualquier pantalla y una tabla de cobertura de los 23 requisitos |
| G-07 | Consistencia (`/speckit.analyze`) | Aprobado | 2 pasadas el 2026-11-24. Pasada 1: 0 críticos, 1 alto, 4 medios y 5 bajos (H-07). Pasada 2, tras corregir: 0 críticos, 0 altos, 0 medios y 0 bajos. 23 de 23 requisitos y 7 de 7 criterios de éxito con tarea (100 %); 72 tareas consecutivas, todas con requisito o criterio de éxito |
| G-08 | Pruebas planeadas y línea base | Aprobado | Los 14 criterios de aceptación tienen al menos una prueba planeada (sección 6) y los 9 riesgos tienen la prueba o el seguimiento que los cubre (sección 5); línea base de 90 suites y 1332 pruebas de backend y 256 de frontend, con la salida completa en `docs/evidencias/sprint-6/` (sección 8) |

## 4. Decisiones de aclaración

Las 8 decisiones abiertas del insumo (sección 9) se resolvieron el 2026-11-24, algunas como supuestos recomendados desde la especificación y cinco en la etapa de aclaraciones, siempre con la opción recomendada y con la aprobación de Jorge Francisco Dominguez Ramirez. El texto completo está en `specs/006-notificaciones-internas/spec.md` (sección «Aclaraciones» y «Supuestos»).

| ID | Decisión | Resolución | Requisito afectado |
|:--:|---|---|---|
| D-01 | Criterio de orden detenida | Orden abierta con 72 horas (3 días de 24 horas) o más desde su último cambio de estado (valor fijo) | FR-005 |
| D-02 | Cita del día | La de hoy, Pendiente o Confirmada, hasta el fin del día aunque su hora ya pasó | FR-004 |
| D-03 | Actualización del contador | Al iniciar sesión, al cambiar de módulo y cada 60 segundos | FR-011 |
| D-04 | Identidad de un aviso para la lectura | Tipo, objeto y estado; la lectura se descarta cuando el aviso desaparece | FR-009 |
| D-05 | Reaparición de un aviso leído | Vuelve a no leído cuando empeora (Próximo a Vencido, stock bajo a agotado) o cuando la condición reaparece | FR-009 |
| D-06 | Anticipación de los avisos | Mantenimiento con los márgenes existentes (15 días o 500 km); cita del día el mismo día; cita de mañana solo en la lista de clientes por avisar | FR-004, FR-015 |
| D-07 | Aviso al cliente y nota | Cada hecho se avisa una vez, con nota opcional de hasta 255 caracteres; un hecho nuevo reaparece | FR-017 |
| D-08 | Qué ve el mecánico | Solo avisos de órdenes detenidas asignadas a él; sin mantenimientos, citas ni stock | FR-006 |
| D-09 | Dónde está la lista de clientes por avisar | Sección propia del menú con insignia, para administración y recepción | FR-015 |
| D-10 | Qué abre cada aviso | Detalle de la orden, de la cita o de la refacción; o Mantenimientos con la placa en el buscador | FR-010 |

## 5. Riesgos y mitigaciones

| ID | Riesgo | Impacto | Mitigación | Prueba que lo cubre | Estado |
|:--:|---|---|---|---|---|
| R-01 | Un rol recibe avisos que no le corresponden (stock para recepción o mecánico, órdenes ajenas para un mecánico) | Alto: fuga de información por rol | Filtrar por rol en el servidor y recorrer todas las rutas nuevas con cada rol | `notifications.reception.test.js`, `notifications.stock.test.js`, `notifications.mechanic.test.js`, `notifications_mechanic_test.dart` (T028, T031, T039, T040) | Abierto |
| R-02 | Las cifras del centro no coinciden con el panel de control, Mantenimientos o Inventario | Alto: el usuario deja de confiar en los avisos | Reutilizar los mismos cálculos (clasificador de mantenimientos, alertas de stock, consulta de citas) y probar la coincidencia | `notifications.consistency.test.js` (T061) | Abierto |
| R-03 | La consulta periódica (cada 60 segundos) es lenta con muchos datos porque la clasificación de mantenimientos se hace en memoria | Medio: la aplicación se siente lenta | Medir con volumen realista y limitar la consulta | `notifications.performance.test.js` (T060, T063) | Abierto |
| R-04 | Una orden se marca como detenida usando una fecha equivocada (la de actualización cambia al editar líneas) | Medio: avisos falsos o ausentes | Medir con el último cambio del historial de estados | `notifications.stalled.test.js` (T036) | Abierto |
| R-05 | Un cliente se avisa dos veces por el mismo hecho, o desaparece de la lista un hecho nuevo | Medio: avisos repetidos u olvidados | Registro único por hecho y prueba de hechos nuevos y de solicitudes simultáneas | `clientNotices.mark.test.js` (T052) | Abierto |
| R-06 | Desajuste de zona horaria entre el servidor y la base al decidir "hoy" y "mañana" | Medio: citas contadas en el día equivocado | Calcular las fechas con la misma hora local que el panel de control y la antigüedad de las órdenes con la hora de MySQL | `notifications.reception.test.js` y `notifications.stalled.test.js` (T028, T036) | Abierto |
| R-07 | Las tablas nuevas contaminan las pruebas de los sprints anteriores | Medio: regresión silenciosa | Agregar las tablas a la limpieza de las pruebas y a la lista de tablas de la prueba de seeds | Ajuste de `helpers.js` y de `seeds.sprint5.test.js` (T005) y `seeds.sprint6.test.js` (T059) | Abierto |
| R-08 | Los seeds con fechas fijas dejan de mostrar avisos con el paso del tiempo | Bajo | Fechas relativas al día de la carga e idempotencia verificada | `seeds.sprint6.test.js` (T059, T062) | Abierto |
| R-09 | El Sprint 6 consume más tiempo del previsto y retrasa el Sprint 7 | Alto: el cierre es el 30 de noviembre | Cerrar el Sprint 6 el 25 de noviembre y proteger el orden 7A antes de 7B | Seguimiento del calendario | Abierto |

## 6. Trazabilidad

Cada criterio de aceptación (CA) del insumo se enlaza con su requisito, su tarea, su prueba y el resultado. Los resultados se llenan al implementar.

| CA | Criterio de aceptación (resumen) | Requisito (FR) | Tarea | Prueba | Resultado | Evidencia |
|:--:|---|---|---|---|---|---|
| CA-1 | La campana muestra el total de avisos no leídos y abre un panel agrupado por tipo | FR-001 | T022, T023, T025, T026 | T018 a T021 | Aprobado | `notification_bell_test.dart`, `notifications.admin.test.js` |
| CA-2 | Los avisos se calculan al consultar; solo se guarda la lectura | FR-003 | T022 | T018, T019 | Aprobado | `notifications.admin.test.js` (no existe tabla de avisos) |
| CA-3 | Tipos: mantenimientos próximos y vencidos, citas del día, stock bajo o agotado y órdenes detenidas | FR-002, FR-005 | T029, T033, T037 | T028, T031, T036 | Aprobado | `notifications.reception.test.js`, `.stock.test.js`, `.stalled.test.js` |
| CA-4 | Cada rol recibe solo sus avisos, validado en el servidor | FR-006, FR-007 | T041 | T028, T031, T039, T040 | Aprobado | `notifications.mechanic.test.js`, [validación del quickstart](../specs/006-notificaciones-internas/validacion-quickstart.md) 2, 3, 8 y 12 |
| CA-5 | Los avisos usan el mismo cálculo que el panel, Mantenimientos y el stock | FR-004, FR-013 | T029, T033 | T061 | Aprobado | `notifications.consistency.test.js`, quickstart 13 |
| CA-6 | La lectura persiste por usuario; el aviso desaparece o reaparece según su estado | FR-008, FR-009 | T047, T048 | T044, T045 | Aprobado | `notifications.read.test.js`, quickstart 4 a 6 |
| CA-7 | Cada aviso abre la pantalla relacionada | FR-010 | T048, T049 | T046 | Aprobado | `notification_open_test.dart` |
| CA-8 | El resumen de stock y la tarjeta del panel siguen funcionando; insignia de Inventario para el administrador | FR-012, FR-013 | T034 | T032, T061 | Aprobado | `inventory_badge_test.dart` (el resumen de Inventario sigue en `parts_alerts_test.dart`) |
| CA-9 | Estados de carga, vacío y error según el sistema de diseño | FR-014 | T002, T025, T056 | T021, T054 | Aprobado | `notification_bell_test.dart`, `client_notices_screen_test.dart` |
| CA-10 | Clientes por avisar para administración y recepción; el mecánico no accede | FR-015, FR-016 | T055, T056, T057 | T040, T051, T054 | Aprobado | `clientNotices.list.test.js`, `client_notices_screen_test.dart` |
| CA-11 | Marcar avisado guarda quién y cuándo, no reaparece por el mismo hecho y sí por uno nuevo | FR-017 a FR-019 | T055 | T052, T053 | Aprobado | `clientNotices.mark.test.js`, quickstart 10 y 11 |
| CA-12 | Los seeds incluyen un caso de cada tipo y son idempotentes | FR-021 | T062 | T059 | Aprobado | `seeds.sprint6.test.js`, quickstart 15 |
| CA-13 | Pruebas de cálculo, permisos, lectura por usuario y rendimiento | FR-022 | T060, T063 | T060 y las pruebas de las fases 2 a 9 | Aprobado | `notifications.performance.test.js`, quickstart 14 |
| CA-14 | Se actualizan `project-context.md` (6.12), `design-system.md` y el README | FR-023 | T002, T065, T066 | Revisión documental | Aprobado | `docs/project-context.md` 6.12, `docs/design-system.md` 8.8 y `README.md` |

## 7. Hallazgos y defectos

Se registra todo lo que se encuentre, sea en los documentos, en el análisis o en las pruebas.

| ID | Descripción | Severidad (crítica, alta, media, baja) | Origen (puerta o prueba) | Estado | Resolución | Evidencia |
|:--:|---|---|---|---|---|---|
| H-01 | La constitución (principio I) solo autorizaba el Sprint 5 como sprint posterior al MVP; los Sprints 6 y 7 requieren una enmienda aprobada | Media | G-01 | Resuelto | Enmienda MINOR 1.2.0 registrada el 2026-11-24: aprueba los Sprints 6 y 7, declara el Sprint 7 como el último y alinea la exclusión de la mensajería al cliente y del hosting | `.specify/memory/constitution.md`, principio I y versión 1.2.0 |
| H-02 | El insumo afirmaba que existían una insignia de stock en el ícono de Inventario, un aviso en la pantalla de inicio y un `StockAlertsProvider`. No existen: solo hay `PartsProvider.summary` (se carga al abrir Inventario) y la tarjeta del panel de control | Media | G-01 | Resuelto | El insumo describe el estado real; CA-8 se reformuló (el resumen y la tarjeta siguen funcionando y la insignia se crea desde el centro de notificaciones, solo para el administrador) | `docs/sprints/sprint-6-notificaciones-internas.md`; `client/lib/providers/parts_provider.dart`; `client/lib/screens/parts_screen.dart` |
| H-03 | `propuesta-sprints-post-mvp.md` marcaba el Sprint 6 como "Implementado" sin que existiera código, especificación ni tablas | Baja | G-01 | Resuelto | Se corrigió a "Por especificar" y se actualizó la fecha del documento | `docs/sprints/propuesta-sprints-post-mvp.md` |
| H-04 | El insumo asumía la migración 006, pero la última migración existente es la 004 | Baja | G-01 | Resuelto | La migración del sprint será `005_sprint6_notificaciones.sql` (consecutiva); el insumo y la especificación lo reflejan | `database/migrations/`; `specs/006-notificaciones-internas/spec.md` (FR-020) |
| H-05 | `service_orders.updatedAt` no sirve para medir una orden detenida porque cambia al editar líneas o notas | Media | G-01 | Resuelto | La especificación mide la antigüedad con el último registro de `order_status_history` (FR-005) | `database/migrations/002_sprint2_appointments_orders.sql`; `specs/006-notificaciones-internas/spec.md` |
| H-06 | La revisión de la lista `notificaciones.md` (40 puntos) encontró huecos y ambigüedades: no estaba definido qué datos lleva cada aviso ni su orden; «3 días» de una orden detenida no distinguía días de calendario de horas ni qué pasa sin historial de estados; el estado que distingue un aviso no estaba definido por tipo; faltaban las reglas de lectura de avisos que ya no existen o no son visibles, de marcar avisado un hecho que ya no aplica, de fallos de la consulta periódica, del tope «99+», de la privacidad del teléfono y de accesibilidad | Media | G-04 (notificaciones.md) | Resuelto | Se corrigió `spec.md`: FR-001, FR-002, FR-005, FR-006, FR-008, FR-009, FR-011, FR-014, FR-015, FR-017, SC-003, casos límite y supuestos (glosario y valores fijos); se actualizó la sección 9 del insumo | `specs/006-notificaciones-internas/checklists/notificaciones.md` |
| H-07 | El análisis de consistencia (pasada 1) encontró: las pruebas de la historia 1 exigían un grupo de cada tipo y los campos `stockAlerts` y `clientsToNotify`, que se implementan en las historias 2, 3, 4 y 7, por lo que el punto de control T027 no podía cumplirse (alta); los clientes desactivados no se excluían en `maintenanceModel` ni había tarea ni prueba (media); `factDate` no estaba definida para un mantenimiento solo por kilometraje ni para una orden Terminada (media); FR-008 decía «se rechaza como no encontrado» mientras el contrato distingue `404` por tipo y `200` sin efecto (media); la trazabilidad y los riesgos seguían en «Por definir» (media); T005 marcada como paralela, dependencias de T055, «3 días» frente a «72 horas», cifras del plan, puntos de control sin archivo y carpeta de pruebas de providers inexistente (bajas) | Alta | G-07 (pasada 1) | Resuelto | Se corrigieron `spec.md` (FR-008, FR-015, casos límite y escenario 1 de US4), `contracts/api.md` y `data-model.md` (`factDate`), `plan.md` (cifras) y `tasks.md` (T005, T011, T013, T017, T018 a T021, T027, T030, T031, T035, T038, T043, T050, T053, T058, T064, T070 y las dependencias); se llenaron las secciones 5 y 6 de este documento. La pasada 2 no encontró hallazgos | Informe de `/speckit.analyze` del 2026-11-24; `specs/006-notificaciones-internas/tasks.md` |
| H-08 | En el cliente Flutter el código se escribió antes que sus pruebas (la tarea exigía pruebas primero); en el backend sí se comprobó que las pruebas fallaban antes de implementar | Baja | Proceso | Resuelto | Se escribieron las pruebas del cliente después y se comprobó una prueba de mutación (quitar la condición «solo administrador» de la insignia de Inventario hace fallar 5 pruebas) | `client/test/screens/inventory_badge_test.dart` |
| H-09 | La prueba de error del panel de avisos descubrió un desbordamiento de 16 px en el estado de error | Baja | Prueba | Resuelto | Se aumentó la altura del estado de error del panel | `client/test/screens/notification_bell_test.dart` |
| H-10 | El centro de avisos y la lista de clientes por avisar excluyen a los clientes desactivados, mientras que el panel de control y la lista de Mantenimientos los siguen contando | Baja | Prueba de coincidencia | Aceptado | Es la regla del sprint (FR-015); las cifras coinciden mientras no haya clientes desactivados con pendientes. Queda como observación para el reporte | `server/tests/integration/notifications.consistency.test.js` |
| H-11 | El escenario 11 del quickstart (entregar la orden y marcarla avisada) no se puede ejecutar tras el escenario 10 con la única orden Terminada de los datos de ejemplo, porque un hecho ya avisado responde `200` por diseño | Baja | Quickstart | Resuelto | Se validó con una cita de mañana cancelada y se anotó la adaptación | [Validación del quickstart](../specs/006-notificaciones-internas/validacion-quickstart.md) |

## 8. Línea base de regresión

Se ejecuta la suite completa antes de tocar el código y de nuevo al cierre. Ninguna prueba de los sprints 1 a 5 debe pasar de verde a rojo.

| Suite | Comando | Antes del sprint 6 | Después del sprint 6 | Diferencia | Evidencia |
|---|---|---|---|---|---|
| Backend (Jest) | `npm test` en `server/` | 90 suites y 1332 pruebas aprobadas, 0 fallidas | 106 suites y 1462 pruebas aprobadas, 0 fallidas | +16 suites y +130 pruebas; ninguna anterior pasó de verde a rojo | [Antes](evidencias/sprint-6/linea-base-backend.txt) · [Después](evidencias/sprint-6/regresion-backend.txt) · [Lint](evidencias/sprint-6/lint-backend.txt) (sin avisos) |
| Frontend (Flutter) | `flutter test` en `client/` | 256 pruebas aprobadas, 0 fallidas | 308 pruebas aprobadas, 0 fallidas; `flutter analyze` sin avisos | +52 pruebas; ninguna anterior pasó de verde a rojo | [Antes](evidencias/sprint-6/linea-base-frontend.txt) · [Después](evidencias/sprint-6/regresion-frontend.txt) |

**Fecha de la línea base:** 2026-11-24, sobre el commit `ad3202a` de la rama `005-precios-refacciones-cobro`, antes de crear la rama `006-notificaciones-internas`.

**Duración del backend:** 86.7 s al inicio y 85.8 s al cierre.

## 9. Control de calidad final

Cinco requisitos funcionales elegidos entre los que más pueden fallar, en las 9 columnas de la bitácora del reporte integral. Enlaces relativos a esta carpeta (`docs/`).

| ID | Requisito | Criterio de aceptación verificable | Prueba ejecutada | Resultado | Evidencia / enlace | Defecto / incidencia (Jira) | Prioridad | Observaciones |
|:--:|---|---|---|---|---|---|:--:|---|
| RF-01 | Cada rol recibe solo los avisos que le corresponden (FR-006, FR-007) | El administrador recibe los seis tipos; recepción ninguno de stock; el mecánico solo las órdenes detenidas asignadas a él, validado en el servidor y no solo en la interfaz | `notifications.reception.test.js`, `notifications.stock.test.js`, `notifications.mechanic.test.js`, `notifications_mechanic_test.dart` y los escenarios 2, 3, 8 y 12 del quickstart contra la API real | Aprobado | [Validación del quickstart](../specs/006-notificaciones-internas/validacion-quickstart.md) · [Regresión](evidencias/sprint-6/regresion-backend.txt) | Sin defectos (H-02 a H-06 fueron de documentación) | Alta | Una petición directa del mecánico no entrega stock, citas ni mantenimientos |
| RF-02 | Una orden está detenida a las 72 horas o más sin cambio de estado (FR-005) | Con 71 horas no aparece y con 72 sí; editar una nota no reinicia la antigüedad; sin historial se mide desde la creación; las Terminadas, Entregadas y Canceladas no generan aviso | `notices.models.test.js`, `notifications.stalled.test.js`; escenario 7 del quickstart | Aprobado | [Validación del quickstart](../specs/006-notificaciones-internas/validacion-quickstart.md) | H-05 resuelto (no se usa `updatedAt`) | Alta | Se mide con la hora de MySQL para no depender de la zona horaria del servidor |
| RF-03 | Las cifras de los avisos coinciden con las de las otras pantallas (FR-004, FR-013) | Los totales de mantenimientos, citas de hoy y stock bajo o agotado son iguales a los de `/dashboard`, `/maintenance` y `/parts/summary` | `notifications.consistency.test.js`; escenario 13 del quickstart | Aprobado | [Validación del quickstart](../specs/006-notificaciones-internas/validacion-quickstart.md) | H-10 aceptado (clientes desactivados) | Alta | Se reutilizan el clasificador de mantenimientos y las consultas existentes; no se duplicó ninguna regla |
| RF-04 | La lectura de un aviso es por usuario y reaparece si cambia de estado (FR-008, FR-009) | Marcar como leído baja el contador y persiste con otra sesión; un aviso que empeora reaparece no leído; la lectura de un aviso inexistente se descarta | `notifications.read.test.js`, `notificationService.test.js`, `notification_open_test.dart`; escenarios 4 a 6 | Aprobado | [Validación del quickstart](../specs/006-notificaciones-internas/validacion-quickstart.md) | Sin defectos | Media | Un tipo ajeno al rol responde `404` y un aviso inexistente de un tipo permitido, `200` sin efecto |
| RF-05 | A cada cliente se le avisa una sola vez por hecho (FR-017 a FR-019) | El primer registro responde `201` con quién y cuándo; repetirlo o dos solicitudes simultáneas dejan un solo registro; si el hecho ya no aplica responde `409` y no registra nada | `clientNotices.mark.test.js`, `clientNotices.list.test.js`, `client_notices_screen_test.dart`; escenarios 10 y 11 | Aprobado | [Validación del quickstart](../specs/006-notificaciones-internas/validacion-quickstart.md) | H-11 resuelto (adaptación del escenario 11) | Alta | La aplicación no envía ningún mensaje al cliente |

### Anexo de evidencias

- Salida de la regresión del backend, del lint y del frontend: `docs/evidencias/sprint-6/`.
- Informe de la validación contra la API real: `specs/006-notificaciones-internas/validacion-quickstart.md`.
- Capturas de pantalla de la campana, el panel, las insignias y la lista de clientes por avisar: pendientes de tomar junto con las del Sprint 7 (se hacen una sola vez con la aplicación completa).
- **Pendiente de una persona (SC-004):** cronometrar que recepción pueda abrir «Clientes por avisar», ubicar a un cliente con su teléfono y marcarlo avisado en menos de 1 minuto. SC-005 (el contador se actualiza al marcar como leído) lo cubre `notification_open_test.dart`: el contador baja en la misma interacción, y persiste tras cerrar sesión (escenario 4).

## 10. Cierre

**Estado del sprint 6: implementado y validado, con dos pendientes declarados** (capturas de pantalla y cronometraje de SC-004), el 2026-11-25.

- 14 de 14 criterios de aceptación aprobados; 7 de 7 historias de usuario implementadas (23 requisitos funcionales).
- Backend: 106 suites y 1462 pruebas en verde (+130). Frontend: 308 pruebas en verde (+52) y análisis sin avisos. Ninguna prueba anterior se rompió.
- Hallazgos: 11 registrados (H-01 a H-11), todos resueltos o aceptados; ninguno crítico ni alto abierto.
- Validación contra la API real: 15 de 15 escenarios del quickstart.
- Aprobación: Jorge Francisco Dominguez Ramirez (pendiente de su revisión).
