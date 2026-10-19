# Especificación de la funcionalidad: Base del sistema, clientes y vehículos

**Rama de la funcionalidad**: `sdd-speckit` (rama única del reporte SDD; la carpeta de la feature es `001-base-clientes-vehiculos`)

**Creado**: 2026-10-18

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripcion de @docs/sprints/sprint-1-base-clientes-vehiculos.md"

## Aclaraciones

### Sesión 2026-10-19

- Q: ¿Se usará alguna librería complementaria de componentes de interfaz además de Material Design 3? → A: Ninguna; solo Material 3 con tema propio y las librerías de apoyo permitidas (tipografía, tablas y un único set de íconos).
- Q: ¿Qué set de íconos único usará la interfaz? → A: `lucide_icons_flutter`, sin mezclar con otros sets.
- Q: ¿Qué secciones muestra la barra lateral en el Sprint 1 y para qué rol? → A: Clientes y Vehículos para los tres roles (el mecánico solo consulta) y Usuarios solo para ADMIN; la pantalla inicial es Clientes; el cambio de contraseña y el cierre de sesión se acceden desde el usuario al pie de la barra.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Iniciar sesión según mi rol (Prioridad: P1)

Como usuario del taller (administrador, recepcionista o mecánico), quiero iniciar sesión con mi usuario o correo electrónico y contraseña para acceder a las funciones que corresponden a mi rol.

**Por qué esta prioridad**: Sin acceso autenticado ningún otro módulo puede usarse ni protegerse; es la base de todo el sistema.

**Prueba independiente**: Se prueba iniciando sesión con cada una de las tres cuentas iniciales, tanto con el nombre de usuario como con el correo, y verificando que cada rol ve solo lo que le corresponde. Entrega valor porque ya permite entrar al sistema de forma segura.

**Escenarios de aceptación**:

1. **Dado** que existe la cuenta `recepcion`, **Cuando** ingreso su nombre de usuario y contraseña correctos, **Entonces** accedo al sistema con las funciones de recepcionista.
2. **Dado** que existe una cuenta con un correo registrado, **Cuando** ingreso ese correo en el mismo campo de acceso con la contraseña correcta, **Entonces** accedo al sistema igual que con el nombre de usuario.
3. **Dado** que ingreso una contraseña incorrecta, **Cuando** envío el formulario, **Entonces** veo un mensaje claro en español que no revela si falló el usuario o la contraseña.
4. **Dado** que fallo el inicio de sesión cinco veces seguidas con la misma cuenta, **Cuando** intento de nuevo, **Entonces** la cuenta queda bloqueada temporalmente y se me informa cuánto debo esperar.
5. **Dado** que soy mecánico, **Cuando** intento acceder a una función reservada a otros roles, **Entonces** el sistema la rechaza aunque yo conozca su dirección directa.
6. **Dado** que tengo sesión iniciada, **Cuando** elijo cerrar sesión, **Entonces** el sistema pide confirmación y, al confirmar, termina mi sesión.
7. **Dado** que tengo sesión iniciada, **Cuando** cambio mi contraseña por una de al menos 8 caracteres con mayúscula, minúscula y número, **Entonces** la contraseña se actualiza y la anterior deja de funcionar.

---

### Historia de usuario 2 - Gestionar clientes (Prioridad: P1)

Como recepcionista, quiero registrar, consultar y editar clientes para mantener actualizada la información de los propietarios de los vehículos.

**Por qué esta prioridad**: Todo vehículo y, en sprints posteriores, toda cita u orden depende de un cliente registrado.

**Prueba independiente**: Con la sesión de recepcionista se registra un cliente, se busca en el listado y se edita un dato; la información persiste al volver a entrar.

**Escenarios de aceptación**:

1. **Dado** que soy recepcionista, **Cuando** registro un cliente con nombre, teléfono y correo válidos, **Entonces** el cliente aparece en el listado con su fecha de registro y estado activo.
2. **Dado** que existen clientes registrados, **Cuando** busco por nombre, teléfono o correo, **Entonces** el listado muestra solo las coincidencias.
3. **Dado** que consulto un cliente, **Cuando** abro su detalle, **Entonces** veo sus datos y la lista de los vehículos asociados.
4. **Dado** que edito el teléfono de un cliente, **Cuando** guardo, **Entonces** el cambio se refleja de inmediato en el detalle y en el listado.
5. **Dado** que registro un cliente con un teléfono que ya existe, **Cuando** envío el formulario, **Entonces** el sistema me avisa y me pide confirmar antes de guardarlo.
6. **Dado** que soy mecánico, **Cuando** consulto clientes, **Entonces** puedo verlos pero no crearlos ni editarlos.

---

