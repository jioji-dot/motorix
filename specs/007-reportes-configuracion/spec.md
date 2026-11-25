# Especificación de la funcionalidad: Reportes y configuración

**Rama de la funcionalidad**: `007-reportes-configuracion`

**Creado**: 2026-11-25

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Especificar el Sprint 7, el último del proyecto, a partir de `docs/sprints/sprint-7-reportes-configuracion.md` (corregido el 2026-11-25 tras revisar el código), con sus 10 historias de usuario, sus 26 criterios de aceptación y sus decisiones abiertas".

> Nota de contexto (hallazgos H-02 a H-08 del aseguramiento de la calidad): hoy el administrador no puede cambiar desde la aplicación los datos del taller del ticket (viven en `.env`) ni los márgenes de «Próximo» (constantes de 15 días y 500 km); el ticket se arma al consultarlo, sin instantánea; no hay catálogo de tipos de servicio, reportes, términos y condiciones ni bitácora; la sesión solo expira a las 8 horas del token; no existe `helmet`. Sí existen la política de contraseñas, el bloqueo por intentos fallidos y los permisos por rol en el servidor, que este sprint complementa.

## Aclaraciones

### Sesión 2026-11-25

- Q: ¿En qué formato se exportan los reportes? → A: CSV (UTF-8 con BOM, para que Excel lo abra con acentos), descargado mediante un enlace de corta vida, igual que el ticket imprimible; sin dependencias nuevas. Las celdas que empiezan con `=`, `+`, `-` o `@` se neutralizan para evitar fórmulas.
- Q: ¿Qué se entrega primero si el tiempo no alcanza? → A: Primero configuración, catálogo, ticket, términos y seguridad (entrega 7A) y después los reportes (7B).
- Q: ¿Los datos del taller se guardan en cada ticket emitido? → A: Sí: al generar el ticket se guardan nombre, dirección, teléfono y próximo servicio; un cambio posterior de la configuración no altera los tickets nuevos ya emitidos. Los tickets generados antes de este sprint no tienen instantánea y siguen armándose con los datos vigentes.
- Q: ¿Cómo se enlaza el tipo de servicio con las líneas de las órdenes? → A: Con una referencia opcional del servicio de la orden al tipo; las líneas existentes quedan sin tipo y siguen funcionando; un tipo desactivado sigue visible en las líneas que ya lo usan.
- Q: ¿Cómo se calcula el margen si la refacción no tiene precio de compra? → A: Con precio de compra 0 se muestra «sin costo» y esa refacción no entra en el margen total; el costo es el precio de compra vigente de la refacción.
- Q: ¿Qué periodos tienen los reportes? → A: Un rango libre de fechas (desde y hasta, inclusivos) de hasta 366 días, con atajos de mes en la pantalla; el corte es la fecha local del servidor.
- Q: ¿Cómo se define la productividad por mecánico? → A: Órdenes terminadas o entregadas en el periodo (por la fecha en que quedaron Terminadas) y el importe de su mano de obra.
- Q: ¿Cómo se define la rotación de inventario? → A: Unidades que salieron en el periodo (salidas ligadas a órdenes) entre la existencia actual de la refacción; con existencia 0 se muestra «sin existencia».
- Q: ¿Recepción ve reportes? → A: No: configuración y reportes son exclusivos del administrador (403 para los demás roles).
- Q: ¿Cómo se publican los términos y condiciones? → A: La versión 1 viene de los datos de ejemplo (plantilla en español que el taller debe revisar con quien corresponda); el administrador publica versiones nuevas desde la aplicación; se acepta una sola vez por versión y los usuarios existentes aceptan en su siguiente ingreso.
- Q: ¿Qué se registra en la bitácora y cuánto se conserva? → A: Inicios de sesión fallidos y bloqueos, altas, bajas, reactivaciones y cambios de rol de usuarios, cambios de configuración, de precios de refacciones y del catálogo de servicios, pagos cancelados y publicación de términos; se conserva sin borrado, se consulta paginada, solo de lectura y sin exportación.
- Q: ¿Qué política de contraseñas se aplica? → A: La que ya existe (8 caracteres o más con mayúscula, minúscula y número); se documenta y se prueba, y no se obliga a cambiar la contraseña de los usuarios sembrados.
- Q: ¿Cuál es el tiempo de inactividad? → A: 30 minutos para todos los roles; el servidor rechaza la sesión inactiva y la aplicación la cierra por su cuenta.
- Q: ¿Qué límites tienen los márgenes de «Próximo»? → A: De 1 a 365 días y de 1 a 100,000 km; por omisión, los de hoy (15 días y 500 km).

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Editar los datos del taller que salen en el ticket (Prioridad: P1)

