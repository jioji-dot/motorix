# Especificación de funcionalidad: Base del sistema, clientes y vehículos (Sprint 1)

**Rama de la funcionalidad**: `001-base-clientes-vehiculos`

**Creada**: 2026-10-12

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripción de docs/sprints/sprint-1-base-clientes-vehiculos.md"

## Aclaraciones

### Sesión 2026-10-12

- Q: ¿Qué puede hacer el rol de mecánico con clientes y vehículos? → A: Solo consulta (listado y detalle), sin crear ni editar.
- Q: ¿Qué datos del vehículo son únicos y obligatorios? → A: La placa es obligatoria y única; el número de identificación es opcional y único si se captura.
- Q: ¿Qué datos del cliente son obligatorios y cómo se tratan los posibles duplicados? → A: Nombre y teléfono obligatorios; correo y dirección opcionales; si el teléfono ya existe se advierte, pero se permite guardar tras confirmar.
- Q: ¿Cuánto dura la sesión y qué pasa tras intentos fallidos de acceso? → A: Sesión de 8 horas; tras 5 intentos fallidos consecutivos la cuenta se bloquea temporalmente 15 minutos.
- Q: ¿Cómo se recupera el acceso si alguien olvida su contraseña, sin recuperación por correo? → A: El administrador puede restablecer la contraseña de otro usuario, y la nueva debe cumplir la política mínima.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Iniciar sesión según mi rol (Prioridad: P1)

Como usuario del taller (administrador, recepcionista o mecánico), quiero iniciar sesión con mi usuario o mi correo electrónico y mi contraseña para acceder únicamente a las funciones que corresponden a mi rol.

**Por qué esta prioridad**: Sin acceso autenticado y con permisos por rol no puede usarse ningún otro módulo; es la base de los cuatro sprints del MVP.

**Prueba independiente**: Se prueba iniciando sesión con cada una de las tres cuentas iniciales, usando tanto el usuario como el correo, y verificando qué funciones quedan disponibles para cada rol.

**Escenarios de aceptación**:

1. **Dado** una cuenta existente y activa, **Cuando** el usuario escribe su nombre de usuario y su contraseña correcta, **Entonces** el sistema le da acceso y muestra solo las funciones de su rol.
2. **Dado** la misma cuenta, **Cuando** el usuario escribe su correo electrónico en el mismo campo de acceso y su contraseña correcta, **Entonces** el sistema le da acceso de igual forma.
3. **Dado** una cuenta existente, **Cuando** el usuario escribe una contraseña incorrecta o un usuario/correo inexistente, **Entonces** el sistema rechaza el acceso con un mensaje claro que no revela cuál de los dos datos falló.
4. **Dado** un usuario con sesión iniciada, **Cuando** intenta una acción que su rol no permite, **Entonces** el sistema la rechaza aunque la solicite saltándose la interfaz.
5. **Dado** una persona sin sesión iniciada, **Cuando** intenta consultar o modificar cualquier dato, **Entonces** el sistema le exige iniciar sesión.

---

### Historia de usuario 2 - Gestionar usuarios y roles (Prioridad: P2)

Como administrador, quiero gestionar usuarios y roles de acceso para controlar quién puede usar el sistema.

**Por qué esta prioridad**: Permite dar de alta al personal del taller, pero el MVP puede demostrarse con las tres cuentas iniciales, por lo que va después del acceso básico y del flujo de clientes y vehículos.

**Prueba independiente**: Se prueba entrando como administrador, creando un usuario con un rol, cambiando su rol y su estado, y verificando que el usuario nuevo accede con las funciones de su rol.

**Escenarios de aceptación**:

1. **Dado** un administrador con sesión iniciada, **Cuando** registra un usuario con nombre de usuario, correo, contraseña y rol, **Entonces** el usuario queda creado y puede iniciar sesión.
2. **Dado** un administrador, **Cuando** intenta registrar un usuario con un nombre de usuario o correo que ya existe, **Entonces** el sistema lo rechaza indicando el campo repetido.
3. **Dado** un administrador, **Cuando** cambia el rol de un usuario o lo desactiva, **Entonces** el cambio se aplica en su siguiente acceso y un usuario desactivado ya no puede iniciar sesión.
4. **Dado** un usuario con rol de recepcionista o mecánico, **Cuando** intenta gestionar usuarios, **Entonces** el sistema lo rechaza.
5. **Dado** una cuenta cualquiera, **Cuando** su titular cambia la contraseña, **Entonces** el sistema exige la política mínima (8 caracteres, con mayúscula, minúscula y número) y rechaza las que no la cumplen.

