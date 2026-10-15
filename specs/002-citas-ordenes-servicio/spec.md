# Especificación de funcionalidad: Citas y órdenes de servicio (Sprint 2)

**Rama de la funcionalidad**: `002-citas-ordenes-servicio`

**Creada**: 2026-10-12

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripción de docs/sprints/sprint-2-citas-ordenes.md"

## Aclaraciones

### Sesión 2026-10-12

- Q: ¿La recepcionista puede editar el diagnóstico, los servicios y la mano de obra de una orden? → A: No; los consulta en solo lectura. Solo el mecánico asignado y el administrador los editan.
- Q: ¿Se puede crear una orden desde una cita cuya fecha no es hoy? → A: Sí, desde cualquier cita Pendiente o Confirmada, porque el vehículo puede llegar antes o después de lo programado.
- Q: ¿Las citas tienen restricción de horario de atención o de horarios fijos? → A: No; se admite cualquier hora futura, con precisión de minutos.
- Q: ¿Se puede marcar una orden como TERMINADO sin haber documentado el trabajo? → A: No; exige diagnóstico y al menos un servicio o una línea de mano de obra.
- Q: ¿Qué datos de la orden puede corregir la recepcionista después de crearla? → A: El problema reportado y el mecánico asignado mientras no esté TERMINADO; el kilometraje de entrada solo cambia con corrección explícita bajo la misma regla de validación.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Registrar y consultar citas (Prioridad: P1)

Como recepcionista, quiero registrar y consultar citas para organizar la llegada de los vehículos al taller.

**Por qué esta prioridad**: La cita es el punto de partida del flujo del taller (cita → recepción del vehículo → orden) y permite anticipar la carga de trabajo.

**Prueba independiente**: Se prueba registrando una cita para un cliente y uno de sus vehículos, y encontrándola en el listado por fecha y por cliente.

**Escenarios de aceptación**:

1. **Dado** un cliente con al menos un vehículo registrado, **Cuando** la recepcionista registra una cita con cliente, vehículo, fecha, hora y motivo, **Entonces** la cita queda guardada con estado "Pendiente" y aparece en el listado.
2. **Dado** que existen varias citas, **Cuando** el usuario filtra por fecha, por estado o busca por cliente o placa, **Entonces** el listado muestra solo las coincidencias, ordenadas por fecha y hora.
3. **Dado** un intento de registrar una cita, **Cuando** el vehículo elegido no pertenece al cliente indicado, o falta la fecha, la hora o el motivo, **Entonces** el sistema la rechaza señalando cada error.
4. **Dado** un intento de registrar una cita con una fecha y hora anteriores al momento actual, **Cuando** se guarda, **Entonces** el sistema la rechaza.
5. **Dado** un usuario con rol de mecánico, **Cuando** intenta registrar o consultar citas, **Entonces** el sistema lo rechaza.

---

### Historia de usuario 2 - Modificar y cancelar citas (Prioridad: P2)

Como recepcionista, quiero modificar o cancelar una cita para reflejar los cambios que pide el cliente.

**Por qué esta prioridad**: Las citas cambian con frecuencia, pero el flujo principal funciona sin esta capacidad.

**Prueba independiente**: Se prueba reprogramando una cita pendiente y cancelando otra, y comprobando que la cancelada se conserva en el historial.

**Escenarios de aceptación**:

1. **Dado** una cita "Pendiente" o "Confirmada", **Cuando** la recepcionista cambia su fecha, hora, motivo u observaciones, **Entonces** los cambios se guardan y se ven en el listado.
2. **Dado** una cita "Pendiente" o "Confirmada", **Cuando** la recepcionista la marca como "Confirmada" tras hablar con el cliente, **Entonces** el estado cambia y se conserva.
3. **Dado** una cita que aún no tiene orden, **Cuando** la recepcionista la cancela y confirma la acción, **Entonces** pasa a "Cancelada", se conserva como historial y ya no se puede modificar.
4. **Dado** una cita con una orden de servicio generada, **Cuando** se intenta cancelar, **Entonces** el sistema lo impide e indica que ya existe una orden.
5. **Dado** una cita "Cancelada" o "Completada", **Cuando** se intenta modificar, **Entonces** el sistema lo rechaza.