Como administrador, quiero editar el nombre, la dirección y el teléfono del taller para que el ticket muestre datos correctos sin tocar el servidor.

**Por qué esta prioridad**: Es la deuda más visible del ticket y la base de la pantalla de configuración.

**Prueba independiente**: El administrador cambia el nombre y el teléfono, genera un ticket de una orden nueva y ve los datos actualizados; un ticket generado antes del cambio conserva los suyos.

**Escenarios de aceptación**:

1. **Dado** un administrador en Configuración, **Cuando** guarda un nombre, una dirección y un teléfono válidos, **Entonces** el sistema confirma el cambio y lo registra en la bitácora.
2. **Dado** un ticket ya generado, **Cuando** el administrador cambia los datos del taller, **Entonces** ese ticket sigue mostrando los datos con los que se generó.
3. **Dado** una orden sin ticket, **Cuando** se genera después del cambio, **Entonces** el ticket muestra los datos nuevos.
4. **Dado** que no hay datos guardados, **Cuando** se genera un ticket, **Entonces** usa los de `.env` o, si tampoco existen, los predeterminados.
5. **Dado** un usuario de recepción o mecánico, **Cuando** intenta leer o cambiar la configuración, **Entonces** el servidor responde 403.

---

### Historia de usuario 2 - Ajustar los márgenes de «Próximo» (Prioridad: P2)

Como administrador, quiero ajustar los días y los kilómetros que hacen «Próximo» a un mantenimiento para adaptarlos a la operación del taller.

**Por qué esta prioridad**: Hoy es una constante; cambiarla exige modificar el código.

**Prueba independiente**: El administrador cambia los días de 15 a 30 y un mantenimiento a 25 días pasa de Normal a Próximo en Mantenimientos, en el panel de control y en los avisos.

**Escenarios de aceptación**:

1. **Dado** márgenes válidos, **Cuando** el administrador los guarda, **Entonces** la lista de Mantenimientos, el panel de control y los avisos usan los nuevos valores en la siguiente consulta.
2. **Dado** un valor fuera de los límites (0 o más de 365 días; 0 o más de 100,000 km), **Cuando** se guarda, **Entonces** se rechaza con un mensaje claro y no cambia nada.
3. **Dado** que nunca se configuró, **Cuando** se clasifica un mantenimiento, **Entonces** se usan 15 días y 500 km.

---

### Historia de usuario 3 - Catálogo de tipos de servicio con intervalos (Prioridad: P2)

Como administrador, quiero mantener un catálogo de tipos de servicio con su intervalo en días y en kilómetros para que el próximo mantenimiento se proponga sin asumir intervalos universales.

**Por qué esta prioridad**: Habilita la propuesta del próximo mantenimiento y el próximo servicio del ticket.

**Prueba independiente**: El administrador crea «Cambio de aceite» con 180 días y 5,000 km, lo enlaza a un servicio de una orden y, al registrar el próximo mantenimiento de esa orden, la fecha y el kilometraje se proponen y se pueden corregir.

**Escenarios de aceptación**:

1. **Dado** un tipo nuevo con nombre único y al menos un intervalo, **Cuando** el administrador lo guarda, **Entonces** aparece en el catálogo y se puede elegir en las líneas de servicio.
2. **Dado** un tipo ya usado en órdenes, **Cuando** el administrador lo desactiva, **Entonces** deja de ofrecerse para líneas nuevas pero las líneas existentes lo siguen mostrando; nunca se borra.
3. **Dado** una orden con servicios de tipos con intervalo, **Cuando** se pide la propuesta del próximo mantenimiento, **Entonces** la fecha es hoy más los días del intervalo y el kilometraje es el del servicio (o el de entrada) más los kilómetros del intervalo; el usuario puede corregirlos antes de guardar.
4. **Dado** un nombre repetido (sin distinguir mayúsculas), **Cuando** se intenta guardar, **Entonces** se rechaza.

---

### Historia de usuario 4 - Ingresos por periodo (Prioridad: P1)

Como administrador, quiero consultar los ingresos por periodo para conocer cómo avanza el taller.

**Por qué esta prioridad**: Es el reporte de mayor valor para quien dirige el taller.

**Prueba independiente**: Con pagos en tres días distintos, el administrador elige el mes y ve el total cobrado, el desglose por método y por día, y los importes coinciden con los pagos que los originan.

**Escenarios de aceptación**:

1. **Dado** un rango de fechas válido, **Cuando** el administrador abre el reporte de ingresos, **Entonces** ve el total de los pagos Pagados cuyo cobro cae en el rango, desglosado por método y por día o por mes.
2. **Dado** pagos Pendientes, Rechazados o Cancelados, **Cuando** se calcula el reporte, **Entonces** no se cuentan.
3. **Dado** un rango de más de 366 días o con la fecha inicial posterior a la final, **Cuando** se consulta, **Entonces** se rechaza con un mensaje claro.
4. **Dado** un rango sin pagos, **Cuando** se consulta, **Entonces** muestra ceros y un estado vacío, sin errores.

---

### Historia de usuario 5 - Servicios frecuentes y productividad por mecánico (Prioridad: P2)

Como administrador, quiero ver los servicios más frecuentes y la productividad por mecánico para tomar decisiones de operación.

**Por qué esta prioridad**: Orienta qué ofrecer y cómo repartir el trabajo.

**Prueba independiente**: Con órdenes terminadas de dos mecánicos, el reporte muestra por cada uno cuántas órdenes terminó y el importe de su mano de obra, y lista los servicios por número de veces realizados.

**Escenarios de aceptación**:

1. **Dado** órdenes Terminadas o Entregadas en el rango, **Cuando** se abre servicios frecuentes, **Entonces** se listan por tipo de servicio (o por descripción si la línea no tiene tipo) con cantidad e importe, de mayor a menor.
2. **Dado** el mismo rango, **Cuando** se abre productividad, **Entonces** cada mecánico muestra sus órdenes terminadas y el importe de mano de obra, y la suma coincide con las órdenes de origen.
3. **Dado** órdenes Canceladas o en curso, **Cuando** se calcula, **Entonces** no se cuentan.

---

### Historia de usuario 6 - Margen de refacciones y rotación de inventario (Prioridad: P2)

Como administrador, quiero ver el costo, el precio y el margen de las refacciones usadas y la rotación del inventario para controlar la rentabilidad.

**Por qué esta prioridad**: El Sprint 5 dejó fuera el costo y el margen.

**Prueba independiente**: Con refacciones usadas en órdenes del periodo, el reporte muestra por refacción las unidades, el costo, la venta y el margen, y marca «sin costo» la que tiene precio de compra 0.

**Escenarios de aceptación**:

1. **Dado** refacciones usadas en órdenes Terminadas o Entregadas del rango, **Cuando** se abre el reporte, **Entonces** se muestran unidades, costo (precio de compra vigente por unidades), venta (el precio guardado en cada línea) y margen.
2. **Dado** una refacción con precio de compra 0, **Cuando** se calcula, **Entonces** se marca «sin costo» y no entra en el margen total.
3. **Dado** el mismo rango, **Cuando** se consulta la rotación, **Entonces** cada refacción con salidas muestra las unidades salidas y la rotación contra su existencia actual; con existencia 0 se muestra «sin existencia».
4. **Dado** un usuario que no es administrador, **Cuando** pide el reporte, **Entonces** el servidor responde 403 y no se expone ningún precio de compra.

---

### Historia de usuario 7 - Exportar cada reporte (Prioridad: P2)

Como administrador, quiero exportar cada reporte para compartirlo o archivarlo.

**Por qué esta prioridad**: Un reporte que no se puede compartir pierde la mitad de su valor.

**Prueba independiente**: El administrador exporta el reporte de ingresos y el archivo CSV trae las mismas filas y totales que la pantalla.

**Escenarios de aceptación**:

1. **Dado** un reporte en pantalla, **Cuando** el administrador pulsa Exportar, **Entonces** se descarga un CSV (UTF-8 con BOM) con el mismo contenido y rango.
2. **Dado** el enlace de descarga, **Cuando** pasan 60 segundos o se usa con otro reporte, **Entonces** deja de funcionar.
3. **Dado** una descripción que empieza con `=`, `+`, `-` o `@`, **Cuando** se exporta, **Entonces** la celda se neutraliza para que no se interprete como fórmula.

---

### Historia de usuario 8 - El ticket indica el próximo servicio (Prioridad: P2)

Como cliente, quiero que mi ticket indique cuándo toca mi próximo servicio para recordarlo sin que nadie me escriba.

**Por qué esta prioridad**: Sustituye a los mensajes al cliente, que quedaron fuera del alcance del proyecto.

**Prueba independiente**: Se genera el ticket de una orden con un servicio de tipo «Cambio de aceite» (180 días y 5,000 km) y muestra «Próximo servicio» con la fecha y el kilometraje; una orden sin tipos con intervalo no lo muestra.

**Escenarios de aceptación**:

1. **Dado** una orden con servicios de tipos con intervalo, **Cuando** se genera el ticket, **Entonces** muestra «Próximo servicio» con el más cercano (fecha, kilometraje o ambos) y lo guarda en el ticket.
2. **Dado** una orden sin tipos con intervalo, **Cuando** se genera el ticket, **Entonces** no muestra esa línea.
3. **Dado** un ticket ya generado, **Cuando** se cambia el catálogo, **Entonces** el ticket no cambia.

---

### Historia de usuario 9 - Aceptar los términos y condiciones (Prioridad: P1)

Como usuario del taller, quiero leer y aceptar los términos y condiciones y el aviso de privacidad al ingresar para conocer las reglas de uso y cómo se protege la información de los clientes.

**Por qué esta prioridad**: Es una obligación de protección de datos y debe cumplirse en el servidor, no solo en la pantalla.

**Prueba independiente**: Un usuario que no ha aceptado la versión vigente inicia sesión y ve la pantalla de aceptación; si rechaza, se cierra la sesión; si acepta, entra y no se le vuelve a pedir hasta que se publique una versión nueva.

**Escenarios de aceptación**:

1. **Dado** una versión vigente que el usuario no ha aceptado, **Cuando** inicia sesión, **Entonces** ve los términos y el aviso de privacidad antes de usar el sistema.
2. **Dado** esa pantalla, **Cuando** rechaza, **Entonces** se cierra la sesión y no accede.
3. **Dado** esa pantalla, **Cuando** acepta, **Entonces** queda guardado el usuario, la versión y la fecha, y entra.
4. **Dado** un usuario sin aceptación vigente, **Cuando** llama directamente a cualquier ruta de la API (salvo ver los términos, aceptarlos y cerrar sesión), **Entonces** el servidor responde 403 `TERMS_NOT_ACCEPTED`.
5. **Dado** que el administrador publica una versión nueva, **Cuando** un usuario inicia sesión o sigue con su sesión abierta, **Entonces** se le pide aceptar la nueva versión.
6. **Dado** que no hay ninguna versión publicada, **Cuando** un usuario usa el sistema, **Entonces** no se le exige aceptar nada.

