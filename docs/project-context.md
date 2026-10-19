# Motorix --- Contexto maestro del proyecto

> **Documento de contexto para desarrollo asistido por IA (CLAUDE)**
>
> **Nombre formal del proyecto:** Sistema de Gestión para Taller
> Mecánico\
> **Nombre provisional del software:** Motorix\
> **Estado:** Planeación del MVP\
> **Tipo:** Proyecto académico de Ingeniería en Sistemas Computacionales

------------------------------------------------------------------------

## 1. Propósito de este archivo

Este documento es la fuente de contexto inicial para el desarrollo de
**Motorix**. Su objetivo es permitir que un entorno de desarrollo
asistido por IA, como CLAUDE, comprenda el problema, alcance, actores,
requisitos, reglas de negocio y plan de sprints antes de generar código.

### Reglas para el agente de IA

1.  No agregar funcionalidades fuera del alcance sin indicarlo primero.
2.  Priorizar el MVP y los sprints definidos en este documento.
3.  No implementar todo el sistema de una sola vez.
4.  Antes de modificar arquitectura, modelos o reglas de negocio,
    revisar este documento.
5.  Mantener separación entre frontend, backend, persistencia e
    integraciones externas.
6.  No almacenar datos sensibles de tarjetas o credenciales de Mercado
    Pago.
7.  El chatbot de WhatsApp **no forma parte de la interfaz ni del MVP
    actual**; se considera una integración externa futura.
8.  Mantener una UX profesional, sencilla y orientada a personal de
    taller.
9.  Si existe una decisión técnica no definida aquí, proponer opciones
    antes de asumir una solución irreversible.
10. Mantener trazabilidad entre requisito de alto nivel → historia de
    usuario → sprint → implementación.

------------------------------------------------------------------------

# 2. Contexto del proyecto

Muchos talleres mecánicos no cuentan con un sistema que concentre la
información de clientes, vehículos, servicios e inventario. Esto
dificulta el control de las actividades y el seguimiento de los
mantenimientos realizados.

Motorix busca organizar y administrar las operaciones principales de un
taller mecánico, facilitando el control de servicios, refacciones y
pagos, así como el seguimiento de los vehículos y la atención de los
clientes.

El sistema debe permitir que una visita al taller forme parte del
expediente digital del vehículo y que esa información pueda utilizarse
posteriormente para consultar su historial y determinar próximos
mantenimientos.

------------------------------------------------------------------------

# 3. Objetivos medibles y criterios de éxito

-   Centralizar el 100% de la información de clientes, vehículos,
    servicios e inventario registrada en el sistema.
-   Registrar el 100% de los servicios realizados para mantener
    actualizado el historial de cada vehículo.
-   Generar recordatorios de mantenimiento con base en las fechas y
    kilometraje registrados.

------------------------------------------------------------------------

# 4. Requisitos de alto nivel

Estos requisitos representan las capacidades principales del producto y
sirven como referencia del Product Backlog.

1.  **Como recepcionista quiero gestionar clientes vehículos citas y
    órdenes de servicio.**
2.  **Como mecánico necesito consultar el historial y seguimiento de
    mantenimiento de los vehículos.**
3.  **Como administrador deseo controlar el inventario y stock de
    refacciones.**
4.  **Como recepcionista puedo registrar pagos mediante Mercado Pago.**
5.  **Como recepcionista necesito generar tickets de servicio.**
6.  **Como administrador requiero consultar la información general del
    taller desde un panel de control.**
7.  **Como administrador puedo gestionar los usuarios y sus roles de
    acceso.**

> Estos elementos son requisitos de alto nivel. No deben tratarse como
> tareas de desarrollo indivisibles. Cada uno debe descomponerse en
> historias o tareas más pequeñas dentro de los sprints.

------------------------------------------------------------------------

# 5. Alcance funcional

## 5.1 Autenticación y usuarios

El sistema contempla:

-   Inicio y cierre de sesión.
-   Gestión de usuarios.
-   Roles de acceso.
-   Restricción de funciones según rol.

### Roles

#### Administrador

Dueño o encargado del taller.

Funciones principales: - Gestionar usuarios, inventario y
configuración. - Supervisar servicios, pagos y operaciones. - Consultar
reportes e información general.

#### Recepcionista

Personal de recepción.

Funciones principales: - Registrar clientes, vehículos y citas. -
Gestionar órdenes de servicio. - Registrar pagos y generar tickets.

#### Mecánico

Personal mecánico.

Funciones principales: - Consultar y actualizar órdenes asignadas. -
Registrar diagnósticos, servicios y refacciones utilizadas. - Agregar
observaciones y recomendaciones de mantenimiento.

#### Cliente

Propietario del vehículo.

En el MVP el cliente es principalmente un **beneficiario externo**, no
necesariamente un usuario autenticado.

Funciones relacionadas: - Recibir información y tickets de servicios
realizados. - Recibir recordatorios de próximos mantenimientos.

### Reglas de autenticación del MVP

- El inicio de sesión DEBE aceptar **usuario o correo electrónico** en el mismo campo. El backend identifica si el valor es un correo (contiene `@`) o un nombre de usuario y busca por el campo correspondiente.
- Esto aplica a todos los roles (ADMIN, RECEPTIONIST, MECHANIC).
- El nombre de usuario (`username`) es único y obligatorio para cada cuenta.