---

### Historia de usuario 3 - Crear una orden de servicio para un cliente y un vehículo (Prioridad: P1)

Como recepcionista, quiero crear una orden de servicio asociada a un cliente y a su vehículo, con el kilometraje de entrada y el problema reportado, para registrar el trabajo a realizar.

**Por qué esta prioridad**: La orden es el eje del taller; sin ella no hay trabajo que documentar ni estados que seguir.

**Prueba independiente**: Se prueba creando una orden desde cero para un vehículo existente y comprobando que recibe un folio, queda en "RECIBIDO" y aparece en el listado y en el detalle del vehículo.

**Escenarios de aceptación**:

1. **Dado** un cliente con un vehículo registrado, **Cuando** la recepcionista crea una orden indicando cliente, vehículo, kilometraje de entrada y problema reportado, **Entonces** la orden se guarda con un folio único, en estado "RECIBIDO", y el kilometraje actual del vehículo se actualiza.
2. **Dado** una cita vigente, **Cuando** la recepcionista crea la orden a partir de esa cita, **Entonces** los datos de cliente, vehículo y motivo se precargan, la orden queda vinculada a la cita y la cita pasa a "En proceso".
3. **Dado** un intento de crear una orden, **Cuando** el vehículo no existe o no pertenece al cliente indicado, **Entonces** el sistema la rechaza.
4. **Dado** un intento de crear una orden, **Cuando** falta el kilometraje de entrada o es negativo, **Entonces** el sistema la rechaza.
5. **Dado** un vehículo con kilometraje registrado, **Cuando** el kilometraje de entrada es menor al registrado y no se marca una corrección explícita, **Entonces** el sistema lo rechaza e indica el kilometraje previo; con la corrección explícita se acepta.
6. **Dado** un vehículo sin kilometraje previo (en 0), **Cuando** se crea la orden con cualquier kilometraje válido, **Entonces** se acepta.

---

### Historia de usuario 4 - Asignar la orden a un mecánico (Prioridad: P1)

Como recepcionista, quiero asignar cada orden a un mecánico para que sepa qué trabajo le corresponde.

**Por qué esta prioridad**: Sin asignación el mecánico no puede ver ni trabajar la orden.

**Prueba independiente**: Se prueba asignando una orden a un mecánico y comprobando que solo ese mecánico la ve.

**Escenarios de aceptación**:

1. **Dado** una orden sin mecánico, **Cuando** la recepcionista elige un mecánico activo, **Entonces** la orden queda asignada y aparece en la lista de ese mecánico.
2. **Dado** una orden asignada que aún no está terminada, **Cuando** la recepcionista elige a otro mecánico, **Entonces** la orden cambia de responsable y deja de aparecer al anterior.
3. **Dado** una persona que no es mecánico o que está desactivada, **Cuando** se intenta asignarle una orden, **Entonces** el sistema lo rechaza.
4. **Dado** una orden "TERMINADO" o "ENTREGADO", **Cuando** se intenta reasignarla, **Entonces** el sistema lo rechaza.

---

### Historia de usuario 5 - Consultar mis órdenes asignadas (Prioridad: P1)

Como mecánico, quiero consultar las órdenes que me asignaron para saber qué trabajar.

**Por qué esta prioridad**: Es la entrada del mecánico al sistema y su vista de trabajo diario.

**Prueba independiente**: Se prueba entrando como un mecánico con órdenes asignadas y como otro sin ellas, y comprobando que cada uno ve solo lo suyo.

**Escenarios de aceptación**:

1. **Dado** un mecánico con órdenes asignadas, **Cuando** abre el listado de órdenes, **Entonces** ve únicamente las suyas, con folio, vehículo, cliente, problema reportado y estado.
2. **Dado** una orden asignada a otro mecánico, **Cuando** el mecánico intenta abrirla por su identificador, **Entonces** el sistema lo rechaza.
3. **Dado** que el mecánico filtra por estado, **Cuando** elige uno, **Entonces** ve solo las órdenes suyas en ese estado.
4. **Dado** un mecánico sin órdenes, **Cuando** abre el listado, **Entonces** ve un mensaje claro de que no tiene órdenes asignadas.
5. **Dado** una recepcionista o un administrador, **Cuando** abre el listado, **Entonces** ve todas las órdenes y puede filtrarlas por estado, mecánico, cliente o placa.

---

### Historia de usuario 6 - Registrar diagnóstico y servicios realizados (Prioridad: P1)

Como mecánico, quiero registrar el diagnóstico, los servicios realizados y la mano de obra para documentar el trabajo.

**Por qué esta prioridad**: Es el contenido central de la orden y la base del historial del vehículo y de los cobros posteriores.

**Prueba independiente**: Se prueba, como mecánico asignado, escribiendo el diagnóstico, agregando dos servicios y una línea de mano de obra, y viendo los importes en el detalle.

**Escenarios de aceptación**:

1. **Dado** una orden asignada y editable, **Cuando** el mecánico escribe el diagnóstico, **Entonces** se guarda y se muestra en el detalle.
2. **Dado** una orden asignada y editable, **Cuando** el mecánico agrega un servicio realizado con descripción e importe, **Entonces** aparece en la lista de servicios de la orden.
3. **Dado** una orden asignada y editable, **Cuando** el mecánico registra mano de obra con descripción, horas y tarifa por hora, **Entonces** se guarda con su importe calculado.
4. **Dado** servicios y mano de obra registrados, **Cuando** se consulta la orden, **Entonces** se muestran el subtotal de servicios, el subtotal de mano de obra y el total.
5. **Dado** un servicio o una línea de mano de obra capturados por error, **Cuando** el mecánico los corrige o los quita mientras la orden es editable, **Entonces** el cambio se refleja en los importes.
6. **Dado** una orden "TERMINADO" o "ENTREGADO", **Cuando** se intenta agregar o cambiar diagnóstico, servicios o mano de obra, **Entonces** el sistema lo rechaza.
7. **Dado** un servicio o mano de obra con importe, horas o tarifa negativos o no numéricos, **Cuando** se guarda, **Entonces** el sistema lo rechaza.

---

### Historia de usuario 7 - Actualizar el estado de la orden (Prioridad: P1)

Como mecánico, quiero cambiar el estado de la orden para reflejar su avance hasta terminar el trabajo.

**Por qué esta prioridad**: Cierra el flujo demostrable del sprint y da visibilidad a recepción sobre cada vehículo.

**Prueba independiente**: Se prueba llevando una orden de "RECIBIDO" a "ENTREGADO" y comprobando que cada paso inválido es rechazado.

**Escenarios de aceptación**:

1. **Dado** una orden "RECIBIDO", **Cuando** el mecánico asignado la pasa a "DIAGNOSTICO", **Entonces** el estado cambia y se registra quién y cuándo lo hizo.
2. **Dado** una orden "DIAGNOSTICO", **Cuando** el mecánico la pasa a "EN_REPARACION", **Entonces** el estado cambia.
3. **Dado** una orden "EN_REPARACION", **Cuando** el mecánico indica que espera una refacción, **Entonces** pasa a "ESPERANDO_REFACCION" y, al llegar, puede volver a "EN_REPARACION".
4. **Dado** una orden "EN_REPARACION", **Cuando** el mecánico la pasa a "TERMINADO", **Entonces** el estado cambia y la orden deja de ser editable por el mecánico.
5. **Dado** una orden "TERMINADO", **Cuando** la recepcionista o el administrador la marca "ENTREGADO" tras entregar el vehículo y confirmar la acción, **Entonces** la orden queda como historial inmodificable.
6. **Dado** cualquier orden, **Cuando** se intenta un salto no permitido (por ejemplo, de "RECIBIDO" a "TERMINADO") o un retroceso, **Entonces** el sistema lo rechaza indicando los estados válidos desde el actual.
7. **Dado** una orden "RECIBIDO" sin mecánico asignado, **Cuando** se intenta avanzarla, **Entonces** el sistema exige primero asignar un mecánico.
8. **Dado** un mecánico que no es el asignado, **Cuando** intenta cambiar el estado, **Entonces** el sistema lo rechaza.
9. **Dado** una orden "EN_REPARACION" sin diagnóstico o sin ningún servicio ni mano de obra, **Cuando** el mecánico intenta pasarla a "TERMINADO", **Entonces** el sistema lo rechaza indicando qué falta.

