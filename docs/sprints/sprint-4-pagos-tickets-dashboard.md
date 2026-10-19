<!--
Insumo de especificacion para /speckit.specify.
Sprint 4 del MVP de Motorix: pagos, tickets y dashboard.
-->

# Insumo de especificacion - Sprint 4: Pagos, tickets y dashboard

> Referencias obligatorias para el agente:
> - Contexto maestro: `docs/project-context.md`
> - Constitucion: `docs/reglas.md` y `.specify/memory/constitution.md`
> - Este documento describe unicamente el alcance del Sprint 4.

## 1. Contexto del sprint

Cierra el MVP. Se apoya en las ordenes de servicio (Sprint 2) y en el control de refacciones y mantenimientos (Sprint 3) para completar el ciclo de atencion: cobro, ticket y vision general del taller.

## 2. Objetivo

Permitir el registro de pagos asociados a una orden (incluyendo Mercado Pago en sandbox), la generacion de tickets de servicio y la consulta de un panel de control con informacion general del taller.

## 3. Historias de usuario del sprint

- **US1** - Como recepcionista, quiero registrar el pago de una orden para cerrar el ciclo del servicio.
- **US2** - Como recepcionista, quiero seleccionar el metodo de pago para dejar constancia de como se cobro.
- **US3** - Como recepcionista, quiero gestionar pagos mediante Mercado Pago para ofrecer una opcion digital.
- **US4** - Como recepcionista, quiero generar tickets de servicio para entregar comprobante al cliente.
- **US5** - Como administrador, quiero consultar informacion general desde el panel de control para supervisar el taller.
- **US6** - Como administrador, quiero visualizar ordenes, citas, mantenimientos y alertas de inventario en el dashboard.

## 4. Flujo demostrable al cierre del sprint

    Orden terminada
    -> calcular / consultar total
    -> registrar pago
    -> Mercado Pago cuando corresponda
    -> generar ticket
    -> consultar indicadores en dashboard

## 5. Entidades y tablas que toca este sprint

| Entidad / tabla | Accion en este sprint |
|-----------------|-----------------------|
| `payments`      | crear tabla, registrar, consultar, actualizar estado |
| `tickets`       | crear tabla, generar, consultar |
| ordenes y citas | consultar para el dashboard |
| `inventory_movements` | consultar para el dashboard |

## 6. Reglas de negocio aplicables

- RN-9: Una orden entregada debe conservarse como historial.
- RN-13: Todo pago debe estar relacionado con una orden.
- RN-14: Los datos sensibles del procesamiento de pagos no deben almacenarse en la aplicacion.
- RN-15: Los permisos deben validarse en backend.

## 7. Criterios de aceptacion

- [ ] CA-1: Registrar un pago asociado a una orden funciona y persiste en MySQL local.
- [ ] CA-2: Se soportan los metodos efectivo, tarjeta, transferencia y Mercado Pago.
- [ ] CA-3: Mercado Pago se integra en modo sandbox y no se almacenan datos de tarjeta.
- [ ] CA-4: El ticket incluye folio, datos del taller, cliente, vehiculo, placas, kilometraje, servicios, refacciones, mano de obra, subtotal, total, metodo de pago, estado del pago y fecha.
- [ ] CA-5: El ticket se puede visualizar e imprimir.
- [ ] CA-6: El dashboard muestra datos reales de ordenes, citas, mantenimientos y alertas de inventario, sin duplicar informacion.
- [ ] CA-7: Las credenciales de Mercado Pago se manejan por variables de entorno.
- [ ] CA-8: Las pruebas de logica de pagos y generacion de tickets existen y pasan.

## 8. Fuera de alcance de este sprint

- Chatbot de WhatsApp.
- Facturacion electronica.
- Envio automatico de correos o mensajes al cliente.
- Reportes avanzados o analitica historica.
- Aplicacion movil nativa.

## 9. Decisiones pendientes que deben resolverse en /speckit.clarify

- Implementacion concreta de PDF/tickets: libreria, formato y almacenamiento.
- Alcance exacto de Mercado Pago para la demostracion: checkout, link de pago u otro.
- Indicadores exactos del dashboard y su periodicidad.
- Politica de reembolsos o cancelaciones de pago.

## 10. Restricciones tecnicas heredadas

- Backend en ES Modules, nunca CommonJS.
- Solo el backend accede a MySQL; el frontend nunca se conecta directo.
- Permisos validados en backend, no solo en UI.
- Sin secretos en el repositorio.
- Idioma: espanol en chat, docs, comentarios y pruebas.
- MySQL local, InnoDB, llaves foraneas, `utf8mb4`.
- Login acepta usuario o correo electronico en el mismo campo.
- Toda pantalla del frontend sigue `docs/design-system.md`.
- Pruebas de integracion contra `motorix_test`, nunca contra la base principal.
- Los seeds del sprint DEBEN incluir datos de ejemplo suficientes para que la aplicacion muestre informacion al arrancar. La base no puede quedar vacia tras la instalacion.
- Los seeds DEBEN ser idempotentes: si se corren de nuevo, no duplican registros.