# Especificación de funcionalidad: Historial, mantenimiento e inventario (Sprint 3)

**Rama de la funcionalidad**: `003-historial-inventario`

**Creada**: 2026-10-13

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripción de docs/sprints/sprint-3-historial-inventario.md"

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Consultar el historial de servicios de un vehículo (Prioridad: P1)

Como mecánico, quiero consultar el historial de servicios de un vehículo para conocer su estado y antecedentes.

**Por qué esta prioridad**: El historial es el valor central del sprint: convierte las órdenes ya registradas en el expediente del vehículo y el resto de las historias se apoyan en él.

**Prueba independiente**: Se prueba abriendo un vehículo con varias órdenes terminadas y comprobando que aparecen en orden cronológico con su fecha, kilometraje, servicios realizados y mecánico.

**Escenarios de aceptación**:

1. **Dado** un vehículo con órdenes en estado "TERMINADO" o "ENTREGADO", **Cuando** el usuario consulta su historial, **Entonces** se muestran esas órdenes en orden cronológico (la más reciente primero) con folio, fecha, kilometraje, servicios, recomendaciones y mecánico.
2. **Dado** un vehículo con órdenes aún en proceso (por ejemplo "RECIBIDO" o "EN_REPARACION"), **Cuando** se consulta su historial, **Entonces** esas órdenes no aparecen en el historial.
3. **Dado** un vehículo sin órdenes terminadas, **Cuando** se consulta su historial, **Entonces** se muestra un mensaje claro de que aún no tiene servicios registrados.
4. **Dado** un servicio recién terminado, **Cuando** se consulta el historial del vehículo, **Entonces** el servicio aparece sin que nadie tenga que capturarlo de nuevo.
5. **Dado** un usuario con cualquiera de los tres roles (administrador, recepcionista o mecánico), **Cuando** consulta el historial, **Entonces** puede verlo, y no puede modificar los servicios desde esa vista.

---

### Historia de usuario 2 - Registrar el kilometraje de cada servicio (Prioridad: P2)

Como mecánico, quiero registrar el kilometraje de cada servicio para mantener actualizado el historial.

**Por qué esta prioridad**: Sin kilometraje confiable no se puede calcular cuándo toca el siguiente mantenimiento ni validar la evolución del vehículo.

**Prueba independiente**: Se prueba terminando una orden con un kilometraje de servicio y comprobando que el historial y el kilometraje actual del vehículo lo reflejan.

**Escenarios de aceptación**:

1. **Dado** una orden en proceso, **Cuando** el mecánico registra el kilometraje con el que termina el servicio, **Entonces** el historial del vehículo muestra ese kilometraje y el kilometraje actual del vehículo se actualiza.
2. **Dado** un kilometraje de servicio menor al de entrada de la orden, **Cuando** se intenta guardar, **Entonces** el sistema lo rechaza e indica el kilometraje de entrada.
3. **Dado** un kilometraje de servicio negativo o no numérico, **Cuando** se intenta guardar, **Entonces** el sistema lo rechaza.
4. **Dado** una orden "ENTREGADO", **Cuando** se intenta cambiar su kilometraje de servicio, **Entonces** el sistema lo rechaza.
5. **Dado** una orden que se termina sin kilometraje de servicio, **Cuando** se guarda, **Entonces** se acepta y el historial usa el kilometraje de entrada; el kilometraje de servicio es opcional.

---

### Historia de usuario 3 - Establecer el próximo mantenimiento (Prioridad: P1)

Como mecánico, quiero establecer el próximo mantenimiento de un vehículo para programar el siguiente servicio.

**Por qué esta prioridad**: Es lo que cierra el ciclo de servicio y permite al taller anticiparse al cliente.

**Prueba independiente**: Se prueba registrando un próximo mantenimiento por fecha, por kilometraje y por ambos, y consultándolo en el vehículo.

**Escenarios de aceptación**:

1. **Dado** un vehículo con un servicio terminado, **Cuando** el mecánico registra el próximo mantenimiento con una descripción y una fecha, un kilometraje o ambos, **Entonces** queda guardado, vinculado al vehículo y a la orden de origen, con estado "Pendiente".
2. **Dado** un intento de registrar un mantenimiento sin fecha ni kilometraje, **Cuando** se guarda, **Entonces** el sistema lo rechaza indicando que se requiere al menos uno.
3. **Dado** una fecha anterior a hoy o un kilometraje menor al actual del vehículo, **Cuando** se guarda, **Entonces** el sistema lo rechaza.
4. **Dado** un mantenimiento "Pendiente", **Cuando** el mecánico corrige su fecha, kilometraje o descripción, **Entonces** los cambios se guardan.
5. **Dado** un mantenimiento que ya se atendió, **Cuando** el mecánico lo marca como "Realizado" (o se registra uno nuevo en su lugar), **Entonces** deja de aparecer entre los próximos y se conserva como antecedente.
6. **Dado** que los intervalos son configurables, **Cuando** el mecánico captura un mantenimiento, **Entonces** puede indicar cualquier intervalo (sin valores impuestos por el sistema), y el sistema solo ofrece sugerencias si el equipo configuró alguna.

---

### Historia de usuario 4 - Consultar mantenimientos próximos y vencidos (Prioridad: P2)

Como recepcionista, quiero consultar los mantenimientos próximos y vencidos para avisar al cliente.

**Por qué esta prioridad**: Convierte los registros en acción comercial, pero requiere que ya existan mantenimientos registrados.

**Prueba independiente**: Se prueba con mantenimientos de ejemplo próximos, vencidos y lejanos, y comprobando que el listado los clasifica correctamente y muestra los datos de contacto del cliente.

**Escenarios de aceptación**:

1. **Dado** mantenimientos pendientes con distintas fechas y kilometrajes, **Cuando** la recepcionista abre la vista de mantenimientos, **Entonces** ve clasificados como "Vencido" los que ya cumplieron su fecha o su kilometraje, como "Próximo" los que están dentro del umbral de aviso, y no ve los lejanos.
2. **Dado** un mantenimiento con fecha y kilometraje, **Cuando** se cumple cualquiera de los dos, **Entonces** se considera vencido.
3. **Dado** un listado de mantenimientos, **Cuando** la recepcionista filtra por estado o busca por cliente o placa, **Entonces** se muestran solo las coincidencias, con los vencidos primero.
4. **Dado** un mantenimiento en la lista, **Cuando** la recepcionista lo abre, **Entonces** ve el nombre y el teléfono del cliente, el vehículo y la descripción para poder avisarle.
5. **Dado** que las notificaciones externas están fuera de alcance, **Cuando** la recepcionista quiere avisar, **Entonces** lo hace por sus propios medios; el sistema no envía mensajes.

---

### Historia de usuario 5 - Registrar y consultar refacciones (Prioridad: P1)

Como administrador, quiero registrar y consultar refacciones para controlar el inventario.

**Por qué esta prioridad**: Sin catálogo de refacciones no se puede usar ni controlar el inventario.

**Prueba independiente**: Se prueba dando de alta una refacción con su existencia inicial y encontrándola en el listado por nombre o código.

**Escenarios de aceptación**:

1. **Dado** un administrador, **Cuando** registra una refacción con código, nombre, existencia inicial, stock mínimo y precio, **Entonces** queda guardada y su existencia inicial genera un movimiento de entrada.
2. **Dado** un código que ya existe, **Cuando** se intenta registrar otra refacción con él, **Entonces** el sistema lo rechaza.
3. **Dado** una refacción existente, **Cuando** el administrador edita su nombre, descripción, precio o stock mínimo, **Entonces** los cambios se guardan sin alterar su existencia.
4. **Dado** que existen varias refacciones, **Cuando** el usuario busca por nombre o código, **Entonces** el listado muestra solo las coincidencias.
5. **Dado** una refacción con movimientos o usada en órdenes, **Cuando** el administrador la da de baja, **Entonces** queda inactiva (no se elimina), ya no se puede agregar a órdenes y se conserva en el historial.
6. **Dado** un usuario recepcionista o mecánico, **Cuando** intenta crear o editar refacciones, **Entonces** el sistema lo rechaza.

---

### Historia de usuario 6 - Consultar el stock disponible (Prioridad: P1)

Como administrador, quiero consultar el stock disponible para saber qué hay en existencia.

**Por qué esta prioridad**: Es la vista principal del inventario y la base de las alertas.

**Prueba independiente**: Se prueba consultando el listado de refacciones y su historial de movimientos, y comprobando que la existencia coincide con la suma de entradas, salidas y ajustes.

**Escenarios de aceptación**:

