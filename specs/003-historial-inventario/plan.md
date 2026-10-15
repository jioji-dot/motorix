# Plan de implementación: Historial, mantenimiento e inventario (Sprint 3)

**Rama**: `003-historial-inventario` | **Fecha**: 2026-10-13 | **Especificación**: [spec.md](spec.md)

**Entrada**: Especificación de la funcionalidad en `/specs/003-historial-inventario/spec.md`

## Resumen

Tercer sprint del MVP: a partir de las órdenes del Sprint 2, el mecánico consulta el historial de servicios de un vehículo, captura el kilometraje de servicio, programa el próximo mantenimiento y agrega las refacciones usadas a una orden; recepción consulta los mantenimientos próximos y vencidos para avisar al cliente; y el administrador registra refacciones, consulta el stock, registra entradas y ajustes, y ve las alertas de stock bajo. Flujo demostrable: finalizar servicio → conservarlo en el historial → registrar próximo mantenimiento → usar refacciones en la orden → actualizar inventario → mostrar alertas de stock.

Enfoque técnico (detalle en [research.md](research.md)): se extiende la API y la aplicación con los mismos patrones de los sprints anteriores. El historial es una consulta calculada sobre las órdenes terminadas (sin tabla duplicada). La existencia de cada refacción es una columna con restricción `CHECK (stock >= 0)` que se actualiza siempre junto con un movimiento de inventario en una transacción, de modo que `stock = suma de movimientos`. El uso simultáneo de una refacción se resuelve con bloqueo de fila y una actualización condicionada. La clasificación de mantenimientos (vencido, próximo, lejano) se calcula al consultar con umbrales configurables guardados en la base. Un solo mantenimiento pendiente por vehículo se garantiza con un índice único sobre una columna generada.

## Contexto técnico

**Lenguaje/Versión**: Backend en JavaScript (ES Modules) sobre Node.js LTS (24); frontend en Dart con Flutter estable (3.47).

**Dependencias principales**: ninguna nueva. Backend: `express`, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`, `helmet`; pruebas: `jest`, `supertest`. Frontend: `provider`, `http`, `google_fonts`, `lucide_icons_flutter`; `DataTable` nativo y selectores de fecha nativos de Material.

**Almacenamiento**: MySQL 8 local (InnoDB, `utf8mb4`); migración nueva `003_sprint3_maintenance_inventory.sql` con `maintenance`, `parts`, `inventory_movements`, `order_parts` y `app_settings`, más dos cambios aditivos en tablas existentes (columna `service_mileage` en `service_orders` e índice en `order_status_history`).

**Pruebas**: Jest (unitarias de clasificación de mantenimiento y cálculos de inventario) y Jest + supertest (integración y contrato) contra `motorix_test`; `flutter test` y `flutter analyze` en el frontend.

**Plataforma objetivo**: Servidor Node.js local; cliente Flutter para navegador (Chrome/Edge) y escritorio de Windows.

**Tipo de proyecto**: Aplicación web con API y base de datos separados (igual que los sprints anteriores).

**Metas de rendimiento**: Inventario, búsqueda, alertas e historial en menos de 2 s con 5 000 refacciones y 1 000 servicios de un vehículo (SC-010); alta de refacción en menos de 1 min y de refacción en una orden en menos de 30 s para quien la registra (SC-005, SC-006).

**Restricciones**: ES Modules; permisos y visibilidad validados en el servidor; stock nunca negativo, incluso con uso simultáneo; refacciones y movimientos nunca se eliminan; migración nueva e inmutable (las `001` y `002` no se tocan); seeds idempotentes con datos suficientes; pruebas de integración solo contra `motorix_test`; toda pantalla sigue `docs/design-system.md`; sin pagos, tickets, dashboard ni notificaciones externas.

**Escala/Alcance**: Un taller; miles de refacciones y movimientos, cientos de servicios por vehículo; 3 roles; unas 8 pantallas nuevas o ampliadas.

## Verificación de la constitución

*COMPUERTA: debe aprobarse antes de la Fase 0. Se vuelve a evaluar tras el diseño de la Fase 1.*

| Principio | Evaluación | Estado |
|-----------|------------|:------:|
| I. Alcance, MVP y fuente de verdad | Solo el Sprint 3; sin pagos, tickets, dashboard ni notificaciones. Trazabilidad requisito → historia → implementación en `spec.md`. | Aprobado |
| II. Arquitectura con responsabilidades separadas | `client/`, `server/`, `database/`; capas `models`, `services`, `controllers`, `routes`, `validators`, `middlewares`, `utils`. La lógica de inventario y mantenimiento vive en `services/` y `utils/maintenanceStatus.js` (reglas puras). | Aprobado |
| III. Stack y base de datos local | Sin tecnologías nuevas; migración SQL numerada e inmutable, InnoDB, FK, `CHECK` y `utf8mb4`; seeds con datos de ejemplo e idempotentes. | Aprobado |
| IV. Seguridad | Permisos por rol y por asignación en el servidor; orden ajena responde 404 al mecánico; entradas validadas con `zod`; errores sin trazas. | Aprobado |
| V. Integridad de reglas de negocio | RN-6 y RN-7 (refacción ligada a orden y salida de inventario), RN-8 (sin stock negativo), RN-10 (historial derivado, sin duplicar), RN-11 y RN-12 (mantenimiento por fecha o kilometraje con umbrales configurables). | Aprobado |
| VI. API consistente y errores | Mismo envoltorio y manejador central; códigos de error nuevos documentados en [contracts/api.md](contracts/api.md). | Aprobado |
| VII. Pruebas | Lógica de stock, mantenimiento y permisos con pruebas unitarias, de integración y de contrato; invariante existencia = suma de movimientos; concurrencia por la última pieza; historias terminadas solo si funcionan de extremo a extremo. | Aprobado |
| VIII. UX/UI | Tokens del sistema de diseño; colores de estado: ámbar para "próximo" y "stock bajo", rojo para "vencido" y "agotada"; confirmaciones al quitar una refacción, reemplazar un mantenimiento y dar de baja una refacción. | Aprobado |

**Resultado de la compuerta**: sin violaciones; no se requiere tabla de complejidad.

**Reevaluación tras el diseño (Fase 1)**: se mantiene aprobado. Precisiones que no son violaciones:
- Se agregan la tabla `app_settings` y la columna `service_mileage`, que el insumo no listaba pero la configuración de umbrales (RN-12) y el kilometraje de servicio (US2) exigen.
- Se agrega una restricción `CHECK` de existencia en la base como segunda defensa del servicio (RN-8).
- Las cantidades son enteras; las unidades fraccionarias (litros) quedan fuera del sprint.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/003-historial-inventario/
├── plan.md              # Este archivo (salida de /speckit-plan)
├── research.md          # Salida de la Fase 0
├── data-model.md        # Salida de la Fase 1
├── quickstart.md        # Salida de la Fase 1
├── contracts/
│   └── api.md           # Contrato de la API REST (Fase 1)
├── checklists/
│   └── requirements.md  # Calidad de la especificación
└── tasks.md             # Salida de /speckit-tasks (NO la crea /speckit-plan)
```

