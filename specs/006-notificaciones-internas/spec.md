# Especificación de la funcionalidad: Notificaciones internas y clientes por avisar

**Rama de la funcionalidad**: `006-notificaciones-internas`

**Creado**: 2026-11-24

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Especificar el Sprint 6 a partir de `docs/sprints/sprint-6-notificaciones-internas.md` (corregido el 2026-11-24 tras revisar el código), con sus 7 historias de usuario, sus 14 criterios de aceptación y sus decisiones abiertas".

> Nota de contexto (hallazgos H-02 y H-03 del aseguramiento de la calidad): hoy solo existe una parte dispersa de lo que pide la sección 6.12 del contexto maestro. Existen el resumen de stock de Inventario (`PartsProvider.summary`, se carga solo al abrir esa pantalla), los contadores del panel de control (solo administrador), la lista de Mantenimientos con su clasificación Próximo o Vencido y las citas con sus estados. **No existen** un centro de notificaciones, tablas ni rutas para avisos, un criterio de "orden detenida", una lista de clientes por avisar, ni la insignia de stock en el ícono de Inventario ni el aviso de stock en la pantalla de inicio que mencionaba el insumo original. Este sprint reúne esos avisos en un solo lugar del encabezado, por rol, y agrega la lista de clientes por avisar. Cada requisito indica si **mantiene** un comportamiento existente (que ahora debe quedar probado) o **agrega** uno nuevo.

## Aclaraciones

### Sesión 2026-11-24

- Q: ¿Dónde se accede a la lista de clientes por avisar? → A: En una sección propia del menú, «Clientes por avisar», visible para administración y recepción, con una insignia con el número de clientes pendientes; no se mezcla con el panel de la campana.
- Q: ¿Qué abre cada tipo de aviso? → A: La orden detenida abre el detalle de la orden; la cita del día, el detalle de la cita; el stock bajo o agotado, el detalle de la refacción; y el mantenimiento próximo o vencido abre la sección Mantenimientos con el buscador ya llenado con la placa del vehículo.
- Q: ¿Una cita de hoy sigue siendo aviso cuando su hora ya pasó? → A: Sí, mientras siga Pendiente o Confirmada y hasta el fin del día; desaparece al cambiar de estado.
- Q: ¿Qué órdenes Terminadas entran en la lista de clientes por avisar? → A: Todas las Terminadas que aún no se entregan, sin importar si ya están pagadas o tienen saldo; salen de la lista al entregarse o al marcar al cliente como avisado.
- Q: ¿Qué pasa con la lectura de un aviso cuando el aviso desaparece? → A: La lectura se descarta; si la condición vuelve a cumplirse, el aviso aparece como nuevo (no leído), aunque tenga el mismo estado que antes.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Ver cuántos avisos tengo en el encabezado (Prioridad: P1)

Como administrador, quiero ver en el encabezado cuántos avisos pendientes tengo para atenderlos sin recorrer cada módulo.

**Por qué esta prioridad**: Es la puerta de entrada de todo el sprint: sin la campana con su contador y su panel no hay centro de notificaciones.

**Prueba independiente**: Con datos de ejemplo que incluyan un mantenimiento vencido, una cita para hoy, una refacción con stock bajo y una orden detenida, el administrador inicia sesión, ve la campana con el total de avisos no leídos y abre el panel con los avisos agrupados por tipo.

**Escenarios de aceptación**:

1. **Dado** que existen avisos para el administrador, **Cuando** inicia sesión, **Entonces** el encabezado muestra una campana con el número de avisos no leídos.
2. **Dado** la campana con avisos, **Cuando** la abre, **Entonces** ve un panel con los avisos agrupados por tipo (mantenimientos, citas, stock y órdenes detenidas), cada uno con su descripción corta.
3. **Dado** que no hay ningún aviso, **Cuando** abre el panel, **Entonces** ve un mensaje de que no tiene avisos pendientes y la campana no muestra número.
4. **Dado** que los datos cambian (por ejemplo, se registra una nueva cita para hoy), **Cuando** pasa el tiempo de actualización o cambia de módulo, **Entonces** el contador refleja el cambio sin cerrar la sesión.

---

