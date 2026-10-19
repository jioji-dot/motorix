# Especificación de la funcionalidad: Historial, mantenimiento e inventario

**Rama de la funcionalidad**: `sdd-speckit` (rama única del reporte SDD; la carpeta de la feature es `003-historial-mantenimiento-inventario`)

**Creado**: 2026-10-19

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripcion de @docs/sprints/sprint-3-historial-inventario.md"

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Consultar el historial de servicios de un vehículo (Prioridad: P1)

Como mecánico, quiero consultar el historial de servicios de un vehículo, con el kilometraje de cada servicio, para conocer su estado y antecedentes antes de trabajar en él.

**Por qué esta prioridad**: El historial es el expediente digital del vehículo y alimenta el seguimiento de mantenimientos; se construye con información que ya existe (las órdenes), por lo que entrega valor desde el primer día.

**Prueba independiente**: Con un vehículo que tiene varias órdenes terminadas, entregadas y canceladas, se abre su historial y se comprueba que muestra solo las terminadas o entregadas, en orden cronológico, con kilometraje, diagnóstico, servicios, refacciones, observaciones y recomendaciones.

**Escenarios de aceptación**:

1. **Dado** un vehículo con varias órdenes terminadas o entregadas, **Cuando** abro su historial, **Entonces** veo cada servicio con fecha, folio, kilometraje, diagnóstico, servicios realizados, refacciones utilizadas, mano de obra, observaciones y recomendaciones, ordenados del más reciente al más antiguo.
2. **Dado** un vehículo con órdenes en curso o canceladas, **Cuando** abro su historial, **Entonces** esas órdenes no aparecen.
3. **Dado** un vehículo sin servicios terminados, **Cuando** abro su historial, **Entonces** veo un estado vacío que lo explica.
4. **Dado** una orden en curso, **Cuando** el mecánico asignado registra el kilometraje del servicio, **Entonces** el valor queda guardado en la orden, el historial lo muestra y el kilometraje actual del vehículo se actualiza si es mayor.
5. **Dado** que registro un kilometraje del servicio menor al de entrada de la orden, **Cuando** guardo, **Entonces** el sistema lo rechaza.
6. **Dado** que una orden se termina, **Cuando** consulto el historial, **Entonces** aparece sin necesidad de capturar nada más (el historial se deriva de la orden, no se duplica).
7. **Dado** cualquier usuario del taller (administrador, recepcionista o mecánico), **Cuando** abre el historial de un vehículo, **Entonces** puede consultarlo aunque no sea de una orden suya.

---

### Historia de usuario 2 - Establecer el próximo mantenimiento (Prioridad: P1)

Como mecánico, quiero establecer el próximo mantenimiento de un vehículo por fecha, por kilometraje o por ambos, para programar el siguiente servicio.

**Por qué esta prioridad**: Es lo que convierte el historial en seguimiento y cumple el objetivo de generar recordatorios con base en fechas y kilometraje.

**Prueba independiente**: Con un vehículo con servicios, el mecánico registra un próximo mantenimiento de "Cambio de aceite" con fecha y kilometraje, lo edita y, al registrar uno nuevo del mismo tipo, el anterior queda atendido.

**Escenarios de aceptación**:

1. **Dado** un vehículo, **Cuando** registro un mantenimiento con tipo de servicio, último servicio (fecha y kilometraje) y próxima fecha, próximo kilometraje o ambos, **Entonces** queda guardado y asociado al vehículo.
2. **Dado** que no indico ni próxima fecha ni próximo kilometraje, **Cuando** guardo, **Entonces** el sistema lo rechaza indicando que se necesita al menos uno.
3. **Dado** que la próxima fecha es anterior a la del último servicio, o el próximo kilometraje no es mayor al del último servicio, **Cuando** guardo, **Entonces** el sistema lo rechaza con un mensaje claro.
4. **Dado** que estoy en una orden terminada, **Cuando** elijo programar el próximo mantenimiento, **Entonces** el último servicio se completa con la fecha y el kilometraje de esa orden.
5. **Dado** un mantenimiento pendiente, **Cuando** registro otro del mismo tipo para el mismo vehículo, **Entonces** el anterior pasa a Atendido y el nuevo queda pendiente.
6. **Dado** un mantenimiento pendiente, **Cuando** edito sus fechas, kilometrajes o notas, **Entonces** el cambio se guarda; los mantenimientos atendidos no se editan.
7. **Dado** que soy recepcionista, **Cuando** intento registrar o editar un mantenimiento, **Entonces** el sistema lo rechaza (solo consulto).