### Estándar de usuarios y contraseñas del MVP

Para facilitar las pruebas durante el MVP, los usuarios iniciales siguen un estándar fijo:

| Rol | Usuario | Contraseña inicial |
|---|---|---|
| Administrador | `admin` | `Admin2026!` |
| Recepcionista | `recepcion` | `Recepcion2026!` |
| Mecánico | `mecanico` | `Mecanico2026!` |

Reglas:

- Las contraseñas del estándar son **solo para el MVP y entornos locales**. No se usan en producción ni se versionan en el repositorio.
- Se generan en la base mediante el script de seeds (hasheadas con bcrypt), nunca en texto plano en el código.
- Las cuentas de usuario del sistema DEBEN poder cambiar su contraseña desde la interfaz. Las contraseñas nuevas ya no siguen el estándar y deben cumplir una política mínima (longitud mínima de 8 caracteres y al menos una mayúscula, una minúscula y un número).
- El administrador puede crear nuevos usuarios con cualquier nombre de usuario único; el estándar solo aplica a las cuentas iniciales de prueba.

------------------------------------------------------------------------

# 6. Módulos del sistema

## 6.1 Clientes

Debe permitir:

-   Registrar clientes.
-   Consultar clientes.
-   Editar información.
-   Asociar uno o varios vehículos.
-   Consultar información relacionada con sus vehículos y servicios.

Datos mínimos sugeridos: - Nombre. - Teléfono. - Correo electrónico. -
Fecha de registro. - Estado.

------------------------------------------------------------------------

## 6.2 Vehículos

Debe permitir:

-   Registrar vehículos.
-   Asociarlos con un propietario.
-   Consultar su información.
-   Actualizar kilometraje.
-   Acceder a su expediente digital.

Datos mínimos sugeridos: - Propietario. - Marca. - Modelo. - Año. -
Placas. - VIN, cuando esté disponible. - Kilometraje actual.

------------------------------------------------------------------------

## 6.3 Citas

Debe permitir:

-   Registrar citas.
-   Consultar citas.
-   Modificar o cancelar citas.
-   Asociar cliente y vehículo.
-   Registrar fecha, hora, motivo y observaciones.

Estados contemplados: - Pendiente. - Confirmada. - En proceso. -
Completada. - Cancelada.

------------------------------------------------------------------------

## 6.4 Órdenes de servicio

Representan el trabajo realizado durante una visita del vehículo.

Debe permitir:

-   Crear una orden.
-   Asociar cliente y vehículo.
-   Registrar kilometraje de entrada.
-   Asignar mecánico.
-   Registrar problema reportado.
-   Registrar diagnóstico.
-   Registrar servicios realizados.
-   Agregar refacciones utilizadas.
-   Registrar mano de obra.
-   Agregar observaciones y recomendaciones.
-   Calcular costos.
-   Cambiar el estado de la orden.

### Estados principales

`RECIBIDO → DIAGNOSTICO → EN_REPARACION → TERMINADO → ENTREGADO`

Puede existir `ESPERANDO_REFACCION` cuando sea necesario.

------------------------------------------------------------------------

## 6.5 Expediente e historial del vehículo

Cada vehículo debe conservar un historial cronológico.

Debe incluir: - Fecha del servicio. - Kilometraje. - Orden
relacionada. - Diagnóstico. - Servicios realizados. - Refacciones
utilizadas. - Observaciones. - Recomendaciones.

Una orden terminada debe poder formar parte del historial del vehículo.

------------------------------------------------------------------------

## 6.6 Mantenimiento preventivo

Debe permitir:

-   Registrar último servicio.
-   Registrar kilometraje del servicio.
-   Definir próximo mantenimiento.
-   Utilizar fecha y/o kilometraje.
-   Consultar mantenimientos próximos.
-   Identificar mantenimientos vencidos.
-   Registrar recomendaciones del mecánico.

### Regla importante

No asumir intervalos universales para todos los vehículos. Los
intervalos deben ser configurables según el servicio o la recomendación
registrada.

Estados visuales sugeridos: - Normal. - Próximo. - Vencido.

------------------------------------------------------------------------

## 6.7 Inventario y refacciones

Debe permitir:

-   Registrar refacciones.
-   Consultar existencias.
-   Registrar entradas y salidas.
-   Definir stock mínimo.
-   Mostrar alertas de stock bajo.
-   Relacionar refacciones con órdenes de servicio.
-   Mantener historial de movimientos.

Datos mínimos sugeridos: - Código o número de parte. - Nombre. -
Categoría. - Marca. - Stock actual. - Stock mínimo. - Precio de
compra. - Precio de venta.

### Regla de negocio

Cuando una refacción sea utilizada en una orden, el sistema debe
reflejar la salida correspondiente del inventario. La implementación
debe evitar que el stock quede en valores inválidos.

------------------------------------------------------------------------

## 6.8 Pagos

Debe permitir:

-   Asociar un pago con una orden.
-   Registrar importe.
-   Registrar método de pago.
-   Registrar estado.
-   Consultar pagos.

Métodos contemplados: - Efectivo. - Tarjeta. - Transferencia. - Mercado
Pago.

