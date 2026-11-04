# Especificación de la funcionalidad: Precios de refacciones y cobro completo

**Rama de la funcionalidad**: `005-precios-refacciones-cobro`

**Creado**: 2026-11-03

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Especificar el Sprint 5 a partir de `docs/sprints/sprint-5-precios-refacciones-cobro.md` (reformulado el 2026-11-03), con sus 5 historias de usuario, sus 13 criterios de aceptación y sus decisiones abiertas".

> Nota de contexto (hallazgo H-02 del aseguramiento de la calidad): los Sprints 3 y 4 ya dejaron construidos los precios de las refacciones, el precio guardado en cada línea de la orden, el total con refacciones, el cobro y el ticket con refacciones. Este sprint no los construye de nuevo: los completa donde faltan reglas, los protege y los demuestra con pruebas. Cada requisito indica si **mantiene** un comportamiento existente (que ahora debe quedar probado) o **agrega** uno nuevo.

## Aclaraciones

### Sesión 2026-11-03

- Q: ¿Qué precios debe ver el mecánico en el inventario y en las líneas de la orden? → A: Ninguno. El mecánico no ve el precio de compra ni el de venta, ni el importe de cada línea de refacción, ni el desglose, ni el total de la orden; solo ve código, nombre, unidad, cantidad y existencia de las refacciones.
- Q: ¿Qué debe hacer el sistema cuando el administrador guarda un precio de venta menor al de compra? → A: Advertir y pedir confirmación: el servidor rechaza el guardado con un aviso claro hasta que el administrador lo confirme de forma explícita; con la confirmación se guarda.
- Q: ¿Se permite corregir a mano el precio de una línea de refacción de una orden en curso? → A: No, queda fuera de este sprint. Un precio equivocado se corrige quitando la refacción y agregándola de nuevo mientras la orden siga en curso; la línea nueva toma el precio vigente.
- Q: ¿Se permite un precio de venta igual a 0? → A: Sí, como hoy, para piezas sin cargo o de garantía.
- Q: ¿Cuál es el máximo de un precio, de una línea y del total de una orden? → A: 99,999,999.99 para los tres, el valor que cabe en el almacenamiento actual; lo que lo exceda se rechaza.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Reglas y límites de los precios de una refacción (Prioridad: P1)

Como administrador, quiero que los precios de compra y de venta de una refacción tengan reglas y límites claros para evitar errores de captura que dañen el cobro.

**Por qué esta prioridad**: Un precio mal capturado se convierte en un cobro incorrecto; es la entrada de todo el cálculo del dinero.

**Prueba independiente**: El administrador registra y edita refacciones con precios válidos e inválidos (negativos, no numéricos, con tres decimales, demasiado grandes, venta menor que compra) y se comprueba que los válidos se guardan y los inválidos se rechazan con un mensaje claro.

**Escenarios de aceptación**:

1. **Dado** el formulario de refacción, **Cuando** el administrador captura categoría, marca, precio de compra y precio de venta válidos, **Entonces** la refacción se guarda y esos datos se conservan al consultarla de nuevo.
2. **Dado** un precio negativo, no numérico, vacío, con más de dos decimales o mayor al máximo permitido, **Cuando** el administrador guarda, **Entonces** el sistema lo rechaza indicando qué precio falla y por qué.
3. **Dado** una refacción existente, **Cuando** el administrador edita solo su nombre, **Entonces** los precios no cambian.
4. **Dado** un precio de venta menor al de compra, **Cuando** el administrador guarda sin confirmar, **Entonces** el sistema no guarda y le avisa que la venta es menor al costo; **Cuando** confirma de forma explícita, **Entonces** se guarda.
5. **Dado** que agregar una refacción a una orden produciría un importe de línea o un total de orden mayor al máximo permitido, **Cuando** se intenta agregar, **Entonces** el sistema lo rechaza con un mensaje claro y la orden no cambia.

---

### Historia de usuario 2 - Precios ocultos al mecánico (Prioridad: P1)

Como mecánico, quiero seguir usando las refacciones en una orden sin ver precios para no exponer información financiera del taller.