---

### Historia de usuario 3 - Consultar mantenimientos próximos y vencidos (Prioridad: P1)

Como recepcionista, quiero consultar los mantenimientos próximos y vencidos, con los datos de contacto del cliente, para avisarle.

**Por qué esta prioridad**: Es el valor de negocio del seguimiento: contactar al cliente a tiempo.

**Prueba independiente**: Con mantenimientos en distintas condiciones (normal, próximo, vencido por fecha, vencido por kilometraje, atendido), la lista muestra la clasificación correcta y se puede filtrar.

**Escenarios de aceptación**:

1. **Dado** mantenimientos pendientes, **Cuando** abro la lista, **Entonces** cada uno aparece como Normal, Próximo o Vencido según su fecha y el kilometraje actual del vehículo, con el cliente, su teléfono, el vehículo y cuánto falta o cuánto se pasó.
2. **Dado** un mantenimiento con próxima fecha pasada, **Cuando** consulto la lista, **Entonces** aparece como Vencido; lo mismo si el kilometraje actual del vehículo alcanzó o superó el próximo kilometraje.
3. **Dado** un mantenimiento cuya fecha está dentro del umbral de aviso, o cuyo kilometraje restante está dentro del umbral de aviso, **Cuando** consulto la lista, **Entonces** aparece como Próximo.
4. **Dado** que filtro por Próximos o Vencidos, **Cuando** aplico el filtro, **Entonces** veo solo esos, ordenados del más urgente al menos urgente.
5. **Dado** un mantenimiento atendido, **Cuando** consulto la lista de pendientes, **Entonces** no aparece.
6. **Dado** un vehículo cuyo kilometraje actual sube por una nueva orden, **Cuando** consulto la lista, **Entonces** la clasificación se recalcula con el kilometraje nuevo.
7. **Dado** que consulto la lista, **Cuando** el taller no tiene mantenimientos, **Entonces** veo un estado vacío que lo explica.

---

### Historia de usuario 4 - Registrar y consultar refacciones y su stock (Prioridad: P1)

Como administrador, quiero registrar refacciones y consultar su stock disponible para controlar el inventario.

**Por qué esta prioridad**: El inventario es la base de las refacciones usadas en las órdenes y de las alertas.

**Prueba independiente**: Un administrador registra una refacción con stock inicial, registra una entrada y un ajuste, y consulta el stock y el historial de movimientos; un mecánico la consulta pero no puede modificarla.

**Escenarios de aceptación**:

1. **Dado** que soy administrador, **Cuando** registro una refacción con código o número de parte, nombre, categoría, marca, stock mínimo, precio de compra, precio de venta y existencia inicial, **Entonces** queda disponible y su stock actual es la existencia inicial.
2. **Dado** que el código ya existe, **Cuando** intento registrarlo, **Entonces** el sistema lo rechaza.
3. **Dado** una refacción, **Cuando** registro una entrada (compra) de cierta cantidad, **Entonces** el stock sube y queda un movimiento con fecha, usuario y motivo.
4. **Dado** una refacción, **Cuando** registro un ajuste por conteo físico indicando la diferencia y un motivo obligatorio, **Entonces** el stock se corrige y queda el movimiento.
5. **Dado** una refacción con stock 3, **Cuando** intento una salida o un ajuste que lo dejaría por debajo de cero, **Entonces** el sistema lo rechaza indicando el stock disponible.
6. **Dado** el listado de refacciones, **Cuando** busco por código, nombre, categoría o marca, o filtro por categoría o por stock bajo, **Entonces** veo solo las coincidencias con su stock actual.
7. **Dado** una refacción, **Cuando** abro su detalle, **Entonces** veo sus datos y el historial de movimientos (tipo, cantidad, motivo, orden relacionada, usuario y fecha).
8. **Dado** que edito los datos de una refacción (nombre, categoría, marca, stock mínimo, precios), **Cuando** guardo, **Entonces** el cambio se aplica sin alterar el stock ni las órdenes pasadas; el stock solo cambia por movimientos.
9. **Dado** que soy recepcionista o mecánico, **Cuando** consulto refacciones, **Entonces** puedo verlas pero no crearlas, editarlas ni registrar entradas o ajustes.
10. **Dado** una refacción que ya no se maneja, **Cuando** el administrador la desactiva (con confirmación), **Entonces** deja de ofrecerse para nuevas órdenes y se conserva su historial.

