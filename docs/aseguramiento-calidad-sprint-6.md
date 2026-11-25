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

Los criterios se marcan `[x]` solo cuando se cumplen de verdad. Hoy el sprint está después de `/speckit.specify`.

**Criterios de entrada (para comenzar la implementación):**

- [ ] Las 8 puertas de la sección 3 están Aprobadas o Aprobadas con observación.
- [x] La enmienda de la constitución (hallazgo H-01) está aprobada y registrada.
- [ ] Las decisiones de la sección 4 están resueltas y registradas.
- [ ] No hay hallazgos críticos ni altos abiertos en el análisis de consistencia.
- [ ] Cada criterio de aceptación tiene al menos una prueba planeada (sección 6).
- [x] La línea base de regresión está registrada (sección 8).
- [x] La documentación desfasada de los sprints anteriores está identificada (`docs/sprints/propuesta-sprints-post-mvp.md`, el insumo del sprint, `docs/project-context.md` sección 6.12 y `docs/design-system.md`).

**Criterios de salida (para cerrar el sprint):**

- [ ] Los 14 criterios de aceptación están Aprobados.
- [ ] Todas las pruebas de los sprints 1 a 5 siguen pasando.
- [ ] No hay defectos críticos ni altos abiertos (sección 7).
- [ ] La matriz de calidad final (sección 9) está completa, con evidencia.
- [ ] Reporte, análisis y matriz no se contradicen.

## 3. Puertas de calidad

Cada puerta se verifica antes de comenzar la implementación. El detalle de cada una está en los documentos citados en la columna de evidencia.

| ID | Puerta | Estado | Evidencia |
|:--:|---|---|---|
| G-01 | Insumo del sprint revisado contra el código | Aprobado con observación | `docs/sprints/sprint-6-notificaciones-internas.md` corregido el 2026-11-24 (H-02 a H-04). Observación: las decisiones de su sección 9 quedan por resolver en `/speckit.clarify` |
| G-02 | Especificación (`/speckit.specify`) | Aprobado | `specs/006-notificaciones-internas/spec.md`: 7 historias de usuario, 23 requisitos funcionales y 7 criterios de éxito. Cada requisito indica si mantiene lo existente o agrega algo nuevo. Sin marcadores `[NEEDS CLARIFICATION]`; las decisiones abiertas quedan como supuestos recomendados |
| G-03 | Aclaraciones (`/speckit.clarify`) | Aprobado | 5 decisiones resueltas en la sesión del 2026-11-24 (sección 4), todas con la opción recomendada; sin marcadores `[NEEDS CLARIFICATION]`; las 8 decisiones del insumo quedaron resueltas en la especificación (FR-004, FR-005, FR-006, FR-009, FR-011, FR-017) |
| G-04 | Lista de calidad de requisitos (`/speckit.checklist`) | Pendiente | |
| G-05 | Plan (`/speckit.plan`) | Pendiente | |
| G-06 | Tareas (`/speckit.tasks`) | Pendiente | |
| G-07 | Consistencia (`/speckit.analyze`) | Pendiente | |
| G-08 | Pruebas planeadas y línea base | Pendiente | Línea base registrada en la sección 8 |

## 4. Decisiones de aclaración

Las 8 decisiones abiertas del insumo (sección 9) se resolvieron el 2026-11-24, algunas como supuestos recomendados desde la especificación y cinco en la etapa de aclaraciones, siempre con la opción recomendada y con la aprobación de Jorge Francisco Dominguez Ramirez. El texto completo está en `specs/006-notificaciones-internas/spec.md` (sección «Aclaraciones» y «Supuestos»).