---

### Historia de usuario 3 - Registrar y consultar clientes (Prioridad: P1)

Como recepcionista, quiero registrar y consultar clientes para mantener actualizada la información de los propietarios.

**Por qué esta prioridad**: Todo vehículo depende de un propietario; sin clientes no hay flujo demostrable.

**Prueba independiente**: Se prueba registrando un cliente, buscándolo en el listado y abriendo su detalle.

**Escenarios de aceptación**:

1. **Dado** un recepcionista con sesión iniciada, **Cuando** registra un cliente con los datos obligatorios, **Entonces** el cliente queda guardado y aparece en el listado.
2. **Dado** un cliente con vehículos asociados, **Cuando** el usuario abre su detalle, **Entonces** ve sus datos y la lista de sus vehículos.
3. **Dado** que existen varios clientes, **Cuando** el usuario busca por nombre u otro dato de contacto, **Entonces** el listado se reduce a las coincidencias.
4. **Dado** un formulario de cliente, **Cuando** faltan datos obligatorios o tienen formato inválido, **Entonces** el sistema no guarda y señala cada error.

---

### Historia de usuario 4 - Editar clientes (Prioridad: P2)

Como recepcionista, quiero editar la información de los clientes para corregir o actualizar sus datos.

**Por qué esta prioridad**: Es necesaria para mantener los datos correctos, pero el flujo principal funciona sin ella.

**Prueba independiente**: Se prueba modificando el teléfono de un cliente existente y comprobando que el cambio se ve en el listado y en el detalle.

**Escenarios de aceptación**:

1. **Dado** un cliente existente, **Cuando** el recepcionista modifica sus datos y guarda, **Entonces** el sistema conserva los cambios y los muestra en todas las consultas.
2. **Dado** una edición con datos inválidos, **Cuando** se intenta guardar, **Entonces** el sistema la rechaza y conserva los datos anteriores.
3. **Dado** un usuario sin permiso de edición, **Cuando** intenta editar un cliente, **Entonces** el sistema lo rechaza.

---

### Historia de usuario 5 - Registrar vehículos con su propietario (Prioridad: P1)

Como recepcionista, quiero registrar vehículos y asociarlos con su propietario para llevar el control de los automóviles atendidos y vincular la información correctamente.

**Por qué esta prioridad**: Completa el flujo demostrable del sprint (cliente → vehículo → consulta) y las historias de usuario US5 y US6 del sprint comparten el mismo flujo.

**Prueba independiente**: Se prueba registrando un vehículo para un cliente existente y comprobando que aparece en el detalle del cliente.

**Escenarios de aceptación**:

1. **Dado** un cliente existente, **Cuando** el recepcionista registra un vehículo y lo asocia a ese cliente, **Entonces** el vehículo queda guardado y aparece en los vehículos del cliente.
2. **Dado** un intento de registrar un vehículo, **Cuando** no se indica propietario o el propietario no existe, **Entonces** el sistema lo rechaza.
3. **Dado** un vehículo registrado, **Cuando** se consulta, **Entonces** se muestran sus datos y su propietario.
4. **Dado** un intento de registrar un vehículo con una placa o un número de identificación ya registrado, **Cuando** se guarda, **Entonces** el sistema avisa del duplicado y no lo guarda.

---

### Historia de usuario 6 - Datos de ejemplo al arrancar (Prioridad: P3)

Como integrante del equipo, quiero que el sistema muestre información de ejemplo tras la instalación inicial para poder demostrar el flujo sin capturar datos a mano.

**Por qué esta prioridad**: Apoya la demostración, pero no es una función del taller.

**Prueba independiente**: Se prueba recreando la base desde cero, cargando los datos de ejemplo e iniciando sesión para ver clientes y vehículos.

**Escenarios de aceptación**:

1. **Dado** una instalación nueva, **Cuando** se prepara la base y se cargan los datos de ejemplo, **Entonces** existen las tres cuentas iniciales y clientes y vehículos de muestra.
2. **Dado** una base que ya contiene los datos de ejemplo, **Cuando** se vuelven a cargar, **Entonces** no se duplican registros.

---

### Casos límite