Estados sugeridos: - Pendiente. - Pagado. - Rechazado. - Cancelado.

------------------------------------------------------------------------

## 6.9 Mercado Pago

Se contempla una integración con Mercado Pago para pagos relacionados
con órdenes de servicio.

Principios: - La orden debe existir antes de generar el pago. - El pago
debe quedar relacionado con la orden. - No almacenar datos de tarjeta en
Motorix. - Las credenciales deben manejarse mediante variables de
entorno. - Durante etapas tempranas puede utilizarse sandbox/pruebas. -
La lógica específica de integración debe mantenerse aislada del dominio
principal.

------------------------------------------------------------------------

## 6.10 Tickets

Debe permitir generar un comprobante asociado a una orden.

Información esperada: - Folio. - Datos básicos del taller. - Cliente. -
Vehículo. - Placas. - Kilometraje. - Servicios. - Refacciones. - Mano de
obra. - Subtotal. - Total. - Método de pago. - Estado del pago. - Fecha.

Debe contemplarse visualización e impresión. La generación PDF puede
implementarse conforme avance el MVP.

------------------------------------------------------------------------

## 6.11 Dashboard

Debe ofrecer una vista resumida de la operación.

Indicadores previstos: - Vehículos atendidos. - Vehículos en
reparación. - Órdenes pendientes. - Órdenes terminadas. - Citas
próximas. - Mantenimientos próximos. - Mantenimientos vencidos. -
Refacciones con stock bajo. - Actividad general del taller.

El dashboard debe consumir información real de los módulos; evitar
duplicar datos solo para estadísticas.

------------------------------------------------------------------------

## 6.12 Notificaciones internas

Debe contemplar avisos relacionados con: - Mantenimientos próximos. -
Mantenimientos vencidos. - Citas. - Stock bajo. - Órdenes que requieran
atención.

------------------------------------------------------------------------

# 7. Funcionalidad fuera del MVP actual

## Chatbot de WhatsApp

Existe como propuesta una integración externa con WhatsApp para
respuestas iniciales breves, por ejemplo:

> "Gracias por tu preferencia. Revisaremos tu solicitud y te
> responderemos."

Sin embargo:

-   No forma parte de la interfaz principal.
-   No debe bloquear el desarrollo del MVP.
-   No debe implementarse hasta que el núcleo del sistema esté
    funcional.
-   Su integración futura deberá tratarse como un servicio externo.

------------------------------------------------------------------------

# 8. Flujo principal del negocio

``` text
Inicio de sesión
      ↓
Registro / consulta de cliente
      ↓
Registro / consulta de vehículo
      ↓
Cita
      ↓
Ingreso del vehículo
      ↓
Orden de servicio
      ↓
Diagnóstico
      ↓
Servicios realizados
      ↓
Refacciones utilizadas
      ↓
Actualización de inventario
      ↓
Finalización de la orden
      ↓
Actualización del historial
      ↓
Próximo mantenimiento
      ↓
Pago
      ↓
Ticket
      ↓
Entrega del vehículo
      ↓
Seguimiento futuro
```

Este flujo es prioritario. Las decisiones de desarrollo deben favorecer
que pueda demostrarse de extremo a extremo.

------------------------------------------------------------------------

# 9. Relaciones conceptuales principales

``` text
Usuario
 └── Rol

Cliente
 └── Vehiculo
      ├── Cita
      ├── OrdenServicio
      │    ├── ServicioRealizado
      │    ├── RefaccionUtilizada
      │    └── Pago
      ├── HistorialMantenimiento
      └── ProximoMantenimiento

Refaccion
 └── MovimientoInventario

OrdenServicio
 └── Ticket
```

Relaciones esperadas:

-   Un cliente puede tener varios vehículos.
-   Un vehículo pertenece a un cliente.
-   Un vehículo puede tener muchas citas.
-   Un vehículo puede tener muchas órdenes.
-   Una orden pertenece a un vehículo y a un cliente.
-   Una orden puede tener varios servicios.
-   Una orden puede utilizar varias refacciones.
-   Una refacción puede aparecer en muchas órdenes.
-   Una orden puede tener información de pago.
-   Un vehículo acumula historial a partir de los servicios realizados.
-   Un vehículo puede tener mantenimientos futuros programados.

------------------------------------------------------------------------

# 10. Propuesta técnica inicial

> Esta sección funciona como guía de implementación para CLAUDE. Si el
> equipo decide otra tecnología, actualizar este documento antes de
> realizar cambios estructurales.

## Stack propuesto (MENF)

### Frontend

-   Flutter.
-   Dart.
-   Interfaz responsive.
-   Consumo de API REST.

### Backend

-   Node.js.
-   Express.
-   JavaScript **usando ES Modules (`import`/`export`), no CommonJS
    (`require`/`module.exports`)**.
-   Configurar `"type": "module"` en `package.json` del backend.
-   Todos los archivos `.js` del backend deben usar sintaxis ESM.

### Base de datos

-   MySQL, ejecutado de forma **local** durante todo el MVP (ver
    sección 14.1).
-   Modelo relacional con llaves foráneas.
-   Scripts SQL versionados en la carpeta `database/`.
-   Capa de acceso a datos desde Node.js (driver u ORM) pendiente de
    decisión (ver sección 27).

