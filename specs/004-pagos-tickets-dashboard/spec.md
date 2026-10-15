# Especificación de funcionalidad: Pagos, tickets y dashboard (Sprint 4)

**Rama de la funcionalidad**: `004-pagos-tickets-dashboard`

**Creada**: 2026-10-14

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripción de docs/sprints/sprint-4-pagos-tickets-dashboard.md"

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Registrar el pago de una orden (Prioridad: P1)

Como recepcionista, quiero registrar el pago de una orden para cerrar el ciclo del servicio.

**Por qué esta prioridad**: Es el cierre del flujo del taller (cita → orden → trabajo → cobro); sin cobro registrado no hay forma de saber qué órdenes están pagadas.

**Prueba independiente**: Se prueba abriendo una orden terminada con total mayor a cero, registrando un pago por el total y comprobando que la orden queda como pagada y que el pago aparece en su detalle.

**Escenarios de aceptación**:

1. **Dado** una orden en estado "TERMINADO" o "ENTREGADO" con un total a cobrar, **Cuando** la recepcionista registra un pago por un importe válido, **Entonces** el pago queda asociado a la orden, con fecha, usuario que lo registró e importe, y el detalle de la orden muestra el total, lo pagado y el saldo pendiente.
2. **Dado** una orden con saldo pendiente, **Cuando** se registran pagos parciales (abonos) que suman el total, **Entonces** la orden pasa a "Pagada" y su saldo queda en cero; mientras tanto se muestra "Pago parcial".
3. **Dado** una orden sin pagos, **Cuando** se consulta, **Entonces** se muestra como "Sin pagar" y con el saldo igual al total.
4. **Dado** un importe mayor al saldo pendiente, igual a cero o negativo, **Cuando** se intenta registrar el pago, **Entonces** el sistema lo rechaza indicando el saldo pendiente.
5. **Dado** una orden que aún está en proceso (por ejemplo "RECIBIDO" o "EN_REPARACION"), **Cuando** se intenta registrar un pago, **Entonces** el sistema lo rechaza porque el total todavía puede cambiar.
6. **Dado** una orden con total cero, **Cuando** se intenta registrar un pago, **Entonces** el sistema lo rechaza: no hay nada que cobrar.
7. **Dado** una orden ya pagada por completo, **Cuando** se intenta registrar otro pago, **Entonces** el sistema lo rechaza.
8. **Dado** un usuario con rol de mecánico, **Cuando** intenta registrar o consultar pagos, **Entonces** el sistema lo rechaza.

---

### Historia de usuario 2 - Seleccionar el método de pago (Prioridad: P1)

Como recepcionista, quiero seleccionar el método de pago para dejar constancia de cómo se cobró.

**Por qué esta prioridad**: El método es parte obligatoria del comprobante y del control de cobros del día.

**Prueba independiente**: Se prueba registrando un pago con cada uno de los métodos y comprobando que se conserva y se muestra en el detalle de la orden.

**Escenarios de aceptación**:

1. **Dado** el formulario de pago, **Cuando** la recepcionista elige el método, **Entonces** puede escoger entre efectivo, tarjeta, transferencia y Mercado Pago.
2. **Dado** un pago registrado con efectivo, tarjeta o transferencia, **Cuando** se guarda, **Entonces** queda con estado "Aprobado" de inmediato, porque el cobro ya ocurrió en el taller.
3. **Dado** un pago con tarjeta o transferencia, **Cuando** la recepcionista captura una referencia opcional (por ejemplo, el número de autorización o de operación), **Entonces** se conserva como dato informativo; el sistema nunca pide ni guarda números de tarjeta, vencimiento o código de seguridad.
4. **Dado** un pago en efectivo, **Cuando** la recepcionista indica con cuánto pagó el cliente, **Entonces** el sistema calcula y muestra el cambio, sin guardarlo como parte del pago.
5. **Dado** un método distinto de los cuatro permitidos, **Cuando** se intenta registrar el pago, **Entonces** el sistema lo rechaza.

---

### Historia de usuario 3 - Cobrar con Mercado Pago (Prioridad: P2)

Como recepcionista, quiero gestionar pagos mediante Mercado Pago para ofrecer una opción digital.

**Por qué esta prioridad**: Es una opción adicional de cobro; el taller puede operar con los otros tres métodos aunque esta no esté disponible. Se demuestra en el entorno de pruebas (sandbox) de Mercado Pago.

