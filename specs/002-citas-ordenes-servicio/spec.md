# Especificación de la funcionalidad: Citas y órdenes de servicio

**Rama de la funcionalidad**: `sdd-speckit` (rama única del reporte SDD; la carpeta de la feature es `002-citas-ordenes-servicio`)

**Creado**: 2026-10-19

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripcion de @docs/sprints/sprint-2-citas-ordenes.md"

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Registrar y gestionar citas (Prioridad: P1)

Como recepcionista, quiero registrar, consultar, modificar y cancelar citas para organizar la llegada de los vehículos al taller.

**Por qué esta prioridad**: La cita es el primer paso del flujo del taller y no depende de las órdenes; permite organizar el día desde el primer momento.

**Prueba independiente**: Con la sesión de recepción se agenda una cita para un cliente y uno de sus vehículos, se consulta en la agenda, se cambia su fecha y se cancela; cada cambio persiste al volver a entrar.

**Escenarios de aceptación**:

1. **Dado** que existe un cliente con un vehículo, **Cuando** registro una cita con fecha, hora, motivo y observaciones, **Entonces** la cita queda en estado Pendiente y aparece en la agenda.
2. **Dado** que registro una cita, **Cuando** elijo un vehículo que no pertenece al cliente seleccionado, **Entonces** el sistema lo rechaza indicando que el vehículo no es de ese cliente.
3. **Dado** que existen citas en distintas fechas y estados, **Cuando** filtro por fecha o por estado, **Entonces** veo solo las citas que coinciden, ordenadas por fecha y hora.
4. **Dado** una cita Pendiente, **Cuando** la confirmo, **Entonces** pasa a Confirmada; **Cuando** cambio su fecha u hora, **Entonces** el cambio se guarda y se refleja en la agenda.
5. **Dado** una cita que aún no generó una orden, **Cuando** elijo cancelarla, **Entonces** el sistema pide confirmación y, al confirmar, la cita queda Cancelada y se conserva en el historial.
6. **Dado** una cita Cancelada o Completada, **Cuando** intento modificarla, **Entonces** el sistema lo impide.
7. **Dado** que soy mecánico, **Cuando** intento registrar o modificar una cita, **Entonces** el sistema lo rechaza.

---

### Historia de usuario 2 - Crear una orden de servicio asociada a un cliente y un vehículo (Prioridad: P1)

Como recepcionista, quiero crear órdenes de servicio asociadas a un cliente y a su vehículo, con el kilometraje de entrada y el problema reportado, para registrar el trabajo a realizar.

**Por qué esta prioridad**: La orden es el núcleo del taller; todo el trabajo del mecánico y los sprints posteriores (historial, inventario, pagos) dependen de ella.

**Prueba independiente**: Con la sesión de recepción se crea una orden para un vehículo existente, con kilometraje de entrada y mecánico asignado, y se verifica que aparece con un folio único, en estado Recibido, y que el kilometraje del vehículo se actualiza.

**Escenarios de aceptación**:

1. **Dado** un cliente con un vehículo, **Cuando** creo una orden indicando el kilometraje de entrada, el problema reportado y un mecánico, **Entonces** la orden se crea en estado Recibido con un folio único y queda asociada al cliente, al vehículo y al mecánico.
2. **Dado** una cita Confirmada, **Cuando** creo la orden desde esa cita, **Entonces** la orden toma el cliente, el vehículo y el motivo de la cita, y la cita pasa a En proceso.
3. **Dado** que intento crear una orden sin vehículo o con uno inexistente, **Cuando** envío el formulario, **Entonces** el sistema lo rechaza con un mensaje claro.
4. **Dado** que intento crear una orden sin kilometraje de entrada, **Cuando** envío el formulario, **Entonces** el sistema lo rechaza por ser obligatorio.
5. **Dado** un vehículo con kilometraje registrado, **Cuando** capturo un kilometraje de entrada menor, **Entonces** el sistema lo rechaza y solo lo acepta si confirmo explícitamente que es una corrección.
6. **Dado** que la orden se crea con un kilometraje de entrada válido y mayor al registrado, **Cuando** se guarda, **Entonces** el kilometraje actual del vehículo se actualiza a ese valor.
7. **Dado** que elijo como responsable a un usuario que no es mecánico activo, **Cuando** guardo, **Entonces** el sistema lo rechaza.

---

### Historia de usuario 3 - Consultar mis órdenes asignadas (Prioridad: P1)

Como mecánico, quiero consultar las órdenes que tengo asignadas para saber qué trabajar.

**Por qué esta prioridad**: Es el punto de partida del trabajo del mecánico y valida la restricción de acceso por asignación.