1. **Dado** refacciones con movimientos, **Cuando** el administrador consulta el inventario, **Entonces** ve para cada una su existencia actual, stock mínimo y precio.
2. **Dado** una refacción, **Cuando** el administrador abre su detalle, **Entonces** ve sus movimientos en orden cronológico con tipo, cantidad, fecha, usuario y motivo u orden relacionada.
3. **Dado** una entrada de mercancía, **Cuando** el administrador registra la cantidad recibida, **Entonces** la existencia aumenta y queda un movimiento de entrada.
4. **Dado** un conteo físico distinto del sistema, **Cuando** el administrador registra un ajuste con su motivo, **Entonces** la existencia queda en la cantidad correcta y se conserva el movimiento de ajuste.
5. **Dado** un ajuste o una salida que dejaría la existencia en negativo, **Cuando** se intenta guardar, **Entonces** el sistema lo rechaza.
6. **Dado** un mecánico o recepcionista, **Cuando** intenta consultar o modificar el inventario completo, **Entonces** el sistema lo rechaza; el mecánico solo busca refacciones para agregarlas a una orden.

---

### Historia de usuario 7 - Agregar refacciones utilizadas a una orden (Prioridad: P1)

Como mecánico, quiero agregar las refacciones utilizadas a una orden para reflejar su uso.

**Por qué esta prioridad**: Conecta el trabajo del taller con el inventario y es la parte demostrable del flujo del sprint.

**Prueba independiente**: Se prueba agregando una refacción con existencia a una orden en proceso y comprobando que aparece en la orden y que su existencia baja por un movimiento de salida.

**Escenarios de aceptación**:

1. **Dado** una orden en proceso asignada al mecánico y una refacción con existencia suficiente, **Cuando** agrega la refacción con su cantidad, **Entonces** queda en la orden con su precio, su subtotal se suma al total de la orden y se genera un movimiento de salida ligado a la orden.
2. **Dado** una cantidad mayor a la existencia, **Cuando** se intenta agregar, **Entonces** el sistema lo rechaza indicando la existencia disponible y no cambia nada.
3. **Dado** una cantidad cero, negativa o no entera, **Cuando** se intenta agregar, **Entonces** el sistema la rechaza.
4. **Dado** una refacción agregada por error a una orden en proceso, **Cuando** el mecánico cambia su cantidad o la quita, **Entonces** el sistema ajusta el inventario con el movimiento correspondiente y el total de la orden se recalcula.
5. **Dado** una orden en estado "TERMINADO" o "ENTREGADO", **Cuando** se intenta agregar, modificar o quitar refacciones, **Entonces** el sistema lo rechaza.
6. **Dado** una orden de otro mecánico, **Cuando** el mecánico intenta cambiarle refacciones, **Entonces** el sistema lo rechaza; el administrador sí puede.
7. **Dado** una refacción inactiva, **Cuando** se intenta agregar a una orden, **Entonces** el sistema la rechaza.

---

### Historia de usuario 8 - Visualizar alertas de stock bajo (Prioridad: P2)

Como administrador, quiero visualizar alertas de stock bajo para reabastecer a tiempo.

**Por qué esta prioridad**: Previene faltantes, pero depende de que el inventario y su uso ya funcionen.

**Prueba independiente**: Se prueba dejando una refacción en o por debajo de su stock mínimo y comprobando que aparece señalada en la interfaz.

**Escenarios de aceptación**:

1. **Dado** una refacción cuya existencia es igual o menor a su stock mínimo, **Cuando** el administrador abre el inventario o ve el menú de navegación, **Entonces** la ve marcada como "Stock bajo" y puede filtrar solo esas.
2. **Dado** una refacción con existencia en cero, **Cuando** se muestra, **Entonces** se distingue como "Agotada".
3. **Dado** una refacción en alerta, **Cuando** el administrador registra una entrada que la lleva por encima de su mínimo, **Entonces** la alerta desaparece.
4. **Dado** que no hay ninguna refacción en alerta, **Cuando** el administrador abre el inventario, **Entonces** no se muestra ninguna alerta.
5. **Dado** una salida por uso en una orden que lleva la existencia al mínimo o debajo, **Cuando** se confirma, **Entonces** la alerta aparece de inmediato.

---

### Casos límite