---

### Historia de usuario 8 - Observaciones y recomendaciones (Prioridad: P2)

Como mecánico, quiero agregar observaciones y recomendaciones para dejar constancia del estado del vehículo y de lo que conviene hacer después.

**Por qué esta prioridad**: Aporta valor al cliente y al historial, pero el trabajo puede completarse sin ellas.

**Prueba independiente**: Se prueba escribiendo observaciones y recomendaciones en una orden y viéndolas en el detalle, también después de terminada la orden.

**Escenarios de aceptación**:

1. **Dado** una orden asignada y no entregada, **Cuando** el mecánico escribe observaciones y recomendaciones, **Entonces** se guardan y se muestran en el detalle.
2. **Dado** una orden "TERMINADO", **Cuando** el mecánico agrega o ajusta sus recomendaciones, **Entonces** se permite, porque no altera el trabajo ni los importes.
3. **Dado** una orden "ENTREGADO", **Cuando** se intenta modificar observaciones o recomendaciones, **Entonces** el sistema lo rechaza.

---

### Historia de usuario 9 - Datos de ejemplo del sprint (Prioridad: P3)

Como integrante del equipo, quiero que tras instalar el sistema existan citas y órdenes de ejemplo en varios estados para demostrar el flujo sin capturar datos a mano.

**Por qué esta prioridad**: Apoya la demostración, pero no es una función del taller.

**Prueba independiente**: Se prueba recreando la base desde cero, cargando los datos de ejemplo e iniciando sesión con cada rol para ver su información.

**Escenarios de aceptación**:

1. **Dado** una instalación nueva, **Cuando** se cargan los datos de ejemplo, **Entonces** existen citas en distintos estados y órdenes en todos los estados del flujo, algunas asignadas al mecánico de ejemplo.
2. **Dado** que los datos de ejemplo ya se cargaron, **Cuando** se cargan de nuevo, **Entonces** no se duplican registros.

---

### Casos límite

- ¿Qué ocurre si dos personas intentan cambiar el estado de la misma orden a la vez? Solo el primer cambio aplica; el segundo se rechaza por transición ya no válida, sin dejar estados intermedios.
- ¿Qué ocurre si dos personas crean órdenes al mismo tiempo? Cada orden recibe un folio distinto, sin repeticiones ni huecos que impidan identificarlas.
- ¿Qué ocurre si el mecánico asignado se desactiva? Sus órdenes abiertas siguen existiendo y recepción puede reasignarlas.
- ¿Qué ocurre si se cambia el rol de un mecánico con órdenes asignadas? Las órdenes se conservan y recepción debe reasignarlas.
- ¿Qué ocurre si un cliente tiene varias citas el mismo día para el mismo vehículo? Se permite, pero el sistema avisa de la coincidencia para que recepción confirme que no es un duplicado.
- ¿Qué ocurre si una cita se registra con una fecha muy lejana? Se acepta mientras sea futura y esté dentro de un máximo razonable de un año.
- ¿Qué ocurre si se crea una orden con kilometraje menor al previo y corrección explícita? Se acepta y el kilometraje del vehículo se actualiza al nuevo valor.
- ¿Qué ocurre si se intenta eliminar una orden? El sistema no ofrece la eliminación; las órdenes se conservan siempre como historial.
- ¿Qué ocurre con el mecánico al intentar abrir una orden inexistente o ajena? Recibe el mismo mensaje de "no encontrada", sin revelar si existe.
- ¿Qué ocurre si falla la comunicación al guardar? El usuario ve un mensaje comprensible y no se pierde lo capturado en el formulario.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Citas**