**Prueba independiente**: Con dos mecánicos y órdenes asignadas a cada uno, cada mecánico ve únicamente las suyas y no puede abrir las del otro.

**Escenarios de aceptación**:

1. **Dado** que tengo órdenes asignadas y otras asignadas a otro mecánico, **Cuando** abro la lista de órdenes, **Entonces** veo solo las mías, con folio, cliente, vehículo, estado y fecha.
2. **Dado** una orden asignada a otro mecánico, **Cuando** intento abrirla directamente, **Entonces** el sistema lo rechaza.
3. **Dado** que soy recepcionista o administrador, **Cuando** abro la lista de órdenes, **Entonces** veo todas y puedo filtrar por estado, mecánico y fecha, y buscar por folio, cliente o placas.
4. **Dado** que no tengo órdenes asignadas, **Cuando** abro la lista, **Entonces** veo un estado vacío que lo explica.

---

### Historia de usuario 4 - Registrar diagnóstico, servicios, observaciones y recomendaciones (Prioridad: P1)

Como mecánico, quiero registrar el diagnóstico, los servicios realizados, la mano de obra, las observaciones y las recomendaciones de una orden para documentar el trabajo y dejar constancia del estado del vehículo.

**Por qué esta prioridad**: Es el contenido técnico que da valor a la orden y alimentará el historial del vehículo en el siguiente sprint.

**Prueba independiente**: Con una orden asignada, el mecánico registra un diagnóstico, agrega dos servicios y una mano de obra, anota observaciones y una recomendación, y ve el total calculado.

**Escenarios de aceptación**:

1. **Dado** una orden asignada a mí en curso, **Cuando** registro el diagnóstico, **Entonces** queda guardado en la orden.
2. **Dado** una orden en curso, **Cuando** agrego un servicio realizado con descripción e importe, **Entonces** aparece en la orden y el total se recalcula.
3. **Dado** una orden en curso, **Cuando** agrego mano de obra con descripción, horas y tarifa por hora, **Entonces** se calcula su importe y el total se recalcula.
4. **Dado** que registro observaciones y recomendaciones, **Cuando** guardo, **Entonces** quedan asociadas a la orden y visibles para recepción.
5. **Dado** una orden Entregada, **Cuando** intento modificar su diagnóstico, servicios o mano de obra, **Entonces** el sistema lo impide.
6. **Dado** que intento agregar un servicio con importe negativo o sin descripción, **Cuando** guardo, **Entonces** el sistema lo rechaza con un mensaje claro.
7. **Dado** una orden de otro mecánico, **Cuando** intento modificarla, **Entonces** el sistema lo rechaza.

---

### Historia de usuario 5 - Cambiar el estado de una orden (Prioridad: P1)

Como mecánico, quiero cambiar el estado de una orden para reflejar su avance, siguiendo la secuencia del taller.

**Por qué esta prioridad**: El estado es lo que permite a recepción informar al cliente y cerrar el flujo de trabajo; sus transiciones son la regla de negocio más delicada del sprint.

**Prueba independiente**: Una orden recorre Recibido → Diagnóstico → En reparación → Terminado → Entregado, se rechazan los saltos y los retrocesos no permitidos, y cada cambio queda registrado.

**Escenarios de aceptación**:

1. **Dado** una orden en Recibido, **Cuando** el mecánico asignado la pasa a Diagnóstico, **Entonces** el cambio se guarda y se registra quién y cuándo lo hizo.
2. **Dado** una orden en Diagnóstico, **Cuando** intento pasarla directamente a Terminado, **Entonces** el sistema lo rechaza indicando las transiciones permitidas.
3. **Dado** una orden En reparación, **Cuando** falta una refacción, **Entonces** puede pasar a Esperando refacción y volver a En reparación.
4. **Dado** una orden Terminada, **Cuando** el mecánico intenta marcarla como Entregada, **Entonces** el sistema lo rechaza porque la entrega la registra recepción o el administrador.
5. **Dado** una orden Terminada, **Cuando** recepción la marca como Entregada, **Entonces** el sistema pide confirmación y, al confirmar, la orden queda Entregada y ya no admite cambios ni eliminación.
6. **Dado** una orden que pasa a Terminado sin diagnóstico ni servicios registrados, **Cuando** intento terminarla, **Entonces** el sistema lo rechaza indicando qué falta.
7. **Dado** una orden Entregada, **Cuando** intento cambiar su estado, **Entonces** el sistema lo impide.

---

### Casos límite

