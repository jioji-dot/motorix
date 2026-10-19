# Matriz de trazabilidad

Esta matriz une cada grupo de requisitos con su historia de usuario, las tareas que lo construyeron, el commit donde quedó y las pruebas que lo comprueban. Sirve para recorrer el camino completo: **requisito → historia → tareas → commit → prueba**.

## Cómo leerla

- Las tareas de `tasks.md` están organizadas por historia de usuario y casi nunca citan el número del requisito (`FR-###`). Por eso la relación se hizo **por historia y fase**, no requisito por requisito: cada grupo de requisitos se liga a la fase de tareas de la historia que lo cubre.
- Los commits de implementación agrupan varias fases. Cada commit se ubica por la historia que entrega.
- Las pruebas listadas son los archivos principales de cada grupo, no todas las pruebas del proyecto. La salida completa está en `docs/evidencias/pruebas-backend-jest.txt` (1,240 pruebas) y `docs/evidencias/pruebas-frontend-flutter.txt` (242 pruebas).
- Los commits de especificación, clarificación, plan y tareas de cada sprint están en el Apartado 7 del reporte; aquí solo aparecen los de implementación.

## Sprint 1: base, clientes y vehículos (`specs/001-base-clientes-vehiculos/`)

| Requisitos | Historia | Fase de tareas | Commit | Pruebas principales |
|------------|----------|----------------|--------|---------------------|
| Preparación del proyecto | — | Fase 1 (6 tareas) | 0524f75 | — |
| Base común: base de datos, errores, middlewares, roles | — | Fase 2 (17 tareas) | 22e03bf | `server/tests/integration/permissions.test.js` |
| FR-001 a FR-007 (autenticación), FR-008 a FR-010 (autorización) | HU1: iniciar sesión según mi rol | Fase 3 (14 tareas) | 1740e36 | `server/tests/integration/auth.test.js`, `server/tests/unit/authService.test.js`, `server/tests/unit/passwordPolicy.test.js` |
| FR-014 a FR-019 (clientes) | HU2: gestionar clientes | Fase 4 (12 tareas) | c3192ad | `server/tests/integration/clients.test.js`, `server/tests/unit/clientService.test.js` |
| FR-020 a FR-024 (vehículos) | HU3: registrar vehículos | Fase 5 (11 tareas) | 2fc8fc2 | `server/tests/integration/vehicles.test.js`, `server/tests/unit/vehicleService.test.js` |
| FR-011 a FR-013 (usuarios) | HU4: administrar usuarios y roles | Fase 6 (10 tareas) | c46f820 | `server/tests/integration/users.test.js`, `server/tests/unit/userService.test.js` |
| FR-025 a FR-030 (calidad general) | Transversal | Fase 7 (7 tareas) | ba5f057 | `server/tests/integration/permissions.test.js` |

## Sprint 2: citas y órdenes de servicio (`specs/002-citas-ordenes-servicio/`)

| Requisitos | Historia | Fase de tareas | Commit | Pruebas principales |
|------------|----------|----------------|--------|---------------------|
| Preparación | — | Fase 1 (2 tareas) | fa132c1 | — |
| Base común: migración 002, folios, permisos de órdenes | — | Fase 2 (8 tareas) | fa132c1 | `server/tests/unit/orderAccess.test.js` |
| FR-001 a FR-006 (citas) | HU1: registrar y gestionar citas | Fase 3 (13 tareas) | d4061b6 | `server/tests/integration/appointments.test.js`, `server/tests/unit/appointmentService.test.js` |
| FR-007 a FR-013 (órdenes) | HU2: crear una orden | Fase 4 (12 tareas) | c75306d | `server/tests/integration/orders.create.test.js`, `server/tests/unit/orderCreation.test.js` |
| FR-018 y FR-019 (consulta y acceso) | HU3: consultar mis órdenes | Fase 5 (9 tareas) | 82fdebc | `server/tests/integration/orders.read.test.js` |
| FR-014 a FR-017 (trabajo del mecánico) | HU4: diagnóstico, servicios y recomendaciones | Fase 6 (9 tareas) | 310a0b3 | `server/tests/integration/orders.lines.test.js`, `server/tests/unit/orderLines.test.js` |
| FR-020 a FR-029 (estados de la orden) | HU5: cambiar el estado | Fase 7 (10 tareas) | c35bc81 | `server/tests/integration/orders.status.test.js`, `server/tests/unit/orderStateMachine.test.js`, `server/tests/unit/orderStatus.test.js` |
| Calidad general | Transversal | Fase 8 (8 tareas) | c49b26b | `server/tests/integration/permissions.test.js` |

## Sprint 3: historial, mantenimiento e inventario (`specs/003-historial-mantenimiento-inventario/`)

