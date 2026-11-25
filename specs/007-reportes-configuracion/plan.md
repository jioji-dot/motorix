# Plan de implementación: Reportes y configuración

**Rama**: `007-reportes-configuracion` | **Fecha**: 2026-11-25 | **Especificación**: [spec.md](spec.md)

**Entrada**: Especificación de la funcionalidad en `specs/007-reportes-configuracion/spec.md`

## Resumen

El Sprint 7, el último del proyecto, agrega diez piezas sobre lo construido en los Sprints 1 a 6: configuración del taller y de los márgenes de «Próximo» desde la aplicación, catálogo de tipos de servicio con intervalos y propuesta del próximo mantenimiento, ticket con instantánea de los datos del taller y línea de «Próximo servicio», términos y condiciones con aceptación por versión validada en el servidor, bitácora de acciones sensibles, cierre de sesión por inactividad, encabezados de seguridad y pruebas de no exposición e inyección, y cinco reportes del administrador con exportación a CSV.

Enfoque técnico: se mantiene la arquitectura por capas del backend (rutas → controladores → servicios con fábrica de dependencias → modelos con consultas parametrizadas → validadores zod). Se agregan **5 tablas y 3 columnas** en una migración aditiva (`006`), **sin dependencias nuevas** (el CSV y los encabezados de seguridad son código propio). La configuración se lee de la base en cada consulta (sin caché, para que un cambio surta efecto al instante) con respaldo a `.env` y a las constantes de hoy. La aceptación de términos y la inactividad se validan dentro de `authenticate`, de modo que ninguna ruta protegida queda fuera. Los reportes se calculan al consultar con SQL agregado y centavos enteros, y se exportan con un enlace firmado de 60 segundos, igual que la impresión del ticket.

La entrega se divide: **7A** (configuración, catálogo, ticket, términos y seguridad) y después **7B** (reportes y exportación). Si el 7B no alcanza, se recorta a ingresos por periodo y servicios frecuentes.

## Contexto técnico

**Lenguaje y versión**: JavaScript (ES Modules) en Node 24 para el servidor; Dart con Flutter 3.47 para el cliente.

**Dependencias principales**: Express 4, mysql2, zod, jsonwebtoken, bcryptjs, Jest y supertest; Flutter con Provider, `data_table_2` y `url_launcher`. **No se agregan dependencias.**

**Almacenamiento**: MySQL 8.0 (InnoDB, `utf8mb4`), bases `motorix_sdd` y `motorix_sdd_test`. Migración `006_sprint7_configuracion_seguridad.sql` aditiva; seeds `010_configuracion.sql` idempotentes.

**Pruebas**: Jest (unitarias, integración y contrato) contra la base de pruebas y `flutter test`. Línea base: 106 suites y 1462 pruebas de backend y 308 de Flutter.

**Plataforma objetivo**: aplicación web de Flutter y API REST local.

**Tipo de proyecto**: aplicación web con API (cliente y servidor).

**Metas de rendimiento**: cada reporte con un año de datos responde en menos de 3 segundos (SC-003); la comprobación de términos e inactividad agrega dos consultas por petición autenticada, indexadas por clave.

**Restricciones**: sin dependencias nuevas; permisos en el servidor; importes en centavos enteros; el enlace de exportación dura 60 segundos; la bitácora no guarda secretos; ninguna prueba anterior puede pasar de verde a rojo.

**Escala y alcance**: un taller; decenas de usuarios; reportes de hasta 366 días.

## Verificación de la constitución

*Puerta: debe pasar antes de la investigación (Fase 0) y volver a verificarse tras el diseño (Fase 1).* Versión de la constitución: 1.2.0.

