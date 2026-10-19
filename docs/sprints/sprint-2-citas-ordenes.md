<!--
Insumo de especificacion para /speckit.specify.
Sprint 2 del MVP de Motorix: citas y ordenes de servicio.
-->

# Insumo de especificacion - Sprint 2: Citas y ordenes de servicio

> Referencias obligatorias para el agente:
> - Contexto maestro: `docs/project-context.md`
> - Constitucion: `docs/reglas.md` y `.specify/memory/constitution.md`
> - Este documento describe unicamente el alcance del Sprint 2.

## 1. Contexto del sprint

Continua el MVP despues del Sprint 1. Se apoya en los modulos de clientes y vehiculos ya existentes para gestionar la llegada de los vehiculos al taller y registrar los trabajos realizados mediante ordenes de servicio.

## 2. Objetivo

Permitir que recepcion registre citas y cree ordenes de servicio asociadas a un cliente y un vehiculo, y que el mecanico consulte sus ordenes asignadas, registre diagnosticos, servicios y recomendaciones, y actualice el estado de la orden.

## 3. Historias de usuario del sprint

- **US1** - Como recepcionista, quiero registrar y consultar citas para organizar la llegada de los vehiculos al taller.
- **US2** - Como recepcionista, quiero crear ordenes de servicio para registrar el trabajo a realizar.
- **US3** - Como recepcionista, quiero asociar una orden con un cliente y un vehiculo para vincular correctamente la informacion.
- **US4** - Como mecanico, quiero consultar las ordenes asignadas para saber que trabajar.
- **US5** - Como mecanico, quiero registrar diagnosticos y servicios realizados para documentar el trabajo.
- **US6** - Como mecanico, quiero cambiar el estado de una orden para reflejar su avance.
- **US7** - Como mecanico, quiero agregar observaciones y recomendaciones para dejar constancia del estado del vehiculo.

## 4. Flujo demostrable al cierre del sprint

    Registrar cita
    -> recibir vehiculo
    -> crear orden
    -> asignar orden a mecanico
    -> registrar diagnostico
    -> registrar servicios
    -> actualizar estado
    -> terminar trabajo

## 5. Entidades y tablas que toca este sprint

| Entidad / tabla | Accion en este sprint |
|-----------------|-----------------------|
| `appointments`  | crear tabla, registrar, consultar, modificar, cancelar |
| `service_orders`| crear tabla, registrar, consultar, actualizar estado |
| `order_services`| crear tabla de servicios realizados por orden |
| `order_labor`   | crear tabla de mano de obra por orden |

## 6. Reglas de negocio aplicables

- RN-2: No crear una orden para un vehiculo inexistente.
- RN-3: Registrar el kilometraje de entrada de una orden.
- RN-4: El kilometraje nuevo no debe ser menor que el kilometraje previamente registrado sin una correccion explicita.
- RN-5: Solo usuarios autorizados pueden modificar ordenes.
- RN-9: Una orden entregada debe conservarse como historial y no eliminarse de manera ordinaria.
- RN-15: Los permisos deben validarse en backend.

## 7. Criterios de aceptacion

- [ ] CA-1: Registrar, consultar, modificar y cancelar citas funciona de extremo a extremo.
- [ ] CA-2: Crear una orden de servicio asociada a cliente y vehiculo funciona contra MySQL local.
- [ ] CA-3: El mecanico ve unicamente las ordenes que tiene asignadas.
- [ ] CA-4: El mecanico registra diagnostico, servicios realizados y recomendaciones.
- [ ] CA-5: Los cambios de estado respetan la secuencia RECIBIDO -> DIAGNOSTICO -> EN_REPARACION -> TERMINADO -> ENTREGADO, con ESPERANDO_REFACCION disponible cuando aplique.
- [ ] CA-6: Se registra el kilometraje de entrada y se valida contra el kilometraje previo del vehiculo.
- [ ] CA-7: Los permisos por rol se validan en backend.
- [ ] CA-8: Las pruebas de la logica de transiciones de estado existen y pasan.

## 8. Fuera de alcance de este sprint

- Historial de mantenimiento por vehiculo.
- Proximo mantenimiento.
- Inventario y refacciones.
- Pagos.
- Mercado Pago.
- Tickets.
- Dashboard.

## 9. Decisiones pendientes que deben resolverse en /speckit.clarify

- Modelo exacto de estados: valores permitidos y transiciones validas.
- Reglas de asignacion de mecanico: manual, por disponibilidad u otra.
- Estrategia de validacion de kilometraje cuando no existe un valor previo.
- Politica de cancelacion de citas y su efecto en ordenes relacionadas.

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