**Prueba independiente**: Se prueba generando un cobro con Mercado Pago para una orden, abriendo el enlace de pago de pruebas, completando el pago con una cuenta de prueba y consultando el estado hasta ver el pago aprobado.

**Escenarios de aceptación**:

1. **Dado** una orden con saldo disponible, **Cuando** la recepcionista elige Mercado Pago (con el saldo completo o un importe menor), **Entonces** el sistema crea un cobro "Pendiente" con una referencia única de la orden, reserva ese importe y le muestra un enlace de pago que puede abrir o compartir con el cliente.
2. **Dado** un cobro de Mercado Pago pendiente en la orden, **Cuando** se intenta crear otro cobro de Mercado Pago o un pago por más del saldo disponible, **Entonces** el sistema lo rechaza indicando el saldo disponible.
3. **Dado** un cobro de Mercado Pago pendiente, **Cuando** el cliente completa el pago en el entorno de pruebas y la recepcionista actualiza el estado, **Entonces** el cobro cambia a "Aprobado" y la orden refleja el nuevo saldo.
4. **Dado** un cobro de Mercado Pago pendiente, **Cuando** el pago es rechazado o no se completa, **Entonces** el cobro pasa a "Rechazado" o permanece "Pendiente" según informe Mercado Pago, y el saldo de la orden no cambia.
5. **Dado** un cobro de Mercado Pago pendiente que ya no se necesita, **Cuando** la recepcionista lo cancela, **Entonces** queda como "Cancelado" y se conserva en el historial.
6. **Dado** que las credenciales de Mercado Pago no están configuradas o el servicio no responde, **Cuando** se intenta generar el cobro, **Entonces** el sistema muestra un mensaje claro, no registra ningún pago y permite cobrar con los demás métodos.
7. **Dado** cualquier cobro de Mercado Pago, **Cuando** se consulta o se almacena, **Entonces** el sistema solo conserva la referencia y el estado del cobro; nunca datos de tarjeta ni credenciales.

---

### Historia de usuario 4 - Generar el ticket de servicio (Prioridad: P1)

Como recepcionista, quiero generar tickets de servicio para entregar comprobante al cliente.

**Por qué esta prioridad**: Es el comprobante que recibe el cliente y cierra la entrega del vehículo.

**Prueba independiente**: Se prueba generando el ticket de una orden con servicios, mano de obra y refacciones, y comprobando que contiene todos los datos requeridos, se puede ver en pantalla e imprimir.

**Escenarios de aceptación**:

1. **Dado** una orden terminada o entregada, **Cuando** la recepcionista genera el ticket, **Entonces** se crea con un folio propio y muestra: datos del taller, folio de la orden, cliente, vehículo, placas, kilometraje, servicios, refacciones, mano de obra, subtotales, total, método(s) de pago, estado del pago y fecha.
2. **Dado** un ticket generado, **Cuando** la recepcionista lo abre, **Entonces** puede verlo en pantalla con formato de comprobante y mandarlo a imprimir con el diálogo de impresión del sistema.
3. **Dado** una orden que ya tiene ticket, **Cuando** se vuelve a generar, **Entonces** el sistema reutiliza el mismo ticket (mismo folio) en lugar de crear uno nuevo, y lo muestra con el estado de pago vigente.
4. **Dado** una orden con pagos parciales o sin pagos, **Cuando** se genera el ticket, **Entonces** el ticket muestra el estado de pago correspondiente ("Sin pagar", "Pago parcial" o "Pagada"), el total pagado y el saldo.
5. **Dado** una orden aún en proceso, **Cuando** se intenta generar el ticket, **Entonces** el sistema lo rechaza.
6. **Dado** un ticket ya emitido, **Cuando** pasa el tiempo o cambian los pagos, **Entonces** sus datos de la orden (servicios, refacciones, mano de obra, totales) no cambian, porque la orden entregada no se modifica; solo se actualiza la información de pago.
7. **Dado** un usuario administrador o recepcionista, **Cuando** consulta los tickets de una orden, **Entonces** puede verlos; un mecánico no.

---

### Historia de usuario 5 - Consultar información general en el panel de control (Prioridad: P2)

Como administrador, quiero consultar información general desde el panel de control para supervisar el taller.

**Por qué esta prioridad**: Ofrece la visión global que el administrador necesita, pero depende de que ya existan órdenes, citas, mantenimientos, inventario y pagos.