---

### Historia de usuario 5 - Agregar refacciones utilizadas a una orden (Prioridad: P1)

Como mecánico, quiero agregar a una orden las refacciones que utilizo para reflejar su uso y que el inventario se actualice solo.

**Por qué esta prioridad**: Conecta las órdenes con el inventario; sin esto el stock no refleja la realidad del taller.

**Prueba independiente**: En una orden en curso, el mecánico agrega 2 piezas de una refacción con stock 5; el stock baja a 3, aparece un movimiento de salida ligado a la orden y el total de la orden incluye las piezas.

**Escenarios de aceptación**:

1. **Dado** una orden en curso asignada a mí, **Cuando** agrego una refacción activa con una cantidad entera mayor a cero, **Entonces** se registra en la orden con el precio de venta vigente, se genera una salida de inventario ligada a la orden y el stock baja en esa cantidad.
2. **Dado** una cantidad mayor al stock disponible, **Cuando** intento agregarla, **Entonces** el sistema lo rechaza indicando cuánto hay disponible y no cambia nada.
3. **Dado** dos mecánicos que intentan usar la última pieza al mismo tiempo, **Cuando** ambos confirman, **Entonces** solo uno lo logra y el otro recibe el aviso de stock insuficiente.
4. **Dado** una refacción ya agregada, **Cuando** cambio su cantidad, **Entonces** el inventario se ajusta con la diferencia (una salida o una entrada de reversa) y el stock sigue sin quedar negativo.
5. **Dado** una refacción agregada, **Cuando** la quito de la orden (con confirmación), **Entonces** las piezas regresan al stock mediante un movimiento ligado a la orden.
6. **Dado** que el precio de venta de la refacción cambia después, **Cuando** consulto órdenes anteriores, **Entonces** conservan el precio con el que se usó la refacción.
7. **Dado** que la orden incluye refacciones, **Cuando** consulto el detalle, **Entonces** veo cada refacción con cantidad, precio e importe, y el total de la orden suma servicios, mano de obra y refacciones.
8. **Dado** una orden Terminada, Entregada o Cancelada, **Cuando** intento agregar, cambiar o quitar refacciones, **Entonces** el sistema lo impide.
9. **Dado** una orden con refacciones que se cancela, **Cuando** se confirma la cancelación, **Entonces** las piezas regresan al stock con movimientos que indican la cancelación.
10. **Dado** una refacción desactivada, **Cuando** busco refacciones para agregar, **Entonces** no se ofrece.
11. **Dado** que soy recepcionista, **Cuando** intento agregar refacciones a una orden, **Entonces** el sistema lo rechaza; otro mecánico (no asignado) tampoco puede.

---

### Historia de usuario 6 - Ver alertas de stock bajo (Prioridad: P2)

Como administrador, quiero visualizar alertas de stock bajo para reabastecer a tiempo.

**Por qué esta prioridad**: Previene quedarse sin piezas, pero depende de que el inventario y su uso ya funcionen.

**Prueba independiente**: Con refacciones por encima, en el límite y por debajo de su stock mínimo, y una agotada, la pantalla de inventario las distingue y las cuenta.

**Escenarios de aceptación**:

1. **Dado** una refacción cuyo stock es menor o igual a su stock mínimo, **Cuando** abro el inventario, **Entonces** se muestra con una alerta de stock bajo, y si el stock es cero, con una alerta de agotada.
2. **Dado** que hay refacciones en alerta, **Cuando** abro el inventario, **Entonces** veo un resumen con cuántas están en stock bajo y cuántas agotadas, y puedo filtrar solo esas.
3. **Dado** una refacción en alerta, **Cuando** registro una entrada que la deja por encima del mínimo, **Entonces** la alerta desaparece.
4. **Dado** que una orden consume una refacción y su stock queda en o por debajo del mínimo, **Cuando** el administrador abre el inventario, **Entonces** la alerta ya aparece.
5. **Dado** que el mecánico busca una refacción para agregar, **Cuando** su stock es bajo o cero, **Entonces** ve una advertencia (y no puede agregar más de lo disponible).
6. **Dado** que ninguna refacción está en alerta, **Cuando** abro el inventario, **Entonces** el resumen indica que todo el stock está en orden.

---

### Casos límite

- Dos usos simultáneos de la última pieza: solo uno se aplica; el otro recibe stock insuficiente.
- Cantidades con decimales, cero o negativas al usar, ajustar o registrar entradas: se rechazan; las cantidades son enteras.
- Una refacción con movimientos no puede eliminarse, solo desactivarse; los movimientos no se editan ni se borran (las correcciones se hacen con ajustes).
- Cambiar el precio de venta no altera las órdenes anteriores.
- Un vehículo sin historial ni mantenimientos muestra estados vacíos.
- Un vehículo con kilometraje actual cero: la clasificación por kilometraje usa ese valor tal cual.
- Mantenimiento solo por fecha o solo por kilometraje: se clasifica con el dato que tiene; si tiene ambos, vale la condición más urgente.
- Una orden entregada conserva sus refacciones y su historial; ya no admite cambios.
- Reactivar una refacción desactivada: la vuelve a ofrecer sin afectar su stock.
- Mecánico desactivado: sus mantenimientos y refacciones usadas se conservan.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Historial del vehículo**

- **FR-001**: El sistema DEBE mostrar el historial de servicios de un vehículo derivado de sus órdenes Terminadas o Entregadas, sin duplicar información ni exigir captura adicional, en orden cronológico (más reciente primero).
- **FR-002**: Cada entrada del historial DEBE incluir fecha, folio, kilometraje del servicio, diagnóstico, servicios realizados, mano de obra, refacciones utilizadas, observaciones y recomendaciones.
- **FR-003**: Las órdenes en curso o Canceladas NO DEBEN aparecer en el historial.
- **FR-004**: Cualquier usuario autenticado del taller DEBE poder consultar el historial de cualquier vehículo.
- **FR-005**: El mecánico asignado (o el administrador) DEBE poder registrar el kilometraje del servicio en una orden en curso; DEBE ser entero, no menor al kilometraje de entrada y no mayor a 1,500,000 km. Si no se registra, el historial muestra el de entrada.
- **FR-006**: Al registrar un kilometraje del servicio mayor al actual del vehículo, el sistema DEBE actualizar el kilometraje actual del vehículo; nunca lo disminuye sin una corrección explícita.

**Mantenimiento programado**

- **FR-007**: El sistema DEBE permitir registrar un mantenimiento con vehículo, tipo de servicio, fecha y kilometraje del último servicio, próxima fecha, próximo kilometraje y notas, exigiendo al menos uno de los dos valores próximos.
- **FR-008**: La próxima fecha NO DEBE ser anterior a la del último servicio y el próximo kilometraje DEBE ser mayor al del último servicio.
- **FR-009**: Los intervalos NO se suponen universales: cada mantenimiento define sus propios valores, y el sistema NO DEBE rellenarlos con intervalos fijos.
- **FR-010**: Desde una orden Terminada o Entregada el sistema DEBE permitir programar el próximo mantenimiento precargando la fecha y el kilometraje del servicio.
- **FR-011**: Al registrar un mantenimiento del mismo tipo y vehículo que uno pendiente, el sistema DEBE marcar el anterior como Atendido; los atendidos no se editan.
- **FR-012**: El sistema DEBE clasificar cada mantenimiento pendiente como Normal, Próximo o Vencido con base en la fecha de hoy y el kilometraje actual del vehículo: Vencido si la próxima fecha ya pasó o el kilometraje actual alcanzó el próximo; Próximo si faltan 15 días o menos, o 500 km o menos; Normal en otro caso. Con ambos valores rige la condición más urgente.
- **FR-013**: Recepción, administración y mecánico DEBEN poder consultar la lista de mantenimientos con filtros por clasificación y por vehículo o cliente, ordenada de más urgente a menos urgente, mostrando cliente, teléfono y vehículo.
- **FR-014**: Solo el mecánico y el administrador DEBEN poder registrar y editar mantenimientos; la recepción solo consulta.