- Dos mecánicos agregan al mismo tiempo la última pieza disponible de una refacción: solo una operación se acepta y la otra recibe un aviso de existencia insuficiente; nunca queda stock negativo.
- Una orden se entrega con refacciones: el inventario no se modifica de nuevo; la salida ya se registró al agregar la refacción.
- Un vehículo con muchos servicios (cientos): el historial se pagina y mantiene su orden cronológico.
- Cambia el precio de una refacción después de usarla: las órdenes anteriores conservan el precio con el que se usaron.
- Se registra un próximo mantenimiento nuevo cuando ya existe uno pendiente para el mismo vehículo: se avisa y, con confirmación, el anterior pasa a "cancelado" y el nuevo queda como único pendiente.
- Un mantenimiento con solo kilometraje cuando el vehículo nunca ha registrado kilometraje: se rechaza si el valor es menor al actual y se acepta en caso contrario.
- Un vehículo se elimina o desactiva: su historial y mantenimientos se conservan para consulta y no aparecen como pendientes.
- Una orden terminada se reabre o se corrige: el historial refleja el estado actual de la orden, sin duplicados.
- Se intenta registrar una cantidad con decimales o un número extremadamente grande: el sistema lo rechaza con un mensaje claro.

## Aclaraciones

### Sesión 2026-10-13

- Q: ¿En qué estados de la orden se pueden agregar, cambiar o quitar refacciones? → A: Mientras la orden esté en RECIBIDO, DIAGNOSTICO, EN_REPARACION o ESPERANDO_REFACCION; con TERMINADO o ENTREGADO se bloquea, igual que los servicios. (El sistema no tiene estado CANCELADO en órdenes.)
- Q: ¿Cómo se marca un mantenimiento como realizado? → A: Manualmente por el mecánico asignado o el administrador; el sistema no lo hace solo al entregar otra orden.
- Q: ¿Puede haber varios mantenimientos pendientes por vehículo? → A: No; solo uno. Registrar otro exige confirmar y cancela el anterior.
- Q: ¿El kilometraje de servicio es obligatorio para terminar una orden? → A: No; es opcional y, si falta, el historial usa el kilometraje de entrada.
- Q: ¿Dónde se muestran las alertas de stock bajo? → A: Insignia con el conteo junto a Inventario en el menú y aviso con acceso al filtro al abrir el inventario (no hay dashboard en este sprint).
- Q (decisiones del insumo): historial como vista calculada, vencimiento por fecha o kilometraje con umbral configurable, stock negativo prohibido y movimientos entrada/salida/ajuste → A: se confirman los supuestos documentados.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Historial del vehículo**

- **FR-001**: El sistema DEBE mostrar el historial de un vehículo con sus órdenes en estado "TERMINADO" o "ENTREGADO", ordenadas cronológicamente, con folio, fecha, kilometraje, servicios, recomendaciones y mecánico.
- **FR-002**: El historial DEBE derivarse de las órdenes ya registradas, sin que haya que capturar el servicio por segunda vez, y reflejar siempre el estado actual de la orden.
- **FR-003**: El historial DEBE poder consultarse por administradores, recepcionistas y mecánicos, y NO debe permitir modificar servicios desde esa vista.
- **FR-004**: El sistema DEBE permitir registrar el kilometraje de servicio de una orden, validar que no sea menor al de entrada ni negativo, y actualizar el kilometraje actual del vehículo sin disminuirlo.

**Mantenimiento**

- **FR-005**: El sistema DEBE permitir al mecánico asignado o al administrador registrar un próximo mantenimiento para un vehículo, vinculado a la orden de origen, con descripción y fecha, kilometraje o ambos.
- **FR-006**: El sistema DEBE exigir al menos una de las dos referencias (fecha o kilometraje) y rechazar fechas pasadas o kilometrajes menores al actual del vehículo.
- **FR-007**: El sistema DEBE permitir editar un mantenimiento pendiente y marcarlo manualmente como realizado o cancelado; los realizados y cancelados se conservan como antecedente. El sistema NO los marca solo al entregar otra orden. Solo puede haber un mantenimiento pendiente por vehículo: registrar uno nuevo exige confirmar que el anterior queda cancelado.
- **FR-008**: El sistema DEBE clasificar cada mantenimiento pendiente como "Vencido" cuando se cumple su fecha o su kilometraje, como "Próximo" cuando está dentro del umbral de aviso, y no mostrar como relevantes los lejanos.
- **FR-009**: Los umbrales de aviso y cualquier intervalo sugerido DEBEN ser configurables y NO deben asumirse valores universales por tipo de servicio o vehículo.
- **FR-010**: El sistema DEBE permitir a la recepcionista (y al administrador) consultar mantenimientos próximos y vencidos con filtro por estado y búsqueda por cliente o placa, mostrando los vencidos primero y los datos de contacto del cliente.
- **FR-011**: El sistema NO DEBE enviar notificaciones externas (correo, WhatsApp u otras).

