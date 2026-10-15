# Plan de implementación: Pagos, tickets y panel de control (Sprint 4)

**Rama**: `004-pagos-tickets-dashboard` | **Fecha**: 2026-10-14 | **Especificación**: [spec.md](spec.md)

**Entrada**: Especificación de la funcionalidad en `/specs/004-pagos-tickets-dashboard/spec.md`

## Resumen

Cuarto y último sprint del MVP: recepción registra los pagos de una orden terminada (efectivo, tarjeta, transferencia y Mercado Pago en modo de pruebas), genera el ticket de servicio para verlo e imprimirlo, y el administrador supervisa el taller desde un panel de control con órdenes, citas, mantenimientos, alertas de inventario y cobros. Flujo demostrable: orden terminada → consultar el total → registrar el pago → Mercado Pago cuando corresponda → generar el ticket → consultar los indicadores del panel.

Enfoque técnico (detalle en [research.md](research.md)): se extiende la API y la aplicación con los patrones de los sprints anteriores. El saldo de la orden es una función pura en centavos enteros; toda operación sobre pagos bloquea primero la orden y recalcula el saldo en la misma transacción, de modo que lo pagado nunca supera el total. La integración con Mercado Pago está aislada en `server/integrations/`, usa `fetch` sin dependencias, lee sus credenciales solo del entorno y se prueba con un servidor HTTP simulado. El ticket guarda solo su folio y se arma al consultar; el cliente construye el PDF en memoria para imprimirlo. El panel agrega consultas en paralelo sobre las tablas existentes, sin tablas nuevas.

## Contexto técnico

**Lenguaje/Versión**: Backend en JavaScript (ES Modules) sobre Node.js LTS (24); frontend en Dart con Flutter estable (3.47).

**Dependencias principales**: backend sin dependencias nuevas (`fetch` nativo para Mercado Pago). Frontend: se agregan `pdf` y `printing` para imprimir el ticket (justificación en [research.md](research.md), D7); se conservan `provider`, `http`, `google_fonts` y `lucide_icons_flutter`.

**Almacenamiento**: MySQL 8 local (InnoDB, `utf8mb4`); migración nueva `004_sprint4_payments_tickets.sql` con `payments` y `tickets`, y las claves del taller en `app_settings`.

**Pruebas**: Jest (unitarias de saldo, dinero y armado del ticket) y Jest + supertest (integración y contrato) contra `motorix_test` y un servidor HTTP simulado de Mercado Pago; `flutter test` y `flutter analyze` en el frontend.

**Plataforma objetivo**: Servidor Node.js local; cliente Flutter para navegador (Chrome/Edge) y escritorio de Windows.

**Tipo de proyecto**: Aplicación web con API y base de datos separados (igual que los sprints anteriores).

**Metas de rendimiento**: Panel y listados de pagos y tickets en menos de 2 s con 1 000 órdenes, 1 000 citas, 5 000 refacciones y 5 000 pagos (SC-007); registro de pago en menos de 1 min y ticket en menos de 30 s para quien los captura (SC-001, SC-003).

**Restricciones**: ES Modules; permisos validados en el servidor; lo pagado nunca supera el total, incluso con registros simultáneos; pagos y tickets nunca se eliminan; sin datos de tarjeta ni credenciales en la aplicación ni en el repositorio; Mercado Pago solo en modo de pruebas y aislado; migración nueva e inmutable (001 a 003 intactas); seeds idempotentes con datos suficientes; pruebas de integración solo contra `motorix_test` y sin llamar a Mercado Pago real; toda pantalla sigue `docs/design-system.md`; sin facturación electrónica, mensajes automáticos ni analítica histórica.

**Escala/Alcance**: Un taller; cientos de pagos al año, hasta miles en el MVP; 3 roles; unas 8 pantallas nuevas o ampliadas.

## Verificación de la constitución

*COMPUERTA: debe aprobarse antes de la Fase 0. Se vuelve a evaluar tras el diseño de la Fase 1.*