**Por qué esta prioridad**: Hoy el mecánico recibe el precio de venta (en el inventario y en las líneas de la orden); la política de visibilidad es un riesgo de información financiera y debe validarse en el servidor.

**Prueba independiente**: Con una orden con refacciones, se consulta cada ruta de lectura con cada rol y se busca el precio de compra y el de venta en las respuestas; el mecánico, además, agrega y quita refacciones normalmente.

**Escenarios de aceptación**:

1. **Dado** que soy mecánico asignado a una orden, **Cuando** agrego, cambio la cantidad o quito una refacción, **Entonces** puedo hacerlo y veo código, nombre, unidad, cantidad y existencia.
2. **Dado** que soy mecánico, **Cuando** consulto el inventario, el detalle o el listado de órdenes, el historial de un vehículo o las alertas de stock, **Entonces** no recibo ningún precio de refacciones (ni de compra ni de venta), ni importes de línea, ni desglose, ni el total de la orden.
3. **Dado** que soy recepcionista, **Cuando** consulto cualquier información de refacciones, **Entonces** recibo el precio de venta y los importes, pero nunca el precio de compra.
4. **Dado** que soy administrador, **Cuando** consulto el inventario, **Entonces** veo tanto el precio de compra como el de venta.
5. **Dado** un intento de saltarse la interfaz (petición directa al servidor), **Cuando** un rol sin permiso pide un precio, **Entonces** el servidor no lo entrega: la restricción no depende de la pantalla.

---

### Historia de usuario 3 - Un cambio de precio no altera lo ya registrado (Prioridad: P1)

Como administrador, quiero que un cambio de precio no altere órdenes abiertas ni pagos y tickets ya emitidos para conservar la integridad del historial.

**Por qué esta prioridad**: Es la garantía que hace confiable el historial de dinero del taller; ya existe y falta demostrarla.

**Prueba independiente**: Se agrega una refacción a una orden, se cambia su precio de venta en el inventario y se comprueba que la línea, el total, el pago y el ticket siguen mostrando el precio original; una refacción agregada después toma el precio nuevo.

**Escenarios de aceptación**:

1. **Dado** una línea de refacción ya agregada a una orden, **Cuando** el administrador cambia el precio de venta de esa refacción, **Entonces** la línea conserva su precio, su importe y el total de la orden no cambia.
2. **Dado** el cambio anterior, **Cuando** se agrega la misma refacción a otra orden, **Entonces** esa línea nueva toma el precio vigente.
3. **Dado** una orden con pago y ticket emitidos, **Cuando** el administrador cambia los precios de todas sus refacciones, **Entonces** el pago conserva su importe y el ticket muestra los mismos importes y el mismo total.
4. **Dado** que el precio cambia al mismo tiempo que se agrega la refacción a una orden, **Cuando** ambas operaciones terminan, **Entonces** la línea quedó con el precio anterior o con el nuevo, nunca con otro valor.
5. **Dado** una orden Terminada o Entregada, **Cuando** se consulta, **Entonces** sus líneas ya no se pueden editar y su total no cambia.

---

### Historia de usuario 4 - Total, pago y ticket coinciden con refacciones (Prioridad: P1)

Como recepcionista, quiero que el total, el pago y el ticket de la orden coincidan siempre, con refacciones, para entregar un comprobante correcto al cliente.

**Por qué esta prioridad**: Es el flujo principal del cobro; cualquier diferencia entre total, pago y ticket es un error de dinero visible para el cliente.

**Prueba independiente**: Con una orden Terminada con servicios, mano de obra y refacciones, recepción consulta el total, registra el pago por ese total y genera el ticket; los tres coinciden, también con importes que requieren redondeo.

**Escenarios de aceptación**:

1. **Dado** una orden con servicios, mano de obra y refacciones, **Cuando** consulto su total, **Entonces** es la suma de los tres, calculada en centavos, sin errores de redondeo.
2. **Dado** una orden Terminada con total mayor a cero, **Cuando** registro un pago por el total, **Entonces** queda Pagada; un importe mayor al saldo se rechaza indicando el saldo.
3. **Dado** una orden cuyo único contenido son refacciones (total mayor a cero), **Cuando** recepción la cobra, **Entonces** el cobro se permite; solo el total cero lo impide.
4. **Dado** un cobro con Mercado Pago, **Cuando** se crea el enlace de pago, **Entonces** recibe el importe correcto con refacciones.
5. **Dado** una orden pagada, **Cuando** genero su ticket, **Entonces** cada refacción aparece con cantidad, precio unitario e importe, y el subtotal coincide con el total de la orden.
6. **Dado** dos cobros simultáneos que juntos excederían el saldo, **Cuando** ambos se envían, **Entonces** solo se aplican los que alcanzan.
7. **Dado** el panel de control y los listados de órdenes y pagos, **Cuando** hay órdenes con refacciones, **Entonces** se muestran sin errores y con los totales correctos.

---

### Historia de usuario 5 - Datos de ejemplo y documentación al día (Prioridad: P2)

Como administrador, quiero datos de ejemplo y documentación al día para demostrar y mantener el cobro con refacciones.

**Por qué esta prioridad**: No cambia el comportamiento, pero sin datos de ejemplo no se puede demostrar y sin documentación el proyecto se contradice a sí mismo.

**Prueba independiente**: En un entorno recién instalado hay refacciones con precios y una orden Terminada cobrable con refacciones; los seeds se ejecutan dos veces sin duplicar nada; la documentación describe el cobro de refacciones como es.

**Escenarios de aceptación**:

1. **Dado** un entorno recién instalado, **Cuando** abro el inventario y las órdenes, **Entonces** hay refacciones con precios y una orden Terminada cobrable que incluye refacciones.
2. **Dado** los seeds ya cargados, **Cuando** se cargan de nuevo, **Entonces** no se duplican registros ni cambian pagos o tickets existentes.
3. **Dado** `docs/project-context.md`, `docs/design-system.md` y los comentarios del código sobre refacciones, **Cuando** se revisan, **Entonces** no afirman nada que contradiga el cobro con refacciones.

---

### Casos límite

- Precio con exactamente dos decimales, con tres, con notación científica, en blanco o con texto; precio igual al máximo y un centavo por encima.
- Precio de venta igual a 0 (por ejemplo, una pieza sin cargo).
- Cantidad grande por precio grande: el importe de la línea o el total superan el máximo permitido.
- Importe de línea que requiere redondeo a centavos (cantidad por precio con muchos decimales intermedios).
- Una orden con una sola refacción y sin servicios ni mano de obra.
- Cambio de precio justo mientras otra persona agrega la refacción a una orden.
- Refacción desactivada con líneas ya registradas: las líneas conservan su precio.
- Pagos y tickets creados antes del sprint: siguen mostrándose con su importe y contenido originales.
- Mecánico que intenta pedir directamente al servidor un precio que no debe ver.
- Orden Terminada o Entregada: no admite cambios en sus líneas, así que su total y su ticket no cambian.
- Pago de Mercado Pago pendiente mientras el administrador cambia precios: el importe del pago y el total de la orden no se alteran porque la orden ya no admite cambios de líneas.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Precios de la refacción**

- **FR-001** (mantiene): El sistema DEBE guardar, para cada refacción, categoría, marca, precio de compra y precio de venta, y DEBE devolverlos al consultarla, de modo que el administrador pueda crearla y editarla con esos datos.
- **FR-002** (mantiene): Los precios de compra y de venta DEBEN ser numéricos, no negativos, con hasta dos decimales y no mayores a 99,999,999.99; cualquier otro valor DEBE rechazarse con un mensaje en español que indique qué precio falla.
- **FR-003** (agrega): El sistema NO DEBE permitir que el importe de una línea de refacción (cantidad por precio guardado) ni el total de una orden superen 99,999,999.99; ante un intento, DEBE rechazarlo con un mensaje claro y sin modificar la orden ni el inventario.
- **FR-004** (agrega): Cuando el administrador crea una refacción o cambia sus precios y el precio de venta resulta menor al de compra, el sistema NO DEBE guardar hasta recibir una confirmación explícita; sin ella DEBE rechazar con un aviso claro de que la venta es menor al costo. Editar otros datos sin cambiar los precios no exige confirmación.
- **FR-004-b** (mantiene): Un precio de venta igual a 0 DEBE permitirse (piezas sin cargo o de garantía).