- Una cita en la misma fecha y hora para el mismo vehículo que otra cita activa: se avisa del posible duplicado.
- Una cita con fecha y hora pasadas: no se permite registrarla, salvo que se capture como parte de una corrección de recepción.
- Un cliente o vehículo desactivado: no se pueden agendar citas ni crear órdenes con ellos.
- Un mecánico desactivado con órdenes asignadas: las órdenes se conservan y pueden reasignarse.
- Una orden creada desde una cita que luego se cancela: la cancelación se impide si la cita ya generó una orden.
- Kilometraje de entrada igual al registrado: se acepta; vehículo sin kilometraje previo (valor cero): se acepta cualquier valor mayor o igual a cero.
- Dos usuarios cambian el estado de la misma orden al mismo tiempo: se aplica una sola transición válida y el segundo recibe un aviso para recargar.
- Eliminar una orden: no existe esa operación; las órdenes se conservan como historial.
- Reasignar una orden a otro mecánico: solo recepción o administrador, mientras no esté Entregada.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Citas**

- **FR-001**: El sistema DEBE permitir registrar citas con cliente, vehículo del mismo cliente, fecha, hora, motivo y observaciones, en estado inicial Pendiente.
- **FR-002**: El sistema DEBE manejar los estados de cita Pendiente, Confirmada, En proceso, Completada y Cancelada, y permitir consultar la agenda con filtros por fecha y estado.
- **FR-003**: El sistema DEBE permitir modificar fecha, hora, motivo y observaciones de una cita Pendiente o Confirmada, y confirmarla.
- **FR-004**: El sistema DEBE permitir cancelar una cita Pendiente o Confirmada que no haya generado una orden, solicitando confirmación, y conservarla como historial en estado Cancelada.
- **FR-005**: El sistema NO DEBE permitir registrar citas con fecha y hora pasadas, ni con un cliente o vehículo desactivado.
- **FR-006**: El sistema DEBE avisar cuando exista otra cita activa del mismo vehículo en la misma fecha y hora.

**Órdenes de servicio**

- **FR-007**: El sistema DEBE permitir crear una orden asociada a un cliente y a un vehículo existentes de ese cliente, con kilometraje de entrada, problema reportado y mecánico asignado.
- **FR-008**: El sistema DEBE asignar a cada orden un folio único y legible, y crearla en estado Recibido.
- **FR-009**: El sistema DEBE permitir crear una orden a partir de una cita Confirmada, tomando de ella cliente, vehículo y motivo, y pasando la cita a En proceso.
- **FR-010**: El sistema DEBE exigir el kilometraje de entrada en toda orden y rechazar uno menor al kilometraje actual del vehículo, salvo que se confirme explícitamente como corrección.
- **FR-011**: El sistema DEBE actualizar el kilometraje actual del vehículo con el kilometraje de entrada de la orden.
- **FR-012**: El sistema DEBE permitir asignar la orden solo a un usuario activo con rol de mecánico, y permitir reasignarla a recepción o administración mientras no esté Entregada.
- **FR-013**: El sistema NO DEBE permitir eliminar órdenes; una orden Entregada se conserva como historial y no admite modificaciones.

**Trabajo del mecánico**

- **FR-014**: El mecánico DEBE poder registrar y editar, en las órdenes que tiene asignadas y que no estén Entregadas, el diagnóstico, las observaciones y las recomendaciones.
- **FR-015**: El mecánico DEBE poder agregar, editar y quitar servicios realizados (descripción e importe) en sus órdenes en curso.
- **FR-016**: El mecánico DEBE poder agregar, editar y quitar mano de obra (descripción, horas y tarifa por hora) en sus órdenes en curso.
- **FR-017**: El sistema DEBE calcular el importe de cada mano de obra y el total de la orden (servicios más mano de obra), validando que los importes, horas y tarifas no sean negativos.

**Consulta y acceso**

- **FR-018**: El mecánico DEBE ver únicamente las órdenes que tiene asignadas; recepción y administración DEBEN ver todas, con filtros por estado, mecánico y fecha, y búsqueda por folio, cliente o placas.
- **FR-019**: El sistema DEBE mostrar el detalle de una orden con cliente, vehículo, mecánico, kilometraje de entrada, problema reportado, diagnóstico, servicios, mano de obra, observaciones, recomendaciones, total e historial de cambios de estado.

**Estados de la orden**

- **FR-020**: El sistema DEBE permitir únicamente las transiciones Recibido → Diagnóstico → En reparación → Terminado → Entregado, más Esperando refacción desde En reparación y su regreso a En reparación; cualquier otra transición DEBE rechazarse indicando las permitidas.
- **FR-021**: El mecánico asignado DEBE poder avanzar la orden hasta Terminado; solo recepción o administración DEBEN poder marcarla como Entregada, con confirmación.
- **FR-022**: El sistema NO DEBE permitir marcar una orden como Terminado sin diagnóstico y al menos un servicio o mano de obra registrados.
- **FR-023**: El sistema DEBE registrar cada cambio de estado con el usuario, la fecha y la hora.