| Requisitos | Historia | Fase de tareas | Commit | Pruebas principales |
|------------|----------|----------------|--------|---------------------|
| Preparación | — | Fase 1 (2 tareas) | 15e5030 | — |
| Base común: migración 003, stock con restricciones y movimientos inmutables | — | Fase 2 (9 tareas) | 15e5030 | `server/tests/integration/stockInvariant.test.js` (en 4597217) |
| FR-001 a FR-006 (historial) | HU1: historial del vehículo | Fase 3 (12 tareas) | 15e5030 | `server/tests/integration/vehicleHistory.test.js`, `server/tests/unit/vehicleHistoryService.test.js`, `server/tests/unit/serviceMileage.test.js` |
| FR-007 a FR-014 (mantenimiento programado) | HU2: establecer el próximo mantenimiento | Fase 4 (11 tareas) | 15e5030 | `server/tests/integration/maintenance.test.js`, `server/tests/unit/maintenanceService.test.js` |
| FR-007 a FR-014 (clasificación y orden) | HU3: mantenimientos próximos y vencidos | Fase 5 (8 tareas) | 15e5030 | `server/tests/unit/maintenanceClassifier.test.js`, `server/tests/integration/maintenance.list.test.js`, `server/tests/unit/maintenanceList.test.js` |
| FR-015 a FR-021 (inventario) | HU4: registrar refacciones y su stock | Fase 6 (12 tareas) | 4597217 | `server/tests/integration/parts.test.js`, `server/tests/unit/partService.test.js`, `server/tests/unit/inventoryService.test.js`, `server/tests/integration/stockInvariant.test.js` |
| FR-022 a FR-028 (refacciones en órdenes) | HU5: agregar refacciones a una orden | Fase 7 (12 tareas) | 4597217 | `server/tests/integration/orderParts.test.js`, `server/tests/integration/orderParts.cancel.test.js`, `server/tests/unit/orderPartService.test.js` |
| FR-029 a FR-031 (alertas de stock bajo) | HU6: alertas de stock bajo | Fase 8 (6 tareas) | 4597217 | `server/tests/integration/parts.alerts.test.js`, `server/tests/unit/stockLevel.test.js` |
| FR-032 a FR-035 (calidad general) | Transversal | Fase 9 (7 tareas) | eb49d39 | `server/tests/integration/permissions.test.js` |

Nota: cada sprint se entregó por capas, no por fase. 15e5030 trae la migración y el backend de historial y mantenimientos; 4597217, el backend de inventario, refacciones en órdenes y alertas; 47a2351, todas las pantallas de Flutter del sprint (por eso las pruebas de widgets no se listan por fila); y eb49d39, la validación y la documentación. Las tareas de interfaz de cada historia quedaron en 47a2351.

## Sprint 4: pagos, tickets y panel de control (`specs/004-pagos-tickets-dashboard/`)

| Requisitos | Historia | Fase de tareas | Commit | Pruebas principales |
|------------|----------|----------------|--------|---------------------|
| Preparación | — | Fase 1 (3 tareas) | 9760335 | — |
| Base común: migración 004, aritmética en centavos, bloqueo de la orden | — | Fase 2 (10 tareas) | 9760335 | `server/tests/unit/money.test.js`, `server/tests/unit/paymentSummary.test.js` |
| FR-001 a FR-012 (pagos) | HU1: registrar el pago de una orden | Fase 3 (11 tareas) | 9760335 | `server/tests/integration/payments.test.js`, `server/tests/unit/paymentService.test.js`, `server/tests/unit/paymentValidator.test.js` |
| Métodos de pago (FR-001 a FR-012) | HU2: elegir el método de pago | Fase 4 (5 tareas) | 9760335 | `server/tests/integration/payments.methods.test.js` |
| FR-019 a FR-024 (tickets) | HU4: generar y consultar el ticket | Fase 5 (12 tareas) | 9760335 | `server/tests/integration/tickets.test.js`, `server/tests/unit/ticketBuilder.test.js`, `server/tests/unit/ticketService.test.js`, `server/tests/unit/ticketPrint.test.js` |
| FR-013 a FR-018 (Mercado Pago) | HU3: cobrar con Mercado Pago | Fase 6 (11 tareas) | 9760335 | `server/tests/integration/payments.mercadopago.test.js`, `server/tests/unit/mercadoPagoGateway.test.js`, `server/tests/unit/mercadoPagoService.test.js`, `server/tests/unit/webhookVerifier.test.js` |
| FR-025 a FR-028 (panel de control) | HU5 y HU6: panel, órdenes, citas, mantenimientos y alertas | Fases 7 y 8 (6 y 7 tareas) | 9760335 | `server/tests/integration/dashboard.test.js`, `server/tests/integration/dashboard.empty.test.js`, `server/tests/unit/dashboardService.test.js` |
| FR-029 a FR-032 (calidad general) | Transversal | Fase 9 (6 tareas) | 3a955a2 | `server/tests/integration/permissions.test.js` |

Nota: el Sprint 4 se entregó en tres commits. 9760335 trae todo el backend (pagos, Mercado Pago, tickets y panel); 028e50a, las pantallas de Flutter de esas historias (bloque de pagos, ticket y panel); y 3a955a2, la validación y la documentación. Las tareas de interfaz de cada historia quedaron en 028e50a.

## Límites de esta matriz

- La relación requisito–tarea es por historia y fase, no por identificador, porque las tareas no citan los `FR-###`.
- Una prueba listada comprueba el grupo de requisitos, pero no todos los requisitos del grupo tienen una prueba propia con su número; el detalle por criterio está en la tabla de criterios del reporte.
- La interfaz de Flutter se comprueba con pruebas de widgets y providers (`client/test/`) y con las capturas de `docs/evidencias/captura-*.png`; no se incluyen aquí por archivo.