### Autenticación

-   JWT.
-   Hash de contraseñas con bcrypt.

### Integraciones

-   Mercado Pago.
-   Generación de tickets/PDF cuando corresponda.

------------------------------------------------------------------------

# 11. Arquitectura sugerida

Separar responsabilidades de forma clara.

``` text
motorix/
├── client/
│   ├── lib/
│   │   ├── models/
│   │   ├── screens/
│   │   ├── widgets/
│   │   ├── services/
│   │   ├── providers/
│   │   ├── utils/
│   │   └── main.dart
│   ├── assets/
│   └── pubspec.yaml
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middlewares/
│   │   ├── validators/
│   │   └── utils/
│   └── ...
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   ├── scripts/
│   ├── data/            (opcional, ignorada por Git)
│   └── README.md
│
├── docs/
│   ├── project-context.md
│   └── api.md
│
├── .env.example
├── .gitignore
└── README.md
```

No es obligatorio conservar exactamente esta estructura si aparece una
necesidad técnica real, pero debe mantenerse una separación equivalente
de responsabilidades.

------------------------------------------------------------------------

# 12. Entidades iniciales sugeridas

Las siguientes entidades sirven como punto de partida. Los campos
definitivos deben validarse durante cada sprint.

> Al utilizar MySQL, cada entidad se implementa como una tabla. Los
> campos de tipo arreglo de `ServiceOrder` (`services[]`, `parts[]`,
> `labor[]`) deben modelarse como tablas relacionadas con la orden
> mediante llave foránea (por ejemplo, servicios realizados, refacciones
> utilizadas y mano de obra por orden), y `totals` puede calcularse a
> partir de ellas o almacenarse como columnas, según se defina en el
> Sprint 2.

## User

``` text
id
username
name
email
passwordHash
role
active
createdAt
updatedAt
```

- `username` es único, obligatorio y se usa junto con `email` para el inicio de sesión.
- `email` es único y válido.
- El login acepta `username` o `email` en el mismo campo.

Roles iniciales:

``` text
ADMIN
RECEPTIONIST
MECHANIC
```

## Client

``` text
id
name
phone
email
active
createdAt
updatedAt
```

## Vehicle

``` text
id
clientId
brand
model
year
licensePlate
vin
currentMileage
createdAt
updatedAt
```

## Appointment

``` text
id
clientId
vehicleId
date
reason
notes
status
createdAt
updatedAt
```

## ServiceOrder

``` text
id
folio
clientId
vehicleId
mechanicId
entryMileage
reportedProblem
diagnosis
status
services[]
parts[]
labor[]
notes
recommendations
totals
createdAt
updatedAt
```

## Part

``` text
id
code
name
category
brand
stock
minimumStock
purchasePrice
salePrice
active
createdAt
updatedAt
```

## InventoryMovement

``` text
id
partId
type
quantity
reason
serviceOrderId
createdAt
```

Tipos:

``` text
IN
OUT
ADJUSTMENT
```

## Maintenance

``` text
id
vehicleId
serviceType
lastServiceDate
lastMileage
nextDate
nextMileage
notes
status
createdAt
updatedAt
```

## Payment

``` text
id
serviceOrderId
amount
method
status
externalReference
createdAt
updatedAt
```

## Ticket

``` text
id
folio
serviceOrderId
paymentId
generatedAt
```

------------------------------------------------------------------------

# 13. Reglas de negocio iniciales

1.  No crear un vehículo sin propietario.
2.  No crear una orden para un vehículo inexistente.
3.  Registrar el kilometraje de entrada de una orden.
4.  El kilometraje nuevo no debería ser menor que el kilometraje
    previamente registrado sin una corrección explícita.
5.  Solo usuarios autorizados pueden modificar órdenes.
6.  Las refacciones utilizadas deben estar relacionadas con una orden.
7.  El uso de una refacción debe generar o reflejar una salida de
    inventario.
8.  No permitir stock negativo salvo que el equipo defina explícitamente
    una política distinta.
9.  Una orden entregada debe conservarse como historial y no eliminarse
    de manera ordinaria.
10. El historial del vehículo debe derivarse de información registrada,
    evitando duplicación innecesaria.
11. Los próximos mantenimientos deben basarse en fecha, kilometraje o
    ambos.
12. Los intervalos de mantenimiento son configurables; no asumir valores
    universales.
13. Todo pago debe estar relacionado con una orden.
14. Los datos sensibles del procesamiento de pagos no deben almacenarse
    en la aplicación.
15. Los permisos deben validarse también en backend; ocultar botones en
    frontend no es seguridad suficiente.
16. El login acepta usuario o correo electrónico en el mismo campo.
17. Las contraseñas del estándar del MVP solo aplican a las cuentas 
    iniciales y en entornos locales; al cambiarlas, deben cumplir la 
    política mínima de seguridad.

------------------------------------------------------------------------

# 14. Plan de desarrollo del MVP

El MVP se construirá mediante cuatro sprints.

## 14.1 Base de datos del MVP (Sprints 1 a 4)

Durante los cuatro sprints del MVP la base de datos **se trabaja de
manera local con MySQL**. No se contempla una base de datos en la nube
ni hosting de base de datos dentro del alcance del MVP.