- ¿Qué ocurre si dos usuarios registran al mismo tiempo un cliente, usuario o vehículo con el mismo dato único? Solo uno se guarda y el otro recibe el aviso de duplicado.
- ¿Qué ocurre si la sesión expira mientras se llena un formulario? El sistema pide iniciar sesión de nuevo y no pierde la información de forma silenciosa.
- ¿Qué ocurre si se escriben espacios o mayúsculas distintas en el usuario o correo al iniciar sesión? El acceso no distingue mayúsculas de minúsculas ni espacios sobrantes en esos campos.
- ¿Qué ocurre con muchos intentos fallidos consecutivos de acceso? Tras 5 intentos la cuenta se bloquea 15 minutos (FR-002a).
- ¿Qué ocurre si un usuario olvida su contraseña? No hay recuperación por correo; el administrador la restablece (FR-006a).
- ¿Qué ocurre si se intenta eliminar un cliente que tiene vehículos asociados? El sistema no lo permite mientras tenga vehículos.
- ¿Qué ocurre si el administrador se desactiva o se quita el rol a sí mismo, o desactiva al último administrador? El sistema lo impide para no dejar el sistema sin administración.
- ¿Qué ocurre si falla la comunicación con el servidor durante un guardado? El usuario ve un mensaje de error comprensible, sin detalles técnicos internos.
- ¿Qué ocurre con una contraseña de las cuentas iniciales que no cumple la política mínima? Se acepta solo en esas cuentas y en entornos locales; al cambiarla debe cumplir la política.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: El sistema DEBE permitir iniciar sesión con un único campo que acepte el nombre de usuario o el correo electrónico, junto con la contraseña, para todos los roles.
- **FR-002**: El sistema DEBE entregar una credencial de sesión con vigencia de 8 horas tras un acceso exitoso y exigirla en toda operación protegida.
- **FR-002a**: El sistema DEBE bloquear temporalmente una cuenta durante 15 minutos tras 5 intentos fallidos consecutivos de acceso, con un mensaje que lo indique.
- **FR-003**: El sistema DEBE almacenar las contraseñas únicamente en forma cifrada irreversible, nunca en texto plano.
- **FR-004**: El sistema DEBE manejar tres roles: administrador (ADMIN), recepcionista (RECEPTIONIST) y mecánico (MECHANIC).
- **FR-005**: El sistema DEBE validar en el servidor los permisos de rol en cada operación protegida; ocultar opciones en la interfaz no sustituye esa validación.
- **FR-006**: El sistema DEBE permitir al administrador crear, consultar, editar, activar y desactivar usuarios, y asignarles un rol.
- **FR-006a**: El sistema DEBE permitir al administrador restablecer la contraseña de otro usuario; la nueva contraseña debe cumplir la política mínima.
- **FR-007**: El sistema DEBE garantizar que el nombre de usuario y el correo electrónico sean únicos entre los usuarios.
- **FR-008**: El sistema DEBE permitir a cada usuario cambiar su contraseña y exigir la política mínima: 8 caracteres, con al menos una mayúscula, una minúscula y un número.
- **FR-009**: El sistema DEBE incluir tres cuentas iniciales (`admin`, `recepcion`, `mecanico`) con las contraseñas del estándar del MVP, solo para entornos locales.
- **FR-010**: El sistema NO DEBE ofrecer registro público de usuarios; solo el administrador crea cuentas.
- **FR-011**: El sistema DEBE permitir registrar clientes con nombre y teléfono obligatorios, y correo y dirección opcionales, con validación de formato. Si el teléfono ya existe en otro cliente, el sistema DEBE advertirlo y permitir guardar solo tras confirmación del usuario.
- **FR-012**: El sistema DEBE permitir consultar el listado de clientes, buscarlos y abrir el detalle de cada uno.
- **FR-013**: El sistema DEBE mostrar en el detalle de un cliente sus datos y los vehículos que tiene asociados.
- **FR-014**: El sistema DEBE permitir editar los datos de un cliente existente.
- **FR-015**: El sistema DEBE permitir registrar vehículos con marca, modelo, año y placa obligatorios, y número de identificación opcional, y asociarlos a un propietario. La placa DEBE ser única; el número de identificación DEBE ser único cuando se capture.
- **FR-016**: El sistema NO DEBE permitir crear un vehículo sin propietario ni con un propietario inexistente.
- **FR-017**: El sistema DEBE permitir consultar el listado de vehículos y el detalle de cada uno, incluyendo su propietario.
- **FR-018**: El sistema DEBE permitir solo a los roles autorizados crear o modificar clientes y vehículos; el mecánico solo puede consultar el listado y el detalle de ambos, sin crear ni editar.
- **FR-019**: El sistema DEBE conservar los datos de forma persistente y recuperable, y el esquema inicial DEBE poder recrearse desde cero.
- **FR-020**: El sistema DEBE incluir datos de ejemplo suficientes (cuentas iniciales, clientes y vehículos) para mostrar información al arrancar, y cargarlos de forma repetible sin duplicar registros.
- **FR-021**: El sistema DEBE mostrar mensajes de éxito o error comprensibles tras cada acción, sin exponer detalles técnicos internos.
- **FR-022**: La interfaz DEBE seguir el sistema de diseño del proyecto (`docs/design-system.md`), con confirmación previa en toda operación destructiva.
- **FR-023**: El sistema NO DEBE incluir en este sprint citas, órdenes de servicio, inventario, pagos, tickets, panel de indicadores, chatbot, recuperación de contraseña, registro público ni modo oscuro.

