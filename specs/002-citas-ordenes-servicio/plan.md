# Plan de implementación: Citas y órdenes de servicio (Sprint 2)

**Rama**: `002-citas-ordenes-servicio` | **Fecha**: 2026-10-12 | **Especificación**: [spec.md](spec.md)

**Entrada**: Especificación de la funcionalidad en `/specs/002-citas-ordenes-servicio/spec.md`

## Resumen

Segundo sprint del MVP: permite a recepción registrar, modificar y cancelar citas y crear órdenes de servicio asociadas a un cliente y a un vehículo (con validación del kilometraje de entrada), y al mecánico consultar solo sus órdenes asignadas, registrar diagnóstico, servicios, mano de obra, observaciones y recomendaciones, y llevar la orden por su secuencia de estados hasta la entrega. Flujo demostrable: cita → recibir vehículo → crear orden → asignar mecánico → diagnóstico → servicios → estados → terminado y entregado.

Enfoque técnico (detalle en [research.md](research.md)): se extiende la API y la aplicación del Sprint 1 con los mismos patrones. La lógica de estados es un módulo puro y exhaustivamente probado; el cambio de estado, la creación de la orden y su efecto en cita y kilometraje se ejecutan en transacciones; los permisos y la visibilidad por mecánico se aplican en el servicio; las citas usan hora local de pared; los importes usan `DECIMAL`.

## Contexto técnico

**Lenguaje/Versión**: Backend en JavaScript (ES Modules) sobre Node.js LTS (24); frontend en Dart con Flutter estable (3.47).

**Dependencias principales**: ninguna nueva. Backend: `express`, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`, `helmet`; pruebas: `jest`, `supertest`. Frontend: `provider`, `http`, `google_fonts`, `lucide_icons_flutter`; selectores de fecha y hora nativos de Material.

**Almacenamiento**: MySQL 8 local (InnoDB, `utf8mb4`); migración nueva `002_sprint2_appointments_service_orders.sql` con `appointments`, `service_orders`, `order_services`, `order_labor` y `order_status_history`.

**Pruebas**: Jest (unitarias, en especial la matriz completa de transiciones) y Jest + supertest (integración y contrato) contra `motorix_test`; `flutter test` y `flutter analyze` en el frontend.

**Plataforma objetivo**: Servidor Node.js local; cliente Flutter para escritorio de Windows y navegador (Chrome/Edge).

**Tipo de proyecto**: Aplicación web con API y base de datos separados (igual que el Sprint 1).

**Metas de rendimiento**: Listados de citas y órdenes en menos de 2 s con 1 000 registros de cada tipo (SC-009); alta de cita en menos de 2 min y de orden en menos de 3 min para quien la registra (SC-001, SC-002).

**Restricciones**: ES Modules; permisos y visibilidad validados en el servidor; sin eliminación de órdenes ni citas; migración nueva e inmutable (la `001` no se toca); seeds idempotentes con datos suficientes; pruebas de integración solo contra `motorix_test`; toda pantalla sigue `docs/design-system.md`.

**Escala/Alcance**: Un taller; cientos de citas y órdenes al año, hasta miles en el MVP; 4 roles de acceso efectivos (3 usuarios del sistema); 10 pantallas nuevas aproximadamente.

## Verificación de la constitución

*COMPUERTA: debe aprobarse antes de la Fase 0. Se vuelve a evaluar tras el diseño de la Fase 1.*

| Principio | Evaluación | Estado |
|-----------|------------|:------:|
| I. Alcance, MVP y fuente de verdad | Solo el Sprint 2; sin historial de mantenimiento, inventario, pagos, tickets ni dashboard. Trazabilidad requisito → historia → implementación en `spec.md`. | Aprobado |
| II. Arquitectura con responsabilidades separadas | `client/`, `server/`, `database/`; capas `models`, `services`, `controllers`, `routes`, `validators`, `middlewares`, `utils`. La lógica de negocio (estados, kilometraje, visibilidad) vive en `services/` y `utils/orderStatus.js`. | Aprobado |
| III. Stack y base de datos local | Sin tecnologías nuevas; migración SQL numerada e inmutable, InnoDB, FK y `utf8mb4`; seeds con datos de ejemplo e idempotentes. | Aprobado |
| IV. Seguridad | Permisos por rol y por asignación en el servidor; una orden ajena responde 404 al mecánico; entradas validadas con `zod`; errores sin trazas. | Aprobado |
| V. Integridad de reglas de negocio | RN-2 (vehículo existente y del cliente), RN-3 y RN-4 (kilometraje de entrada y su validación), RN-9 (órdenes entregadas inmodificables y sin borrado), pagos fuera de alcance. | Aprobado |
| VI. API consistente y errores | Mismo envoltorio y manejador central; códigos de error nuevos documentados en [contracts/api.md](contracts/api.md). | Aprobado |
| VII. Pruebas | Lógica de transiciones con matriz exhaustiva (CA-8), permisos por rol, kilometraje y regla de terminado con pruebas de integración y contrato; historias terminadas solo si funcionan de extremo a extremo. | Aprobado |
| VIII. UX/UI | Tokens del sistema de diseño, colores de estado de `docs/design-system.md`, confirmaciones obligatorias (cancelar cita, reasignar, entregar, salir sin guardar), selectores nativos sin dependencias. | Aprobado |

**Resultado de la compuerta**: sin violaciones; no se requiere tabla de complejidad.

**Reevaluación tras el diseño (Fase 1)**: se mantiene aprobado. Dos precisiones que no son violaciones:
- Se agrega una quinta tabla, `order_status_history`, que el insumo no listaba pero FR-026 exige.
- Las citas se guardan en hora local de pared (D5); si el servidor cambiara de zona horaria deberá configurarse (fuera del MVP local).

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/002-citas-ordenes-servicio/
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
│   └── 002_sprint2_appointments_service_orders.sql      (N)
└── seeds/
    └── 002_sample_appointments_orders.sql               (N)

server/
├── models/
│   ├── appointmentModel.js                              (N)
│   ├── orderModel.js                                    (N)  órdenes, servicios, mano de obra, historial
│   ├── userModel.js                                     (M)  listado de mecánicos activos
│   └── vehicleModel.js                                  (M)  actualizar kilometraje dentro de transacción
├── services/
│   ├── appointmentService.js                            (N)
│   ├── orderService.js                                  (N)
│   ├── orderWorkService.js                              (N)  diagnóstico, servicios, mano de obra, notas
│   └── mileageService.js                                (N)  regla de kilometraje compartida (D9)
├── utils/
│   └── orderStatus.js                                   (N)  máquina de estados pura (D1)
├── validators/
│   ├── appointmentValidators.js                         (N)
│   └── orderValidators.js                               (N)
├── controllers/ appointmentController.js, orderController.js, mechanicController.js   (N)
├── routes/      appointmentRoutes.js, orderRoutes.js, mechanicRoutes.js               (N)
├── app.js                                               (M)  monta las rutas nuevas
├── utils/AppError.js                                    (M)  códigos de error nuevos
├── config/constants.js                                  (M)  estados de cita y de orden
└── tests/
    ├── unit/        orderStatus.test.js, mileageService.test.js                       (N)
    ├── integration/ appointments.test.js, orders.test.js, orderWork.test.js,
    │                orderStatus.test.js, orderPermissions.test.js, sprint2Seeds.test.js,
    │                listPerformance.test.js                                           (N)
    ├── contract/    appointments.contract.test.js, orders.contract.test.js            (N)
    └── helpers/factories.js                             (M)  citas, órdenes y líneas

client/lib/
├── models/      appointment.dart, service_order.dart, order_status.dart               (N)
├── services/    appointments_service.dart, orders_service.dart                        (N)
├── providers/   appointments_provider.dart, orders_provider.dart                      (N)
├── screens/
│   ├── appointments/  appointments_list_screen.dart, appointment_form_screen.dart     (N)
│   └── orders/        orders_list_screen.dart, order_form_screen.dart, order_detail_screen.dart   (N)
├── widgets/     status_chip.dart, date_time_field.dart, order_lines_table.dart        (N)
├── utils/       format.dart (M: importes y fecha/hora), validators.dart (M)
├── app_routes.dart, router.dart, main.dart                                            (M)
└── widgets/app_shell.dart                               (M)  entradas "Citas" y "Órdenes" por rol
client/test/     appointments_*, orders_*, order_detail_* (N)

docs/api.md                                              (M)  se fusiona el contrato del Sprint 2
```