- **FR-001**: El sistema DEBE permitir a recepcionistas y administradores registrar una cita con cliente, vehículo del cliente, fecha, hora, motivo y observaciones opcionales.
- **FR-002**: El sistema DEBE crear toda cita en estado "Pendiente" y manejar los estados Pendiente, Confirmada, En proceso, Completada y Cancelada.
- **FR-003**: El sistema NO DEBE permitir citas con fecha y hora anteriores al momento actual ni a más de un año de distancia, ni con un vehículo que no pertenezca al cliente. No hay restricción de horario de atención ni horarios fijos: se admite cualquier hora futura con precisión de minutos.
- **FR-004**: El sistema DEBE permitir consultar citas con filtros por fecha, estado y búsqueda por cliente o placa, ordenadas por fecha y hora.
- **FR-005**: El sistema DEBE permitir modificar fecha, hora, motivo y observaciones, y confirmar o cancelar citas "Pendiente" o "Confirmada"; las citas "En proceso", "Completada" y "Cancelada" no se modifican.
- **FR-006**: El sistema DEBE conservar las citas canceladas como historial y NO DEBE permitir cancelar una cita que ya tenga una orden de servicio.
- **FR-007**: El sistema DEBE avisar, sin impedir el registro, cuando se registre una cita del mismo vehículo el mismo día que otra cita no cancelada.

**Órdenes de servicio**

- **FR-008**: El sistema DEBE permitir a recepcionistas y administradores crear una orden de servicio asociada a un cliente y a un vehículo existente de ese cliente, con kilometraje de entrada y problema reportado obligatorios.
- **FR-009**: El sistema DEBE asignar a cada orden un folio único y legible, y crearla en estado "RECIBIDO".
- **FR-010**: El sistema DEBE permitir crear la orden a partir de cualquier cita "Pendiente" o "Confirmada", sin importar su fecha, precargando sus datos, vinculándolas y pasando la cita a "En proceso". Una cita admite una sola orden.
- **FR-011**: El sistema NO DEBE permitir crear una orden para un vehículo inexistente ni para un cliente distinto al propietario del vehículo.
- **FR-012**: El sistema DEBE validar el kilometraje de entrada: debe ser un entero no negativo y no menor al kilometraje registrado del vehículo, salvo corrección explícita; si el vehículo no tiene kilometraje previo, se acepta cualquier valor válido.
- **FR-013**: El sistema DEBE actualizar el kilometraje del vehículo con el kilometraje de entrada de cada orden aceptada.
- **FR-013a**: El sistema DEBE permitir a recepcionistas y administradores corregir el problema reportado y el mecánico asignado mientras la orden no esté "TERMINADO" ni "ENTREGADO". El kilometraje de entrada solo se puede cambiar con corrección explícita, bajo la misma validación de FR-012.
- **FR-014**: El sistema DEBE permitir asignar la orden a un mecánico activo y reasignarla mientras no esté "TERMINADO" ni "ENTREGADO"; no se puede avanzar una orden más allá de "RECIBIDO" sin mecánico asignado.
- **FR-015**: El sistema DEBE permitir a recepcionistas y administradores consultar todas las órdenes con filtros por estado, mecánico, cliente o placa, y ver el detalle de cualquiera.
- **FR-016**: El sistema DEBE mostrar al mecánico únicamente las órdenes que tiene asignadas y rechazar el acceso a las demás.
- **FR-017**: El sistema NO DEBE ofrecer la eliminación de órdenes; toda orden se conserva como historial.

