# Aseguramiento de la calidad - Sprint 7: Reportes y configuración

Este documento es el registro de calidad del Sprint 7 de Motorix, el último del proyecto. Reúne las puertas de calidad, las decisiones, los riesgos, la trazabilidad de los criterios de aceptación, los hallazgos, la regresión de los sprints 1 a 6 y el control de calidad final, con sus evidencias.

Resultado general: **en curso** (se completa al cierre del sprint).

## 0. Datos del documento

| Campo | Valor |
|---|---|
| Sprint | 7 - Reportes y configuración |
| Insumo | `docs/sprints/sprint-7-reportes-configuracion.md` |
| Rama | `007-reportes-configuracion` (encadenada desde `006-notificaciones-internas`) |
| Responsable | Jorge Francisco Dominguez Ramirez, representante del proyecto |
| Fecha de inicio | 2026-11-25 |
| Fecha de cierre | Por definir (se completa al cierre) |
| Estado general | En curso |

## 1. Objetivo y alcance

**Objetivo.** Asegurar que el Sprint 7 salga con calidad: que los requisitos estén completos, sean medibles y no se contradigan, que las pruebas estén planeadas antes del código y que el cambio no rompa lo construido en los sprints 1 a 6.

**Dentro del alcance:** configuración del taller desde la aplicación (datos del ticket y márgenes de «Próximo»), catálogo de tipos de servicio con intervalos, próximo servicio en el ticket con instantánea de los datos del taller, términos y condiciones con aviso de privacidad (aceptación por versión validada en backend), bitácora de acciones sensibles, cierre de sesión por inactividad, encabezados de seguridad y pruebas de no exposición de datos e inyección, y reportes del administrador (ingresos por periodo, servicios frecuentes, productividad por mecánico, margen de refacciones y rotación de inventario) con exportación a CSV.

**Fuera del alcance:** lo que el insumo lista en su sección 8: gráficas avanzadas, impuestos y facturación, gestión de usuarios y roles, credenciales de Mercado Pago, mensajes al cliente, envío automático de reportes, cifrado, respaldos, HTTPS y despliegue, autenticación de dos factores y recuperación de contraseña por correo.

## 2. Criterios de entrada y de salida

Los criterios se marcan `[x]` solo cuando se cumplen de verdad.

**Criterios de entrada (para comenzar la implementación):**

- [x] Las 8 puertas de la sección 3 están Aprobadas o Aprobadas con observación.
- [x] La enmienda de la constitución (principio I, versión 1.2.0) aprueba el Sprint 7 y lo declara el último del proyecto.
- [x] Las decisiones de la sección 4 están resueltas y registradas.
- [x] No hay hallazgos críticos ni altos abiertos en el análisis de consistencia.
- [x] Cada criterio de aceptación tiene al menos una prueba planeada (sección 6).
- [x] La línea base de regresión está registrada (sección 8).

**Criterios de salida (para cerrar el sprint):**

- [ ] Los 26 criterios de aceptación están Aprobados.
- [ ] Todas las pruebas de los sprints 1 a 6 siguen pasando.
- [ ] No hay defectos críticos ni altos abiertos (sección 7).
- [ ] La matriz de calidad final (sección 9) está completa, con evidencia.
- [ ] Reporte, análisis y matriz no se contradicen.

## 3. Puertas de calidad