**Prueba independiente**: Se prueba iniciando sesión como administrador y comprobando que el panel de control se abre como pantalla de inicio con indicadores que coinciden con los datos reales de la aplicación.

**Escenarios de aceptación**:

1. **Dado** un administrador con sesión iniciada, **Cuando** entra a la aplicación, **Entonces** el panel de control es su pantalla de inicio y muestra la fecha y hora de la última actualización.
2. **Dado** el panel de control abierto, **Cuando** el administrador pulsa "Actualizar", **Entonces** los indicadores se vuelven a calcular con los datos vigentes.
3. **Dado** que los datos cambian (por ejemplo, se entrega una orden o se registra un pago), **Cuando** se actualiza el panel, **Entonces** los indicadores reflejan el cambio sin duplicar ni desfasar información.
4. **Dado** un usuario recepcionista o mecánico, **Cuando** intenta abrir el panel de control o pedir sus datos, **Entonces** el sistema lo rechaza.
5. **Dado** que el panel no se pudo cargar por un error, **Cuando** se muestra, **Entonces** aparece un mensaje claro con la opción de reintentar.

---

### Historia de usuario 6 - Visualizar órdenes, citas, mantenimientos y alertas en el panel (Prioridad: P2)

Como administrador, quiero visualizar órdenes, citas, mantenimientos y alertas de inventario en el panel de control para saber de un vistazo qué atender.

**Por qué esta prioridad**: Es el contenido concreto del panel; da valor inmediato al administrador al reunir en una pantalla lo que hoy está en cuatro módulos.

**Prueba independiente**: Se prueba con los datos de ejemplo y comprobando que cada indicador coincide con el listado del módulo correspondiente.

**Escenarios de aceptación**:

1. **Dado** órdenes en distintos estados, **Cuando** se abre el panel, **Entonces** muestra cuántas órdenes hay en cada estado abierto (recibida, diagnóstico, en reparación, esperando refacción), cuántas están terminadas sin entregar y cuántas se entregaron hoy.
2. **Dado** citas registradas, **Cuando** se abre el panel, **Entonces** muestra las citas de hoy y las de los próximos 7 días (pendientes y confirmadas), con la siguiente cita visible.
3. **Dado** mantenimientos programados, **Cuando** se abre el panel, **Entonces** muestra cuántos están vencidos y cuántos próximos, con los mismos criterios y umbrales del módulo de mantenimientos.
4. **Dado** refacciones en alerta, **Cuando** se abre el panel, **Entonces** muestra cuántas están con stock bajo y cuántas agotadas, con las más críticas a la vista.
5. **Dado** pagos registrados, **Cuando** se abre el panel, **Entonces** muestra lo cobrado hoy (pagos aprobados), cuánto saldo está pendiente en órdenes terminadas o entregadas y cuántas órdenes están por cobrar.
6. **Dado** cualquier indicador del panel, **Cuando** el administrador lo selecciona, **Entonces** lo lleva al módulo correspondiente (órdenes, citas, mantenimientos, inventario o pagos) para ver el detalle.
7. **Dado** que no hay datos en alguna sección, **Cuando** se muestra el panel, **Entonces** esa sección indica claramente que no hay elementos en lugar de mostrar espacios vacíos o ceros ambiguos.

---

### Casos límite

- Dos recepcionistas registran a la vez el pago final de la misma orden: solo se acepta el que cabe en el saldo; el otro recibe un aviso de saldo insuficiente y la orden nunca queda con más pagado que su total.
- Se registra un pago en efectivo con un importe en centavos (por ejemplo, 1 234.50): se conserva exacto, sin redondeos que cambien el saldo.
- Una orden terminada sin pagos se entrega: puede entregarse con saldo pendiente (el cobro es independiente de la entrega) tras un aviso con el saldo y una confirmación; el panel y el ticket la muestran como "Sin pagar".
- Se intenta cambiar el total de una orden ya terminada: no es posible, porque sus servicios, mano de obra y refacciones se bloquean al terminarla; por eso el saldo de una orden cobrable solo cambia con los pagos.
- Un cobro de Mercado Pago queda pendiente mucho tiempo: sigue visible como "Pendiente", no cuenta como cobrado y puede cancelarse.
- Mercado Pago informa dos veces el mismo pago aprobado: el cobro se aprueba una sola vez y el saldo no se descuenta dos veces.
- Se intenta aprobar a mano un cobro de Mercado Pago pendiente: el sistema no lo permite; el estado solo cambia con lo que informa Mercado Pago.
- Se anula un pago aprobado por error: el pago se conserva como "Anulado" con su motivo y quién lo anuló, el saldo de la orden se recupera y la anulación solo la puede hacer un administrador. La devolución del dinero se hace fuera del sistema.
- Un ticket se imprime sin conexión con la API: la vista ya cargada permite imprimirse; no se generan archivos en el servidor.
- El panel de control se abre con un taller sin movimiento: cada sección muestra su mensaje de vacío.
- Datos del taller (nombre, dirección, teléfono) sin configurar: el ticket usa valores predeterminados de Motorix y nunca sale con campos vacíos.