**Decisión de estructura**: se conserva la estructura del Sprint 1 (tres carpetas raíz y capas del backend en `server/`). La separación entre `orderService` (ciclo de vida y estados) y `orderWorkService` (trabajo técnico) evita un servicio de más de 500 líneas y refleja los dos actores distintos (recepción y mecánico).

## Fases de ejecución sugeridas (insumo para `/speckit-tasks`)

1. **Fundamentos**: migración 002, constantes de estados, códigos de error, `orderStatus.js` con su matriz de pruebas, `mileageService.js`, fábricas de prueba y actualización del `cleanTables`.
2. **US1 — Citas (registrar y consultar)**: modelo, servicio, validadores, rutas, aviso de coincidencias; pantallas de listado y formulario (selectores de fecha y hora).
3. **US2 — Modificar, confirmar y cancelar citas**.
4. **US3 y US4 — Crear la orden y asignar mecánico**: transacción de alta (D8), regla de kilometraje, creación desde cita, catálogo de mecánicos, corrección de datos básicos; formulario de orden.
5. **US5 — Mis órdenes**: listado con visibilidad por mecánico, detalle con `allowedTransitions` y `editable`.
6. **US6 — Diagnóstico, servicios y mano de obra**, con totales.
7. **US7 — Estados**: transiciones con historial, concurrencia, requisitos para terminar y entrega con efecto en la cita.
8. **US8 — Observaciones y recomendaciones**.
9. **US9 — Seeds y cierre**: datos de ejemplo, rendimiento con 1 000 registros, `docs/api.md`, `README.md`, revisión de seguridad e interfaz, y recorrido de [quickstart.md](quickstart.md).

## Decisiones que requieren confirmación del equipo

- Valores de estados de cita en español (`PENDIENTE`, `CONFIRMADA`, …) por coherencia con los de la orden (D6).
- Folio `OS-` más 6 dígitos del identificador (D4).
- Pantalla inicial del mecánico: "Mis órdenes" (D15).
- La recepcionista ve el trabajo técnico de la orden en solo lectura (aclaración de la sesión de clarificación).

## Seguimiento de complejidad

Sin violaciones de la constitución que justificar.