| ID | Puerta | Estado | Evidencia |
|:--:|---|---|---|
| G-01 | Insumo del sprint revisado contra el código | Aprobado con observación | `docs/sprints/sprint-7-reportes-configuracion.md` corregido el 2026-11-25 (H-02 a H-08). Observación: las decisiones de su sección 9 quedan por resolver en `/speckit.clarify` |
| G-02 | Especificación (`/speckit.specify`) | Aprobado | `specs/007-reportes-configuracion/spec.md`: 10 historias de usuario, 34 requisitos funcionales (cada uno indica si mantiene o agrega) y 7 criterios de éxito. Sin marcadores `[NEEDS CLARIFICATION]` |
| G-03 | Aclaraciones (`/speckit.clarify`) | Aprobado | 14 decisiones resueltas en la sesión del 2026-11-25 (sección 4), todas con la opción recomendada; las 15 decisiones del insumo (sección 9) quedaron resueltas en la especificación |
| G-04 | Lista de calidad de requisitos (`/speckit.checklist`) | Aprobado | `checklists/requirements.md` y `checklists/reportes-seguridad.md` (30 puntos revisados y resueltos; 7 huecos corregidos en `spec.md`, H-09) |
| G-05 | Plan (`/speckit.plan`) | Aprobado | `plan.md`, `research.md`, `data-model.md`, `contracts/api.md` y `quickstart.md`. Constitución v1.2.0 sin violaciones (8 de 8 principios); migración `006` aditiva con 5 tablas y 3 columnas; sin dependencias nuevas |
| G-06 | Tareas (`/speckit.tasks`) | Aprobado | `tasks.md`: 101 tareas en dos entregas (7A y 7B), con las pruebas antes del código en cada historia, `design-system.md` antes de cualquier pantalla y una tabla de cobertura de los 34 requisitos y de los 7 criterios de éxito |
| G-07 | Consistencia (`/speckit.analyze`) | Aprobado | 2 pasadas el 2026-11-25. Pasada 1: 0 críticos, 0 altos, 3 medios y 1 bajo (H-10). Pasada 2, tras corregir: sin hallazgos de fondo. 34 de 34 requisitos y 7 de 7 criterios de éxito con tarea (100 %); 101 tareas consecutivas, todas con requisito o criterio de éxito |
| G-08 | Pruebas planeadas y línea base | Aprobado | Los 26 criterios de aceptación tienen al menos una prueba planeada (sección 6) y los 9 riesgos tienen la prueba o el seguimiento que los cubre (sección 5); línea base de 106 suites y 1462 pruebas de backend y 308 de frontend (sección 8) |

## 4. Decisiones de aclaración

Las decisiones abiertas del insumo (sección 9) se resolvieron el 2026-11-25 siempre con la opción recomendada, con la aprobación de Jorge Francisco Dominguez Ramirez. El texto completo está en la sección Aclaraciones de `specs/007-reportes-configuracion/spec.md`.

| ID | Decisión | Resolución | Requisito afectado |
|:--:|---|---|---|
| D-01 | Formato de exportación | CSV (UTF-8 con BOM) mediante un enlace de corta vida, sin dependencias nuevas | FR-016 |
| D-02 | Prioridad si el sprint se divide | Entrega 7A (configuración, catálogo, ticket, términos y seguridad) antes de la 7B (reportes) | Calendario y orden de las tareas |
| D-03 | Instantánea del ticket | El ticket guarda al generarse los datos del taller y el próximo servicio; los tickets anteriores se arman con los datos vigentes | FR-002 |
| D-04 | Tipo de servicio en las líneas | `order_services.serviceTypeId` opcional; las líneas existentes quedan sin tipo | FR-006 |
| D-05 | Margen sin precio de compra | Se muestra «sin costo» y no entra en el margen total | FR-012 |
| D-06 | Periodos y corte | Rango libre con atajos de mes, en hora local del servidor, de hasta 366 días | FR-014 |
| D-07 | Productividad por mecánico | Órdenes terminadas o entregadas en el periodo e importe de mano de obra | FR-011 |
| D-08 | Rotación de inventario | Unidades que salieron en el periodo entre la existencia actual | FR-013 |
| D-09 | Reportes para recepción | Exclusivos del administrador (403 para los demás) | FR-017 |
| D-10 | Términos y condiciones | Versión 1 publicada con los seeds; el administrador publica versiones nuevas desde la aplicación; se acepta una vez por versión y los usuarios existentes aceptan en su siguiente ingreso | FR-018, FR-020 |
| D-11 | Bitácora | Acciones sensibles; consulta paginada solo de lectura, sin exportación ni borrado | FR-024, FR-025 |
| D-12 | Política de contraseñas | Se mantiene la existente (8 caracteres o más, mayúscula, minúscula y número) y no se obliga a cambiar las de los usuarios sembrados | FR-027 |
| D-13 | Inactividad | 30 minutos para todos los roles, validado en backend | FR-028 |
| D-14 | Márgenes de «Próximo» | Valores de hoy (15 días y 500 km) por omisión, con límites de 1 a 365 días y de 1 a 100,000 km | FR-003 |