## Aclaraciones

### Sesión 2026-10-14

- Q: ¿Un cobro de Mercado Pago pendiente reserva saldo, y puede haber varios a la vez en una orden? → A: Sí reserva: el saldo disponible para nuevos pagos es el total menos lo aprobado y lo pendiente, y solo puede haber un cobro de Mercado Pago pendiente por orden; cancelarlo o que sea rechazado libera su importe.
- Q: ¿El importe de un cobro de Mercado Pago es siempre el saldo completo? → A: No; por omisión es el saldo disponible, pero la recepcionista puede indicar un importe menor (abono), nunca mayor al saldo disponible.
- Q: ¿Qué pasa al entregar una orden con saldo pendiente? → A: Se permite, pero la aplicación muestra un aviso con el saldo pendiente y pide confirmar la entrega; el ticket y el panel la muestran como por cobrar.
- Q (decisiones del insumo): ticket como comprobante generado por la aplicación que se ve e imprime sin guardar archivos, Mercado Pago con enlace de pago en sandbox y estado actualizado a mano, panel solo para administradores con la situación actual y del día, y reembolsos como anulación con motivo → A: se confirman los supuestos documentados.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Pagos**

- **FR-001**: El sistema DEBE permitir registrar pagos de una orden en estado "TERMINADO" o "ENTREGADO", y rechazar pagos de órdenes en cualquier otro estado.
- **FR-002**: Todo pago DEBE estar asociado a una orden; no existen pagos sueltos (RN-13).
- **FR-003**: El sistema DEBE permitir pagos parciales y rechazar un importe menor o igual a cero, o mayor al saldo pendiente de la orden.
- **FR-004**: El sistema DEBE calcular para cada orden el total a cobrar (servicios, mano de obra y refacciones), lo pagado (suma de pagos aprobados), el saldo pendiente y el estado de pago: "Sin pagar", "Pago parcial" o "Pagada".
- **FR-005**: El sistema DEBE soportar los métodos de pago efectivo, tarjeta, transferencia y Mercado Pago, y rechazar cualquier otro.
- **FR-006**: Los pagos en efectivo, tarjeta y transferencia DEBEN quedar "Aprobados" al registrarse. El pago en efectivo DEBE poder mostrar el cambio calculado con el importe recibido, sin guardarlo.
- **FR-007**: Un pago con tarjeta o transferencia DEBE admitir una referencia opcional informativa (autorización u operación). El sistema NO DEBE solicitar, recibir ni guardar números de tarjeta, vencimientos, códigos de seguridad ni credenciales de pago (RN-14).
- **FR-008**: Cada pago DEBE conservar su orden, método, importe, estado, referencia, usuario que lo registró y fecha y hora.
- **FR-009**: Los pagos NO DEBEN eliminarse. Un pago aprobado puede anularse solo por un administrador, con motivo obligatorio; queda como "Anulado", se conserva en el historial y su importe deja de contar como pagado. Un pago pendiente puede cancelarse por recepción o administración.
- **FR-010**: El sistema DEBE evitar que, con registros simultáneos, el total pagado de una orden supere su total. Los cobros pendientes de Mercado Pago reservan su importe: el saldo disponible para nuevos pagos es el total menos lo aprobado y lo pendiente.
- **FR-011**: El sistema DEBE permitir consultar los pagos de una orden y un listado de pagos con filtros por estado, método, fecha y búsqueda por folio de orden, cliente o placa.

**Mercado Pago**