---

### Historia de usuario 10 - Seguridad de la información (Prioridad: P1)

Como administrador, quiero que la información del sistema esté protegida (bitácora de acciones sensibles, política de contraseñas, cierre de sesión por inactividad, encabezados de seguridad y respuestas sin datos reservados) para detectar usos indebidos y proteger los datos del taller y de sus clientes.

**Por qué esta prioridad**: El sistema maneja datos personales de clientes y datos financieros del taller.

**Prueba independiente**: El administrador cambia el rol de un usuario y la bitácora muestra quién, qué y cuándo, sin contraseñas; una sesión inactiva por más de 30 minutos es rechazada; ninguna respuesta de la API incluye el hash de contraseña ni precios reservados al rol.

**Escenarios de aceptación**:

1. **Dado** una acción sensible (alta, baja o cambio de rol de un usuario, cambio de configuración, precio de refacción o catálogo, pago cancelado, inicio de sesión fallido o bloqueo, publicación de términos), **Cuando** ocurre, **Entonces** queda en la bitácora con usuario, acción, entidad y fecha.
2. **Dado** la bitácora, **Cuando** el administrador la consulta con filtros por fecha, usuario y acción, **Entonces** la ve paginada, sin poder editarla ni borrarla.
3. **Dado** cualquier entrada de la bitácora, **Cuando** se revisa, **Entonces** no contiene contraseñas, hashes, tokens ni datos de tarjeta.
4. **Dado** una contraseña que no cumple la política, **Cuando** se crea o cambia, **Entonces** se rechaza con un mensaje claro.
5. **Dado** una sesión sin actividad por más de 30 minutos, **Cuando** se hace una petición, **Entonces** el servidor responde 401 `SESSION_INACTIVE` y la aplicación pide iniciar sesión de nuevo.
6. **Dado** cualquier respuesta de usuarios, refacciones, órdenes, pagos y tickets, **Cuando** se revisa, **Entonces** no incluye el hash, el token ni los precios reservados al rol.
7. **Dado** un texto de inyección en un campo de búsqueda, **Cuando** se consulta, **Entonces** se trata como texto literal y no altera la consulta.

---

### Casos límite

- Un administrador cambia los márgenes mientras otros usuarios consultan: cada consulta usa los valores vigentes en ese momento.
- Un ticket cuyo próximo servicio solo tiene fecha o solo kilometraje: muestra el dato disponible.
- Una orden con varios servicios con intervalo: el ticket muestra el más cercano por fecha; si solo hay kilometraje, el menor.
- Un tipo de servicio desactivado que sigue en líneas antiguas: se muestra en la orden y en los reportes, pero no se ofrece para líneas nuevas.
- Dos administradores publican términos casi al mismo tiempo: cada versión recibe un número consecutivo distinto y la vigente es la mayor.
- Un usuario con la sesión abierta cuando se publica una versión nueva: la siguiente petición responde 403 `TERMS_NOT_ACCEPTED` y la aplicación muestra la pantalla de aceptación.
- Rango de reportes con un solo día: es válido (desde igual a hasta).
- Una orden Terminada y luego Entregada cuenta una sola vez, con la fecha en que quedó Terminada.
- Dos reportes de ingresos del mismo rango siempre suman lo mismo, agrupados por día o por mes.
- Reporte con importes muy grandes: se calcula en centavos enteros, sin pérdida de precisión.
- Inactividad exactamente de 30 minutos: sigue vigente; con más de 30 minutos se rechaza. La consulta automática de avisos de la aplicación no cuenta como actividad.
- Cliente o vehículo desactivados: sus órdenes siguen contando en los reportes (son historial).

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Configuración del taller**