| ID | Decisión | Resolución | Requisito afectado |
|:--:|---|---|---|
| D-01 | Criterio de orden detenida | Orden abierta con 3 o más días desde su último cambio de estado (valor fijo) | FR-005 |
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
| R-01 | Un rol recibe avisos que no le corresponden (stock para recepción o mecánico, órdenes ajenas para un mecánico) | Alto: fuga de información por rol | Filtrar por rol en el servidor y recorrer todas las rutas nuevas con cada rol | Por definir en `/speckit.tasks` | Abierto |
| R-02 | Las cifras del centro no coinciden con el panel de control, Mantenimientos o Inventario | Alto: el usuario deja de confiar en los avisos | Reutilizar los mismos cálculos (clasificador de mantenimientos, alertas de stock, consulta de citas) y probar la coincidencia | Por definir | Abierto |
| R-03 | La consulta periódica (cada 60 segundos) es lenta con muchos datos porque la clasificación de mantenimientos se hace en memoria | Medio: la aplicación se siente lenta | Medir con volumen realista y limitar la consulta | Por definir (prueba de rendimiento) | Abierto |
| R-04 | Una orden se marca como detenida usando una fecha equivocada (la de actualización cambia al editar líneas) | Medio: avisos falsos o ausentes | Medir con el último cambio del historial de estados | Por definir | Abierto |
| R-05 | Un cliente se avisa dos veces por el mismo hecho, o desaparece de la lista un hecho nuevo | Medio: avisos repetidos u olvidados | Registro único por hecho y prueba de hechos nuevos | Por definir | Abierto |
| R-06 | Desajuste de zona horaria entre el servidor y la base al decidir "hoy" y "mañana" | Medio: citas contadas en el día equivocado | Calcular las fechas con la misma hora local que el panel de control | Por definir | Abierto |
| R-07 | Las tablas nuevas contaminan las pruebas de los sprints anteriores | Medio: regresión silenciosa | Agregar las tablas a la limpieza de las pruebas y a la lista de tablas de la prueba de seeds | Por definir | Abierto |
| R-08 | Los seeds con fechas fijas dejan de mostrar avisos con el paso del tiempo | Bajo | Fechas relativas al día de la carga e idempotencia verificada | Por definir | Abierto |
| R-09 | El Sprint 6 consume más tiempo del previsto y retrasa el Sprint 7 | Alto: el cierre es el 30 de noviembre | Cerrar el Sprint 6 el 25 de noviembre y proteger el orden 7A antes de 7B | Seguimiento del calendario | Abierto |

## 6. Trazabilidad

Cada criterio de aceptación (CA) del insumo se enlaza con su requisito, su tarea, su prueba y el resultado. Las columnas de tarea y prueba se llenan en `/speckit.tasks`.

| CA | Criterio de aceptación (resumen) | Requisito (FR) | Tarea | Prueba | Resultado | Evidencia |
|:--:|---|---|---|---|---|---|
| CA-1 | La campana muestra el total de avisos no leídos y abre un panel agrupado por tipo | FR-001 | Por definir | Por definir | Pendiente | |
| CA-2 | Los avisos se calculan al consultar; solo se guarda la lectura | FR-003 | Por definir | Por definir | Pendiente | |
| CA-3 | Tipos: mantenimientos próximos y vencidos, citas del día, stock bajo o agotado y órdenes detenidas | FR-002, FR-005 | Por definir | Por definir | Pendiente | |
| CA-4 | Cada rol recibe solo sus avisos, validado en el servidor | FR-006, FR-007 | Por definir | Por definir | Pendiente | |
| CA-5 | Los avisos usan el mismo cálculo que el panel, Mantenimientos y el stock | FR-004, FR-013 | Por definir | Por definir | Pendiente | |
| CA-6 | La lectura persiste por usuario; el aviso desaparece o reaparece según su estado | FR-008, FR-009 | Por definir | Por definir | Pendiente | |
| CA-7 | Cada aviso abre la pantalla relacionada | FR-010 | Por definir | Por definir | Pendiente | |
| CA-8 | El resumen de stock y la tarjeta del panel siguen funcionando; insignia de Inventario para el administrador | FR-012, FR-013 | Por definir | Por definir | Pendiente | |
| CA-9 | Estados de carga, vacío y error según el sistema de diseño | FR-014 | Por definir | Por definir | Pendiente | |
| CA-10 | Clientes por avisar para administración y recepción; el mecánico no accede | FR-015, FR-016 | Por definir | Por definir | Pendiente | |
| CA-11 | Marcar avisado guarda quién y cuándo, no reaparece por el mismo hecho y sí por uno nuevo | FR-017 a FR-019 | Por definir | Por definir | Pendiente | |
| CA-12 | Los seeds incluyen un caso de cada tipo y son idempotentes | FR-021 | Por definir | Por definir | Pendiente | |
| CA-13 | Pruebas de cálculo, permisos, lectura por usuario y rendimiento | FR-022 | Por definir | Por definir | Pendiente | |
| CA-14 | Se actualizan `project-context.md` (6.12), `design-system.md` y el README | FR-023 | Por definir | Revisión documental | Pendiente | |

