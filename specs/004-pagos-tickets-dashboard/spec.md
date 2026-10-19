# Especificación de la funcionalidad: Pagos, tickets y panel de control

**Rama de la funcionalidad**: `sdd-speckit` (rama única del reporte SDD; la carpeta de la feature es `004-pagos-tickets-dashboard`)

**Creado**: 2026-10-19

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripcion de @docs/sprints/sprint-4-pagos-tickets-dashboard.md"

## Aclaraciones

### Sesión 2026-10-19

- Q: ¿Qué forma debe tener el cobro con Mercado Pago en la demostración (sandbox)? → A: Enlace de pago: Motorix crea el cobro en Mercado Pago, recepción ve y copia el enlace (o su código QR) para el cliente, que paga en la página de Mercado Pago; el estado se actualiza por notificación o por consulta. Motorix nunca captura datos de tarjeta.
- Q: ¿Cómo se entrega el ticket para imprimirlo: como una página imprimible en pantalla o como un archivo PDF que Motorix genera? → A: Como una vista de ticket imprimible que se arma al consultarlo con los datos actuales; "Imprimir" abre el diálogo del sistema, desde donde también se puede guardar como PDF. Motorix no genera ni almacena archivos PDF.
- Q: ¿Se permiten pagos parciales en una orden o cada orden se cobra completa en un solo pago? → A: Se permiten pagos parciales: varios pagos hasta cubrir el total (por ejemplo, un anticipo y la liquidación, o parte en efectivo y parte con tarjeta); el estado de cobro de la orden es Sin pagos, Pago parcial o Pagada.
- Q: ¿Qué hace Motorix cuando hay que devolver dinero o corregir un pago ya cobrado? → A: Nada: no hay reembolsos en Motorix. Un pago Pagado no se modifica ni se revierte; solo se pueden cancelar los pagos Pendientes de Mercado Pago. Las devoluciones se manejan fuera del sistema (caja o panel de Mercado Pago).
- Q: ¿El panel de control usa periodos fijos o permite elegir el periodo? → A: Periodos fijos, sin selector de fechas: lo cobrado hoy y en el mes en curso, las citas de hoy y de los próximos 7 días, y el resto como foto del momento (órdenes por estado, mantenimientos y alertas de inventario).

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Registrar el pago de una orden (Prioridad: P1)

Como recepcionista, quiero registrar el pago de una orden para cerrar el ciclo del servicio.

**Por qué esta prioridad**: Es el cierre económico del servicio y la base de las demás historias: el ticket y el panel de control necesitan saber qué se cobró.

**Prueba independiente**: Con una orden Terminada cuyo total es conocido, recepción registra un pago por el total en efectivo, la orden queda como pagada y el pago se puede consultar después; un pago por más del saldo se rechaza.

**Escenarios de aceptación**:

1. **Dado** una orden Terminada o Entregada con un total mayor a cero, **Cuando** registro un pago con importe y método, **Entonces** el pago queda guardado, asociado a esa orden y visible en su detalle.
2. **Dado** una orden en curso o Cancelada, **Cuando** intento registrar un pago, **Entonces** el sistema lo rechaza explicando que la orden debe estar Terminada o Entregada.
3. **Dado** que el importe es cero, negativo, con más de dos decimales o mayor al saldo pendiente de la orden, **Cuando** guardo, **Entonces** el sistema lo rechaza con un mensaje claro e indica el saldo pendiente.
4. **Dado** una orden con pagos que suman exactamente su total, **Cuando** consulto su detalle, **Entonces** aparece como pagada y ya no admite más pagos.
5. **Dado** una orden con un pago parcial, **Cuando** consulto su detalle, **Entonces** veo lo pagado, el saldo pendiente y el estado "pago parcial".
6. **Dado** que soy mecánico, **Cuando** intento registrar o consultar pagos, **Entonces** el sistema lo rechaza (los pagos son de recepción y administración).
7. **Dado** que dos personas registran al mismo tiempo pagos que juntos excederían el saldo, **Cuando** ambas guardan, **Entonces** solo se aplican los que alcanzan y el otro recibe el aviso de saldo insuficiente.
8. **Dado** un pago registrado, **Cuando** la orden pasa a Entregada, **Entonces** el pago y su historial se conservan.

---

### Historia de usuario 2 - Elegir el método de pago (Prioridad: P1)