**Inventario de refacciones**

- **FR-015**: El administrador DEBE poder registrar refacciones con código o número de parte único, nombre, categoría, marca, stock mínimo, precio de compra, precio de venta y existencia inicial.
- **FR-016**: El stock actual de una refacción DEBE ser siempre el resultado de sus movimientos; el stock NO se edita directamente.
- **FR-017**: El sistema DEBE manejar movimientos de entrada (compras), salida (uso en una orden o salida manual con motivo) y ajuste (corrección por conteo físico con diferencia y motivo obligatorio), cada uno con cantidad entera, fecha, usuario, motivo y, si aplica, la orden relacionada.
- **FR-018**: El sistema NO DEBE permitir que el stock quede negativo por ningún movimiento; DEBE rechazar la operación indicando el stock disponible.
- **FR-019**: Los movimientos NO DEBEN poder editarse ni eliminarse; las correcciones se hacen con ajustes.
- **FR-020**: El administrador DEBE poder editar los datos de una refacción y desactivarla (con confirmación) sin eliminarla; una refacción con movimientos no se elimina.
- **FR-021**: Todos los usuarios autenticados DEBEN poder consultar refacciones, su stock y sus movimientos, con búsqueda por código, nombre, categoría o marca y filtros por categoría y por stock bajo; solo el administrador crea, edita, desactiva o registra entradas y ajustes.

**Refacciones en las órdenes**

- **FR-022**: El mecánico asignado (o el administrador) DEBE poder agregar a una orden en curso una refacción activa con una cantidad entera mayor a cero; el sistema DEBE registrar el precio de venta vigente en ese momento.
- **FR-023**: Cada refacción agregada DEBE generar en la misma operación una salida de inventario ligada a la orden; si no hay stock suficiente, NO DEBE guardarse nada.
- **FR-024**: Con usos simultáneos de la misma refacción, el sistema DEBE garantizar que el stock no se sobreasigne: solo se aplican los que alcanzan.
- **FR-025**: Al cambiar la cantidad de una refacción usada el sistema DEBE registrar la diferencia como salida o entrada de reversa; al quitarla, DEBE regresar las piezas al stock con un movimiento ligado a la orden.
- **FR-026**: Las refacciones usadas DEBEN conservar el precio con el que se agregaron aunque el precio de venta cambie después.
- **FR-027**: El total de la orden DEBE sumar servicios, mano de obra y refacciones, recalculado en cada cambio.
- **FR-028**: Las órdenes Terminadas, Entregadas o Canceladas NO DEBEN admitir cambios en sus refacciones; al cancelar una orden con refacciones, el sistema DEBE regresarlas al stock con movimientos que indiquen la cancelación.

**Alertas de stock bajo**

- **FR-029**: El sistema DEBE marcar como stock bajo toda refacción activa con stock menor o igual a su stock mínimo, y como agotada la que tiene cero.
- **FR-030**: La pantalla de inventario DEBE mostrar un resumen de cuántas refacciones están en stock bajo y agotadas, y permitir filtrar solo esas; las alertas DEBEN reflejar el stock actual al abrir la pantalla.
- **FR-031**: Al agregar refacciones a una orden, el sistema DEBE advertir cuando la refacción tiene stock bajo o cero.

**Calidad general**

- **FR-032**: Los permisos por rol DEBEN validarse en el servidor en cada operación; las entradas se validan en el servidor con mensajes en español sin detalles internos.
- **FR-033**: Toda pantalla DEBE seguir el sistema de diseño, mostrar estados de carga, vacío, error y éxito, y pedir confirmación al quitar refacciones de una orden y al desactivar refacciones.
- **FR-034**: La navegación DEBE mostrar las secciones **Inventario** (todos los roles; solo el administrador modifica) y **Mantenimientos** (todos los roles; recepción solo consulta), y el historial DEBE ser accesible desde el detalle del vehículo.
- **FR-035**: El sistema DEBE incluir datos de ejemplo suficientes (refacciones en distintos niveles de stock con movimientos, refacciones usadas en órdenes, mantenimientos en cada clasificación y órdenes terminadas en el historial) sin duplicar registros al cargarlos de nuevo.

