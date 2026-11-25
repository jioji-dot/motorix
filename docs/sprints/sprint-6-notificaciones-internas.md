<!--
Insumo de especificación para /speckit.specify.
Sprint 6 post-MVP de Motorix: notificaciones internas.
Borrador para revisión: las decisiones de la sección 9 no están resueltas.
Corregido el 2026-11-24 tras revisar el código (hallazgos H-02 y H-03 del aseguramiento de la calidad del sprint).
-->

# Insumo de especificación - Sprint 6: Notificaciones internas

> Referencias obligatorias para el agente:
> - Contexto maestro: `docs/project-context.md` (sección 6.12)
> - Constitución: `docs/reglas.md` y `.specify/memory/constitution.md`
> - Propuesta de origen: `docs/sprints/propuesta-sprints-post-mvp.md`
> - Este documento describe únicamente el alcance del Sprint 6.

## 1. Contexto del sprint

La sección 6.12 del contexto maestro pide avisos internos sobre mantenimientos próximos y vencidos, citas, stock bajo y órdenes que requieran atención. Hoy solo existe una parte, dispersa y limitada al administrador:

- Un resumen de stock (`PartsProvider.summary`) que se carga solo al abrir Inventario y se muestra en esa pantalla ("N con stock bajo · M agotadas"). No existe insignia en el ícono de Inventario, ni aviso en la pantalla de inicio, ni `StockAlertsProvider`.
- Contadores de mantenimientos próximos y vencidos, citas próximas y stock bajo en el dashboard (`dashboardService.js`), también solo para ADMIN.
- La lista de Mantenimientos con su indicador calculado (Próximo / Vencido), consultable por recepción y mecánico, pero sin aviso proactivo.

No existe un centro de notificaciones, ni tabla ni endpoint para ellas, ni un criterio de "orden que requiere atención". Este sprint reúne esos avisos en un solo lugar del encabezado, por rol.

## 2. Objetivo

Que cada usuario vea en el encabezado un centro de notificaciones con los avisos que le corresponden por su rol, calculados con datos reales, y pueda marcarlos como leídos.

## 3. Historias de usuario del sprint

- **US1** - Como administrador, quiero ver en el encabezado cuántos avisos pendientes tengo para atenderlos sin recorrer cada módulo.
- **US2** - Como recepcionista, quiero ver los mantenimientos próximos y vencidos y las citas del día para avisar a los clientes a tiempo.
- **US3** - Como administrador, quiero ver las refacciones con stock bajo o agotado para reabastecer a tiempo.
- **US4** - Como administrador o recepcionista, quiero ver las órdenes detenidas para destrabarlas.
- **US5** - Como mecánico, quiero ver solo los avisos de mis órdenes asignadas para no recibir información que no me corresponde.
- **US6** - Como usuario, quiero marcar un aviso como leído y abrir el módulo relacionado desde él para dar seguimiento rápido.
- **US7** - Como recepcionista, quiero una lista de clientes por avisar (vehículo listo, cita de mañana, mantenimiento próximo o vencido) con su teléfono, y marcar cada uno como avisado, para contactarlos por teléfono o en persona sin olvidar ni repetir avisos.

## 4. Flujo demostrable al cierre del sprint

    Existe un mantenimiento vencido, una cita para hoy, una refacción con stock bajo y una orden detenida
    -> el administrador inicia sesión y el encabezado muestra la campana con el total de avisos
    -> abre el centro y ve los cuatro avisos agrupados por tipo
    -> abre el aviso de stock y llega a Inventario
    -> marca un aviso como leído y el contador baja
    -> la recepcionista inicia sesión y solo ve mantenimientos, citas y órdenes detenidas
    -> el mecánico solo ve avisos de sus órdenes
    -> recepción abre "Clientes por avisar", ve al cliente de la orden terminada con su teléfono, lo llama y lo marca como avisado
    -> el cliente avisado sale de la lista y queda registrado quién lo avisó y cuándo

## 5. Entidades y tablas que toca este sprint

> Basado en las secciones 6.3, 6.6, 6.7 y 6.12 de `project-context.md`.

| Entidad / tabla | Acción en este sprint |
|-----------------|-----------------------|
| `notification_reads` | crear tabla: usuario, clave del aviso y fecha de lectura (único estado que se guarda) |
| `maintenance` | consultar (próximos y vencidos, con el indicador ya existente) |
| `appointments` | consultar (citas del día y próximas) |
| `parts` | consultar (alertas de stock con el cálculo ya existente) |
| `service_orders` y `order_status_history` | consultar para detectar órdenes detenidas |
| `client_notices` | crear tabla: cliente, tipo de aviso, clave del hecho (orden, cita o mantenimiento), quién avisó y fecha |
| `clients` | consultar el teléfono para la lista de clientes por avisar |
| migración `005_sprint6_notificaciones.sql` y seeds del sprint | crear (la última migración existente es la 004) |

## 6. Reglas de negocio aplicables

- RN-5: Solo usuarios autorizados pueden consultar y modificar registros.
- RN-8: No permitir stock negativo (el aviso de stock parte de las alertas ya calculadas).
- RN-10: No duplicar información: los avisos se derivan de datos existentes.
- RN-11: Los próximos mantenimientos se basan en fecha, kilometraje o ambos.
- RN-15: Los permisos deben validarse en backend.