### Reglas

-   Cada integrante del equipo ejecuta su propia instancia local de
    MySQL en su equipo de desarrollo.
-   La base de datos se llama `motorix` (nombre sugerido; configurable
    por variable de entorno).
-   Todo el esquema y los datos iniciales se definen mediante scripts
    SQL dentro de la carpeta `database/` del repositorio, de modo que
    cualquier integrante pueda recrear la base de datos desde cero.
-   Los archivos físicos de datos de MySQL **no se versionan en Git**.
    Si se utiliza un directorio de datos local dentro del proyecto
    (por ejemplo, `database/data/` con Docker o un datadir propio),
    debe estar en `.gitignore`.
-   Los cambios de esquema se agregan como nuevos scripts numerados; no
    se editan scripts de sprints anteriores ya aplicados.
-   El script de seeds DEBE incluir datos de ejemplo suficientes para que 
    la aplicacion muestre informacion al arrancar: al menos un usuario 
    por rol (admin, recepcion, mecanico), clientes de prueba con sus 
    vehiculos asociados, y (en sprints posteriores) citas, ordenes, 
    refacciones y pagos de ejemplo.
-   Al terminar la instalacion inicial del entorno local, el desarrollador 
    DEBE poder abrir la aplicacion y ver informacion real en las pantallas 
    sin tener que capturar datos manualmente.
-   Los seeds DEBEN ser idempotentes: si se corren de nuevo, no duplican 
    registros ni rompen las referencias existentes.
-   La conexión se configura únicamente mediante variables de entorno,
    sin credenciales en el código:

``` text
DB_HOST=localhost
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=motorix
```

-   `.env.example` debe incluir estas variables sin valores sensibles.
-   Se debe usar un usuario de MySQL dedicado al proyecto, no el
    usuario `root`, en la configuración de la aplicación.
-   Usar el motor InnoDB, llaves foráneas, restricciones `NOT NULL` y
    `UNIQUE` donde corresponda, y codificación `utf8mb4`.
-   El backend sigue siendo el único componente que accede a la base de
    datos; el frontend nunca se conecta directamente.

### Estructura de la carpeta `database/`

``` text
database/
├── migrations/
│   ├── 001_sprint1_users_clients_vehicles.sql
│   ├── 002_sprint2_appointments_service_orders.sql
│   ├── 003_sprint3_maintenance_inventory.sql
│   └── 004_sprint4_payments_tickets.sql
├── seeds/
│   └── 001_initial_roles_and_admin.sql
├── scripts/
│   └── (creación de base de datos, reinicio local, respaldo)
├── data/            (opcional, ignorada por Git)
└── README.md        (cómo crear y reiniciar la base de datos local)
```

### Tablas por sprint

| Sprint | Tablas principales |
|--------|--------------------|
| 1 | `users`, `clients`, `vehicles` |
| 2 | `appointments`, `service_orders` y tablas de servicios realizados y mano de obra por orden |
| 3 | `parts`, `inventory_movements`, `maintenance` y tabla de refacciones utilizadas por orden |
| 4 | `payments`, `tickets` |

Los nombres y campos definitivos se validan al especificar cada sprint.
El script de seeds no debe contener contraseñas en texto plano: el
usuario administrador inicial se crea con contraseña hasheada (bcrypt) o
mediante un comando/script del backend.

------------------------------------------------------------------------

## Sprint 1 --- Base del sistema y gestión de clientes

### Objetivo

Crear la estructura inicial del sistema y permitir el registro de
clientes y sus vehículos.

### Historias

-   Como administrador puedo iniciar sesión en el sistema.
-   Como administrador puedo gestionar usuarios y roles de acceso.
-   Como recepcionista puedo registrar y consultar clientes.
-   Como recepcionista puedo editar la información de los clientes.
-   Como recepcionista puedo registrar vehículos.
-   Como recepcionista puedo asociar un vehículo con su propietario.

### Resultado esperado

Debe ser posible:

``` text
Iniciar sesión
→ registrar cliente
→ registrar vehículo
→ asociarlo con el cliente
→ consultar la información
```

### Prioridad técnica

Este sprint debe establecer: - estructura del repositorio; - conexión
con la base de datos MySQL local y su esquema inicial
(`database/`); - configuración mediante variables de entorno; -
autenticación; - autorización básica por roles; - modelos de usuario,
cliente y vehículo; - endpoints necesarios; - primeras pantallas
funcionales.

------------------------------------------------------------------------

## Sprint 2 --- Citas y órdenes de servicio

### Objetivo

Gestionar la llegada de los vehículos al taller y registrar los trabajos
realizados.

### Historias

-   Como recepcionista puedo registrar y consultar citas.
-   Como recepcionista puedo crear órdenes de servicio.
-   Como recepcionista puedo asociar una orden con un cliente y
    vehículo.
-   Como mecánico puedo consultar las órdenes asignadas.
-   Como mecánico puedo registrar diagnósticos y servicios realizados.
-   Como mecánico puedo cambiar el estado de una orden.
-   Como mecánico puedo agregar observaciones y recomendaciones.

### Resultado esperado

``` text
Registrar cita
→ recibir vehículo
→ crear orden
→ asignar / consultar orden
→ registrar diagnóstico
→ registrar servicios
→ actualizar estado
→ terminar trabajo
```