**Inventario**

- **FR-012**: El sistema DEBE permitir al administrador registrar refacciones con código único, nombre, descripción, existencia inicial, stock mínimo y precio, y editarlas sin alterar la existencia directamente.
- **FR-013**: El sistema DEBE registrar cada cambio de existencia como un movimiento de inventario de tipo entrada, salida o ajuste, con cantidad, fecha, usuario y motivo u orden relacionada.
- **FR-014**: La existencia de una refacción DEBE ser igual a la suma de sus movimientos, y NUNCA debe quedar en negativo; las operaciones que lo provoquen DEBEN rechazarse sin efectos parciales.
- **FR-015**: El sistema DEBE permitir al administrador consultar el inventario (búsqueda por nombre o código, filtro por alerta y estado) y el historial de movimientos de cada refacción.
- **FR-016**: El sistema DEBE permitir al administrador registrar entradas de mercancía y ajustes con motivo obligatorio.
- **FR-017**: Una refacción con movimientos o con uso en órdenes NO DEBE eliminarse; solo se desactiva, y una refacción inactiva no puede agregarse a órdenes.
- **FR-018**: El sistema DEBE marcar como "Stock bajo" las refacciones con existencia igual o menor al mínimo y como "Agotada" las de existencia cero, y mostrarlo en la interfaz de forma visible para el administrador: una insignia con el número de alertas junto a la opción de inventario en el menú, y un aviso con acceso directo al filtro de alertas al abrir el inventario.

**Refacciones en las órdenes**

- **FR-019**: El sistema DEBE permitir al mecánico asignado o al administrador agregar refacciones a una orden con una cantidad entera positiva, solo mientras la orden esté en "RECIBIDO", "DIAGNOSTICO", "EN_REPARACION" o "ESPERANDO_REFACCION" (igual que los servicios y la mano de obra).
- **FR-020**: Cada refacción agregada a una orden DEBE guardar el precio unitario vigente en ese momento, sumarse al total de la orden y generar un movimiento de salida ligado a la orden.
- **FR-021**: Al cambiar la cantidad de una refacción en una orden o quitarla, el sistema DEBE ajustar el inventario con el movimiento correspondiente y recalcular el total de la orden.
- **FR-022**: Toda refacción utilizada DEBE estar relacionada con una orden; no se permiten salidas por uso sin orden.
- **FR-023**: El sistema DEBE manejar de forma segura el uso simultáneo de una misma refacción, evitando existencia negativa.

**Permisos y seguridad**

- **FR-024**: El sistema DEBE validar todos los permisos en el servidor: el inventario completo y el alta o edición de refacciones solo para administradores; los mantenimientos para mecánicos (los de sus órdenes), recepcionistas (consulta) y administradores; el historial para los tres roles.
- **FR-025**: El mecánico DEBE poder buscar refacciones activas (código, nombre y existencia) únicamente para agregarlas a sus órdenes.

**Datos de ejemplo**

- **FR-026**: Tras la instalación, la base DEBE incluir datos de ejemplo suficientes para ver el historial, mantenimientos próximos, vencidos y lejanos, refacciones con existencia normal, baja y agotada, y movimientos de los tres tipos, sin que la aplicación quede vacía.
- **FR-027**: Los datos de ejemplo DEBEN poder cargarse varias veces sin duplicar registros.

**Interfaz y pruebas**

- **FR-028**: Todas las pantallas nuevas DEBEN seguir el sistema de diseño del proyecto y mostrar mensajes de error, vacío y confirmación en español.
- **FR-029**: Las reglas de inventario y mantenimiento DEBEN contar con pruebas automatizadas que se ejecuten contra la base de datos de pruebas, nunca contra la principal.

### Entidades clave