### Entidades clave *(incluir si la funcionalidad involucra datos)*

- **Usuario**: persona del taller con acceso al sistema. Tiene nombre de usuario único, correo único, contraseña cifrada, rol (administrador, recepcionista o mecánico) y estado activo/inactivo.
- **Cliente**: propietario de uno o más vehículos. Tiene nombre y teléfono obligatorios, y correo y dirección opcionales; se relaciona con cero o más vehículos.
- **Vehículo**: automóvil atendido por el taller. Tiene marca, modelo, año y placa únicos obligatorios, número de identificación opcional (único si se captura), color opcional, y pertenece obligatoriamente a un cliente.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Un usuario con cuenta válida inicia sesión y llega a su pantalla principal en menos de 15 segundos.
- **SC-002**: El 100 % de los intentos de operaciones no permitidas para un rol (probados para cada rol y cada operación protegida) son rechazados.
- **SC-003**: Un recepcionista completa el flujo "registrar cliente → registrar vehículo → asociarlo → consultar" en menos de 3 minutos en su primer intento.
- **SC-004**: El 100 % de los intentos de crear un vehículo sin propietario válido son rechazados.
- **SC-005**: Tras recrear la base desde cero y cargar los datos de ejemplo, un usuario ve clientes y vehículos de muestra sin capturar nada a mano.
- **SC-006**: Cargar los datos de ejemplo varias veces seguidas deja exactamente la misma cantidad de registros que la primera carga.
- **SC-007**: Una búsqueda de cliente devuelve resultados en menos de 2 segundos con al menos 500 clientes registrados.
- **SC-008**: Ninguna contraseña aparece en texto plano en la base de datos, y el repositorio no contiene secretos.
- **SC-009**: El 100 % de las contraseñas nuevas que no cumplen la política mínima son rechazadas.

## Supuestos

- El taller usa el sistema desde computadoras de escritorio y con conexión estable a la red local; la prioridad de la interfaz es el escritorio.
- Los permisos por defecto son: el administrador puede todo en este sprint; el recepcionista gestiona clientes y vehículos y consulta; el mecánico solo consulta clientes y vehículos. Solo el administrador gestiona usuarios.
- Un cliente puede tener varios vehículos, y cada vehículo tiene un único propietario. Cambiar el propietario de un vehículo (traspaso) queda fuera de este sprint.
- Los clientes y vehículos no se eliminan en este sprint; la depuración queda para una etapa posterior.
- Las contraseñas del estándar del MVP aplican solo a las cuentas iniciales y a entornos locales (RN-17).
- Quedan fuera de este sprint: citas, órdenes de servicio, inventario y refacciones, pagos y Mercado Pago, tickets, panel de indicadores, chatbot de WhatsApp, recuperación de contraseña (incluida por correo), registro público de usuarios y modo oscuro.
- Las decisiones técnicas ya resueltas (Flutter con Provider, MySQL local, driver directo, migraciones numeradas, Jest y supertest) se documentan en la constitución y se aplicarán en la fase de planeación; no forman parte de esta especificación.
- Quedan para `/speckit-clarify`: la librería complementaria de componentes de interfaz (o ninguna), el set de íconos definitivo y la estructura exacta del menú lateral y de las pantallas iniciales.
- Dependencias: `docs/project-context.md` (alcance), `docs/design-system.md` (interfaz) y `.specify/memory/constitution.md` (reglas del proyecto).