### Historia de usuario 2 - Mantenimientos próximos y vencidos y citas del día para recepción (Prioridad: P1)

Como recepcionista, quiero ver los mantenimientos próximos y vencidos y las citas del día para avisar a los clientes a tiempo.

**Por qué esta prioridad**: Es el uso diario del centro por parte de quien contacta a los clientes.

**Prueba independiente**: Con un mantenimiento próximo, uno vencido y una cita para hoy, la recepcionista abre el panel y ve esos avisos; el número de mantenimientos coincide con el de la lista de Mantenimientos.

**Escenarios de aceptación**:

1. **Dado** un mantenimiento pendiente que ya venció por fecha o por kilometraje, **Cuando** la recepcionista abre el panel, **Entonces** ve un aviso de mantenimiento vencido con el cliente, el vehículo y cuánto se pasó.
2. **Dado** un mantenimiento pendiente a 15 días o menos, o a 500 km o menos, **Cuando** abre el panel, **Entonces** ve un aviso de mantenimiento próximo.
3. **Dado** una cita de hoy Pendiente o Confirmada, **Cuando** abre el panel, **Entonces** ve el aviso de cita del día con la hora, el cliente y el vehículo.
4. **Dado** una cita Cancelada o Completada, o un mantenimiento Atendido, **Cuando** abre el panel, **Entonces** no aparece ningún aviso de ellos.

---

### Historia de usuario 3 - Stock bajo o agotado para el administrador (Prioridad: P2)

Como administrador, quiero ver las refacciones con stock bajo o agotado para reabastecer a tiempo.

**Por qué esta prioridad**: Evita quedarse sin piezas, pero el inventario ya tiene sus propias alertas dentro de su pantalla.

**Prueba independiente**: Con una refacción con stock bajo y otra agotada, el administrador ve ambos avisos y la insignia de Inventario con el mismo número; recepción y mecánico no los reciben.

**Escenarios de aceptación**:

1. **Dado** una refacción activa con existencia igual o menor a su mínimo, **Cuando** el administrador abre el panel, **Entonces** ve un aviso de stock bajo con su nombre y existencia.
2. **Dado** una refacción activa con existencia cero, **Cuando** abre el panel, **Entonces** ve un aviso de stock agotado.
3. **Dado** el ícono de Inventario en el menú, **Cuando** hay alertas de stock, **Entonces** muestra una insignia con su número, igual al de las alertas del panel de control y de la pantalla de Inventario.
4. **Dado** una refacción desactivada, **Cuando** abre el panel, **Entonces** no genera aviso.

---

### Historia de usuario 4 - Órdenes detenidas (Prioridad: P2)

Como administrador o recepcionista, quiero ver las órdenes detenidas para destrabarlas.

**Por qué esta prioridad**: Un vehículo olvidado en el taller es dinero y confianza perdidos; hoy no existe forma de detectarlo.

**Prueba independiente**: Con una orden en reparación cuyo último cambio de estado fue hace cinco días y otra con un cambio de hoy, solo la primera aparece como aviso.

**Escenarios de aceptación**:

1. **Dado** una orden abierta (Recibido, Diagnóstico, En reparación o Esperando refacción) sin cambio de estado desde hace 3 días o más, **Cuando** un administrador o recepcionista abre el panel, **Entonces** ve el aviso de orden detenida con su folio, el vehículo, el estado y los días detenida.
2. **Dado** una orden abierta con un cambio de estado reciente, **Cuando** abre el panel, **Entonces** no aparece.
3. **Dado** que a una orden detenida solo se le editó un servicio o una nota sin cambiar de estado, **Cuando** abre el panel, **Entonces** sigue apareciendo, porque la antigüedad se mide por el último cambio de estado.
4. **Dado** una orden Entregada o Cancelada, **Cuando** abre el panel, **Entonces** no genera aviso.

---

### Historia de usuario 5 - El mecánico solo ve los avisos de sus órdenes (Prioridad: P1)

Como mecánico, quiero ver solo los avisos de mis órdenes asignadas para no recibir información que no me corresponde.

**Por qué esta prioridad**: Es una regla de seguridad por rol que debe cumplirse en el servidor, no solo en la pantalla.