| Principio | Evaluación | Estado |
|-----------|------------|:------:|
| I. Alcance, MVP y fuente de verdad | Solo el Sprint 4; sin chatbot, facturación electrónica, mensajes automáticos ni analítica histórica. Trazabilidad requisito → historia → implementación en `spec.md`. | Aprobado |
| II. Arquitectura con responsabilidades separadas | `client/`, `server/`, `database/`; capas `models`, `services`, `controllers`, `routes`, `validators`, `middlewares`, `utils`. La integración con Mercado Pago vive aislada en `server/integrations/` (el dominio no conoce su API). La lógica de saldo y pagos está en `services/` y `utils/paymentBalance.js`. | Aprobado |
| III. Stack y base de datos local | Backend sin tecnologías nuevas; migración SQL numerada e inmutable, InnoDB, FK, `CHECK` y `utf8mb4`; seeds con datos de ejemplo e idempotentes. En Flutter se agregan `pdf` y `printing` con justificación (D7). | Aprobado |
| IV. Seguridad | Permisos por rol en el servidor (anulación solo administración, panel solo administración); credenciales de Mercado Pago solo por variables de entorno y nunca devueltas ni registradas; ningún dato de tarjeta; entradas validadas con `zod`; errores sin trazas. | Aprobado |
| V. Integridad de reglas de negocio | Todo pago relacionado con una orden (RN-13); sin datos sensibles de pago (RN-14); órdenes entregadas conservadas y sin cambios en su contenido (RN-9); permisos en el backend (RN-15); pagos y tickets sin borrado. | Aprobado |
| VI. API consistente y errores | Mismo envoltorio y manejador central; códigos de error nuevos documentados en [contracts/api.md](contracts/api.md). | Aprobado |
| VII. Pruebas | Lógica de saldo, estados y permisos con pruebas unitarias, de integración y de contrato; concurrencia al cobrar; Mercado Pago contra un servidor simulado; historias terminadas solo si funcionan de extremo a extremo. | Aprobado |
| VIII. UX/UI | Tokens del sistema de diseño; colores de estado (verde pagada o aprobada, ámbar parcial o pendiente, rojo rechazada, anulada o vencida); confirmaciones al anular, cancelar un cobro y entregar con saldo. | Aprobado |

**Resultado de la compuerta**: sin violaciones; no se requiere tabla de complejidad.

**Reevaluación tras el diseño (Fase 1)**: se mantiene aprobado. Precisiones que no son violaciones:
- El ticket es uno por orden (el modelo de `docs/project-context.md` lo ligaba a un pago); se justifica por los abonos (D6) y queda en decisiones por confirmar.
- Se agrega un resumen de pago a las respuestas de órdenes, derivado de `payments` y sin copias.
- `printing` genera el documento en el cliente; el servidor no guarda archivos.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/004-pagos-tickets-dashboard/
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
│   └── 004_sprint4_payments_tickets.sql                 (N)
└── seeds/
    └── 004_sample_payments_tickets.sql                  (N)

server/
├── integrations/
│   └── mercadoPagoClient.js                             (N)  única parte que conoce la API de Mercado Pago
├── models/
│   ├── paymentModel.js                                  (N)
│   ├── ticketModel.js                                   (N)
│   ├── dashboardModel.js                                (N)  conteos y sumas del panel
│   ├── orderModel.js                                    (M)  resumen de pago, filtro paymentStatus
│   ├── maintenanceModel.js                              (M)  conteo por clasificación (comparte condiciones)
│   └── settingsModel.js                                 (M)  datos del taller
├── services/
│   ├── paymentService.js                                (N)
│   ├── ticketService.js                                 (N)
│   ├── dashboardService.js                              (N)
│   └── orderService.js                                  (M)  `payment` y `ticketId` en detalle y listado
├── utils/
│   ├── money.js                                         (N)  centavos
│   ├── paymentBalance.js                                (N)  saldo y estado de pago (puras)
│   ├── ticketBuilder.js                                 (N)  arma el contenido del ticket (puro)
│   └── AppError.js                                      (M)  códigos de error nuevos
├── validators/ paymentValidators.js, ticketValidators.js   (N); orderValidators.js (M)
├── controllers/ paymentController.js, ticketController.js, dashboardController.js   (N)
├── routes/      paymentRoutes.js, ticketRoutes.js, dashboardRoutes.js (N); orderRoutes.js (M)
├── app.js, config/constants.js, config/env.js           (M)  rutas, constantes y variables de Mercado Pago
└── tests/
    ├── unit/        money.test.js, paymentBalance.test.js, ticketBuilder.test.js          (N)
    ├── integration/ payments.test.js, paymentConcurrency.test.js, mercadoPago.test.js,
    │                tickets.test.js, dashboard.test.js, paymentPermissions.test.js,
    │                schemaSprint4.test.js, sprint4Seeds.test.js, sprint4Performance.test.js   (N)
    ├── contract/    payments.contract.test.js, tickets.contract.test.js,
    │                dashboard.contract.test.js, orderPayment.contract.test.js              (N)
    └── helpers/     factories.js, testDb.js (M); mercadoPagoStub.js (N)  servidor HTTP simulado