- **FR-001** (agrega): El administrador DEBE poder editar desde la aplicación el nombre (obligatorio, hasta 120 caracteres), la dirección (hasta 200) y el teléfono (hasta 30) del taller. Configuración es exclusiva de ADMIN, validado en el servidor (403 para los demás roles).
- **FR-002** (agrega): El ticket DEBE guardar, al generarse, el nombre, la dirección y el teléfono del taller y el próximo servicio; un cambio posterior no altera tickets ya generados. Los tickets generados antes de este sprint, sin instantánea, DEBEN seguir armándose con los datos vigentes.
- **FR-003** (agrega): El administrador DEBE poder editar los márgenes de «Próximo» en días (1 a 365) y en kilómetros (1 a 100,000); la lista de Mantenimientos, el panel de control y los avisos DEBEN usar los valores vigentes en cada consulta.
- **FR-004** (mantiene): Sin valores guardados, el sistema DEBE usar los datos del taller de `.env` (o los predeterminados) y los márgenes de 15 días y 500 km, de modo que una instalación existente siga funcionando sin configurar nada.

**Catálogo de tipos de servicio y próximo servicio**

- **FR-005** (agrega): El administrador DEBE poder crear, editar y desactivar tipos de servicio con nombre único (sin distinguir mayúsculas, hasta 100 caracteres), intervalo en días (1 a 3650), intervalo en kilómetros (1 a 1,000,000) y al menos uno de los dos. Un tipo nunca se borra.
- **FR-006** (agrega): Una línea de servicio de una orden PUEDE enlazarse a un tipo activo; las líneas existentes quedan sin tipo; un tipo desactivado sigue visible en las líneas que ya lo usan. El catálogo es de lectura para recepción y mecánico (para elegir el tipo) y de escritura solo para el administrador.
- **FR-007** (agrega): Para una orden con servicios de tipos con intervalo, el sistema DEBE proponer el próximo mantenimiento: fecha igual a hoy más los días del intervalo y kilometraje igual al del servicio (o al de entrada) más los kilómetros del intervalo; el usuario puede corregir la propuesta antes de guardar.
- **FR-008** (agrega): El ticket nuevo DEBE mostrar «Próximo servicio» con el más cercano (fecha, kilometraje o ambos) cuando la orden tiene un tipo con intervalo, y no mostrarlo cuando no lo tiene.

**Reportes**

- **FR-009** (agrega): El sistema DEBE ofrecer el reporte de ingresos por periodo: total de los pagos Pagados con fecha de cobro dentro del rango, desglosado por método y por día o por mes (a elección, por día de forma predeterminada).
- **FR-010** (agrega): El sistema DEBE ofrecer el reporte de servicios más frecuentes: por tipo de servicio (o por descripción si la línea no tiene tipo), con cantidad e importe, de las órdenes Terminadas o Entregadas cuya fecha de término cae en el rango (la fecha en que quedaron Terminadas, según su historial de estados).
- **FR-011** (agrega): El sistema DEBE ofrecer el reporte de productividad por mecánico: órdenes Terminadas o Entregadas con fecha de término en el rango e importe de su mano de obra, por el mecánico asignado a la orden.
- **FR-012** (agrega): El sistema DEBE ofrecer el reporte de refacciones con unidades, costo (precio de compra vigente), venta (precio guardado en la línea) y margen; con precio de compra 0 muestra «sin costo» y no entra en el margen total.
- **FR-013** (agrega): El sistema DEBE ofrecer el reporte de rotación de inventario: unidades salidas por órdenes en el rango entre la existencia actual; con existencia 0, «sin existencia».
- **FR-014** (agrega): Los reportes DEBEN aceptar un rango de fechas inclusivo de hasta 366 días (con la fecha inicial no posterior a la final), calcularse con la fecha local del servidor y rechazar los rangos inválidos con un mensaje claro.
- **FR-015** (agrega): Los importes de los reportes DEBEN calcularse en centavos enteros y coincidir con los pagos, órdenes y movimientos que los originan; los reportes no guardan copias de los datos.
- **FR-016** (agrega): Cada reporte DEBE poder exportarse a CSV (UTF-8 con BOM) con el mismo contenido y rango que la pantalla, mediante un enlace que dura 60 segundos y solo sirve para ese reporte; las celdas que empiezan con `=`, `+`, `-` o `@` DEBEN neutralizarse.
- **FR-017** (agrega): Los reportes y la exportación DEBEN ser exclusivos del administrador, validado en el servidor; el precio de compra solo aparece en los reportes, que son de ADMIN.

