# Plan de implementación: Historial, mantenimiento e inventario

**Rama**: `sdd-speckit` (carpeta de la feature `003-historial-mantenimiento-inventario`) | **Fecha**: 2026-10-19 | **Especificación**: [spec.md](spec.md)

**Entrada**: Especificación de la funcionalidad en `specs/003-historial-mantenimiento-inventario/spec.md`

## Resumen

El Sprint 3 agrega tres capacidades sobre las órdenes del Sprint 2: el historial del vehículo (una vista calculada, sin tabla propia), el seguimiento de mantenimientos programados con clasificación Normal, Próximo o Vencido, y el inventario de refacciones con movimientos inmutables, uso en órdenes y alertas de stock bajo. El punto delicado es la **consistencia del stock**: cada cambio ocurre en una transacción que bloquea la refacción, valida que no quede negativo e inserta el movimiento, y una restricción `CHECK` en la base lo garantiza aunque falle la lógica. Se mantiene la misma arquitectura y el mismo stack que los sprints anteriores, sin dependencias nuevas. Las decisiones técnicas están en [research.md](research.md).

## Contexto técnico

**Lenguaje/Versión**: Node.js 24 con JavaScript ES Modules; Dart con Flutter 3.47.5 (igual que los sprints anteriores)

**Dependencias principales**: sin dependencias nuevas (`express`, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`; `provider`, `http`, `google_fonts`, `data_table_2` 2.6.0, `lucide_icons_flutter`)

**Almacenamiento**: MySQL 8.0 local, InnoDB, `utf8mb4`; migración `003_sprint3_maintenance_inventory.sql` (nunca se editan la 001 ni la 002)

**Pruebas**: Jest (unitarias, con pruebas exhaustivas de la clasificación de mantenimientos y de las reglas de stock) y Jest + supertest (integración y contrato, con pruebas de concurrencia) contra la base `*_test`; `flutter test` en el frontend

**Plataforma objetivo**: Aplicación Flutter de escritorio/web con prioridad en escritorio; API REST local

**Tipo de proyecto**: Aplicación web con frontend y backend separados (`client/` y `server/`)

**Metas de rendimiento**: historial de un vehículo en menos de 1 segundo con cientos de órdenes (consultas por lotes, sin consultas repetidas por orden); listados de refacciones y mantenimientos en menos de 1 segundo con miles de registros; uso de una refacción en una orden en menos de 500 ms

**Restricciones**: stock nunca negativo (restricción en la base y validación en el servicio); movimientos inmutables; precio de compra solo para administrador (se omite en el servidor); permisos por rol y por asignación en el backend; cambios de stock y totales dentro de transacciones; toda pantalla sigue `docs/design-system.md`

**Escala/Alcance**: un taller, una bodega; cientos de refacciones, miles de movimientos al año, cientos de mantenimientos; 3 módulos nuevos (inventario, mantenimientos, historial) y aproximadamente 8 pantallas nuevas

## Verificación de la constitución

*PUERTA: debe aprobarse antes de la investigación de la Fase 0. Se vuelve a verificar tras el diseño de la Fase 1.*

| Principio | Cumplimiento | Evidencia en el plan |
|-----------|--------------|----------------------|
| I. Alcance, MVP y fuente de verdad | Cumple | Solo Sprint 3; sin pagos, tickets, dashboard ni notificaciones externas |
| II. Arquitectura con responsabilidades separadas | Cumple | Reglas de stock y de clasificación en `services/` (la clasificación es una función pura fácil de probar); controladores delgados |
| III. Stack y base de datos local | Cumple | Sin tecnologías nuevas; migración numerada nueva; seeds idempotentes con stock coherente |
| IV. Seguridad | Cumple | Roles y asignación en backend; precio de compra omitido en el servidor para roles no administradores; errores sin trazas |
| V. Reglas de negocio | Cumple | Refacciones siempre ligadas a una orden (RN-6); salida de inventario por cada uso (RN-7); stock no negativo (RN-8); historial derivado (RN-10); mantenimiento por fecha y/o kilometraje con intervalos propios (RN-11, RN-12) |
| VI. API consistente | Cumple | Mismo formato y manejo de errores ([contracts/api.md](contracts/api.md)) |
| VII. Pruebas | Cumple | Pruebas exhaustivas de clasificación; pruebas de concurrencia y de invariante `stock = suma de movimientos` |
| VIII. UX/UI | Cumple | Material 3 con tema propio; confirmación al quitar refacciones y al desactivar |

**Resultado**: sin violaciones. Se reevaluó tras el diseño de la Fase 1 con el mismo resultado.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/003-historial-mantenimiento-inventario/
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
├── migrations/003_sprint3_maintenance_inventory.sql
└── seeds/005_parts.sql, 006_order_parts.sql, 007_maintenance.sql

server/
├── models/              # partModel, inventoryModel, orderPartModel, maintenanceModel, historyModel
├── services/            # partService, inventoryService (stock), orderPartService,
│                        # maintenanceService, maintenanceClassifier, vehicleHistoryService
├── controllers/         # partController, maintenanceController, historyController
├── routes/              # partRoutes, maintenanceRoutes, + rutas de refacciones en orderRoutes
├── validators/          # partValidator, maintenanceValidator
└── tests/{unit,integration,contract}/

client/lib/
├── models/              # part.dart, maintenance.dart, history_entry.dart
├── providers/           # parts_provider.dart, maintenance_provider.dart
├── screens/             # parts_screen, part_form_screen, part_detail_screen, maintenance_screen,
│                        # maintenance_form_screen, vehicle_history_screen
└── widgets/             # stock_level_chip.dart, selector de refacción, resumen de alertas
```

**Decisión de estructura**: se conserva la estructura de los sprints anteriores. Las reglas con lógica propia (`inventoryService` para los movimientos y `maintenanceClassifier` para la clasificación) viven aisladas en `server/services/` para probarlas de forma exhaustiva; la clasificación es una función pura sin acceso a la base de datos.

## Seguimiento de complejidad

> Sin violaciones de la constitución; no se requiere justificación.

| Violación | Por qué se necesita | Alternativa más simple descartada porque |
|-----------|---------------------|------------------------------------------|
| Ninguna | N/A | N/A |