### Código fuente (raíz del repositorio)

Archivos nuevos (N) y modificados (M):

```text
database/
├── migrations/
│   └── 003_sprint3_maintenance_inventory.sql            (N)
└── seeds/
    └── 003_sample_maintenance_inventory.sql             (N)

server/
├── models/
│   ├── maintenanceModel.js                              (N)
│   ├── partModel.js                                     (N)  refacciones y movimientos
│   ├── orderModel.js                                    (M)  líneas de refacciones, subtotal, kilometraje de servicio
│   ├── vehicleModel.js                                  (M)  historial paginado
│   └── settingsModel.js                                 (N)  lectura de app_settings
├── services/
│   ├── historyService.js                                (N)
│   ├── maintenanceService.js                            (N)
│   ├── inventoryService.js                              (N)  catálogo, entradas, ajustes, alertas
│   ├── orderPartsService.js                             (N)  refacciones de la orden + salidas (D7, D8)
│   ├── orderWorkService.js                              (M)  kilometraje de servicio
│   └── orderService.js                                  (M)  detalle con refacciones y editable.parts
├── utils/
│   ├── maintenanceStatus.js                             (N)  clasificación pura (D4)
│   ├── stockStatus.js                                   (N)  OK / LOW / OUT puro (D10)
│   └── AppError.js                                      (M)  códigos de error nuevos
├── validators/ maintenanceValidators.js, partValidators.js; orderValidators.js (M)
├── controllers/ historyController.js, maintenanceController.js, partController.js, orderPartsController.js   (N)
├── routes/      maintenanceRoutes.js, partRoutes.js (N); orderRoutes.js, vehicleRoutes.js (M)
├── app.js                                               (M)  monta las rutas nuevas
├── config/constants.js                                  (M)  estados de mantenimiento, tipos de movimiento
└── tests/
    ├── unit/        maintenanceStatus.test.js, stockStatus.test.js                    (N)
    ├── integration/ history.test.js, maintenance.test.js, parts.test.js,
    │                inventoryMovements.test.js, orderParts.test.js, stockConcurrency.test.js,
    │                serviceMileage.test.js, sprint3Permissions.test.js, schemaSprint3.test.js,
    │                sprint3Seeds.test.js, sprint3Performance.test.js                  (N)
    ├── contract/    history.contract.test.js, maintenance.contract.test.js,
    │                parts.contract.test.js, orderParts.contract.test.js               (N)
    └── helpers/factories.js, testDb.js                  (M)  refacciones, movimientos, mantenimientos

client/lib/
├── models/      part.dart, maintenance.dart, history_entry.dart                       (N)
│                service_order.dart                      (M)  refacciones, serviceMileage
├── services/    inventory_service.dart, maintenance_service.dart                      (N)
│                orders_service.dart, vehicles_service.dart  (M)
├── providers/   inventory_provider.dart, maintenance_provider.dart                    (N)
│                orders_provider.dart                    (M)
├── screens/
│   ├── inventory/     inventory_list_screen.dart, part_form_screen.dart, part_detail_screen.dart   (N)
│   ├── maintenance/   maintenance_list_screen.dart                                    (N)
│   ├── vehicles/      vehicle_detail_screen.dart       (M)  historial y mantenimiento
│   └── orders/        order_detail_screen.dart         (M)  refacciones, kilometraje de servicio, próximo mantenimiento
├── widgets/     order_parts_table.dart, part_picker_dialog.dart, maintenance_dialog.dart,
│                stock_chip.dart, history_card.dart, stock_movement_dialog.dart         (N)
│                app_shell.dart                          (M)  "Mantenimientos" e "Inventario" por rol, insignia de alertas
├── app_routes.dart, router.dart, main.dart                                            (M)
├── utils/       format.dart, validators.dart            (M)
client/test/     inventory_*, part_*, maintenance_*, order_parts_*, vehicle_history_*, app_shell_menu (M)  (N)

docs/api.md                                              (M)  se fusiona el contrato del Sprint 3
README.md, database/README.md                            (M)
```