### Entidades clave *(incluir si la funcionalidad involucra datos)*

- **Refacción**: pieza del inventario. Tiene código o número de parte único, nombre, categoría, marca, stock mínimo, precio de compra, precio de venta y estado (activa o desactivada). Su stock actual se calcula con sus movimientos.
- **Movimiento de inventario**: registro inmutable de un cambio de stock. Tiene refacción, tipo (entrada, salida o ajuste), cantidad, motivo, orden relacionada (si aplica), usuario y fecha.
- **Refacción utilizada**: refacción agregada a una orden, con cantidad, precio de venta al momento del uso e importe.
- **Mantenimiento programado**: seguimiento de un servicio futuro de un vehículo. Tiene tipo de servicio, fecha y kilometraje del último servicio, próxima fecha, próximo kilometraje, notas y estado (pendiente o atendido). Su clasificación (Normal, Próximo, Vencido) se calcula.
- **Historial de servicio**: no es una entidad aparte; es la vista de las órdenes Terminadas o Entregadas de un vehículo, con el kilometraje del servicio que se registre en la orden.

Relaciones: una refacción tiene muchos movimientos; una orden tiene muchas refacciones utilizadas y cada una genera movimientos ligados a la orden; un vehículo tiene muchos mantenimientos programados y su historial sale de sus órdenes.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Un mecánico consulta el historial completo de un vehículo en menos de 10 segundos desde que lo busca.
- **SC-002**: El 100 % de las refacciones agregadas a una orden se refleja en el inventario como una salida ligada a esa orden, y el stock de cada refacción es siempre igual a la suma de sus movimientos.
- **SC-003**: Ninguna combinación de usos, ajustes, cantidades o peticiones simultáneas deja una refacción con stock negativo, comprobado por pruebas automáticas.
- **SC-004**: La clasificación de mantenimientos (Normal, Próximo, Vencido) es correcta en el 100 % de los casos de prueba de los umbrales por fecha y por kilometraje.
- **SC-005**: Las alertas de stock bajo aparecen en la pantalla de inventario al abrirla, sin acciones adicionales, en el 100 % de los casos de prueba.
- **SC-006**: Un administrador registra una refacción nueva en menos de 2 minutos y un mecánico agrega una refacción a una orden en menos de 1 minuto.
- **SC-007**: El total de cada orden coincide con la suma de servicios, mano de obra y refacciones en el 100 % de los casos de prueba.
- **SC-008**: Recién instalado el entorno, las pantallas de historial, mantenimientos e inventario muestran información de ejemplo sin capturar datos a mano.

## Supuestos

- Se apoya en los clientes, vehículos, usuarios, citas y órdenes de los Sprints 1 y 2.
- El historial es una vista calculada a partir de las órdenes (no una tabla que se llene aparte), para no duplicar información.
- El kilometraje del servicio es un dato opcional de la orden; si no se captura, el historial usa el de entrada.
- Los umbrales de aviso de mantenimiento (15 días y 500 km) son valores del sistema por omisión; cada mantenimiento define libremente sus propios intervalos.
- El stock negativo está prohibido; no hay política de excepción.
- Los movimientos de inventario son entrada, salida y ajuste; las cantidades son enteras (piezas completas).
- Una sola bodega; no se manejan proveedores, órdenes de compra, lotes ni costos promedio.
- Recepción puede consultar el inventario y los mantenimientos, pero no modificarlos; solo el administrador modifica el inventario.
- Quedan por confirmar en `/speckit-clarify`: el modelo exacto del historial (vista calculada o registro propio), los umbrales de vencimiento de mantenimiento, la política de stock negativo y los tipos de movimiento con su uso exacto.
- Fuera de alcance: pagos, Mercado Pago, tickets, dashboard y notificaciones externas (correo, WhatsApp).
- Dependencia: Sprints 1 y 2 completados.