**Prueba independiente**: Con dos mecánicos y una orden detenida de cada uno, cada mecánico recibe únicamente el aviso de la suya; una petición directa a la API no entrega stock, citas ni mantenimientos ni avisos de órdenes ajenas.

**Escenarios de aceptación**:

1. **Dado** una orden detenida asignada al mecánico, **Cuando** abre el panel, **Entonces** ve ese aviso.
2. **Dado** una orden detenida asignada a otro mecánico, **Cuando** abre el panel, **Entonces** no la ve.
3. **Dado** que existen avisos de stock, citas o mantenimientos, **Cuando** el mecánico consulta los avisos (por la pantalla o directamente por la API), **Entonces** no recibe ninguno de ellos.
4. **Dado** que la orden se reasigna a otro mecánico, **Cuando** ambos abren el panel, **Entonces** el aviso pasa al nuevo mecánico.

---

### Historia de usuario 6 - Marcar un aviso como leído y abrir el módulo relacionado (Prioridad: P2)

Como usuario, quiero marcar un aviso como leído y abrir el módulo relacionado desde él para dar seguimiento rápido.

**Por qué esta prioridad**: Sin la marca de leído el contador nunca baja y deja de ser útil.

**Prueba independiente**: Un usuario marca un aviso como leído y el contador baja en uno; cierra sesión, vuelve a entrar y el aviso sigue leído; abre un aviso y llega a la pantalla relacionada.

**Escenarios de aceptación**:

1. **Dado** un aviso no leído, **Cuando** lo marca como leído, **Entonces** el contador baja y el aviso se muestra como leído, y esto se conserva al cerrar sesión y volver a entrar.
2. **Dado** que dos usuarios ven el mismo aviso, **Cuando** uno lo marca como leído, **Entonces** al otro le sigue apareciendo como no leído.
3. **Dado** un aviso leído, **Cuando** su condición deja de cumplirse (por ejemplo, el mantenimiento se atiende), **Entonces** el aviso desaparece.
4. **Dado** un aviso leído, **Cuando** su estado empeora (un mantenimiento pasa de Próximo a Vencido o una refacción de stock bajo a agotado), **Entonces** vuelve a mostrarse como no leído.
5. **Dado** un aviso, **Cuando** el usuario lo abre, **Entonces** llega a la pantalla relacionada (el detalle de la orden, el detalle de la cita, el detalle de la refacción, o la sección Mantenimientos con la placa del vehículo ya escrita en el buscador) y el aviso queda leído.
6. **Dado** un aviso leído que desapareció porque su condición dejó de cumplirse, **Cuando** la condición vuelve a cumplirse, **Entonces** el aviso aparece como no leído.

---

### Historia de usuario 7 - Lista de clientes por avisar (Prioridad: P1)

Como recepcionista, quiero una lista de clientes por avisar (vehículo listo, cita de mañana, mantenimiento próximo o vencido) con su teléfono, y marcar cada uno como avisado, para contactarlos por teléfono o en persona sin olvidar ni repetir avisos.

**Por qué esta prioridad**: Sustituye a la mensajería automática, que quedó fuera del alcance del proyecto: es la forma de que el taller avise al cliente sin olvidos.

**Prueba independiente**: Con una orden Terminada sin entregar, la recepcionista abre "Clientes por avisar", ve al cliente con su teléfono y el motivo, lo marca como avisado y deja de verlo en la lista; queda registrado quién lo avisó y cuándo.

**Escenarios de aceptación**:

1. **Dado** una orden Terminada que aún no se entrega, **Cuando** recepción abre la lista, **Entonces** ve al cliente con su teléfono, su vehículo y el motivo "vehículo listo".
2. **Dado** una cita de mañana Pendiente o Confirmada, o un mantenimiento próximo o vencido, **Cuando** recepción abre la lista, **Entonces** ve al cliente con el motivo correspondiente.
3. **Dado** un cliente de la lista, **Cuando** recepción lo marca como avisado (con una nota opcional como "no contestó"), **Entonces** sale de la lista y queda registrado quién lo avisó, cuándo y la nota.
4. **Dado** un cliente ya avisado por un hecho, **Cuando** vuelve a abrir la lista, **Entonces** no reaparece por ese mismo hecho; si surge un hecho nuevo (otra orden terminada, otra cita, otro mantenimiento), sí aparece.
5. **Dado** un mecánico, **Cuando** intenta consultar la lista o marcar un aviso (por la pantalla o directamente por la API), **Entonces** el servidor se lo impide.
6. **Dado** que marcar como avisado solo registra que una persona avisó, **Cuando** se marca, **Entonces** el sistema no envía ningún mensaje por ningún canal.