## 5. Riesgos y mitigaciones

| ID | Riesgo | Impacto | Mitigación | Prueba que lo cubre | Estado |
|:--:|---|---|---|---|---|
| R-01 | El middleware de términos o el de inactividad rompen casi toda la suite de pruebas existente | Alto: regresión masiva | Aplicarlos solo si existe una versión vigente y si `lastActivityAt` no está vencido; ajustar `helpers.js` desde el inicio | Regresión completa (sección 8) | Abierto |
| R-02 | El tiempo no alcanza para todos los reportes antes del cierre (30 de noviembre) | Alto | Orden 7A antes de 7B; si no alcanza, se recorta a ingresos por periodo y servicios frecuentes y se declara como deuda | Seguimiento del calendario | Abierto |
| R-03 | Cambiar los datos del taller altera tickets ya emitidos | Alto: documentos que cambian | Instantánea al generar el ticket | `tickets.snapshot.test.js` (T022) | Abierto |
| R-04 | Los importes de los reportes no coinciden con los pagos y las órdenes | Alto: cifras incorrectas | Centavos enteros y pruebas de coincidencia contra los datos de origen | `reports.income.test.js`, `reports.services.test.js` y `reports.parts.test.js` (T071, T077, T081) | Abierto |
| R-05 | La bitácora guarda datos sensibles (contraseñas, hashes, tokens, datos de pago) | Alto: fuga de información | Lista cerrada de campos por acción y una prueba que busca valores prohibidos | `auditService.test.js` (T014) y `audit.log.test.js` (T058) | Abierto |
| R-06 | Una persona queda bloqueada por la aceptación de términos (sin poder aceptar) | Medio | Las rutas de ver y aceptar los términos y cerrar sesión quedan exentas | `terms.gate.test.js` (T050) | Abierto |
| R-07 | Los reportes con muchos datos son lentos | Medio | Rango máximo de 366 días y consultas agregadas en SQL | `reports.performance.test.js` (T090) | Abierto |
| R-08 | Los márgenes configurables cambian la clasificación y descuadran los avisos del Sprint 6 | Medio | La clasificación lee los márgenes de una sola fuente (configuración) y se prueba la coincidencia de avisos, Mantenimientos y panel | `settings.margins.test.js` (T029) | Abierto |
| R-09 | Las listas fijas de tablas de las pruebas (`limpiarBase` y la prueba de seeds) quedan desfasadas con las tablas nuevas | Medio | Ajustarlas al crear la migración | Ajuste de `helpers.js` y de las pruebas de seeds (T005) y `seeds.sprint7.test.js` (T089) | Abierto |

## 6. Trazabilidad

Cada criterio de aceptación (CA) del insumo se enlaza con su requisito, su tarea, su prueba y el resultado. Se llena al generar las tareas y se actualiza al implementar.