## 7. Hallazgos y defectos

Se registra todo lo que se encuentre, sea en los documentos, en el análisis o en las pruebas.

| ID | Descripción | Severidad (crítica, alta, media, baja) | Origen (puerta o prueba) | Estado | Resolución | Evidencia |
|:--:|---|---|---|---|---|---|
| H-01 | La constitución (principio I) solo autorizaba el Sprint 5 como sprint posterior al MVP; los Sprints 6 y 7 requieren una enmienda aprobada | Media | G-01 | Resuelto | Enmienda MINOR 1.2.0 registrada el 2026-11-24: aprueba los Sprints 6 y 7, declara el Sprint 7 como el último y alinea la exclusión de la mensajería al cliente y del hosting | `.specify/memory/constitution.md`, principio I y versión 1.2.0 |
| H-02 | El insumo afirmaba que existían una insignia de stock en el ícono de Inventario, un aviso en la pantalla de inicio y un `StockAlertsProvider`. No existen: solo hay `PartsProvider.summary` (se carga al abrir Inventario) y la tarjeta del panel de control | Media | G-01 | Resuelto | El insumo describe el estado real; CA-8 se reformuló (el resumen y la tarjeta siguen funcionando y la insignia se crea desde el centro de notificaciones, solo para el administrador) | `docs/sprints/sprint-6-notificaciones-internas.md`; `client/lib/providers/parts_provider.dart`; `client/lib/screens/parts_screen.dart` |
| H-03 | `propuesta-sprints-post-mvp.md` marcaba el Sprint 6 como "Implementado" sin que existiera código, especificación ni tablas | Baja | G-01 | Resuelto | Se corrigió a "Por especificar" y se actualizó la fecha del documento | `docs/sprints/propuesta-sprints-post-mvp.md` |
| H-04 | El insumo asumía la migración 006, pero la última migración existente es la 004 | Baja | G-01 | Resuelto | La migración del sprint será `005_sprint6_notificaciones.sql` (consecutiva); el insumo y la especificación lo reflejan | `database/migrations/`; `specs/006-notificaciones-internas/spec.md` (FR-020) |
| H-05 | `service_orders.updatedAt` no sirve para medir una orden detenida porque cambia al editar líneas o notas | Media | G-01 | Resuelto | La especificación mide la antigüedad con el último registro de `order_status_history` (FR-005) | `database/migrations/002_sprint2_appointments_orders.sql`; `specs/006-notificaciones-internas/spec.md` |

## 8. Línea base de regresión

Se ejecuta la suite completa antes de tocar el código y de nuevo al cierre. Ninguna prueba de los sprints 1 a 5 debe pasar de verde a rojo.

| Suite | Comando | Antes del sprint 6 | Después del sprint 6 | Diferencia | Evidencia |
|---|---|---|---|---|---|
| Backend (Jest) | `npm test` en `server/` | 90 suites y 1332 pruebas aprobadas, 0 fallidas | Pendiente | Pendiente | [Salida completa](evidencias/sprint-6/linea-base-backend.txt) |
| Frontend (Flutter) | `flutter test` en `client/` | 256 pruebas aprobadas, 0 fallidas | Pendiente | Pendiente | [Salida completa](evidencias/sprint-6/linea-base-frontend.txt) |

**Fecha de la línea base:** 2026-11-24, sobre el commit `ad3202a` de la rama `005-precios-refacciones-cobro`, antes de crear la rama `006-notificaciones-internas`.

**Duración del backend:** 86.7 s al inicio.

## 9. Control de calidad final

Se llena al cierre del sprint con cinco requisitos funcionales elegidos entre los que más pueden fallar, en las 9 columnas de la bitácora del reporte integral.

## 10. Cierre

Se llena al cierre del sprint.