---

### Casos límite

- Sin avisos: el panel muestra un estado vacío con un mensaje útil y la campana sin número.
- Error al consultar los avisos: el panel muestra un mensaje claro en español con la opción de reintentar, sin trazas internas; la campana conserva el último número conocido.
- Cierre de sesión: el contador y los avisos del usuario anterior no quedan en pantalla para la persona siguiente.
- Muchos avisos de un mismo tipo: el panel muestra los más urgentes y el resto se consulta en el módulo correspondiente, sin perder el conteo total.
- Un aviso que se resuelve mientras el panel está abierto: desaparece en la siguiente actualización.
- Mantenimiento con fecha y kilometraje: rige el más urgente, igual que en la lista de Mantenimientos.
- Orden que cambia de estado y vuelve a detenerse: la antigüedad cuenta desde el último cambio.
- Cliente desactivado, vehículo sin cliente activo o refacción desactivada: no generan avisos.
- Marcar dos veces como avisado el mismo hecho (doble clic o dos personas a la vez): se conserva un solo registro y la segunda solicitud no falla.
- Usuario desactivado o con rol cambiado: sus lecturas se conservan, pero el servidor responde según su rol vigente.
- Una cita de hoy cuya hora ya pasó pero sigue Pendiente o Confirmada: sigue siendo aviso hasta el fin del día o hasta que cambie de estado.
- Citas y mantenimientos cuya fecha cae justo en el límite (hoy a medianoche, exactamente a 15 días o a 500 km): se tratan con los mismos criterios del panel de control y de Mantenimientos.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Centro de notificaciones**

- **FR-001** (agrega): El encabezado DEBE mostrar una campana con el número de avisos **no leídos** del usuario y, al abrirla, un panel con los avisos agrupados por tipo. Sin avisos, la campana no muestra número y el panel muestra un estado vacío.
- **FR-002** (agrega): Los tipos de aviso DEBEN ser: mantenimiento próximo, mantenimiento vencido, cita del día, stock bajo, stock agotado y orden detenida.
- **FR-003** (agrega): Los avisos DEBEN calcularse al consultarlos con los datos reales del sistema; NO se copian a otra tabla. Lo único que se guarda es la lectura de cada usuario.
- **FR-004** (mantiene): Los avisos DEBEN usar los mismos criterios que ya existen, de modo que las cifras coincidan entre pantallas: mantenimiento Próximo a 15 días o menos o a 500 km o menos y Vencido si la fecha pasó o el kilometraje alcanzó el próximo (solo pendientes); stock bajo si la existencia es menor o igual al mínimo y agotado si es cero (solo refacciones activas); cita del día Pendiente o Confirmada con fecha de hoy, aunque su hora ya haya pasado.
- **FR-005** (agrega): Una orden DEBE considerarse **detenida** cuando está abierta (Recibido, Diagnóstico, En reparación o Esperando refacción) y han pasado 3 o más días desde su último cambio de estado, medido con la fecha del último registro del historial de estados. Una orden Terminada se atiende con la lista de clientes por avisar y una Entregada o Cancelada no genera aviso.

**Visibilidad por rol**

- **FR-006** (agrega): El servidor DEBE devolver a cada rol únicamente sus avisos: el administrador todos; recepción mantenimientos, citas y órdenes detenidas, nunca stock; el mecánico solo los avisos de órdenes detenidas asignadas a él, y ningún aviso de mantenimientos, citas ni stock.
- **FR-007** (mantiene): Los permisos DEBEN validarse en el servidor y no solo en la interfaz; una petición directa de un rol sin permiso DEBE rechazarse o devolver una lista vacía de ese tipo, nunca los datos.