**Decisión de estructura**: se conserva la estructura de los sprints anteriores. `orderPartsService` se separa de `inventoryService` porque tiene dos actores y reglas distintas (mecánico en la orden frente a administrador en el catálogo) pero comparte la función de movimiento atómico, que vive en `partModel` y se reutiliza para entradas, ajustes y salidas.

## Fases de ejecución sugeridas (insumo para `/speckit-tasks`)

1. **Fundamentos**: migración 003, constantes, códigos de error, `maintenanceStatus.js` y `stockStatus.js` con sus pruebas unitarias, `settingsModel`, fábricas de prueba y actualización de `cleanTables`.
2. **US5 y US6 — Catálogo e inventario**: modelo, servicio, validadores y rutas de refacciones; entradas, ajustes y movimientos con la invariante; pantallas de inventario, formulario y detalle con movimientos.
3. **US7 — Refacciones en la orden**: modelo y servicio con la salida atómica, subtotal en el total de la orden, `editable.parts`; búsqueda de refacciones disponibles; tabla y selector en el detalle de la orden; prueba de concurrencia.
4. **US8 — Alertas de stock bajo**: resumen de alertas, filtro y chips; insignia en el menú y aviso en la pantalla de inventario.
5. **US2 — Kilometraje de servicio**: campo en el trabajo técnico, actualización del kilometraje del vehículo, historial lo muestra.
6. **US1 — Historial del vehículo**: consulta derivada paginada, tarjeta de historial en el detalle del vehículo.
7. **US3 — Próximo mantenimiento**: alta con regla de uno pendiente y reemplazo, edición, realizar y cancelar; diálogo desde la orden terminada y panel en el vehículo.
8. **US4 — Mantenimientos próximos y vencidos**: listado global con clasificación, filtros y datos de contacto; pantalla para recepción.
9. **Cierre**: seeds de ejemplo e idempotencia, rendimiento con 5 000 refacciones, `docs/api.md`, `README.md`, `database/README.md`, revisión de seguridad e interfaz, y recorrido de [quickstart.md](quickstart.md).

## Decisiones que requieren confirmación del equipo

- Modelo de `Part` (`price`, sin `purchasePrice`, `category` ni `brand`) y de `Maintenance` (`orderId`, `description`; `lastServiceDate` y `lastMileage` se derivan de la orden de origen) respecto a las entidades de `docs/project-context.md`.
- Estado de mantenimiento en español (`PENDIENTE`, `REALIZADO`, `CANCELADO`) por coherencia con citas y órdenes.
- Umbrales iniciales de aviso: 30 días y 1 000 km, configurables en la base.
- Refacciones solo editables en los estados de trabajo de la orden (se bloquean al pasar a `TERMINADO`).
- Una sola refacción por línea en la orden, con cantidades enteras.
- Actualizar `docs/project-context.md` con estas decisiones (tarea final, pendiente de aprobación como en los sprints anteriores).

## Seguimiento de complejidad

Sin violaciones de la constitución que justificar.