------------------------------------------------------------------------

## Sprint 3 --- Historial, mantenimiento e inventario

### Objetivo

Mantener el historial de los vehículos, dar seguimiento a próximos
mantenimientos y controlar las refacciones disponibles.

### Historias

-   Como mecánico puedo consultar el historial de servicios de un
    vehículo.
-   Como mecánico puedo registrar el kilometraje de cada servicio.
-   Como mecánico puedo establecer el próximo mantenimiento.
-   Como recepcionista puedo consultar los mantenimientos próximos.
-   Como administrador puedo registrar y consultar refacciones.
-   Como administrador puedo consultar el stock disponible.
-   Como mecánico puedo agregar refacciones utilizadas a una orden.
-   Como administrador puedo visualizar alertas de stock bajo.

### Resultado esperado

``` text
Finalizar servicio
→ conservarlo en historial
→ registrar próximo mantenimiento
→ utilizar refacciones
→ actualizar inventario
→ mostrar alertas de stock
```

------------------------------------------------------------------------

## Sprint 4 --- Pagos, tickets y panel de control

### Objetivo

Completar el proceso de atención del vehículo y proporcionar información
general de las operaciones del taller.

### Historias

-   Como recepcionista puedo registrar el pago de una orden.
-   Como recepcionista puedo seleccionar el método de pago.
-   Como recepcionista puedo gestionar pagos mediante Mercado Pago.
-   Como recepcionista puedo generar tickets de servicio.
-   Como administrador puedo consultar información general desde el
    panel de control.
-   Como administrador puedo visualizar órdenes, citas, mantenimientos y
    alertas de inventario.

### Resultado esperado

``` text
Orden terminada
→ calcular / consultar total
→ registrar pago
→ Mercado Pago cuando corresponda
→ generar ticket
→ consultar indicadores en dashboard
```

------------------------------------------------------------------------

# 15. Definición funcional del MVP

El MVP se considera demostrable cuando el siguiente flujo puede
ejecutarse de extremo a extremo:

``` text
Login
→ Cliente
→ Vehículo
→ Cita
→ Orden de servicio
→ Diagnóstico
→ Servicios
→ Refacciones
→ Historial
→ Próximo mantenimiento
→ Pago
→ Ticket
→ Dashboard
```

El MVP no requiere automatizar todos los escenarios posibles. Debe
demostrar correctamente el flujo principal y los requisitos de alto
nivel comprometidos.

------------------------------------------------------------------------

## 16. Sistema de diseño (UI)

> Documento complementario: `docs/design-system.md`. Si una decisión de esa guía cambia, actualizarla antes de modificar la interfaz.

La interfaz de Motorix debe verse **profesional, sobria y con identidad propia**, no genérica ni "hecha por IA". El sistema de diseño completo vive en `docs/design-system.md` y cubre:

- **Base obligatoria**: Flutter + Dart con Material Design 3 (`useMaterial3: true`) y `ThemeData` propio en `client/lib/utils/app_theme.dart`. No se usa el tema por defecto de Material.
- **Librerías complementarias permitidas**: máximo una de componentes de UI (por decidir), además de las de apoyo (`google_fonts`, `fl_chart`, `data_table_2`, un único set de íconos). Toda dependencia nueva se propone antes de agregarse.
- **Paleta de marca**: rojo grisáceo apagado (`#9B4F55`) como color primario, sidebar oscuro (`#2B2325`), fondo claro (`#F5F2F1`) y colores de estado diferenciados (`warning`, `success`, `danger`). Sin degradados ni más de un color de acento.
- **Tipografía**: IBM Plex Sans (vía `google_fonts`), escala fija de 4 tamaños (12, 14, 18, 28).
- **Tokens**: color, tipografía, espaciado (escala de 4 px: 4, 8, 12, 16, 24, 32) y radios (6 px botones/inputs; 8 px paneles, tarjetas, chips y diálogos; 12 px o completo en elementos tipo pill) se definen una sola vez en el tema. Las pantallas no llevan valores sueltos.
- **Movimiento**: toda transición y cambio de estado DEBE ser suave (150 ms estados, 200 ms aparición de elementos y sidebar, 250 ms navegación), con `Curves.easeInOut` o `Curves.easeOutCubic`. Sin rebotes, zooms ni efectos vistosos, y respetando la preferencia de reducir movimiento.
- **Layout**: sidebar colapsable (`NavigationRail` extendido, ~260 px expandido / ~72 px colapsado, estado guardado en un `Provider`), header con título, buscador, notificaciones, usuario y rol. Solo se muestran los módulos del sprint actual y del rol del usuario; los permisos se validan también en backend.
- **Componentes**: dashboard con máximo 4 indicadores y una gráfica principal; tablas densas con filtros, chips de estado y acciones al final; tarjetas solo cuando agrupen contenido que lo necesite.
- **Estados de la interfaz**: toda pantalla muestra estados vacío, cargando, error (en español, sin trazas internas) y éxito.
- **Confirmaciones obligatorias**: cerrar sesión, cancelar citas, cancelar/anular/entregar órdenes, eliminar o desactivar registros, registrar pagos y salir de formularios con cambios sin guardar DEBEN pedir confirmación ("Confirmar" / "Cancelar").
- **Qué evitar**: degradados morados o neón, glassmorphism, todo en tarjetas, emojis como íconos, gráficas decorativas, textos genéricos de marketing y cambios de estado bruscos.