| CA | Criterio de aceptación (resumen) | Requisito (FR) | Tarea | Prueba | Resultado | Evidencia |
|:--:|---|---|---|---|---|---|
| CA-1 | Editar nombre, dirección y teléfono; tickets nuevos los usan y los emitidos no cambian | FR-001, FR-002 | T024 a T027 | T020, T022, T023 | Pendiente | |
| CA-2 | Márgenes de «Próximo» editables con límites; Mantenimientos y panel los respetan | FR-003 | T030, T031 | T029 | Pendiente | |
| CA-3 | Sin valor guardado se usan `.env` o 15 días y 500 km | FR-004 | T017 | T016, T020, T029 | Pendiente | |
| CA-4 | Catálogo de tipos de servicio sin borrar los usados | FR-005, FR-006 | T038, T039 | T033, T034, T037 | Pendiente | |
| CA-5 | Propuesta del próximo mantenimiento corregible | FR-007 | T040, T041 | T035, T037 | Pendiente | |
| CA-6 | Reportes de ingresos, servicios, productividad y rotación con rango de fechas | FR-009 a FR-014 | T074, T078, T082 | T071, T077, T081 | Pendiente | |
| CA-7 | Importes en centavos enteros que coinciden con el origen | FR-015 | T074, T078, T082 | T071, T077, T081 | Pendiente | |
| CA-8 | Margen de refacciones con precio de compra solo para el administrador | FR-012, FR-017 | T082 | T081 | Pendiente | |
| CA-9 | Exportación igual a la pantalla | FR-016 | T008, T086, T087 | T007, T085 | Pendiente | |
| CA-10 | Configuración y reportes exclusivos del administrador (403) | FR-001, FR-017 | T024, T074 | T020, T071, T085 | Pendiente | |
| CA-11 | Reportes con muchos datos responden en tiempo razonable | FR-014 | T092 | T090 | Pendiente | |
| CA-12 | Seeds con configuración, tipos y datos para los reportes, idempotentes | FR-032 | T091 | T089 | Pendiente | |
| CA-13 | Pruebas de configuración, cálculo de reportes, permisos y exportación | FR-033 | Todas las de pruebas | T020, T029, T071, T085 y las de cada historia | Pendiente | |
| CA-14 | El ticket nuevo muestra el próximo servicio y los emitidos no cambian | FR-002, FR-008 | T045, T046 | T043, T044 | Pendiente | |
| CA-15 | Documentación actualizada y `.env.example` como respaldo | FR-034 | T002, T094, T095 | Revisión documental | Pendiente | |
| CA-16 | Pantalla de aceptación al ingresar; rechazar cierra la sesión | FR-019 | T055 | T052 | Pendiente | |
| CA-17 | La aceptación guarda usuario, versión y fecha y se pide de nuevo con una versión nueva | FR-020 | T053 | T049 | Pendiente | |
| CA-18 | Contenido de los términos y consulta de la versión y las aceptaciones | FR-022, FR-023 | T056, T091 | T049, T089 | Pendiente | |
| CA-19 | La aceptación se valida en backend | FR-021 | T054 | T050 | Pendiente | |
| CA-20 | Bitácora de acciones sensibles con filtros, sin edición ni borrado | FR-024, FR-025 | T065, T066 | T058 | Pendiente | |
| CA-21 | La bitácora no guarda secretos | FR-026 | T015 | T014, T058 | Pendiente | |
| CA-22 | Política de contraseñas aplicada al crear y cambiar | FR-027 | Existente (Sprint 1) | T063 | Pendiente | |
| CA-23 | Cierre de sesión por inactividad validado en backend | FR-028 | T067, T069 | T059, T064 | Pendiente | |
| CA-24 | Ninguna respuesta expone el hash, el token ni precios reservados | FR-030 | Existente (serializadores) | T061 | Pendiente | |
| CA-25 | Consultas con parámetros y prueba de inyección | FR-031 | Existente | T062 | Pendiente | |
| CA-26 | Pruebas de términos, bitácora, contraseñas, inactividad y no exposición | FR-033 | T053 a T070 | T050, T058, T059, T061, T062, T063 | Pendiente | |

## 7. Hallazgos y defectos

Se registra todo lo que se encuentre, sea en los documentos, en el análisis o en las pruebas.