**Términos y condiciones**

- **FR-018** (agrega): El sistema DEBE guardar versiones de los términos y condiciones y del aviso de privacidad (número de versión consecutivo, textos, quién y cuándo la publicó); la vigente es la de mayor número.
- **FR-019** (agrega): Un usuario sin aceptación de la versión vigente DEBE ver la pantalla de aceptación antes de usar el sistema; si rechaza, se cierra su sesión.
- **FR-020** (agrega): La aceptación DEBE guardar usuario, versión y fecha, una sola vez por usuario y versión.
- **FR-021** (agrega): El servidor DEBE rechazar con 403 `TERMS_NOT_ACCEPTED` cualquier operación de un usuario sin aceptación vigente, salvo ver los términos, aceptarlos, consultar la propia sesión y cerrar sesión; si no hay versión publicada, no se exige nada.
- **FR-022** (agrega): El administrador DEBE poder publicar una versión nueva y consultar la vigente y quién la aceptó y quién no.
- **FR-023** (agrega): Los términos DEBEN describir el uso permitido del sistema, la confidencialidad de los datos de clientes y vehículos, la responsabilidad de las cuentas personales y el aviso de privacidad; el texto inicial es una plantilla en español que el taller debe revisar.

**Seguridad de la información**

- **FR-024** (agrega): El sistema DEBE tener una bitácora de acciones sensibles con usuario, acción, entidad afectada y fecha (en un inicio de sesión fallido se guarda el identificador escrito y la cuenta si existe, nunca la contraseña): inicios de sesión fallidos y bloqueos, altas, bajas, reactivaciones y cambios de rol de usuarios, cambios de configuración, de precios de refacciones y del catálogo, pagos cancelados y publicación de términos.
- **FR-025** (agrega): La bitácora DEBE consultarse solo por el administrador, con filtros por fecha, usuario y acción, paginada; nadie puede editarla ni borrarla desde la aplicación, y no se exporta.
- **FR-026** (agrega): La bitácora NO DEBE guardar contraseñas, hashes, tokens ni datos de tarjeta; cada acción guarda una lista cerrada de campos.
- **FR-027** (mantiene): La política de contraseñas existente (8 caracteres o más con mayúscula, minúscula y número) DEBE seguir aplicándose al crear y al cambiar la contraseña, con mensajes claros, y quedar documentada y probada; las contraseñas se guardan solo con hash.
- **FR-028** (agrega): El servidor DEBE rechazar con 401 `SESSION_INACTIVE` la sesión con más de 30 minutos sin actividad, y la aplicación DEBE cerrar la sesión por inactividad; la expiración del token se mantiene. Cuenta como actividad cualquier petición de la persona **excepto la consulta periódica automática de avisos** (`GET /api/notifications` cada 60 segundos), que no debe mantener viva una sesión abandonada; en la aplicación cuenta como actividad tocar, escribir o desplazarse.
- **FR-029** (agrega): Las respuestas de la API DEBEN incluir encabezados de seguridad (no adivinar el tipo de contenido, no incrustar en marcos, política de referencia y sin caché de las respuestas de la API) y no revelar la tecnología del servidor.
- **FR-030** (mantiene): Ninguna respuesta de usuarios, refacciones, órdenes, pagos o tickets DEBE incluir el hash de contraseña, el token ni los precios reservados al rol; pruebas lo verifican en cada endpoint.
- **FR-031** (mantiene): Las consultas DEBEN usar parámetros y las entradas validarse en el servidor; una prueba automática verifica intentos de inyección en los campos de búsqueda.