**Visibilidad por rol**

- **FR-005** (mantiene): El precio de compra DEBE ser visible solo para el administrador; el sistema NO DEBE entregarlo a recepción ni al mecánico en ninguna consulta (inventario, alertas, movimientos, historial del vehículo, panel de control, órdenes, pagos y tickets).
- **FR-006** (mantiene): Recepción y administración DEBEN recibir el precio de venta y los importes de las refacciones de las órdenes.
- **FR-007** (mantiene): El mecánico asignado DEBE poder agregar, cambiar la cantidad y quitar refacciones de una orden en curso y consultar el inventario con código, nombre, unidad y existencia.
- **FR-008** (agrega): El mecánico NO DEBE recibir ningún precio ni importe de refacciones en ninguna consulta: ni el precio de compra, ni el de venta, ni el importe de una línea, ni el desglose, ni el total de la orden (en el detalle ni en el listado de órdenes). Hoy recibe el precio de venta, los importes y el total, así que este requisito cambia el contrato actual.
- **FR-009** (mantiene): Las restricciones de visibilidad DEBEN aplicarse en el servidor, no solo en la interfaz.

**Integridad del dinero**

- **FR-010** (mantiene): Al agregar una refacción a una orden, el sistema DEBE guardar en esa línea el precio de venta vigente en ese momento; los cambios posteriores del precio de la refacción NO DEBEN modificar la línea, su importe ni el total de la orden. Si el precio cambia al mismo tiempo, la línea DEBE tomar el precio anterior o el nuevo, nunca otro valor.
- **FR-011** (mantiene): El total de una orden DEBE ser servicios más mano de obra más refacciones (cantidad por precio guardado), calculado en centavos enteros y recalculado en la misma operación que cambia cualquiera de sus líneas.
- **FR-012** (mantiene): Una orden Terminada o Entregada NO DEBE admitir cambios en sus líneas; por tanto, su total, su pago y su ticket no cambian después de cobrarse.
- **FR-013** (mantiene): Los pagos y los tickets existentes y los generados antes y después de un cambio de precio DEBEN conservar su importe y su contenido; los datos de ejemplo del Sprint 4 DEBEN seguir intactos.
- **FR-014** (agrega): Una refacción agregada a una orden DESPUÉS de un cambio de precio DEBE tomar el precio nuevo.

**Cobro y ticket**

- **FR-015** (mantiene): El pago DEBE validarse contra el saldo de la orden calculado con su total con refacciones: un importe mayor al saldo se rechaza indicando el saldo, y los cobros simultáneos no pueden exceder el total.
- **FR-016** (mantiene): Una orden con total mayor a cero DEBE poder cobrarse aunque solo tenga refacciones; solo el total cero impide el cobro.
- **FR-017** (mantiene): El cobro con Mercado Pago DEBE solicitar el importe correcto de la orden con refacciones, y el sistema NO DEBE almacenar datos de tarjeta ni credenciales de pago.
- **FR-018** (mantiene): El ticket DEBE mostrar, por cada refacción, cantidad, precio unitario e importe, y su subtotal DEBE coincidir con el total de la orden.
- **FR-019** (mantiene): El panel de control y los listados de órdenes y pagos DEBEN funcionar con el total que incluye refacciones.

**Corrección de precios en una orden abierta**

- **FR-020** (mantiene): El sistema NO DEBE ofrecer corregir a mano el precio de una línea de refacción; solo se puede cambiar su cantidad. Un precio equivocado se corrige quitando la refacción y agregándola de nuevo mientras la orden esté en curso, y la línea nueva toma el precio vigente.

**Datos de ejemplo, pruebas y documentación**

- **FR-021** (mantiene): Los datos de ejemplo DEBEN incluir refacciones con precios y una orden Terminada cobrable con refacciones, y DEBEN poder cargarse de nuevo sin duplicar registros.
- **FR-022** (agrega): El sprint DEBE contar con pruebas automáticas del cálculo del total, el precio guardado en la línea, el redondeo, los límites de importe, la visibilidad por rol (con búsqueda del precio en todas las rutas de lectura), la concurrencia del pago y la compatibilidad con pagos y tickets anteriores.
- **FR-023** (agrega): `docs/project-context.md`, `docs/design-system.md` y los comentarios del código sobre el cobro de refacciones DEBEN actualizarse en este sprint para no contradecir el comportamiento real.