- **Mantenimiento**: Próximo servicio programado para un vehículo. Tiene descripción, fecha objetivo y/o kilometraje objetivo, estado (pendiente, realizado, cancelado), orden de origen y vehículo. Su carácter "próximo" o "vencido" se calcula, no se guarda.
- **Refacción**: Pieza del catálogo de inventario. Tiene código único, nombre, descripción, precio vigente, stock mínimo, existencia actual y estado (activa o inactiva).
- **Movimiento de inventario**: Registro inmutable de un cambio de existencia de una refacción: tipo (entrada, salida, ajuste), cantidad, fecha, usuario, motivo y, si aplica, la orden relacionada.
- **Refacción de la orden**: Uso de una refacción en una orden: refacción, cantidad, precio unitario congelado y subtotal. Se relaciona con una orden y con el movimiento de salida que generó.
- **Historial del vehículo** (derivado): Conjunto de órdenes terminadas o entregadas de un vehículo; no es una entidad independiente.
- **Orden de servicio, Vehículo, Cliente y Usuario** (existentes del Sprint 1 y 2): Se extienden con kilometraje de servicio, total con refacciones y relaciones nuevas.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Un mecánico consulta el historial completo de un vehículo en menos de 3 segundos y en no más de 2 pasos desde el detalle del vehículo.
- **SC-002**: El 100 % de las órdenes terminadas o entregadas de un vehículo aparece en su historial sin captura adicional.
- **SC-003**: Un mecánico registra el próximo mantenimiento de un vehículo en menos de 1 minuto.
- **SC-004**: La recepcionista identifica en menos de 30 segundos a qué clientes avisar, a partir de la lista de mantenimientos vencidos y próximos.
- **SC-005**: Un administrador da de alta una refacción con existencia inicial en menos de 1 minuto.
- **SC-006**: Un mecánico agrega una refacción a una orden en menos de 30 segundos y la existencia refleja el cambio de inmediato.
- **SC-007**: En el 100 % de los casos, la existencia de cada refacción coincide con la suma de sus movimientos, y ninguna operación deja existencia negativa, incluso con uso simultáneo.
- **SC-008**: Toda refacción en o por debajo de su mínimo aparece señalada en la interfaz del administrador en el momento en que se consulta el inventario.
- **SC-009**: El flujo completo (finalizar servicio, conservarlo en el historial, registrar próximo mantenimiento, usar refacciones, actualizar inventario y mostrar alertas) puede demostrarse de principio a fin con los datos de ejemplo, sin captura previa.
- **SC-010**: Con 5 000 refacciones y 1 000 servicios en un vehículo, las consultas de inventario e historial responden en menos de 2 segundos.

## Supuestos

- Se parte de los Sprint 1 y 2 ya terminados: clientes, vehículos, citas, órdenes, estados de orden y los tres roles (administrador, recepcionista y mecánico).
- **Historial** (confirmada en la aclaración): se resuelve como vista calculada sobre las órdenes "TERMINADO" y "ENTREGADO", sin tabla duplicada, conforme a RN-10.
- **Vencimiento** (confirmada en la aclaración): un mantenimiento está "Vencido" al cumplirse su fecha o su kilometraje, y "Próximo" dentro de un umbral de aviso configurable (valores iniciales sugeridos: 30 días y 1 000 km, modificables sin cambiar el código).
- **Stock negativo** (confirmada en la aclaración): está prohibido; no se permite ninguna política distinta en este sprint.
- **Tipos de movimiento** (confirmada en la aclaración): entrada (compras y existencia inicial), salida (uso en órdenes) y ajuste (correcciones por conteo, con motivo obligatorio).
- El kilometraje de servicio es el que registra el mecánico al terminar; si no se captura, se usa el de entrada de la orden.
- Las cantidades de refacciones son enteras positivas; las unidades fraccionarias (litros, metros) quedan fuera de este sprint.
- Los precios de las refacciones se manejan en pesos mexicanos, igual que el resto de la aplicación; no existe costo de compra ni proveedor en este sprint.
- Los mantenimientos son avisos internos; el taller contacta al cliente por sus propios medios.
- Fuera de alcance: pagos, Mercado Pago, tickets, dashboard, notificaciones externas (correo, WhatsApp), proveedores y órdenes de compra.
- La actualización de `docs/project-context.md` con las decisiones de este sprint requiere aprobación del equipo, como en los sprints anteriores.