Como recepcionista, quiero seleccionar el método de pago para dejar constancia de cómo se cobró.

**Por qué esta prioridad**: El método de pago forma parte del comprobante y de la contabilidad básica del taller; es parte del mismo registro de pago.

**Prueba independiente**: Se registran pagos con efectivo, tarjeta, transferencia y Mercado Pago, y se comprueba que cada uno conserva su método y que uno no válido se rechaza.

**Escenarios de aceptación**:

1. **Dado** el formulario de pago, **Cuando** elijo el método, **Entonces** puedo elegir Efectivo, Tarjeta, Transferencia o Mercado Pago, y el método es obligatorio.
2. **Dado** un pago en efectivo, tarjeta (cobrada con terminal externa) o transferencia, **Cuando** lo guardo, **Entonces** queda registrado como Pagado de inmediato, con una referencia opcional (por ejemplo, número de autorización o de transferencia).
3. **Dado** un pago con tarjeta, **Cuando** lo registro, **Entonces** el sistema NO pide ni guarda datos de la tarjeta (número, vencimiento o código de seguridad); solo guarda importe, método y referencia.
4. **Dado** que envío un método que no existe, **Cuando** guardo, **Entonces** el sistema lo rechaza.
5. **Dado** una orden con pagos de varios métodos, **Cuando** consulto su detalle, **Entonces** veo cada pago con su método, importe, estado, referencia, quién lo registró y cuándo.

---

### Historia de usuario 3 - Cobrar con Mercado Pago (Prioridad: P2)

Como recepcionista, quiero gestionar pagos mediante Mercado Pago para ofrecer una opción digital.

**Por qué esta prioridad**: Es una opción adicional de cobro; el taller puede operar sin ella usando los otros métodos, por eso va después de los pagos básicos.

**Prueba independiente**: En modo de pruebas (sandbox), recepción inicia un pago con Mercado Pago para una orden, obtiene un enlace de pago, el pago queda Pendiente y, al confirmarse o rechazarse en el servicio externo, su estado se actualiza en Motorix.

**Escenarios de aceptación**:

1. **Dado** una orden Terminada o Entregada con saldo pendiente, **Cuando** inicio un pago con Mercado Pago por un importe válido, **Entonces** el sistema crea el pago en estado Pendiente, solicita el cobro a Mercado Pago en modo de pruebas y muestra el enlace de pago (y su código QR) para que el cliente pague en la página de Mercado Pago.
2. **Dado** un pago de Mercado Pago Pendiente, **Cuando** Mercado Pago informa que fue aprobado, **Entonces** el pago pasa a Pagado y el saldo de la orden se actualiza.
3. **Dado** un pago de Mercado Pago Pendiente, **Cuando** Mercado Pago informa que fue rechazado o cancelado, **Entonces** el pago pasa a Rechazado o Cancelado, no cuenta para el saldo y se puede iniciar otro.
4. **Dado** un pago de Mercado Pago Pendiente, **Cuando** consulto su estado desde Motorix, **Entonces** el sistema verifica el estado actual con Mercado Pago y lo actualiza.
5. **Dado** que las credenciales de Mercado Pago no están configuradas o el servicio no responde, **Cuando** intento iniciar un pago con Mercado Pago, **Entonces** el sistema muestra un mensaje claro, no crea un pago a medias y permite usar otro método.
6. **Dado** cualquier pago de Mercado Pago, **Cuando** reviso lo que Motorix guarda, **Entonces** solo hay importe, estado, referencia externa y fechas; nunca datos de tarjeta ni credenciales.
7. **Dado** que una notificación de Mercado Pago llega repetida o con datos que no corresponden a ningún pago, **Cuando** el sistema la procesa, **Entonces** no duplica ni altera pagos ajenos.
8. **Dado** un pago de Mercado Pago Pendiente, **Cuando** recepción lo cancela, **Entonces** pasa a Cancelado y deja de contar para el saldo.

---

### Historia de usuario 4 - Generar y consultar el ticket de servicio (Prioridad: P1)

Como recepcionista, quiero generar tickets de servicio para entregar comprobante al cliente.

**Por qué esta prioridad**: Es el comprobante que recibe el cliente y cierra el flujo demostrable del sprint (orden → pago → ticket).

**Prueba independiente**: Con una orden Terminada con servicios, mano de obra, refacciones y un pago, recepción genera el ticket, lo visualiza con todos los datos esperados y lo imprime.