CLAUDE DEBE leer `docs/design-system.md` antes de construir cualquier pantalla del frontend, y una pantalla solo se considera terminada cuando cumple los criterios de la sección 11 de esa guía.

------------------------------------------------------------------------

# 17. Supuestos y restricciones

## Supuesto

El taller cuenta con acceso a internet y con personal que puede utilizar
el sistema para registrar y consultar información.

## Restricción

El funcionamiento de servicios externos, como Mercado Pago, depende de
su disponibilidad y de la conexión a internet.

------------------------------------------------------------------------

# 18. Riesgos identificados

-   Resistencia del personal al cambio de un control manual a uno
    digital.
-   Registro incorrecto o incompleto de vehículos, servicios o
    refacciones.
-   Fallas de conexión a internet.
-   Dependencia de servicios externos como Mercado Pago.

------------------------------------------------------------------------

# 19. Presupuesto y contexto académico

El proyecto es académico. El costo principal corresponde a las horas de
trabajo del equipo.

Pueden existir gastos relacionados con: - hospedaje; - dominio; -
almacenamiento; - integraciones externas.

Durante el MVP se deben priorizar alternativas gratuitas o de bajo costo
cuando sean suficientes.

------------------------------------------------------------------------

# 20. Interesados

  Interesado             Participación                      Influencia
  ---------------------- ---------------------------------- ------------
  Dueño del taller       Patrocinador y administrador       Alta
  Recepcionista          Usuario operativo                  Media
  Mecánicos              Usuarios operativos                Media
  Clientes               Usuarios finales / beneficiarios   Media
  Equipo de desarrollo   Diseño e implementación            Alta

------------------------------------------------------------------------

# 21. Director del proyecto

**Jorge Francisco Domínguez Ramírez**

Responsabilidades: - Coordinar el desarrollo. - Definir prioridades. -
Supervisar el cumplimiento del alcance.

------------------------------------------------------------------------

# 22. Equipo

-   Jorge Francisco Domínguez Ramírez
-   José Adrián Mendoza Hernández
-   Edward Negrete Bustos
-   Raúl Francisco Amador
-   Ignacio Joaquín Trejo
-   Carlos Castro Rafael

------------------------------------------------------------------------

# 23. Criterios generales de desarrollo

CLAUDE debe favorecer:

### Código

-   Nombres claros y consistentes.
-   Funciones pequeñas y enfocadas.
-   Evitar duplicación.
-   Separar lógica de negocio de controladores y componentes visuales.
-   Manejo centralizado y consistente de errores.
-   Validar entradas en backend.
-   No confiar únicamente en validaciones del frontend.
-   Usar ES Modules (`import`/`export`) en todo el código JavaScript
    del backend. No usar CommonJS (`require`/`module.exports`).
-   Mantener `"type": "module"` en `package.json` del backend.

### API

-   Rutas coherentes.
-   Respuestas JSON consistentes.
-   Códigos HTTP apropiados.
-   Middleware de autenticación.
-   Middleware de autorización.
-   Validación de payloads.

### Seguridad

-   Contraseñas nunca almacenadas en texto plano.
-   Secretos fuera del repositorio.
-   `.env` ignorado por Git.
-   Proporcionar `.env.example` sin secretos.
-   Sanitizar y validar entradas.
-   No exponer trazas internas al usuario final.
-   No almacenar información bancaria sensible.

### Persistencia

-   Mantener integridad referencial mediante llaves foráneas en MySQL.
-   Versionar los cambios de esquema como scripts en `database/`.
-   Evitar duplicar información derivable.
-   Registrar fechas relevantes.
-   Diseñar índices para búsquedas frecuentes cuando sea necesario.

### Git

-   Cambios pequeños y enfocados.
-   No mezclar funcionalidades no relacionadas en el mismo cambio.
-   No subir secretos.
-   Mantener README y documentación actualizados conforme cambie la
    arquitectura.

------------------------------------------------------------------------

# 24. Estrategia recomendada para CLAUDE

Cuando se solicite implementar un sprint:

1.  Leer este archivo completo.
2.  Revisar el estado actual del repositorio.
3.  Identificar qué historias del sprint ya existen.
4.  Proponer un plan de implementación.
5.  Implementar únicamente el alcance acordado.
6.  Ejecutar pruebas/lint disponibles.
7.  Verificar manualmente el flujo principal afectado.
8.  Actualizar documentación si cambió alguna decisión técnica.
9.  Reportar:
    -   archivos modificados;
    -   historias cubiertas;
    -   pruebas realizadas;
    -   pendientes;
    -   riesgos o decisiones abiertas.

No marcar una historia como terminada únicamente porque existe una
interfaz visual. Debe funcionar de extremo a extremo cuando la historia
requiera persistencia o lógica de backend.

------------------------------------------------------------------------

# 25. Definition of Done base para historias del MVP

Una historia puede considerarse terminada cuando, según corresponda:

-   La funcionalidad solicitada está implementada.
-   Frontend y backend están integrados.
-   Los datos se almacenan/consultan correctamente.
-   Se validan entradas relevantes.
-   Se respetan permisos.
-   Se manejan errores previsibles.
-   No rompe flujos existentes.
-   La interfaz mantiene consistencia con el sistema.
-   Se realizó una prueba funcional.
-   No existen secretos en el código.
-   La documentación se actualizó si hubo una decisión relevante.

------------------------------------------------------------------------

# 26. Orden recomendado para comenzar

No iniciar por Mercado Pago, dashboard o tickets.

El primer objetivo técnico debe ser completar el núcleo del **Sprint
1**:

``` text
1. Inicializar estructura del proyecto.
2. Configurar backend.
3. Configurar frontend.
4. Configurar MySQL local y crear el esquema inicial en `database/`.
5. Definir variables de entorno.
6. Crear modelo de usuario y roles.
7. Implementar autenticación.
8. Implementar autorización.
9. Crear módulo de clientes.
10. Crear módulo de vehículos.
11. Relacionar cliente ↔ vehículo.
12. Crear interfaz mínima funcional.
13. Probar flujo completo del Sprint 1.
```

Después continuar secuencialmente con Sprint 2, Sprint 3 y Sprint 4.

------------------------------------------------------------------------

# 27. Decisiones pendientes

Antes de asumirlas como definitivas, el equipo debe decidir:

-   Servicio de hosting.
-   Proveedor/estrategia de almacenamiento para evidencias.
-   Implementación concreta de PDF/tickets.
-   Alcance exacto de Mercado Pago para la demostración.

### Decisiones resueltas durante el Sprint 1

-   **Frontend**: Flutter + Dart con Provider para el estado. Se descartó
    React: la sección 10 ya fijaba Flutter como stack del MVP.
-   **Acceso a datos desde Node.js**: driver `mysql2` directo, sin ORM ni
    query builder. La capa vive en `server/config/db.js` y `server/models/`;
    cambiarla más adelante no toca servicios ni controladores.
-   **Migraciones**: scripts SQL numerados e inmutables en
    `database/migrations/` ejecutados por `database/scripts/apply-*.ps1`
    (idempotentes, con registro en `schema_migrations`).
-   **MySQL local**: instalación nativa, no Docker (decisión R-04), con un
    usuario dedicado `motorix_app` creado por
    `database/scripts/crear-entorno.ps1` (las migraciones se aplican con
    `database/scripts/aplicar-migraciones.ps1`).
-   **Validación de entradas en el backend**: `zod` (esquemas en
    `server/validators/`), con mensajes en español.
-   **Hash de contraseñas**: `bcryptjs` (bcrypt en JavaScript puro, costo 10),
    para evitar compilar módulos nativos en Windows.
-   **Sesión y bloqueo**: JWT con duración de 8 horas; el rol y el estado
    activo del usuario se consultan en cada petición. Tras 5 intentos de
    inicio de sesión fallidos consecutivos la cuenta se bloquea 15 minutos.
-   **Librería complementaria de componentes de UI**: ninguna. Se usa
    Material 3 con tema propio, más `google_fonts`, `data_table_2` (versión
    2.6.0; la 3.x no es compatible con Flutter 3.47) y el set de íconos
    `lucide_icons_flutter` (pendiente de confirmación del equipo).
-   **Reglas funcionales del Sprint 1**: MECHANIC solo consulta clientes y
    vehículos; un teléfono de cliente repetido avisa y pide confirmación; la
    placa es única y el número de serie es opcional pero único si se captura;
    el administrador inicial se crea con `server/scripts/create-admin.js`.
-   **Pruebas automatizadas**: Jest + supertest en el backend (unit,
    integración y contrato, contra la base `motorix_test`) y `flutter test`
    en el frontend (providers y widgets).
-   **Ramas y commits**: una rama por feature (`NNN-nombre-en-minusculas`)
    y Conventional Commits con la descripción en español.
-   **Estructura del backend**: sin carpeta `src/` intermedia; las capas
    (`config`, `models`, `services`, `controllers`, `routes`, `middlewares`,
    `validators`, `utils`) viven directamente en `server/`, manteniendo la
    separación de responsabilidades de la sección 11.

### Decisiones resueltas durante el ajuste del MVP (2026-10-09)

- **Login**: se acepta usuario o correo electrónico en el mismo campo para todos los roles.
- **Estándar de usuarios del MVP**: se fijan cuentas iniciales `admin`, `recepcion` y `mecanico` con contraseñas `Admin2026!`, `Recepcion2026!` y `Mecanico2026!` respectivamente, solo para pruebas locales. Se agrega `username` único a la entidad `User`.

CLAUDE puede proponer opciones para estas decisiones, pero no debe
introducir dependencias grandes sin justificar su necesidad.

------------------------------------------------------------------------

# 28. Fuente de verdad y control de cambios

Este archivo describe el alcance inicial acordado para Motorix.

Si durante el desarrollo cambia: - una regla de negocio; - un rol; - una
entidad; - un requisito; - un sprint; - una integración; - el alcance
del MVP;

se debe actualizar este documento para evitar que el código y la
planeación se contradigan.

**Prioridad actual:** entregar un MVP funcional, demostrable y coherente
antes de incorporar funcionalidades adicionales.