**Lectura y navegación**

- **FR-008** (agrega): Marcar un aviso como leído DEBE persistir por usuario: el contador baja, se conserva al cerrar sesión y volver a entrar, y no afecta a otros usuarios.
- **FR-009** (agrega): La identidad de un aviso DEBE ser su tipo, su objeto y su estado. Si la condición deja de cumplirse, el aviso desaparece y su lectura se descarta, de modo que si la condición vuelve a cumplirse el aviso aparece como nuevo (no leído); si el estado cambia (de Próximo a Vencido, de stock bajo a agotado), el aviso también vuelve a mostrarse como no leído.
- **FR-010** (agrega): Cada aviso DEBE abrir su pantalla relacionada y, al abrirlo, quedar marcado como leído: la orden detenida abre el detalle de la orden; la cita del día, el detalle de la cita; el stock bajo o agotado, el detalle de la refacción; y el mantenimiento próximo o vencido, la sección Mantenimientos con el buscador ya llenado con la placa del vehículo.
- **FR-011** (agrega): El contador DEBE actualizarse al iniciar sesión, al cambiar de módulo y cada 60 segundos mientras la sesión esté abierta, y dejar de consultarse al cerrar sesión.
- **FR-012** (agrega): El ícono de Inventario DEBE mostrar una insignia con el número de alertas de stock (bajo y agotado) solo para el administrador, calculada con el mismo criterio del centro de notificaciones; sin alertas, no se muestra.
- **FR-013** (mantiene): El resumen de stock de la pantalla de Inventario y la tarjeta de stock del panel de control DEBEN seguir funcionando y mostrar las mismas cifras que el centro de notificaciones.
- **FR-014** (agrega): El centro DEBE manejar los estados de carga, vacío y error en español, según `docs/design-system.md`, y mostrar los avisos con los colores de estado del sistema de diseño (advertencia para próximo, peligro para vencido o agotado).

**Clientes por avisar**

- **FR-015** (agrega): Administración y recepción DEBEN tener una sección propia del menú, «Clientes por avisar», con una insignia con el número de clientes pendientes, y una lista con cliente, teléfono, vehículo, motivo y fecha del hecho, con estos motivos: orden Terminada sin entregar (vehículo listo, sin importar si está pagada o con saldo), cita de mañana Pendiente o Confirmada, y mantenimiento próximo o vencido.
- **FR-016** (agrega): El mecánico NO DEBE poder consultar la lista ni marcar clientes como avisados; el servidor DEBE responder que no tiene permiso y la sección no aparece en su menú.
- **FR-017** (agrega): Marcar a un cliente como avisado DEBE guardar quién lo avisó, cuándo y una nota opcional de hasta 255 caracteres, y sacarlo de la lista por ese hecho. El mismo hecho NO DEBE volver a aparecer; un hecho nuevo (otra orden, otra cita, o el mismo mantenimiento con otra clasificación) SÍ DEBE aparecer. Un mantenimiento avisado como próximo y que luego vence es un hecho nuevo.
- **FR-018** (agrega): Marcar como avisado NO DEBE enviar ningún mensaje por ningún canal (WhatsApp, correo o SMS): solo registra que una persona avisó al cliente.
- **FR-019** (agrega): Marcar dos veces el mismo hecho DEBE conservar un solo registro y no producir error.

**Datos de ejemplo, pruebas y documentación**

- **FR-020** (agrega): La migración DEBE ser aditiva y numerada (`005_sprint6_notificaciones.sql`, la siguiente a la 004) y crear solo lo necesario para guardar las lecturas y los avisos a clientes; NO DEBE modificar las migraciones anteriores.
- **FR-021** (agrega): Los datos de ejemplo DEBEN incluir al menos un caso de cada tipo de aviso y de cada motivo de la lista de clientes por avisar, con fechas relativas al día de la carga, y DEBEN poder cargarse de nuevo sin duplicar registros.
- **FR-022** (agrega): El sprint DEBE contar con pruebas automáticas del cálculo de cada aviso, los permisos por rol, la lectura por usuario, la coincidencia de cifras con el panel de control, la lista de clientes por avisar y el rendimiento de la consulta.
- **FR-023** (agrega): `docs/project-context.md` (sección 6.12), `docs/design-system.md` y el `README.md` DEBEN actualizarse en este sprint para no contradecir el comportamiento real.