| Principio | Cumplimiento | Evidencia en el plan |
|-----------|--------------|----------------------|
| I. Alcance, MVP y fuente de verdad | Cumple | Sprint 7 aprobado en la enmienda 1.2.0 y declarado el último; no agrega funciones fuera del insumo; lo excluido (gráficas, facturación, envío de reportes, respaldos, HTTPS, doble factor) se declara; `docs/project-context.md` se actualiza al cerrar |
| II. Arquitectura con responsabilidades separadas | Cumple | Reglas en `services/` con fábrica de dependencias; consultas en `models/`; CSV y encabezados como utilidades y middleware; pantallas Flutter con providers y sin lógica de negocio |
| III. Stack y base de datos local | Cumple | Sin tecnologías nuevas; migración `006` aditiva y numerada; seeds `010` idempotentes con datos suficientes para ver cada reporte al arrancar; solo el backend toca MySQL |
| IV. Seguridad | Cumple | Configuración, reportes, bitácora y términos de administración exclusivos de ADMIN; aceptación de términos e inactividad dentro de `authenticate`; bitácora con lista cerrada de campos y sin secretos; enlace de exportación firmado de 60 segundos; encabezados de seguridad; CSV neutralizado contra fórmulas; sin secretos en el repositorio |
| V. Integridad de las reglas de negocio | Cumple | Los reportes se calculan de los datos existentes (RN-10) en centavos enteros; el catálogo nunca borra tipos usados; el ticket guarda su instantánea; la configuración tiene límites y respaldo |
| VI. API consistente y manejo de errores | Cumple | Rutas con el formato `{ data, meta }` y los errores existentes; códigos nuevos `TERMS_NOT_ACCEPTED` y `SESSION_INACTIVE`; contrato en [contracts/api.md](contracts/api.md) |
| VII. Pruebas | Cumple | Pruebas antes del código en cada historia, contra `motorix_test`; reglas de configuración, cálculo y exportación de reportes, permisos por rol, términos, bitácora, inactividad y no exposición; regresión completa contra la línea base |
| VIII. UX/UI profesional y sencilla | Cumple | Pantallas de Configuración, Reportes y aceptación de términos con los componentes y tokens existentes; estados de carga, vacío y error; el diseño se actualiza antes de tocar pantallas |

**Resultado de la puerta**: sin violaciones; el seguimiento de complejidad queda vacío.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/007-reportes-configuracion/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
├── checklists/requirements.md
├── checklists/reportes-seguridad.md
├── spec.md
├── tasks.md
└── validacion-quickstart.md   (al cerrar)
```

### Código fuente (raíz del repositorio)

```text
database/
├── migrations/006_sprint7_configuracion_seguridad.sql   (nuevo)
└── seeds/010_configuracion.sql                          (nuevo)

server/
├── middlewares/securityHeaders.js, authenticate.js (modifica)
├── models/settingsModel.js, serviceTypeModel.js, termsModel.js, auditModel.js, reportModel.js (nuevos)
├── services/settingsService.js, serviceTypeService.js, termsService.js, auditService.js, reportService.js,
│            reportExport.js (nuevos); maintenanceClassifier.js, maintenanceService.js, ticketService.js,
│            ticketBuilder.js, ticketPrint.js, authService.js, userService.js, partService.js, paymentService.js (modifican)
├── utils/csv.js (nuevo)
├── controllers/ y routes/ de settings, service-types, terms, audit y reports (nuevos)
├── validators/settingsValidator.js, serviceTypeValidator.js, termsValidator.js, reportValidator.js (nuevos)
└── tests/ unit, integration y contract de cada pieza; helpers.js y seeds.sprint5/6 (se ajustan)

client/lib/
├── models/ app_settings.dart, service_type.dart, terms.dart, audit_entry.dart, report.dart (nuevos)
├── providers/ settings, service_types, terms, audit y reports (nuevos); auth_provider.dart (modifica)
├── screens/ settings_screen.dart, reports_screen.dart, terms_screen.dart (nuevos); home_screen.dart, ticket_screen.dart, main.dart (modifican)
└── widgets/ inactivity_watcher.dart (nuevo)
```

## Fases

1. **Fase 0 (investigación)**: [research.md](research.md).
2. **Fase 1 (diseño)**: [data-model.md](data-model.md), [contracts/api.md](contracts/api.md) y [quickstart.md](quickstart.md).
3. **Fase 2 (tareas)**: `tasks.md`, con la entrega 7A antes de la 7B.

## Seguimiento de complejidad

Sin violaciones de la constitución que justificar.