## 7. Criterios de aceptación

- [ ] CA-1: El encabezado muestra una campana con el total de avisos no leídos del usuario y abre un panel con los avisos agrupados por tipo.
- [ ] CA-2: Los avisos se calculan al consultar con datos reales y no se copian a otra tabla; solo se guarda la lectura.
- [ ] CA-3: Los tipos incluidos son mantenimientos próximos, mantenimientos vencidos, citas del día, stock bajo o agotado y órdenes detenidas.
- [ ] CA-4: El backend devuelve a cada rol únicamente sus avisos: ADMIN todos; RECEPTIONIST mantenimientos, citas y órdenes detenidas; MECHANIC solo avisos de órdenes asignadas a él. El stock no se devuelve a RECEPTIONIST ni a MECHANIC.
- [ ] CA-5: Los avisos usan el mismo cálculo que el dashboard, la lista de Mantenimientos y las alertas de stock, y los números coinciden entre pantallas.
- [ ] CA-6: Marcar un aviso como leído persiste por usuario; si la condición deja de cumplirse el aviso desaparece, y si reaparece con otro estado vuelve a mostrarse como no leído.
- [ ] CA-7: Cada aviso abre la pantalla relacionada (orden, cita, vehículo o inventario).
- [ ] CA-8: El resumen de stock de Inventario y la tarjeta de stock del dashboard siguen funcionando y no se contradicen con el centro de notificaciones; el ícono de Inventario muestra una insignia con las alertas de stock (solo ADMIN) tomada del mismo cálculo.
- [ ] CA-9: El centro maneja estados de carga, vacío y error según `docs/design-system.md`.
- [ ] CA-10: RECEPTIONIST y ADMIN ven la lista de clientes por avisar con cliente, teléfono, vehículo y motivo (orden terminada sin entregar, cita de mañana, mantenimiento próximo o vencido); MECHANIC no accede, validado en backend.
- [ ] CA-11: Marcar a un cliente como avisado guarda quién y cuándo, lo saca de la lista y no vuelve a aparecer por el mismo hecho; si surge un hecho nuevo (otra orden, otra cita), aparece de nuevo.
- [ ] CA-12: Los seeds incluyen al menos un caso de cada tipo de aviso y son idempotentes.
- [ ] CA-13: Existen y pasan pruebas de cálculo de cada aviso, permisos por rol, lectura por usuario y rendimiento de la consulta.
- [ ] CA-14: `docs/project-context.md` (sección 6.12) y `docs/design-system.md` se actualizan en el mismo sprint.

## 8. Fuera de alcance de este sprint

- Envío automático de avisos al cliente por cualquier canal (WhatsApp, correo, SMS): el aviso lo hace la persona de recepción y el sistema solo lo registra.
- Notificaciones en tiempo real por WebSocket o notificaciones del sistema operativo.
- Preferencias por usuario sobre qué avisos recibir.
- Historial o bitácora de avisos pasados.
- Reportes y configuración del taller (Sprint 7).

## 9. Decisiones pendientes que deben resolverse en /speckit.clarify

- Criterio de "orden detenida": ¿más de N días sin cambio de estado, o solo `ESPERANDO_REFACCION` por más de N días? ¿Cuánto vale N y es configurable?
- Qué considera "cita del día": ¿solo hoy o también mañana? ¿Incluye citas pendientes sin confirmar?
- Actualización del contador: ¿al navegar, con un intervalo de consulta (por ejemplo cada 60 segundos) o solo al abrir el panel?
- Identidad de un aviso para la lectura: ¿por tipo y objeto (por ejemplo `STOCK:parte-12`) o por tipo y estado?
- Si un aviso leído debe volver a aparecer cuando empeora (de Próximo a Vencido).
- Cuántos días antes se avisa de un mantenimiento próximo y si la cita se avisa un día antes o el mismo día.
- Si el aviso de orden terminada se da una sola vez o puede repetirse, y si el registro guarda una nota (por ejemplo, "no contestó").
- Si el mecánico debe ver avisos de mantenimiento de los vehículos que atiende o solo de órdenes.

## 10. Restricciones técnicas heredadas

- Backend en ES Modules, nunca CommonJS.
- Solo el backend accede a MySQL; el frontend nunca se conecta directo.
- Permisos validados en backend, no solo en UI.
- Sin secretos en el repositorio.
- Idioma: español en chat, docs, comentarios y pruebas.
- MySQL local, InnoDB, llaves foráneas, `utf8mb4`.
- Login acepta usuario o correo electrónico en el mismo campo.
- Toda pantalla del frontend sigue `docs/design-system.md`.
- Pruebas de integración contra `motorix_test`, nunca contra la base principal.
- Los seeds del sprint DEBEN incluir datos de ejemplo suficientes para que la aplicación muestre información al arrancar. La base no puede quedar vacía tras la instalación.
- Los seeds DEBEN ser idempotentes: si se corren de nuevo, no duplican registros.
- Las migraciones son aditivas y numeradas (`005_...sql`, la siguiente a la 004); no modifican las migraciones anteriores.