### Entidades clave *(incluir si la funcionalidad involucra datos)*

- **Refacción**: pieza del catálogo con código, nombre, categoría, marca, existencia, stock mínimo, precio de compra, precio de venta y estado activo. El precio de compra es información financiera solo del administrador.
- **Línea de refacción de la orden**: uso de una refacción en una orden, con cantidad, precio unitario guardado al agregarla e importe. Es la copia del precio de venta del momento y no depende del catálogo después.
- **Total de la orden**: suma de servicios, mano de obra e importes de las refacciones de la orden; base del saldo, del pago y del ticket.
- **Pago**: cobro asociado a una orden; no se modifica una vez Pagado.
- **Ticket**: comprobante de una orden Terminada o Entregada; su contenido se arma al consultarlo con la orden, sus líneas y sus pagos.

Relaciones: una orden tiene muchas líneas de refacción, cada una apunta a una refacción y conserva su propio precio; una orden tiene muchos pagos y a lo sumo un ticket.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: En el 100 % de los casos de prueba, cambiar el precio de una refacción no altera ninguna línea, total, pago ni ticket ya registrados, incluso con el cambio y el alta de la línea al mismo tiempo.
- **SC-002**: En el 100 % de las rutas de lectura probadas, el precio de compra no aparece para recepción ni mecánico, y ningún precio ni importe de refacciones ni el total de la orden aparece en las respuestas que recibe el mecánico.
- **SC-003**: En el 100 % de los casos de prueba, el total de la orden, el pago y el subtotal y total del ticket coinciden, incluso con importes que requieren redondeo.
- **SC-004**: Recepción cobra una orden con refacciones y genera su ticket en menos de 2 minutos.
- **SC-005**: Todo precio o importe fuera de las reglas se rechaza con un mensaje claro en el 100 % de los casos de prueba, y ninguno deja datos a medias.
- **SC-006**: Las pruebas de los Sprints 1 a 4 siguen pasando al cerrar el sprint, salvo las que cambien por un contrato declarado en esta especificación, que se registran como hallazgo.
- **SC-007**: Recién instalado el entorno, el inventario y las órdenes muestran refacciones con precios y una orden cobrable con refacciones, y cargar los datos de ejemplo dos veces no duplica nada.

## Supuestos

- Se apoya en el inventario (Sprint 3) y en los pagos, tickets y panel (Sprint 4); no se cambia su estructura de datos salvo que una decisión lo exija, y cualquier migración nueva es aditiva.
- Decisión D-06 del insumo, resuelta por el comportamiento actual y por la aclaración del Sprint 4: una orden Terminada solo puede pasar a Entregada, sus líneas no se editan y su total no cambia; por tanto, no hay un total que se desfase de un pago pendiente de Mercado Pago. No se preguntó en la sesión de aclaraciones porque el código y el Sprint 4 la respaldan.
- Decisión D-07 del insumo, resuelta por la aclaración del Sprint 4: el ticket se arma al consultarlo con los datos de la orden, sus líneas y sus pagos, y no guarda un contenido propio; como las líneas conservan su precio y las órdenes cobradas no cambian, el ticket emitido no varía. No se preguntó en la sesión de aclaraciones por la misma razón.
- Decisiones D-01 a D-05 del insumo: resueltas en la sesión de aclaraciones del 2026-11-03 (ver «Aclaraciones»).
- Los importes de los servicios y de la mano de obra que ve el mecánico no cambian en este sprint; la restricción nueva se refiere solo a las refacciones y al total de la orden.
- Los pagos parciales ya existen desde el Sprint 4 y no se tocan; no hay reembolsos, impuestos ni descuentos.
- El precio de compra nunca llega a recepción ni al mecánico, y esto ya se cumple; el sprint lo protege con pruebas.
- Los importes se calculan en centavos enteros y se guardan con dos decimales, igual que en el Sprint 4.
- Los precios de la refacción no se corrigen en las líneas ya agregadas; esa corrección manual queda fuera del sprint (aclaración del 2026-11-03).