.env.example                                             (M)  MP_ACCESS_TOKEN, MP_API_URL, MP_MODE (sin valores)

client/lib/
├── models/      payment.dart, ticket.dart, dashboard.dart                              (N)
│                service_order.dart                      (M)  resumen de pago y ticketId
├── services/    payments_service.dart, tickets_service.dart, dashboard_service.dart    (N)
├── providers/   payments_provider.dart, tickets_provider.dart, dashboard_provider.dart (N)
│                orders_provider.dart                    (M)
├── screens/
│   ├── dashboard/   dashboard_screen.dart                                              (N)
│   ├── payments/    payments_list_screen.dart                                          (N)
│   ├── tickets/     ticket_screen.dart                                                 (N)
│   └── orders/      order_detail_screen.dart, orders_list_screen.dart                  (M)  pagos, ticket y entrega con saldo
├── widgets/     payment_summary_card.dart, payments_table.dart, payment_dialog.dart,
│                mercado_pago_dialog.dart, void_payment_dialog.dart, ticket_view.dart,
│                dashboard_tile.dart                                                    (N)
│                app_shell.dart                          (M)  "Panel", "Pagos" por rol
├── utils/       ticket_pdf.dart (N); format.dart (M)
├── app_routes.dart, router.dart, main.dart                                             (M)
└── pubspec.yaml                                         (M)  pdf, printing
client/test/     dashboard_*, payment_*, ticket_*, order_payment_*, app_shell_menu (M)  (N)

docs/api.md                                              (M)  se fusiona el contrato del Sprint 4
README.md, database/README.md                            (M)
```

**Decisión de estructura**: se conserva la estructura de los sprints anteriores y se agrega `server/integrations/` para aislar a Mercado Pago, como pide la constitución. `paymentService` es el único que combina el cliente de Mercado Pago con el dominio; `dashboardService` solo lee.

## Fases de ejecución sugeridas (insumo para `/speckit-tasks`)

1. **Fundamentos**: migración 004, constantes y errores, `money.js` y `paymentBalance.js` con pruebas unitarias, resumen de pago en la orden, variables de entorno de Mercado Pago, fábricas de prueba y limpieza de tablas.
2. **US1 y US2 — Registrar el pago y elegir el método (P1)**: modelo, servicio con bloqueo de la orden, validadores y rutas; efectivo con cambio, tarjeta y transferencia con referencia; cancelar y anular; pantalla de pagos de la orden y listado de pagos; prueba de concurrencia.
3. **US4 — Tickets (P1)**: armado del contenido, generación idempotente, consulta y listado; vista del comprobante, PDF e impresión; datos del taller.
4. **US3 — Mercado Pago (P2)**: cliente aislado con servidor simulado, alta del cobro, actualización idempotente del estado, cancelación y mensajes sin configuración; diálogo y estado en la interfaz.
5. **US5 y US6 — Panel de control (P2)**: consultas del panel, permisos solo de administrador, pantalla de inicio del administrador con tarjetas y accesos a los módulos.
6. **Entrega con saldo**: aviso y confirmación al entregar una orden con saldo pendiente.
7. **Cierre**: seeds de ejemplo e idempotencia, rendimiento, `docs/api.md`, `README.md`, `database/README.md`, revisión de seguridad e interfaz, y recorrido de [quickstart.md](quickstart.md).

## Decisiones que requieren confirmación del equipo

- Estados de pago en español (`PENDIENTE`, `APROBADO`, `RECHAZADO`, `CANCELADO`, `ANULADO`) en lugar de "Pagado", por coherencia con citas, órdenes y mantenimientos.
- Un ticket por orden (no por pago) y modelo de `Payment` con `reference`, `externalReference`, `paymentUrl` y datos de anulación, respecto a `docs/project-context.md`.
- Dependencias de Flutter `pdf` y `printing` para imprimir el ticket y `url_launcher` para abrir el enlace de pago de Mercado Pago (Principio III).
- Mercado Pago con enlace de pago en modo de pruebas y actualización manual del estado, sin webhook, por correr el MVP en una máquina local.
- Pagos parciales (abonos) y cobros de Mercado Pago que reservan saldo, con un solo cobro pendiente por orden.
- Panel de control como pantalla de inicio del administrador y sin acceso para recepción.
- Actualizar `docs/project-context.md` con estas decisiones (tarea final, pendiente de aprobación como en los sprints anteriores).

## Seguimiento de complejidad

Sin violaciones de la constitución que justificar.