### Historia de usuario 3 - Registrar vehículos y asociarlos a su propietario (Prioridad: P1)

Como recepcionista, quiero registrar vehículos y asociarlos con su propietario para llevar el control de los automóviles atendidos y vincular la información correctamente.

**Por qué esta prioridad**: Completa el flujo demostrable del sprint y es el insumo del expediente del vehículo en sprints posteriores.

**Prueba independiente**: Con un cliente existente se registra un vehículo con sus datos y se verifica que aparece en el detalle de ese cliente y en el listado de vehículos.

**Escenarios de aceptación**:

1. **Dado** que existe un cliente, **Cuando** registro un vehículo con marca, modelo, año, placas y kilometraje y lo asocio a ese cliente, **Entonces** el vehículo queda guardado y aparece en el detalle del cliente.
2. **Dado** que intento registrar un vehículo sin propietario, **Cuando** envío el formulario, **Entonces** el sistema lo rechaza indicando que el propietario es obligatorio.
3. **Dado** que existe un vehículo con ciertas placas, **Cuando** intento registrar otro con las mismas placas, **Entonces** el sistema lo rechaza con un mensaje claro.
4. **Dado** que registro un vehículo con número de serie (VIN), **Cuando** ya existe otro con el mismo VIN, **Entonces** el sistema lo rechaza; si no capturo VIN, el registro se permite.
5. **Dado** que consulto un vehículo, **Cuando** abro su detalle, **Entonces** veo sus datos y el nombre de su propietario.

---

### Historia de usuario 4 - Administrar usuarios y roles (Prioridad: P2)

Como administrador, quiero gestionar usuarios y roles de acceso para controlar quién puede usar el sistema.

**Por qué esta prioridad**: Es necesaria para operar el taller con varias personas, pero el flujo principal puede demostrarse con las cuentas iniciales.

**Prueba independiente**: Con la sesión de administrador se crea un usuario con rol de mecánico, se inicia sesión con él y después se desactiva y se comprueba que ya no puede entrar.

**Escenarios de aceptación**:

1. **Dado** que soy administrador, **Cuando** creo un usuario con nombre, usuario único, correo único, rol y contraseña válida, **Entonces** el usuario puede iniciar sesión con su rol.
2. **Dado** que existe un usuario con un nombre de usuario o correo determinado, **Cuando** intento crear otro igual, **Entonces** el sistema lo rechaza.
3. **Dado** que soy administrador, **Cuando** cambio el rol de un usuario o lo desactivo (tras confirmar), **Entonces** el cambio aplica en su siguiente petición, sin esperar a que expire su sesión.
4. **Dado** que soy recepcionista o mecánico, **Cuando** intento gestionar usuarios, **Entonces** el sistema lo rechaza.
5. **Dado** que soy el único administrador activo, **Cuando** intento desactivarme o quitarme el rol, **Entonces** el sistema lo impide.

---

### Casos límite

- Inicio de sesión con campos vacíos o con espacios al inicio y al final del usuario o correo.
- Distinción entre usuario y correo: un valor con `@` se busca como correo; si no, como nombre de usuario.
- Sesión expirada o cuenta desactivada mientras el usuario trabaja: la siguiente acción lo envía de nuevo al inicio de sesión con un mensaje claro.
- Contraseña nueva que no cumple la política mínima: se rechaza indicando qué falta.
- Año de vehículo fuera de un rango razonable (por ejemplo, futuro lejano) o kilometraje negativo: se rechaza.
- Cliente sin vehículos: el detalle muestra un estado vacío con la opción de registrar uno.
- Desactivar un cliente que tiene vehículos: se conserva la información y el vehículo sigue ligado a su propietario.
- Falla de conexión con la base de datos: el usuario ve un mensaje en español sin detalles internos.
- Reejecución de los datos de ejemplo: no duplica registros ni rompe relaciones.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Autenticación y sesión**

- **FR-001**: El sistema DEBE permitir iniciar sesión con un único campo que acepte nombre de usuario o correo electrónico, más la contraseña, para los roles ADMIN, RECEPTIONIST y MECHANIC.
- **FR-002**: El sistema DEBE almacenar las contraseñas solo de forma cifrada irreversible, nunca en texto plano.
- **FR-003**: El sistema DEBE emitir un token de sesión válido al autenticar y rechazar peticiones sin token válido.
- **FR-004**: El sistema DEBE bloquear una cuenta temporalmente tras 5 intentos fallidos consecutivos y desbloquearla automáticamente tras 15 minutos.
- **FR-005**: El sistema DEBE permitir cerrar sesión, solicitando confirmación previa.
- **FR-006**: El sistema DEBE permitir a cada usuario cambiar su contraseña y exigir una política mínima: al menos 8 caracteres, una mayúscula, una minúscula y un número.
- **FR-007**: El sistema DEBE contar con las cuentas iniciales `admin`, `recepcion` y `mecanico` (una por rol), solo para entornos locales de prueba y con contraseña cifrada, creadas mediante los datos iniciales.