**Escenarios de aceptación**:

1. **Dado** una orden Terminada o Entregada, **Cuando** genero su ticket, **Entonces** el sistema crea un ticket con folio único y fecha de generación.
2. **Dado** un ticket generado, **Cuando** lo visualizo, **Entonces** muestra el folio, los datos básicos del taller, cliente, vehículo, placas, kilometraje, servicios, refacciones, mano de obra, subtotal, total, método de pago, estado del pago y fecha.
3. **Dado** una orden con pagos de varios métodos, **Cuando** veo su ticket, **Entonces** el método de pago y el estado del pago reflejan lo registrado (por ejemplo, "Efectivo y tarjeta", "Pagado" o "Pago parcial").
4. **Dado** una orden sin pagos, **Cuando** genero su ticket, **Entonces** se genera con estado de pago "Pendiente" y sin método de pago.
5. **Dado** un ticket visualizado, **Cuando** elijo imprimir, **Entonces** obtengo una versión lista para imprimir (o guardar como PDF) con el mismo contenido y sin elementos de navegación; el sistema no genera ni guarda archivos PDF.
6. **Dado** una orden que ya tiene ticket, **Cuando** vuelvo a generarlo, **Entonces** el sistema no crea otro folio: devuelve el mismo ticket con la información actualizada de pago.
7. **Dado** una orden en curso o Cancelada, **Cuando** intento generar su ticket, **Entonces** el sistema lo rechaza.
8. **Dado** que soy mecánico, **Cuando** intento generar o consultar tickets, **Entonces** el sistema lo rechaza.

---

### Historia de usuario 5 - Consultar el panel de control (Prioridad: P2)

Como administrador, quiero consultar información general desde el panel de control para supervisar el taller.

**Por qué esta prioridad**: Da una visión de conjunto, pero el taller puede operar sin ella; se apoya en los datos que generan las historias anteriores.

**Prueba independiente**: Con datos de ejemplo, el administrador abre el panel y ve los indicadores de órdenes, citas, pagos, mantenimientos y alertas de inventario, que coinciden con lo que muestran las pantallas de cada módulo.

**Escenarios de aceptación**:

1. **Dado** que soy administrador, **Cuando** abro el panel de control, **Entonces** veo indicadores de la operación con datos reales actualizados al abrir la pantalla.
2. **Dado** que soy recepcionista o mecánico, **Cuando** intento abrir el panel, **Entonces** el sistema no me lo muestra y el servidor rechaza la consulta.
3. **Dado** un taller sin datos de un tipo (por ejemplo, sin pagos), **Cuando** abro el panel, **Entonces** ese indicador muestra cero o un estado vacío claro, sin errores.
4. **Dado** que falla la consulta de datos, **Cuando** abro el panel, **Entonces** veo un mensaje de error en español con la opción de reintentar.
5. **Dado** cada indicador del panel, **Cuando** lo comparo con el módulo de origen (órdenes, citas, mantenimientos, inventario o pagos), **Entonces** el número coincide.

---

### Historia de usuario 6 - Ver órdenes, citas, mantenimientos y alertas en el panel (Prioridad: P2)

Como administrador, quiero visualizar órdenes, citas, mantenimientos y alertas de inventario en el panel para detectar rápido qué requiere atención.

**Por qué esta prioridad**: Concreta qué muestra el panel; sin esta historia el panel no tiene contenido útil.

**Prueba independiente**: Con datos de ejemplo en todos los módulos, el panel muestra cuántas órdenes hay por estado, las citas de hoy y próximas, los mantenimientos vencidos y próximos, las refacciones con stock bajo o agotadas, y lo cobrado del periodo.

**Escenarios de aceptación**:

1. **Dado** órdenes en varios estados, **Cuando** abro el panel, **Entonces** veo cuántas hay en cada estado y cuántas están terminadas sin cobrar completamente.
2. **Dado** citas en varios estados, **Cuando** abro el panel, **Entonces** veo las citas pendientes o confirmadas de hoy y de los próximos 7 días.
3. **Dado** mantenimientos programados, **Cuando** abro el panel, **Entonces** veo cuántos están vencidos y cuántos próximos.
4. **Dado** refacciones con stock bajo o agotadas, **Cuando** abro el panel, **Entonces** veo cuántas son y cuáles son las más urgentes.
5. **Dado** pagos registrados, **Cuando** abro el panel, **Entonces** veo lo cobrado hoy y en el mes en curso, y cuánto hay pendiente de cobrar de órdenes terminadas.
6. **Dado** un indicador con elementos concretos (por ejemplo, un mantenimiento vencido), **Cuando** lo elijo, **Entonces** voy a la pantalla del módulo correspondiente, sin repetir la información en el panel.
7. **Dado** que el panel resume la misma información que otros módulos, **Cuando** lo reviso, **Entonces** no duplica ni almacena copias: cada cifra se calcula al abrirlo a partir de los datos del módulo de origen.

---

### Casos límite

- Pago por el saldo exacto: la orden queda pagada; pagos posteriores se rechazan.
- Orden con total cero: no admite pagos y su ticket se genera con total cero y estado de pago "Sin cobro".
- Redondeo: los importes tienen dos decimales; la suma de pagos nunca excede el total por redondeo.
- Dos pagos simultáneos que juntos exceden el saldo: solo se aplican los que alcanzan.
- Un pago Rechazado o Cancelado no cuenta para el saldo y se conserva en el historial de la orden; los pagos nunca se eliminan.
- Una orden Entregada con saldo pendiente: se puede seguir cobrando; la entrega no exige que esté pagada.
- Cambio posterior a la orden: una orden Terminada o Entregada ya no cambia su total, así que el ticket y el saldo siguen siendo coherentes; si una orden Terminada se cancela, no admite pagos nuevos y conserva los ya registrados.
- Mercado Pago sin credenciales, sin conexión, con tiempo de espera agotado o con notificaciones repetidas o falsas: se maneja con mensajes claros y sin pagos duplicados ni a medias.
- Ticket de una orden sin pagos, con pago parcial, con varios métodos y con pagos Rechazados: muestra el estado correcto.
- Impresión: el ticket impreso no incluye menús, botones ni la barra lateral.
- Panel sin datos: muestra ceros y estados vacíos; con muchos datos, sigue cargando en el tiempo esperado.
- Fechas "hoy" y "mes en curso" del panel se calculan con la hora local del taller.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Pagos**

- **FR-001**: El sistema DEBE permitir registrar un pago asociado a una orden Terminada o Entregada, con importe, método de pago y referencia opcional; todo pago DEBE estar relacionado con una orden.
- **FR-002**: El sistema DEBE rechazar pagos para órdenes en curso o Canceladas y para órdenes con total cero.
- **FR-003**: El importe de un pago DEBE ser mayor a cero, con hasta dos decimales y no mayor al saldo pendiente de la orden; ante un rechazo por saldo, el mensaje DEBE indicar el saldo pendiente.
- **FR-004**: El saldo pendiente DEBE calcularse como el total de la orden menos la suma de los pagos en estado Pagado; los pagos Pendientes de Mercado Pago DEBEN reservar su importe para que no se sobrecobre mientras esperan confirmación.
- **FR-005**: El sistema DEBE garantizar que pagos simultáneos no excedan el saldo de la orden: solo se aplican los que alcanzan.
- **FR-006**: Los métodos de pago DEBEN ser Efectivo, Tarjeta, Transferencia y Mercado Pago; el método es obligatorio y cualquier otro valor se rechaza.
- **FR-007**: Los pagos en efectivo, tarjeta (cobrados con terminal externa) y transferencia DEBEN quedar Pagados al registrarse; el estado de un pago DEBE ser uno de Pendiente, Pagado, Rechazado o Cancelado.
- **FR-008**: El sistema NO DEBE solicitar ni almacenar datos sensibles de tarjetas (número, vencimiento, código de seguridad) ni credenciales de pago.
- **FR-009**: Los pagos NUNCA DEBEN eliminarse; un pago Pendiente de Mercado Pago puede cancelarse por recepción o administración, y los pagos Pagados no se modifican.
- **FR-010**: El detalle de la orden DEBE mostrar sus pagos (método, importe, estado, referencia, quién y cuándo), lo pagado, el saldo pendiente y el estado de cobro de la orden (Sin pagos, Pago parcial o Pagada).
- **FR-011**: Solo recepción y administración DEBEN poder registrar y consultar pagos; el mecánico NO DEBE tener acceso a ellos.
- **FR-012**: Una orden Entregada DEBE conservarse como historial, incluidos sus pagos; la entrega no exige que la orden esté pagada y se puede seguir cobrando después.

