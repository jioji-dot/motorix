# Plan de implementación: Citas y órdenes de servicio

**Rama**: `sdd-speckit` (carpeta de la feature `002-citas-ordenes-servicio`) | **Fecha**: 2026-10-19 | **Especificación**: [spec.md](spec.md)

**Entrada**: Especificación de la funcionalidad en `specs/002-citas-ordenes-servicio/spec.md`

## Resumen

El Sprint 2 agrega la agenda de citas y las órdenes de servicio sobre los clientes, vehículos y usuarios del Sprint 1. El enfoque técnico extiende la misma arquitectura: API REST en Node.js/Express (ES Modules) con `mysql2` y MySQL local, y la aplicación Flutter con Material 3. La parte delicada es la **máquina de estados de la orden** (transiciones, quién las aplica y bloqueos de concurrencia), que se implementa como una tabla de transiciones pura en `services/` y se prueba de forma exhaustiva. Las decisiones técnicas están en [research.md](research.md).

## Contexto técnico

**Lenguaje/Versión**: Node.js 24 con JavaScript ES Modules; Dart con Flutter 3.47.5 (igual que el Sprint 1)

**Dependencias principales**: sin dependencias nuevas. Backend: `express`, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`. Frontend: `provider`, `http`, `google_fonts`, `data_table_2` 2.6.0, `lucide_icons_flutter`.

**Almacenamiento**: MySQL 8.0 local, InnoDB, `utf8mb4`; migración `002_sprint2_appointments_orders.sql` (nunca se edita la 001)

**Pruebas**: Jest (unitarias, incluida la tabla de transiciones) y Jest + supertest (integración y contrato) contra la base de pruebas `*_test`; `flutter test` en el frontend

**Plataforma objetivo**: Aplicación Flutter de escritorio/web con prioridad en escritorio; API REST local

**Tipo de proyecto**: Aplicación web con frontend y backend separados (`client/` y `server/`)

**Metas de rendimiento**: listados de citas y órdenes en menos de 1 segundo con miles de registros (índices por fecha, estado y mecánico); cambio de estado en menos de 500 ms

**Restricciones**: permisos por rol y por asignación validados en el backend; cambios de estado y totales dentro de transacciones; las órdenes nunca se eliminan; importes con dos decimales (`DECIMAL`); toda pantalla sigue `docs/design-system.md`

**Escala/Alcance**: un taller; decenas de citas por día y cientos de órdenes al año; 2 módulos nuevos (citas y órdenes) y aproximadamente 6 pantallas nuevas

## Verificación de la constitución

*PUERTA: debe aprobarse antes de la investigación de la Fase 0. Se vuelve a verificar tras el diseño de la Fase 1.*

| Principio | Cumplimiento | Evidencia en el plan |
|-----------|--------------|----------------------|
| I. Alcance, MVP y fuente de verdad | Cumple | Solo Sprint 2; sin historial de mantenimiento, inventario, pagos ni tickets |
| II. Arquitectura con responsabilidades separadas | Cumple | Reglas de estado y totales en `services/`; controladores delgados |
| III. Stack y base de datos local | Cumple | Sin tecnologías nuevas; migración numerada nueva; seeds idempotentes |
| IV. Seguridad | Cumple | Rol y asignación validados en backend; errores sin trazas; sin secretos |
| V. Reglas de negocio | Cumple | Kilometraje de entrada validado (RN-3, RN-4); orden entregada o cancelada inmutable (RN-9); orden siempre ligada a vehículo existente (RN-2) |
| VI. API consistente | Cumple | Mismo formato y manejo de errores ([contracts/api.md](contracts/api.md)) |
| VII. Pruebas | Cumple | Prueba exhaustiva de transiciones; integración por rol; widgets en Flutter |
| VIII. UX/UI | Cumple | Material 3 con tema propio; confirmación al cancelar citas y órdenes y al entregar |

**Resultado**: sin violaciones. Se reevaluó tras el diseño de la Fase 1 con el mismo resultado.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/002-citas-ordenes-servicio/
├── plan.md              # Este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   └── api.md           # Contrato de la API REST
├── checklists/
│   └── requirements.md
└── tasks.md             # Lo genera /speckit-tasks (NO /speckit-plan)
```

### Código fuente (raíz del repositorio)

```text
database/
├── migrations/002_sprint2_appointments_orders.sql
└── seeds/003_appointments.sql, 004_service_orders.sql

server/
├── models/              # appointmentModel, orderModel (+ líneas e historial)
├── services/            # appointmentService, orderService, orderStateMachine
├── controllers/         # appointmentController, orderController, mechanicController
├── routes/              # appointmentRoutes, orderRoutes, mechanicRoutes
├── validators/          # appointmentValidator, orderValidator
└── tests/{unit,integration,contract}/

client/lib/
├── models/              # appointment.dart, service_order.dart
├── providers/           # appointments_provider.dart, orders_provider.dart
├── screens/             # appointments_screen, appointment_form_screen, appointment_detail_screen,
│                        # orders_screen, order_form_screen, order_detail_screen
└── widgets/             # order_status_chip.dart, líneas de servicio y mano de obra
```

**Decisión de estructura**: se conserva la estructura del Sprint 1 (sin carpetas nuevas de primer nivel). La tabla de transiciones vive aislada en `server/services/orderStateMachine.js` como función pura, sin acceso a la base de datos, para probarla de forma exhaustiva.

## Seguimiento de complejidad

> Sin violaciones de la constitución; no se requiere justificación.

| Violación | Por qué se necesita | Alternativa más simple descartada porque |
|-----------|---------------------|------------------------------------------|
| Ninguna | N/A | N/A |
