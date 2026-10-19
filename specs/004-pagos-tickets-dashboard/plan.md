# Plan de implementación: Pagos, tickets y panel de control

**Rama**: `sdd-speckit` (carpeta de la feature `004-pagos-tickets-dashboard`) | **Fecha**: 2026-10-19 | **Especificación**: [spec.md](spec.md)

**Entrada**: Especificación de la funcionalidad en `specs/004-pagos-tickets-dashboard/spec.md`

## Resumen

El Sprint 4 cierra el MVP con tres capacidades sobre las órdenes ya terminadas: el registro de **pagos** (parciales, con cuatro métodos), el **ticket** de servicio (una vista imprimible que se arma al consultarla) y el **panel de control** del administrador (cifras calculadas al abrirlo). El punto delicado es la **consistencia del saldo**: la suma de pagos Pagados y Pendientes de una orden nunca puede exceder su total, ni siquiera con cobros simultáneos, así que cada alta de pago bloquea la orden dentro de una transacción. El segundo punto delicado es **Mercado Pago**: se integra en sandbox mediante un enlace de pago, con la lógica externa aislada en su propio módulo, credenciales solo por variables de entorno, notificaciones públicas verificadas contra la API de Mercado Pago e idempotentes, y sin guardar datos de tarjeta. Las decisiones técnicas están en [research.md](research.md).

## Contexto técnico

**Lenguaje/Versión**: Node.js 24 con JavaScript ES Modules; Dart con Flutter 3.47.5 (igual que los sprints anteriores)

**Dependencias principales**: backend sin dependencias nuevas (la API de Mercado Pago se llama con el `fetch` nativo de Node 24); frontend con dos dependencias nuevas pequeñas y justificadas en [research.md](research.md): `url_launcher` (abrir el ticket imprimible en el navegador del sistema) y `qr_flutter` (dibujar el código QR del enlace de pago)

**Almacenamiento**: MySQL 8.0 local, InnoDB, `utf8mb4`; migración `004_sprint4_payments_tickets.sql` (nunca se editan la 001, 002 ni 003)

**Pruebas**: Jest (unitarias de las reglas de saldo, de la integración con Mercado Pago simulada, del armado del ticket y del panel) y Jest + supertest (integración y contrato, con pruebas de concurrencia de pagos y de notificaciones repetidas) contra la base `*_test`; `flutter test` en el frontend

**Plataforma objetivo**: Aplicación Flutter de escritorio/web con prioridad en escritorio; API REST local

**Tipo de proyecto**: Aplicación web con frontend y backend separados (`client/` y `server/`)

**Metas de rendimiento**: registrar un pago en menos de 500 ms (sin contar Mercado Pago); armar un ticket en menos de 500 ms; panel de control en menos de 3 segundos con los datos de ejemplo y con miles de órdenes (consultas agregadas, sin recorrer registro por registro desde la aplicación)

**Restricciones**: la suma de pagos reservados nunca excede el total de la orden; pagos inmutables una vez finales y nunca eliminados; ningún dato de tarjeta ni credencial en base de datos, respuestas o registros; credenciales de Mercado Pago solo en variables de entorno; permisos por rol validados en el backend (pagos y tickets: recepción y administración; panel: solo administración); notificaciones públicas de Mercado Pago verificadas e idempotentes; toda pantalla sigue `docs/design-system.md`

**Escala/Alcance**: un taller; cientos de pagos al año; 3 módulos nuevos (pagos, tickets, panel) y aproximadamente 6 pantallas o diálogos nuevos

## Verificación de la constitución

*PUERTA: debe aprobarse antes de la investigación de la Fase 0. Se vuelve a verificar tras el diseño de la Fase 1.*

| Principio | Cumplimiento | Evidencia en el plan |
|-----------|--------------|----------------------|
| I. Alcance, MVP y fuente de verdad | Cumple | Solo Sprint 4; sin reembolsos, facturación, correos, WhatsApp ni analítica histórica; las decisiones pendientes de la constitución (PDF/tickets y alcance de Mercado Pago) quedan resueltas en [research.md](research.md) |
| II. Arquitectura con responsabilidades separadas | Cumple | Reglas de saldo en `services/paymentService`; Mercado Pago aislado en `integrations/mercadoPagoGateway`; armado del ticket en `services/ticketService`; panel en `services/dashboardService` que reutiliza los módulos de origen; controladores delgados |
| III. Stack y base de datos local | Cumple | Sin tecnologías nuevas en el backend; migración numerada nueva; seeds idempotentes con pagos y tickets de ejemplo; las dos dependencias del frontend se justifican |
| IV. Seguridad | Cumple | Roles en backend; credenciales por variables de entorno; sin datos de tarjeta; notificación pública verificada contra Mercado Pago (y firma si hay secreto); enlace de impresión con token de corta vida que no sirve como sesión; errores sin trazas |
| V. Reglas de negocio | Cumple | Todo pago ligado a una orden (RN-13); sin datos sensibles de pago (RN-14); permisos en backend (RN-15); orden entregada se conserva como historial (RN-9) |
| VI. API consistente | Cumple | Mismo formato y manejo de errores ([contracts/api.md](contracts/api.md)) |
| VII. Pruebas | Cumple | Pruebas de concurrencia de pagos, de idempotencia de notificaciones, de contenido del ticket y de coincidencia de cada cifra del panel con su módulo; la integración con Mercado Pago se prueba con un simulador, nunca con llamadas reales en las pruebas |
| VIII. UX/UI | Cumple | Material 3 con tema propio; confirmación al cancelar pagos; estados de carga, vacío, error y éxito |

**Resultado**: sin violaciones. Se reevaluó tras el diseño de la Fase 1 con el mismo resultado.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/004-pagos-tickets-dashboard/
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
├── migrations/004_sprint4_payments_tickets.sql
└── seeds/008_payments_tickets.sql

server/
├── config/              # env.js se amplía con Mercado Pago y datos del taller
├── integrations/        # mercadoPagoGateway.js (única pieza que habla con Mercado Pago)
├── models/              # paymentModel, ticketModel, dashboardModel
├── services/            # paymentService, mercadoPagoService, ticketService, ticketPrint, dashboardService
├── controllers/         # paymentController, ticketController, dashboardController
├── routes/              # paymentRoutes, ticketRoutes, dashboardRoutes, + rutas de pagos y ticket en orderRoutes
├── validators/          # paymentValidator
└── tests/{unit,integration,contract}/

client/lib/
├── models/              # payment.dart, ticket.dart, dashboard.dart
├── providers/           # payments_provider.dart, dashboard_provider.dart
├── screens/             # dashboard_screen, ticket_screen
└── widgets/             # payment_section, payment_dialogs (registrar, enlace de Mercado Pago)
```

**Decisión de estructura**: se conserva la estructura de los sprints anteriores y se agrega la carpeta `server/integrations/` para que lo externo (Mercado Pago) quede separado del dominio y se pueda sustituir por un simulador en las pruebas. Las reglas con lógica propia (saldo de la orden, estados del pago y armado del ticket) viven en `server/services/` como funciones fáciles de probar.

## Seguimiento de complejidad

> Sin violaciones de la constitución; no se requiere justificación.

| Violación | Por qué se necesita | Alternativa más simple descartada porque |
|-----------|---------------------|------------------------------------------|
| Ninguna | N/A | N/A |