### Entidades clave *(incluir si la funcionalidad involucra datos)*

- **Aviso**: mensaje interno calculado al consultar, con tipo, objeto (orden, cita, mantenimiento o refacción), estado y destinatarios por rol. No se guarda.
- **Lectura de aviso**: constancia de que un usuario leyó un aviso concreto en un estado concreto, con su fecha. Es lo único que se guarda de los avisos y se descarta cuando el aviso desaparece.
- **Aviso a cliente**: registro de que una persona avisó a un cliente por un hecho (orden terminada, cita de mañana o mantenimiento), con quién, cuándo y una nota opcional.
- **Hecho**: situación que motiva un aviso a un cliente: una orden terminada sin entregar, una cita de mañana o un mantenimiento próximo o vencido.

Relaciones: un usuario tiene muchas lecturas; un cliente tiene muchos avisos, uno por hecho; un aviso a cliente apunta al usuario que avisó.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: En el 100 % de los casos de prueba, cada tipo de aviso llega solo al rol que le corresponde: recepción y mecánico nunca reciben stock, y el mecánico nunca recibe avisos de órdenes ajenas, ni siquiera con una petición directa al servidor.
- **SC-002**: En el 100 % de los casos de prueba, los números del centro de notificaciones coinciden con los del panel de control, la lista de Mantenimientos y las alertas de Inventario para los mismos datos.
- **SC-003**: La consulta de avisos responde en menos de 1 segundo con los datos de ejemplo y en menos de 3 segundos con 500 mantenimientos pendientes, 500 refacciones y 500 órdenes abiertas.
- **SC-004**: Una persona de recepción, con los datos de ejemplo, abre "Clientes por avisar", ubica a un cliente de una orden terminada con su teléfono y lo marca como avisado en menos de 1 minuto, medido con cronómetro.
- **SC-005**: Marcar un aviso como leído actualiza el contador en menos de 2 segundos y el aviso sigue leído después de cerrar sesión y volver a entrar.
- **SC-006**: Las pruebas de los Sprints 1 a 5 siguen pasando al cerrar el sprint; ninguna prueba se borra ni se debilita sin quedar registrada como hallazgo con su razón.
- **SC-007**: Recién instalado el entorno, el administrador ve al menos un aviso de cada tipo y recepción ve clientes por avisar; cargar los datos de ejemplo dos veces no duplica nada.

## Supuestos

- Se apoya en las citas y órdenes (Sprint 2), los mantenimientos y el inventario (Sprint 3) y el panel de control (Sprint 4); no cambia su comportamiento, solo los consulta. La única estructura nueva son las dos tablas de la migración 005.
- Los 3 días de una orden detenida son un valor fijo en este sprint; no hay pantalla para cambiarlo.
- La cita del día es la de hoy; la cita de mañana solo se usa en la lista de clientes por avisar.
- El mecánico no recibe avisos de mantenimiento aunque atienda el vehículo; solo avisos de órdenes detenidas asignadas a él.
- El panel muestra hasta 10 avisos por tipo; el total y el resto se consultan en el módulo correspondiente.
- Los avisos no se envían en tiempo real ni como notificaciones del sistema operativo: el cliente de escritorio y web consulta cada 60 segundos.
- No hay preferencias por usuario sobre qué avisos recibir ni historial de avisos pasados.
- Las fechas de "hoy" y "mañana" se calculan con la hora local del servidor, igual que el panel de control.
- El aviso al cliente lo hace siempre una persona (por teléfono o en persona); el chatbot de WhatsApp y la mensajería automática por cualquier canal están fuera del alcance del proyecto.
- Un cliente desactivado no aparece en la lista de clientes por avisar, pero su historial de avisos se conserva.
- Cada hecho se avisa una sola vez; si no contestó, la nota lo deja registrado y la persona decide si lo intenta de nuevo por otra vía, sin que el sistema lo vuelva a poner en la lista.
- Si el plan requiere una migración, es aditiva, numerada y no destructiva.