**Autorización**

- **FR-008**: El sistema DEBE validar el rol del usuario en el servidor en cada operación protegida; ocultar opciones en la interfaz NO sustituye esta validación.
- **FR-009**: El sistema DEBE consultar en cada petición el rol vigente y el estado activo del usuario, de modo que los cambios de rol o la desactivación surtan efecto de inmediato.
- **FR-010**: Solo ADMIN DEBE poder gestionar usuarios; ADMIN y RECEPTIONIST DEBEN poder crear y editar clientes y vehículos; MECHANIC DEBE poder únicamente consultarlos.

**Usuarios (administrador)**

- **FR-011**: El sistema DEBE permitir a ADMIN crear, consultar, editar, activar/desactivar usuarios y asignarles un rol, con confirmación al desactivar.
- **FR-012**: El sistema DEBE garantizar que el nombre de usuario y el correo de cada cuenta sean únicos y obligatorios.
- **FR-013**: El sistema NO DEBE permitir que quede el taller sin al menos un administrador activo.

**Clientes**

- **FR-014**: El sistema DEBE permitir registrar clientes con nombre, teléfono, correo electrónico, estado y fecha de registro.
- **FR-015**: El sistema DEBE permitir consultar clientes en un listado con búsqueda por nombre, teléfono o correo, y ver el detalle de cada uno.
- **FR-016**: El sistema DEBE permitir editar los datos de un cliente.
- **FR-017**: El sistema DEBE avisar y pedir confirmación cuando se registre un teléfono ya existente, sin impedirlo.
- **FR-018**: El detalle de un cliente DEBE mostrar los vehículos asociados.
- **FR-019**: El sistema DEBE permitir desactivar un cliente (con confirmación) sin eliminar su información.

**Vehículos**

- **FR-020**: El sistema DEBE permitir registrar vehículos con propietario, marca, modelo, año, placas, número de serie (opcional) y kilometraje actual.
- **FR-021**: El sistema NO DEBE permitir crear un vehículo sin propietario; un cliente puede tener varios vehículos y cada vehículo pertenece a un solo cliente.
- **FR-022**: Las placas DEBEN ser únicas; el número de serie es opcional pero, si se captura, DEBE ser único.
- **FR-023**: El sistema DEBE permitir consultar vehículos en un listado con búsqueda por placas, marca, modelo o propietario, y ver el detalle de cada uno.
- **FR-024**: El sistema DEBE permitir editar los datos de un vehículo; el kilometraje actual no puede disminuir sin una corrección explícita.

**Calidad general**

- **FR-025**: El sistema DEBE validar todas las entradas en el servidor y mostrar mensajes de error en español, sin exponer detalles internos.
- **FR-026**: Los datos DEBEN persistir entre sesiones y ser consistentes (no puede existir un vehículo apuntando a un cliente inexistente).
- **FR-027**: El sistema DEBE incluir datos de ejemplo suficientes (al menos las tres cuentas iniciales, clientes de prueba con sus vehículos) para mostrar información al primer arranque, y su carga repetida NO DEBE duplicar registros.
- **FR-028**: Toda pantalla DEBE seguir el sistema de diseño del proyecto y mostrar estados de carga, vacío, error y éxito; las acciones destructivas o irreversibles DEBEN pedir confirmación.
- **FR-029**: El sistema DEBE mostrar a cada usuario solo las secciones permitidas para su rol: Clientes y Vehículos para los tres roles, y Usuarios únicamente para ADMIN. Tras iniciar sesión, la pantalla inicial es Clientes.
- **FR-030**: El cambio de contraseña y el cierre de sesión DEBEN estar disponibles desde el usuario mostrado al pie de la barra lateral.

### Entidades clave *(incluir si la funcionalidad involucra datos)*

- **Usuario**: persona con acceso al sistema. Tiene nombre, nombre de usuario único, correo único, rol (ADMIN, RECEPTIONIST o MECHANIC), estado activo/inactivo y fechas de creación y actualización. La contraseña se guarda únicamente cifrada.
- **Cliente**: propietario de uno o varios vehículos. Tiene nombre, teléfono, correo, estado y fechas de registro y actualización.
- **Vehículo**: automóvil que pertenece a exactamente un cliente. Tiene marca, modelo, año, placas únicas, número de serie opcional único, kilometraje actual y fechas de registro y actualización.