**Datos de ejemplo, pruebas y documentación**

- **FR-032** (agrega): Los seeds DEBEN incluir la configuración inicial, tipos de servicio con intervalos, la versión 1 de los términos y datos suficientes para que cada reporte muestre información; DEBEN ser idempotentes.
- **FR-033** (agrega): DEBEN existir y pasar pruebas de las reglas de configuración, el cálculo y la exportación de los reportes, los permisos por rol, la aceptación de términos, la bitácora, la inactividad y la no exposición de datos; ninguna prueba de los Sprints 1 a 6 puede pasar de verde a rojo.
- **FR-034** (agrega): `docs/project-context.md`, `docs/design-system.md`, `README.md`, `database/README.md` y `.env.example` DEBEN actualizarse; los datos del taller de `.env` quedan documentados como valor de respaldo.

### Entidades clave *(incluir si la funcionalidad involucra datos)*

- **Configuración (`settings`)**: pares clave-valor con los datos del taller y los márgenes de «Próximo»; quién y cuándo los cambió.
- **Tipo de servicio (`service_types`)**: nombre único, intervalo en días y en kilómetros, activo; enlazado opcionalmente desde las líneas de servicio.
- **Instantánea del ticket**: datos del taller y próximo servicio guardados en el ticket al generarse.
- **Versión de términos (`terms_versions`)** y **aceptación (`terms_acceptances`)**: textos, número, publicación; usuario, versión y fecha.
- **Bitácora (`audit_log`)**: usuario, acción, entidad, detalle sin secretos y fecha.
- **Actividad del usuario**: marca de la última actividad para el cierre por inactividad.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: El administrador cambia los datos del taller y un ticket generado a continuación los muestra en menos de 1 minuto, sin reiniciar el servidor; los tickets anteriores no cambian.
- **SC-002**: El 100 % de los importes de los reportes coincide con los pagos, órdenes y movimientos de origen en las pruebas de cálculo.
- **SC-003**: Cada reporte con un año de datos (366 días) responde en menos de 3 segundos.
- **SC-004**: El archivo exportado de cada reporte tiene las mismas filas y totales que la pantalla en el 100 % de las pruebas.
- **SC-005**: Ningún usuario sin aceptación vigente de los términos puede ejecutar una operación (salvo las exentas); ninguna entrada de la bitácora contiene valores prohibidos.
- **SC-006**: Ninguna prueba de los Sprints 1 a 6 pasa de verde a rojo.
- **SC-007**: Cargar los datos de ejemplo dos veces no duplica ningún registro y cada reporte muestra información al arrancar.

## Supuestos

- Los textos de los términos y del aviso de privacidad son una plantilla en español; el taller debe revisarlos con quien corresponda (no es asesoría legal).
- El costo de una refacción es su precio de compra vigente (las líneas de orden no guardan el costo); un cambio posterior del precio de compra cambia el margen histórico y esto se documenta como limitación.
- La hora de corte de los reportes es la local del servidor.
- Los valores de este sprint (30 minutos de inactividad, 60 segundos del enlace de descarga, 366 días de rango máximo) son fijos.
- No se agregan dependencias nuevas: el CSV y los encabezados de seguridad se escriben con código propio.
- Si el tiempo no alcanza, la entrega 7B se recorta a ingresos por periodo y servicios frecuentes, y el resto se declara como deuda técnica.