- **FR-012**: El sistema DEBE permitir crear un cobro con Mercado Pago en modo de pruebas (sandbox) para una orden con saldo disponible: se registra un pago "Pendiente" con referencia única y se obtiene un enlace de pago. El importe es por omisión el saldo disponible y puede ser menor, nunca mayor; solo puede haber un cobro de Mercado Pago pendiente por orden.
- **FR-013**: El sistema DEBE permitir actualizar el estado de un cobro de Mercado Pago consultando a Mercado Pago, y reflejar los estados "Aprobado", "Rechazado" y "Pendiente". Un cobro aprobado solo cuenta una vez, aunque se actualice repetidamente.
- **FR-014**: Las credenciales de Mercado Pago DEBEN manejarse únicamente con variables de entorno; nunca se guardan en el repositorio, en la base de datos ni se muestran en la interfaz. La integración DEBE estar aislada del resto del dominio.
- **FR-015**: Si Mercado Pago no está configurado o no responde, el sistema DEBE mostrar un mensaje claro sin registrar un pago y permitir seguir cobrando con los demás métodos.
- **FR-016**: Solo el estado informado por Mercado Pago DEBE poder aprobar o rechazar un cobro de Mercado Pago; no se aprueba manualmente.

**Tickets**

- **FR-017**: El sistema DEBE permitir generar el ticket de una orden terminada o entregada, con un folio propio, y reutilizar el mismo ticket si ya existe para esa orden.
- **FR-018**: El ticket DEBE incluir: folio del ticket y de la orden, datos del taller, cliente, vehículo, placas, kilometraje, servicios, refacciones, mano de obra, subtotales, total, método(s) de pago, estado del pago y fecha.
- **FR-019**: El ticket DEBE poder visualizarse en pantalla con formato de comprobante y enviarse a imprimir; no requiere guardar archivos en el servidor.
- **FR-020**: El contenido de la orden en el ticket DEBE coincidir con la orden; la información de pago DEBE mostrarse con el estado vigente al consultarlo.
- **FR-021**: Los datos del taller que aparecen en el ticket (nombre, dirección, teléfono) DEBEN ser configurables y tener valores predeterminados para que ningún campo salga vacío.
- **FR-022**: Se DEBE conservar quién generó cada ticket y cuándo.

**Panel de control**

- **FR-023**: El sistema DEBE ofrecer a los administradores un panel de control, que es su pantalla de inicio, con la fecha y hora de la última actualización y la opción de actualizar.
- **FR-024**: El panel DEBE mostrar, con datos reales y sin duplicar información: órdenes por estado y entregadas hoy; citas de hoy y de los próximos 7 días; mantenimientos vencidos y próximos; refacciones con stock bajo y agotadas; cobrado hoy, saldo pendiente y órdenes por cobrar.
- **FR-025**: Los indicadores del panel DEBEN usar los mismos criterios que los módulos de origen (por ejemplo, los umbrales de mantenimiento y de stock) y DEBEN llevar al módulo correspondiente al seleccionarlos.
- **FR-026**: El panel DEBE mostrar un mensaje de vacío claro por sección sin datos y un mensaje de error con reintento si falla la carga.
- **FR-027**: El panel NO DEBE incluir reportes avanzados ni analítica histórica.

**Permisos, seguridad y datos de ejemplo**

- **FR-028**: El sistema DEBE validar todos los permisos en el servidor: pagos y tickets para recepción y administración (la anulación de pagos aprobados, solo administración); el panel de control, solo administración; el mecánico no accede a pagos, tickets ni panel.
- **FR-029**: Las acciones DEBEN confirmarse cuando sean irreversibles o delicadas: anular un pago, cancelar un cobro pendiente, entregar una orden con saldo pendiente (mostrando el saldo) y abandonar un formulario con cambios.
- **FR-030**: Tras la instalación, la base DEBE incluir pagos y tickets de ejemplo (órdenes sin pagar, con pago parcial y pagadas, con distintos métodos) para que el panel y los listados muestren información; los datos de ejemplo DEBEN cargarse varias veces sin duplicar registros.
- **FR-031**: Todas las pantallas nuevas DEBEN seguir el sistema de diseño del proyecto y mostrar mensajes de error, vacío y confirmación en español.
- **FR-032**: La lógica de pagos y de generación de tickets DEBE contar con pruebas automatizadas que se ejecuten contra la base de datos de pruebas y, para Mercado Pago, contra un servicio simulado, nunca contra cuentas reales.

### Entidades clave