**Mercado Pago**

- **FR-013**: El sistema DEBE permitir iniciar un pago con Mercado Pago para una orden con saldo pendiente, creando el pago en estado Pendiente y obteniendo de Mercado Pago, en modo de pruebas (sandbox), un enlace de pago (con su código QR) que recepción comparte con el cliente; el cliente paga en la página de Mercado Pago y Motorix nunca captura datos de tarjeta.
- **FR-014**: El sistema DEBE actualizar el estado de un pago de Mercado Pago cuando el servicio externo informe su resultado (aprobado, rechazado o cancelado) y DEBE permitir consultar y sincronizar su estado bajo demanda.
- **FR-015**: Las notificaciones de Mercado Pago DEBEN procesarse de forma segura e idempotente: no duplican pagos, no aceptan datos que no puedan verificarse con Mercado Pago y no alteran pagos ajenos.
- **FR-016**: Las credenciales de Mercado Pago DEBEN manejarse únicamente por variables de entorno y nunca aparecer en el repositorio, en las respuestas ni en los registros.
- **FR-017**: Si Mercado Pago no está configurado o no responde, el sistema DEBE informar con un mensaje claro en español, no dejar pagos a medias y permitir cobrar con otro método.
- **FR-018**: Del pago de Mercado Pago el sistema SOLO DEBE guardar importe, estado, referencia externa y fechas; la lógica de integración DEBE estar aislada del resto del dominio.

**Tickets**

- **FR-019**: El sistema DEBE permitir generar el ticket de una orden Terminada o Entregada, con folio único y fecha de generación; las órdenes en curso o Canceladas NO tienen ticket.
- **FR-020**: El ticket DEBE incluir folio, datos básicos del taller, cliente, vehículo, placas, kilometraje, servicios, refacciones, mano de obra, subtotal, total, método de pago, estado del pago y fecha.
- **FR-021**: Cada orden DEBE tener a lo sumo un ticket: generarlo de nuevo devuelve el mismo folio con el método y el estado de pago actuales.
- **FR-022**: El ticket DEBE poder visualizarse en pantalla y imprimirse (o guardarse como PDF desde el diálogo de impresión) con el mismo contenido y sin elementos de navegación; el sistema NO DEBE generar ni almacenar archivos PDF.
- **FR-023**: Los importes del ticket DEBEN coincidir exactamente con los de la orden y sus pagos; el subtotal y el total DEBEN calcularse con la misma regla que el total de la orden.
- **FR-024**: Solo recepción y administración DEBEN poder generar y consultar tickets; el mecánico NO DEBE tener acceso.

**Panel de control**

- **FR-025**: El administrador DEBE poder abrir un panel de control con datos reales de órdenes, citas, pagos, mantenimientos y alertas de inventario, calculados al abrirlo; recepción y mecánico NO DEBEN tener acceso, y el servidor DEBE rechazar su consulta.
- **FR-026**: El panel DEBE mostrar: órdenes por estado y cuántas están terminadas con saldo pendiente; citas de hoy y de los próximos 7 días; mantenimientos vencidos y próximos; refacciones con stock bajo y agotadas; y lo cobrado hoy y en el mes en curso junto con lo pendiente de cobrar.
- **FR-027**: Cada indicador del panel DEBE coincidir con la información de su módulo de origen, sin duplicarla ni guardar copias, y permitir ir al módulo correspondiente.
- **FR-028**: El panel DEBE mostrar estados de carga, vacío y error con opción de reintentar, y funcionar sin errores cuando no hay datos.

**Calidad general**

- **FR-029**: Los permisos por rol DEBEN validarse en el servidor en cada operación; las entradas se validan en el servidor con mensajes en español sin detalles internos.
- **FR-030**: Toda pantalla DEBE seguir el sistema de diseño y mostrar estados de carga, vacío, error y éxito, con confirmación al cancelar un pago pendiente.
- **FR-031**: La navegación DEBE mostrar la sección **Panel de control** solo al administrador; los pagos y el ticket DEBEN ser accesibles desde el detalle de la orden para recepción y administración.
- **FR-032**: El sistema DEBE incluir datos de ejemplo suficientes (pagos en distintos métodos y estados, órdenes con cobro completo, parcial y sin cobro, y tickets generados) para que el panel y las pantallas muestren información al instalar, sin duplicar registros al cargarlos de nuevo.