**Calidad general**

- **FR-024**: Los permisos por rol DEBEN validarse en el servidor en cada operación: recepción y administración gestionan citas y crean órdenes; el mecánico solo opera sobre sus órdenes.
- **FR-025**: El sistema DEBE validar las entradas en el servidor y mostrar mensajes en español sin exponer detalles internos.
- **FR-026**: Toda pantalla DEBE seguir el sistema de diseño, mostrar estados de carga, vacío, error y éxito, y pedir confirmación al cancelar citas y al entregar órdenes.
- **FR-027**: El sistema DEBE incluir datos de ejemplo suficientes (citas en distintos estados y órdenes en distintas etapas con servicios y mano de obra) para mostrar información al arrancar, sin duplicar registros al cargarlos de nuevo.
- **FR-028**: La navegación DEBE mostrar las secciones Citas y Órdenes de servicio según el rol, además de las del sprint anterior.

### Entidades clave *(incluir si la funcionalidad involucra datos)*

- **Cita**: visita agendada de un cliente con uno de sus vehículos. Tiene fecha y hora, motivo, observaciones y estado (Pendiente, Confirmada, En proceso, Completada, Cancelada).
- **Orden de servicio**: trabajo realizado durante una visita. Tiene folio único, cliente, vehículo, mecánico asignado, kilometraje de entrada, problema reportado, diagnóstico, observaciones, recomendaciones, estado y total; puede originarse en una cita.
- **Servicio realizado**: trabajo concreto de una orden, con descripción e importe.
- **Mano de obra**: tiempo de trabajo de una orden, con descripción, horas, tarifa por hora e importe calculado.
- **Cambio de estado**: registro de cada transición de una orden, con el estado anterior y el nuevo, el usuario, la fecha y la hora.

Relaciones: una orden pertenece a un cliente y a un vehículo (del mismo cliente) y tiene un mecánico; una orden puede tener varios servicios y varias manos de obra; una cita puede originar una sola orden; un vehículo puede tener varias citas y varias órdenes.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Una persona de recepción registra una cita en menos de 1 minuto y crea una orden completa en menos de 2 minutos.
- **SC-002**: El flujo completo (cita → orden → asignación → diagnóstico → servicios → estado Terminado) se completa de extremo a extremo en menos de 8 minutos.
- **SC-003**: El 100 % de los intentos de saltarse el orden de estados es rechazado con un mensaje que indica las transiciones permitidas, comprobado por pruebas automáticas de todas las combinaciones de estado.
- **SC-004**: Un mecánico ve el 100 % de sus órdenes y 0 órdenes de otros mecánicos, comprobado con al menos dos mecánicos.
- **SC-005**: El 100 % de los intentos de registrar un kilometraje de entrada menor al del vehículo, sin corrección explícita, es rechazado.
- **SC-006**: Ninguna orden Entregada puede modificarse ni eliminarse; el 100 % de los intentos es rechazado.
- **SC-007**: El total de cada orden coincide con la suma de sus servicios y mano de obra en el 100 % de los casos de prueba.
- **SC-008**: Recién instalado el entorno, las pantallas de citas y órdenes muestran información de ejemplo sin capturar datos a mano.

## Supuestos

- Se apoya en los clientes, vehículos y usuarios del Sprint 1; los mecánicos son usuarios activos con rol de mecánico.
- La asignación del mecánico es manual (la elige recepción o administración al crear la orden); no hay asignación automática por disponibilidad.
- Las citas no bloquean horarios ni manejan capacidad del taller: solo avisan de duplicados del mismo vehículo.
- Los importes se manejan en una sola moneda (pesos mexicanos) con dos decimales.
- La cancelación de citas no elimina información; una cita con orden asociada no se cancela.
- Anular o cancelar una orden en curso no se incluye en este sprint; se evaluará en la aclaración.
- Quedan por confirmar en `/speckit-clarify`: el modelo de estados y sus transiciones, las reglas de asignación de mecánico, la validación de kilometraje cuando no existe un valor previo y la política de cancelación de citas y su efecto en las órdenes relacionadas.
- Fuera de alcance: historial de mantenimiento por vehículo, próximo mantenimiento, inventario y refacciones, pagos, Mercado Pago, tickets, dashboard y notificaciones.
- Dependencia: Sprint 1 completado (autenticación, clientes, vehículos y usuarios).