- **Pago**: Cobro de una orden. Tiene orden, método (efectivo, tarjeta, transferencia o Mercado Pago), importe, estado (pendiente, aprobado, rechazado, cancelado o anulado), referencia informativa o referencia externa del proveedor, motivo de anulación si aplica, usuario que lo registró y fechas.
- **Ticket**: Comprobante de servicio de una orden. Tiene folio propio, orden, usuario que lo generó y fecha; su contenido se arma a partir de la orden, el cliente, el vehículo, sus líneas de trabajo y los pagos vigentes.
- **Estado de pago de la orden** (derivado): "Sin pagar", "Pago parcial" o "Pagada", calculado de los pagos aprobados y el total; no se guarda.
- **Indicadores del panel** (derivados): Conteos e importes calculados al consultar a partir de órdenes, citas, mantenimientos, inventario y pagos; no se guardan.
- **Orden de servicio, Cliente, Vehículo, Refacción, Mantenimiento y Usuario** (existentes): Se consultan; la orden se extiende con su resumen de pago.

## Criterios de éxito *(obligatorio)*

### Medidas verificables

- **SC-001**: Una recepcionista registra el pago de una orden en menos de 1 minuto.
- **SC-002**: El 100 % de los pagos registrados está asociado a una orden y ninguna orden queda con más pagado que su total, incluso con registros simultáneos.
- **SC-003**: Una recepcionista genera y abre el ticket de una orden en menos de 30 segundos y lo manda a imprimir en un paso más.
- **SC-004**: El 100 % de los tickets contiene los datos requeridos (folio, taller, cliente, vehículo, placas, kilometraje, servicios, refacciones, mano de obra, subtotales, total, método de pago, estado del pago y fecha).
- **SC-005**: Un cobro de Mercado Pago de pruebas se completa de punta a punta (generar, pagar con cuenta de prueba, consultar el estado y ver el saldo actualizado) en menos de 3 minutos, y en ningún momento se guardan datos de tarjeta ni credenciales en la aplicación.
- **SC-006**: El administrador ve el panel de control completo en menos de 3 segundos, con indicadores que coinciden al 100 % con los listados de los módulos de origen.
- **SC-007**: Con 1 000 órdenes, 1 000 citas y 5 000 refacciones, el panel y los listados de pagos responden en menos de 2 segundos.
- **SC-008**: El flujo completo (orden terminada, consultar total, registrar pago, cobrar con Mercado Pago, generar ticket y consultar el panel) puede demostrarse de principio a fin con los datos de ejemplo.
- **SC-009**: Un usuario sin permiso nunca obtiene datos de pagos, tickets o panel: el 100 % de los intentos se rechaza.

## Supuestos

- Se parte de los Sprint 1, 2 y 3 terminados: clientes, vehículos, citas, órdenes con sus servicios, mano de obra y refacciones, mantenimientos, inventario y los tres roles. El total de una orden incluye servicios, mano de obra y refacciones.
- **Momento del cobro**: se cobra una orden "TERMINADO" o "ENTREGADO"; el cobro es independiente de la entrega (la entrega no exige pago completo). La decisión de exigir el pago para entregar queda fuera de este sprint.
- **Pagos parciales**: se permiten abonos hasta cubrir el total. Los importes se manejan en pesos mexicanos con dos decimales; no hay impuestos desglosados ni facturación electrónica.
- **Mercado Pago** (decisión pendiente de `/speckit-clarify`): se usa el enlace de pago (checkout) del entorno de pruebas y la recepcionista actualiza el estado desde la aplicación, porque el MVP corre en una máquina local sin dirección pública para recibir notificaciones automáticas. No se manejan reembolsos desde Mercado Pago.
- **Tickets** (decisión pendiente): el ticket es un comprobante generado por la aplicación que se ve en pantalla y se imprime con el diálogo de impresión del sistema; no se guardan archivos PDF en el servidor. Un solo ticket por orden, con folio propio.
- **Panel de control** (decisión pendiente): muestra la situación actual y la del día (hoy y próximos 7 días); no incluye históricos ni gráficas de tendencias. Es solo para administradores.
- **Reembolsos y cancelaciones** (decisión pendiente): los pagos no se eliminan; los pendientes se cancelan y los aprobados los anula un administrador con motivo. La devolución del dinero ocurre fuera del sistema.
- Los datos del taller del ticket (nombre, dirección y teléfono) se configuran en la base de datos, igual que los umbrales de mantenimiento, con valores predeterminados.
- Fuera de alcance: chatbot de WhatsApp, facturación electrónica, envío automático de correos o mensajes al cliente, reportes avanzados o analítica histórica y aplicación móvil nativa.
- La actualización de `docs/project-context.md` con las decisiones de este sprint requiere aprobación del equipo, como en los sprints anteriores.