### Entidades clave *(incluir si la funcionalidad involucra datos)*

- **Pago**: cobro asociado a una orden. Tiene importe, método (efectivo, tarjeta, transferencia o Mercado Pago), estado (pendiente, pagado, rechazado o cancelado), referencia (de la transferencia, la autorización o el servicio externo), usuario que lo registró y fechas. Nunca contiene datos de tarjeta.
- **Ticket**: comprobante de una orden Terminada o Entregada. Tiene folio único, orden, pago principal relacionado (si existe) y fecha de generación; su contenido se arma con la orden, sus líneas y sus pagos.
- **Indicadores del panel**: no es una entidad; son cifras calculadas al abrir el panel a partir de órdenes, citas, pagos, mantenimientos e inventario.

Relaciones: una orden tiene muchos pagos y a lo sumo un ticket; un ticket se relaciona con el pago principal de su orden; el panel solo lee las demás entidades.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Recepción registra el pago de una orden en menos de 1 minuto y genera su ticket en menos de 30 segundos adicionales.
- **SC-002**: En el 100 % de los casos de prueba, la suma de los pagos Pagados de una orden nunca excede su total, incluso con pagos simultáneos.
- **SC-003**: El 100 % de los pagos registrados está asociado a una orden y ninguno contiene datos de tarjeta ni credenciales, comprobado por pruebas automáticas y revisión del esquema.
- **SC-004**: Un pago de Mercado Pago en modo de pruebas pasa de Pendiente a su estado final en Motorix sin intervención manual cuando el servicio externo informa su resultado, y los reintentos o notificaciones repetidas no duplican pagos.
- **SC-005**: Los importes del ticket coinciden con los de la orden y sus pagos en el 100 % de los casos de prueba (subtotal, total, método y estado de pago).
- **SC-006**: El ticket se visualiza e imprime con todos los datos esperados en el 100 % de los casos de prueba de contenido.
- **SC-007**: Cada cifra del panel coincide con la de su módulo de origen en el 100 % de los casos de prueba, y el panel carga en menos de 3 segundos con los datos de ejemplo.
- **SC-008**: Recién instalado el entorno, el panel y las pantallas de pagos y tickets muestran información de ejemplo sin capturar datos a mano.

## Supuestos

- Se apoya en los clientes, vehículos, usuarios, citas y órdenes de los Sprints 1 y 2 y en el inventario, los mantenimientos y las refacciones usadas del Sprint 3; el total de la orden (servicios + mano de obra + refacciones) ya existe.
- Los pagos pueden ser parciales: varios pagos que suman el total, con combinación de métodos (aclaración del 2026-10-19).
- Los pagos con efectivo, tarjeta y transferencia se registran al cobrarse (la tarjeta se cobra en una terminal externa); solo Mercado Pago pasa por el estado Pendiente.
- Mercado Pago se usa solo en modo de pruebas (sandbox); la integración para la demostración es un enlace de pago (aclaración del 2026-10-19), sin formulario de tarjeta dentro de Motorix.
- No hay reembolsos ni devoluciones: un pago Pagado no se modifica ni se revierte desde Motorix y las devoluciones se manejan fuera del sistema (aclaración del 2026-10-19).
- No se maneja impuestos (IVA) ni facturación: subtotal y total son iguales salvo que se defina lo contrario en la aclaración.
- Los datos básicos del taller (nombre, dirección, teléfono) vienen de la configuración del sistema, no de una pantalla de administración.
- El ticket se genera a partir de la información de la orden y sus pagos; el ticket es una vista imprimible que se arma al consultarla (aclaración del 2026-10-19); desde el diálogo de impresión también se puede guardar como PDF, pero Motorix no genera ni almacena archivos.
- Los indicadores del panel son los de FR-026 con periodos fijos ("hoy", "mes en curso" y "próximos 7 días") y sin selector de fechas (aclaración del 2026-10-19).
- Una sola moneda (pesos mexicanos).
- Fuera de alcance: chatbot de WhatsApp, facturación electrónica, envío automático de correos o mensajes al cliente, reportes avanzados o analítica histórica, y aplicación móvil nativa.
- Dependencia: Sprints 1, 2 y 3 completados.