| ID | Descripción | Severidad (crítica, alta, media, baja) | Origen (puerta o prueba) | Estado | Resolución | Evidencia |
|:--:|---|---|---|---|---|---|
| H-01 | La constitución (principio I) debía aprobar el Sprint 7 y declararlo el último | Media | G-01 | Resuelto | La enmienda MINOR 1.2.0 (2026-11-24) aprueba los Sprints 5, 6 y 7 | `.specify/memory/constitution.md` |
| H-02 | El insumo afirmaba que existía `helmet`; no existe en las dependencias ni en `app.js` | Media | G-01 | Resuelto | Se corrigió el insumo; los encabezados de seguridad se agregan con un middleware propio, sin dependencias nuevas | `server/package.json`, `server/app.js` |
| H-03 | El insumo llamaba `SHOP_*` a las variables del taller y `MAINTENANCE_WARN_*` a los márgenes de «Próximo» en `.env`; las variables son `WORKSHOP_*` y los márgenes son constantes de 15 días y 500 km (no 30 y 1,000) | Media | G-01 | Resuelto | Se corrigió el insumo y CA-3 usa 15 días y 500 km como valores de respaldo | `.env.example`, `server/config/env.js`, `server/utils/constants.js` |
| H-04 | La política de contraseñas ya existe (8 caracteres o más, mayúscula, minúscula y número, con pruebas); el insumo la daba por inexistente | Baja | G-01 | Resuelto | CA-22 pasa a mantenerla, documentarla y probarla | `server/validators/authValidator.js` |
| H-05 | El dashboard no tiene ingresos por mes ni por método: solo cobrado hoy y del mes | Baja | G-01 | Resuelto | Se corrigió el insumo; los reportes de ingresos son consultas nuevas | `server/services/dashboardService.js` |
| H-06 | El ticket se arma al consultarlo con los datos del taller vigentes, sin instantánea; cambiar la configuración alteraría tickets ya emitidos | Alta | G-01 | Resuelto | Se agregan columnas de instantánea a `tickets` (decisión D-03) | `server/services/ticketBuilder.js` |
| H-07 | El insumo hablaba de la migración `007`; la última existente es la `005` | Baja | G-01 | Resuelto | La migración del sprint es `006_sprint7_configuracion_seguridad.sql` | `database/migrations/` |
| H-08 | No hay datos de actividad por usuario para cerrar la sesión por inactividad | Media | G-01 | Resuelto | Se agrega `users.lastActivityAt` y se valida en backend (decisión D-13) | `server/middlewares/authenticate.js` |
| H-09 | La revisión de la lista `reportes-seguridad.md` (30 puntos) encontró 7 huecos: la fecha que decide si una orden entra en un reporte, la agrupación por día o mes, no contar dos veces una orden Terminada y luego Entregada, que las agrupaciones sumen lo mismo, las rutas exentas de la aceptación, qué se guarda de un inicio de sesión fallido y qué cuenta como actividad. El último era grave: el sondeo de avisos del Sprint 6 (cada 60 segundos) habría mantenido viva para siempre una sesión abandonada | Media | G-04 | Resuelto | Se corrigieron FR-009, FR-010, FR-011, FR-021, FR-024 y FR-028 y los casos límite; la consulta automática de avisos no cuenta como actividad | `specs/007-reportes-configuracion/checklists/reportes-seguridad.md` |
| H-10 | El análisis de consistencia (pasada 1) encontró: tareas de US3 y US8 numeradas fuera del orden de ejecución, la tarea de rendimiento T092 sin comando, la ruta `/service-types` sin mención explícita y la prueba del texto de los términos sin verificar su contenido (FR-023) | Media | G-07 | Resuelto | Se renumeraron las tareas, se agregó el comando de T092, la ruta a T038 y la verificación del contenido a T089; la pasada 2 no encontró hallazgos | `specs/007-reportes-configuracion/tasks.md` |

## 8. Línea base de regresión

Se ejecuta la suite completa antes de tocar el código y de nuevo al cierre. Ninguna prueba de los sprints 1 a 6 debe pasar de verde a rojo.

| Suite | Comando | Antes del sprint 7 | Después del sprint 7 | Diferencia | Evidencia |
|---|---|---|---|---|---|
| Backend (Jest) | `npm test` en `server/` | 106 suites y 1462 pruebas aprobadas, 0 fallidas | Pendiente | Pendiente | [Salida completa](evidencias/sprint-6/regresion-backend.txt) |
| Frontend (Flutter) | `flutter test` en `client/` | 308 pruebas aprobadas, 0 fallidas | Pendiente | Pendiente | [Salida completa](evidencias/sprint-6/regresion-frontend.txt) |

**Fecha de la línea base:** 2026-11-25, sobre el commit `2f9debf` de la rama `006-notificaciones-internas` (cierre del Sprint 6), antes de crear los cambios del Sprint 7.

## 9. Control de calidad final

Se llena al cierre del sprint con cinco requisitos funcionales elegidos entre los que más pueden fallar, en las 9 columnas de la bitácora del reporte integral.

## 10. Cierre

Se llena al cierre del sprint.