**Trabajo del mecánico**

- **FR-018**: El sistema DEBE permitir al mecánico asignado (y al administrador) registrar y editar el diagnóstico, los servicios realizados y la mano de obra mientras la orden esté en "RECIBIDO", "DIAGNOSTICO", "EN_REPARACION" o "ESPERANDO_REFACCION".
- **FR-018a**: Las recepcionistas DEBEN poder consultar el diagnóstico, los servicios, la mano de obra, las observaciones y las recomendaciones de cualquier orden, pero NO editarlos.
- **FR-019**: Cada servicio realizado DEBE llevar descripción e importe no negativo; cada línea de mano de obra DEBE llevar descripción, horas mayores a cero y tarifa por hora no negativa, con su importe calculado.
- **FR-020**: El sistema DEBE calcular y mostrar el subtotal de servicios, el subtotal de mano de obra y el total de la orden.
- **FR-021**: El sistema DEBE permitir al mecánico asignado (y al administrador) registrar observaciones y recomendaciones mientras la orden no esté "ENTREGADO".
- **FR-022**: El sistema NO DEBE permitir modificar diagnóstico, servicios ni mano de obra de una orden "TERMINADO" o "ENTREGADO", ni ningún dato de una "ENTREGADO".

**Estados**

- **FR-023**: El sistema DEBE manejar los estados RECIBIDO, DIAGNOSTICO, EN_REPARACION, ESPERANDO_REFACCION, TERMINADO y ENTREGADO, con estas únicas transiciones válidas: RECIBIDO → DIAGNOSTICO → EN_REPARACION → TERMINADO → ENTREGADO, y EN_REPARACION ⇄ ESPERANDO_REFACCION.
- **FR-024**: El sistema DEBE rechazar cualquier transición distinta, incluidos saltos y retrocesos, indicando los estados válidos desde el actual.
- **FR-024a**: El sistema NO DEBE permitir pasar una orden a "TERMINADO" si no tiene diagnóstico y al menos un servicio realizado o una línea de mano de obra; el rechazo indica qué falta.
- **FR-025**: El sistema DEBE permitir que el mecánico asignado (y el administrador) realice las transiciones hasta "TERMINADO", y que solo recepcionistas y administradores marquen "ENTREGADO".
- **FR-026**: El sistema DEBE registrar cada cambio de estado con el estado anterior, el nuevo, la persona que lo hizo y la fecha y hora, y mostrarlo como historial de la orden.
- **FR-027**: Al pasar una orden vinculada a una cita a "ENTREGADO", el sistema DEBE marcar la cita como "Completada".

**Transversales**

- **FR-028**: El sistema DEBE validar en el servidor los permisos de rol de cada operación de citas y órdenes; ocultar opciones en la interfaz no sustituye esa validación.
- **FR-029**: El sistema DEBE pedir confirmación explícita antes de cancelar una cita, reasignar una orden a otro mecánico, marcar una orden como "ENTREGADO" o salir de un formulario con cambios sin guardar.
- **FR-030**: El sistema DEBE incluir datos de ejemplo de citas y órdenes en todos los estados, cargables de forma repetible sin duplicar registros.
- **FR-031**: El sistema NO DEBE incluir en este sprint historial de mantenimiento, próximo mantenimiento, inventario ni refacciones, pagos, tickets ni panel de indicadores.

### Entidades clave *(incluir si la funcionalidad involucra datos)*