Relaciones: un cliente tiene cero o más vehículos; un vehículo pertenece a un solo cliente; un usuario tiene exactamente un rol.

### Criterios de aceptación en EARS

Reescritura del requisito **FR-004** con la sintaxis EARS (*Easy Approach to Requirements Syntax*). El requisito original no se modifica: estas líneas lo complementan, separando cada comportamiento para poder probarlo por separado. Responde siempre el backend.

- **FR-004-a** (por evento): CUANDO una cuenta acumule 5 intentos fallidos consecutivos de inicio de sesión, el backend DEBERÁ bloquearla durante 15 minutos.
- **FR-004-b** (comportamiento no deseado): SI una cuenta está bloqueada, ENTONCES el backend DEBERÁ rechazar cualquier intento de inicio de sesión, aunque la contraseña sea correcta, con un mensaje en español que indique cuántos minutos faltan.
- **FR-004-c** (por evento): CUANDO se cumplan los 15 minutos del bloqueo, el backend DEBERÁ permitir de nuevo el inicio de sesión sin intervención de un administrador.
- **FR-004-d** (por evento): CUANDO una cuenta inicie sesión correctamente, el backend DEBERÁ reiniciar a cero su contador de intentos fallidos.

Reescritura también de **FR-021** y **FR-009**, con el mismo criterio.

- **FR-021-a** (siempre activo): Cada vehículo DEBERÁ pertenecer a un solo cliente.
- **FR-021-b** (comportamiento no deseado): SI una solicitud de alta de vehículo no indica un propietario existente, ENTONCES el backend DEBERÁ rechazarla con el mensaje «El propietario es obligatorio».
- **FR-009-a** (por evento): CUANDO un administrador cambie el rol de un usuario o lo desactive, el backend DEBERÁ aplicar el cambio en la siguiente petición de ese usuario, sin esperar a que su sesión expire.
- **FR-009-b** (comportamiento no deseado): SI un usuario desactivado presenta un token todavía vigente, ENTONCES el backend DEBERÁ rechazar la petición.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Un usuario con cuenta válida inicia sesión en menos de 30 segundos, usando indistintamente su usuario o su correo.
- **SC-002**: El flujo completo (iniciar sesión → registrar cliente → registrar vehículo → asociarlo → consultar) se completa de extremo a extremo en menos de 3 minutos por una persona sin capacitación técnica.
- **SC-003**: El 100 % de las operaciones protegidas rechaza a los roles no autorizados, comprobado por pruebas automáticas por cada rol y función.
- **SC-004**: Recién instalado el entorno local, el 100 % de las pantallas del sprint muestra información de ejemplo sin capturar datos a mano.
- **SC-005**: El 100 % de los intentos de registrar un vehículo sin propietario, con placas duplicadas o con una contraseña fuera de política es rechazado con un mensaje comprensible.
- **SC-006**: Ninguna contraseña ni secreto aparece en texto plano en el repositorio ni en la base de datos.
- **SC-007**: La base de datos puede recrearse desde cero y volver a un estado utilizable en un solo procedimiento documentado.
- **SC-008**: Los cambios de rol o desactivación de un usuario surten efecto en su siguiente acción, sin esperar a que expire su sesión.

## Supuestos

- Los usuarios del sistema son únicamente personal del taller; los clientes son beneficiarios externos y no inician sesión en el MVP.
- La interfaz es una aplicación de escritorio/web con prioridad en pantallas de escritorio, en español y en tema claro.
- El taller cuenta con acceso a internet; la base de datos es local a cada integrante durante el MVP.
- Las cuentas y contraseñas estándar (`admin`, `recepcion`, `mecanico`) son solo para pruebas locales; las contraseñas nuevas deben cumplir la política mínima.
- La sesión dura 8 horas y el bloqueo por intentos fallidos dura 15 minutos (decisiones ya resueltas por el equipo).
- Las decisiones técnicas resueltas (frontend, acceso a datos, migraciones, pruebas) están en `docs/project-context.md` y en la constitución; se aplican en la fase de planificación, no en esta especificación.
- La interfaz no usa librería complementaria de componentes: solo Material Design 3 con tema propio y las librerías de apoyo permitidas por el sistema de diseño.
- La interfaz usa un único set de íconos (`lucide_icons_flutter`).
- No hay pantalla de inicio ni Dashboard en este sprint; la navegación solo incluye los módulos del sprint.
- Fuera de alcance: citas, órdenes de servicio, inventario, pagos y Mercado Pago, tickets, dashboard, chatbot de WhatsApp, recuperación de contraseña, registro público de usuarios y modo oscuro.
- Dependencia: ninguna funcionalidad previa; este sprint es la base de los sprints 2 a 4.