- **Cita**: visita programada de un cliente con un vehículo. Tiene fecha y hora, motivo, observaciones, estado (Pendiente, Confirmada, En proceso, Completada o Cancelada) y, si ya se recibió el vehículo, la orden de servicio vinculada.
- **Orden de servicio**: trabajo realizado durante una visita. Tiene folio único, cliente, vehículo, mecánico asignado (opcional al inicio), kilometraje de entrada, problema reportado, diagnóstico, observaciones, recomendaciones, estado y cita de origen opcional; agrupa servicios y mano de obra, y conserva su historial de estados.
- **Servicio realizado**: línea de la orden con descripción e importe.
- **Mano de obra**: línea de la orden con descripción, horas, tarifa por hora e importe calculado.
- **Cambio de estado**: registro inmutable de una transición de la orden (estado anterior y nuevo, usuario, fecha y hora).

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Una recepcionista registra una cita completa en menos de 2 minutos en su primer intento.
- **SC-002**: Una recepcionista crea una orden con cliente, vehículo, kilometraje y problema en menos de 3 minutos en su primer intento.
- **SC-003**: Un mecánico ve el 100 % de sus órdenes asignadas y 0 órdenes de otros mecánicos en todas las pruebas de visibilidad.
- **SC-004**: El 100 % de las transiciones de estado no permitidas son rechazadas, y el 100 % de las permitidas se aceptan, en la batería de pruebas de transiciones.
- **SC-005**: El 100 % de los intentos de operaciones no permitidas para un rol (probados para cada rol y cada operación de citas y órdenes) son rechazados.
- **SC-006**: Ninguna orden entregada puede modificarse ni eliminarse: 0 cambios aceptados sobre órdenes "ENTREGADO" en las pruebas.
- **SC-007**: El 100 % de los kilometrajes de entrada menores al previo sin corrección explícita son rechazados.
- **SC-008**: El flujo completo "cita → orden → asignación → diagnóstico → servicios → estados → entregada" se recorre de principio a fin en menos de 10 minutos con los datos de ejemplo.
- **SC-009**: Los listados de citas y órdenes responden en menos de 2 segundos con al menos 1 000 órdenes y 1 000 citas registradas.
- **SC-010**: Tras recrear la base y cargar los datos de ejemplo, cada rol ve información de citas y órdenes sin capturar nada a mano, y cargarlos varias veces deja las mismas cantidades.

## Supuestos

- Se apoya en los clientes, vehículos y usuarios del Sprint 1: el vehículo pertenece a un cliente y los mecánicos son usuarios con rol MECHANIC.
- La asignación de mecánico es manual, la hace recepción o el administrador, sin reglas de disponibilidad ni carga de trabajo; cada orden tiene un solo mecánico responsable.
- Los permisos por defecto: el administrador puede todo; la recepcionista gestiona citas, crea y asigna órdenes, corrige el problema reportado, consulta todas (incluido el trabajo técnico, en solo lectura) y marca "ENTREGADO"; el mecánico solo ve y trabaja sus órdenes asignadas y no accede a las citas.
- El modelo de estados de la orden es el indicado en FR-023; las órdenes no se cancelan en este sprint y el retroceso de estado no existe.
- Las citas no tienen duración ni control de capacidad del taller; solo se avisa de coincidencias del mismo vehículo el mismo día.
- Una cita termina como "Completada" cuando su orden se entrega; la cita "En proceso" corresponde al vehículo ya recibido.
- El folio es consecutivo y legible (por ejemplo, `OS-000123`), único y sin reutilizarse.
- Los importes de servicios y mano de obra se manejan en una sola moneda con dos decimales; las refacciones y el cobro llegan en sprints posteriores, por lo que el total de este sprint solo suma servicios y mano de obra.
- Las citas y órdenes no se eliminan; las canceladas y entregadas se conservan como historial.
- Quedan fuera de este sprint: historial de mantenimiento por vehículo, próximo mantenimiento, inventario y refacciones, pagos, Mercado Pago, tickets, panel de indicadores y chatbot.
- Las decisiones pendientes del insumo (modelo exacto de estados, regla de asignación, validación de kilometraje sin valor previo y política de cancelación de citas) quedaron definidas en los requisitos FR-006, FR-012, FR-014 y FR-023 y se confirmaron con las aclaraciones de la sesión.
- Dependencias: `docs/project-context.md` (alcance), `docs/design-system.md` (interfaz), `.specify/memory/constitution.md` (reglas) y la funcionalidad `001-base-clientes-vehiculos`.
