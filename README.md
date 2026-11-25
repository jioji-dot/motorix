# Motorix

Sistema de Gestión para Taller Mecánico. Proyecto académico de Ingeniería en Sistemas Computacionales,
desarrollado con **Desarrollo Guiado por Especificaciones (SDD)** usando Spec Kit.

Este repositorio contiene los **cuatro sprints** del MVP y los sprints posteriores al MVP (los **Sprints 5, 6 y 7**; el 7 es el último del proyecto):

- **Sprint 1**: autenticación con roles, gestión de usuarios, clientes y vehículos.
- **Sprint 2**: agenda de citas y órdenes de servicio (asignación de mecánico, diagnóstico, servicios, mano de obra,
  total calculado, estados con historial y cancelación).
- **Sprint 3**: historial de servicios del vehículo, mantenimientos programados (próximos y vencidos) e inventario de
  refacciones con movimientos, uso en las órdenes y alertas de stock bajo.
- **Sprint 4**: pagos de las órdenes (parciales, con cuatro métodos y cobro con enlace de Mercado Pago en sandbox), ticket de
  servicio imprimible y panel de control del administrador.
- **Sprint 5** (posterior al MVP): precios de refacciones y cobro completo, con límites de importes, confirmación de la venta menor al
  costo y precios ocultos al mecánico.
- **Sprint 6** (posterior al MVP): notificaciones internas (campana con avisos de mantenimientos, citas, stock y órdenes detenidas, según el
  rol) y la lista de clientes por avisar, sin enviar mensajes.
- **Sprint 7** (posterior al MVP, el último): configuración del taller, catálogo de tipos de servicio con intervalos, próximo servicio en el
  ticket, términos y condiciones con aceptación por versión, bitácora, cierre por inactividad, encabezados de seguridad y reportes del
  administrador con exportación a CSV.

El alcance completo y las reglas de negocio están en [`docs/project-context.md`](docs/project-context.md)
y las reglas del proyecto en la [constitución](.specify/memory/constitution.md).

## Estructura

```text
motorix/
├── client/      Aplicación Flutter (Material 3, Provider)
├── server/      API REST en Node.js + Express (ES Modules) con mysql2
├── database/    Migraciones, seeds y scripts de la base MySQL local
├── docs/        Contexto del proyecto, reglas, sistema de diseño y sprints
├── specs/       Artefactos de Spec Kit de cada funcionalidad
└── .specify/    Constitución, plantillas y scripts de Spec Kit
```

La documentación de cada funcionalidad está en `specs/`:

- [`specs/001-base-clientes-vehiculos/`](specs/001-base-clientes-vehiculos/) (Sprint 1)
- [`specs/002-citas-ordenes-servicio/`](specs/002-citas-ordenes-servicio/) (Sprint 2)
- [`specs/003-historial-mantenimiento-inventario/`](specs/003-historial-mantenimiento-inventario/) (Sprint 3)
- [`specs/004-pagos-tickets-dashboard/`](specs/004-pagos-tickets-dashboard/) (Sprint 4)
- [`specs/005-precios-refacciones-cobro/`](specs/005-precios-refacciones-cobro/) (Sprint 5)
- [`specs/006-notificaciones-internas/`](specs/006-notificaciones-internas/) (Sprint 6)
- [`specs/007-reportes-configuracion/`](specs/007-reportes-configuracion/) (Sprint 7)

Cada carpeta incluye `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`,
`tasks.md` y `validacion-quickstart.md`.

## Requisitos

- Node.js 20 o superior (probado con 24)
- Flutter 3.47 (Dart incluido)
- MySQL 8.0 local, con el cliente `mysql` disponible
- PowerShell (para los scripts de `database/scripts/`)

## Instalación

### 1. Base de datos local

La contraseña del usuario `root` de MySQL se entrega **solo por variable de entorno** y nunca se guarda en el
repositorio.

```powershell
$env:MYSQL_ROOT_PASSWORD = '<contraseña de root>'
./database/scripts/crear-entorno.ps1 -Puerto 3306 -Base motorix -BasePrueba motorix_test -Usuario motorix_app
Remove-Item Env:MYSQL_ROOT_PASSWORD
./database/scripts/aplicar-migraciones.ps1 -Base motorix
./database/scripts/aplicar-migraciones.ps1 -Base motorix_test
```

El script crea las bases, un usuario dedicado (la aplicación nunca usa `root`) y el archivo `.env` con una
contraseña y un `JWT_SECRET` generados. Si en tu servidor ya existen bases o un usuario con esos nombres, usa otros
(por ejemplo `-Base motorix_sdd -BasePrueba motorix_sdd_test -Usuario motorix_sdd_app`): el script **no modifica**
un usuario existente. Más detalles en [`database/README.md`](database/README.md).

### 2. Variables de entorno

`crear-entorno.ps1` genera el `.env`. Para ver todas las variables, consulta [`.env.example`](.env.example). Las
variables `SEED_PASSWORD_ADMIN`, `SEED_PASSWORD_RECEPCION` y `SEED_PASSWORD_MECANICO` contienen las contraseñas de
las cuentas iniciales de prueba (consulta el estándar en `docs/project-context.md`) y solo se usan en local.

### 3. Backend

```powershell
cd server
npm install
npm run seed     # usuarios, clientes y vehículos de ejemplo (idempotente)
npm start        # API en http://localhost:3000/api
```

Cuentas iniciales: `admin`, `recepcion`, `mecanico` y `mecanico2` (se puede entrar con el usuario o con el correo).
El seed carga clientes, vehículos, 8 citas (una o más por estado) y 7 órdenes de servicio (una por estado) repartidas entre
los dos mecánicos, 14 refacciones (una agotada y dos con stock bajo) con sus movimientos, refacciones usadas en las órdenes
7 mantenimientos programados en cada clasificación y pagos de ejemplo (una orden cobrada completa con su ticket, una con pago
parcial y un intento de Mercado Pago rechazado), para que cada pantalla muestre información al abrirla.

### Qué puede hacer cada rol

| Rol | Clientes y vehículos | Citas | Órdenes de servicio | Usuarios |
|-----|----------------------|-------|---------------------|----------|
| Administrador | Gestiona | Gestiona | Todo (crea, documenta, cambia estado) | Gestiona |
| Recepcionista | Gestiona | Gestiona | Crea, reasigna, entrega y cancela | — |
| Mecánico | Consulta | — | Ve solo las suyas; documenta y avanza el trabajo hasta Terminado | — |

Estados de la orden: Recibido → Diagnóstico → En reparación → Terminado → Entregado (Esperando refacción es un desvío
desde En reparación; una orden en curso puede cancelarse con motivo). Una orden entregada o cancelada ya no cambia.

### Historial, mantenimientos e inventario (Sprint 3)

| Rol | Historial del vehículo | Mantenimientos | Inventario | Refacciones en la orden |
|-----|------------------------|----------------|------------|-------------------------|
| Administrador | Consulta | Programa y edita | Gestiona (catálogo, movimientos, precio de compra) | Agrega, cambia y quita |
| Recepcionista | Consulta | Consulta | Consulta (sin precio de compra) | — |
| Mecánico | Consulta | Programa y edita | Consulta (sin precios, desde el Sprint 5) | Solo en sus órdenes en curso, sin ver precios |

- El **historial** es una vista calculada: las órdenes Terminadas y Entregadas del vehículo, de la más reciente a la más
  antigua, con el kilometraje del servicio (o el de entrada si falta).
- Un **mantenimiento** se programa por fecha, por kilometraje o por ambos y se clasifica al consultarlo: **Vencido** si
  la fecha pasó o el kilometraje actual alcanzó el próximo; **Próximo** si faltan 15 días o menos, o 500 km o menos;
  **Normal** en otro caso. Registrar otro del mismo tipo deja el anterior como Atendido.
- El **stock** de cada refacción solo cambia con movimientos inmutables (entrada, salida o ajuste) dentro de una
  transacción que impide dejarlo negativo; siempre es igual a la suma de sus movimientos. Cada uso en una orden genera una
  salida ligada a ella (con el precio de venta vigente, que se conserva) y cancelar la orden regresa las piezas.

### Precios y cobro de refacciones (Sprint 5)

- La línea de refacción de una orden **guarda el precio de venta vigente al agregarla**: un cambio posterior del catálogo no altera la
  línea, el total, el pago ni el ticket ya emitidos.
- El **precio de compra** solo lo ve el administrador. El **mecánico no ve ningún precio ni importe de refacciones ni el total de la
  orden**; recepción ve el precio de venta y los importes.
- Los precios, el importe de una línea y el total de la orden van de 0 a **99,999,999.99**. Guardar una venta menor al precio de compra
  exige que el administrador lo confirme.

### Notificaciones internas y clientes por avisar (Sprint 6)

| Rol | Avisos de la campana | Insignias | Clientes por avisar |
|-----|----------------------|-----------|---------------------|
| Administrador | Todos: mantenimientos vencidos y próximos, citas de hoy, stock agotado y bajo y órdenes detenidas | Inventario (alertas de stock) y Clientes por avisar | Ve la lista y marca avisados |
| Recepcionista | Todos menos stock | Clientes por avisar | Ve la lista y marca avisados |
| Mecánico | Solo las órdenes detenidas asignadas a él | — | — (la sección no aparece) |

- Los avisos **se calculan al consultar** con los mismos criterios de Mantenimientos, Inventario y el panel de control; solo se guarda qué
  avisos leyó cada usuario. Un aviso que cambia de estado (próximo a vencido, stock bajo a agotado) reaparece como no leído.
- Una orden está **detenida** si sigue abierta y lleva **72 horas o más sin cambio de estado**. El contador se actualiza al iniciar sesión,
  al cambiar de sección y cada 60 segundos; el panel muestra hasta 10 avisos por tipo con el total real.
- **Clientes por avisar**: vehículos listos (orden Terminada sin entregar), citas de mañana y mantenimientos próximos o vencidos, con el
  teléfono del cliente. Marcar a alguien como avisado guarda quién y cuándo (con una nota opcional) y ocurre **una sola vez por hecho**.
  La aplicación **no envía ningún mensaje**: la persona llama o avisa en persona.

### Configuración, reportes, términos y seguridad (Sprint 7)

| Rol | Configuración y catálogo | Reportes | Bitácora | Términos |
|-----|--------------------------|----------|----------|----------|
| Administrador | Edita datos del taller, márgenes y tipos de servicio | Los cinco, con exportación a CSV | Consulta (solo lectura) | Publica versiones y ve quién aceptó |
| Recepcionista | Solo elige tipos de servicio activos | — | — | Acepta la versión vigente |
| Mecánico | Solo elige tipos de servicio activos | — | — | Acepta la versión vigente |

- Los **datos del taller** del ticket y los **márgenes de «Próximo»** se editan en Configuración; `WORKSHOP_*` de `.env` queda como valor de
  respaldo. El ticket guarda una instantánea de esos datos y de su **próximo servicio** (calculado con los intervalos de los tipos de servicio).
- Los **reportes** (ingresos por periodo, servicios frecuentes, productividad por mecánico, refacciones con margen y rotación) usan un rango de
  hasta 366 días, importes en centavos enteros y se exportan a CSV con un enlace de 60 segundos.
- Al ingresar hay que **aceptar los términos y condiciones** vigentes; el servidor rechaza toda operación sin la aceptación (`403`).
- La **sesión se cierra a los 30 minutos sin actividad**; la **bitácora** registra inicios de sesión fallidos, cambios de usuarios, de precios, de
  configuración y del catálogo, pagos cancelados y la publicación de términos, sin guardar contraseñas ni datos de pago.

### Pagos, ticket y panel de control (Sprint 4)

| Rol | Pagos | Ticket | Panel de control |
|-----|-------|--------|------------------|
| Administrador | Registra y consulta | Genera, consulta e imprime | Sí |
| Recepcionista | Registra y consulta | Genera, consulta e imprime | — |
| Mecánico | — | — | — |

- Una orden **Terminada o Entregada** admite pagos parciales hasta cubrir su total (efectivo, tarjeta cobrada en terminal externa,
  transferencia o Mercado Pago). Motorix **no pide ni guarda datos de tarjeta**. No hay reembolsos: un pago Pagado no se modifica.
- **Mercado Pago** funciona con un enlace de pago en modo de pruebas (sandbox): el cliente paga en la página de Mercado Pago y el
  estado se actualiza por notificación o con el botón "Actualizar estado". Configura `MP_ACCESS_TOKEN` (credencial de **prueba**)
  en tu `.env`; sin ella, el cobro con Mercado Pago avisa que no está configurado y se puede usar otro método. Para recibir
  notificaciones en local hace falta una dirección pública (`MP_NOTIFICATION_URL`); sin ella, usa "Actualizar estado".
- El **ticket** (uno por orden, folio `TK-000123`) se arma con los datos vigentes de la orden y sus pagos. "Imprimir" lo abre en el
  navegador del sistema, donde también se puede guardar como PDF; el enlace dura 5 minutos.
- El **panel de control** (solo administrador) muestra órdenes por estado y por cobrar, citas de hoy y de los próximos 7 días,
  mantenimientos vencidos y próximos, alertas de inventario y lo cobrado hoy y en el mes; cada cifra coincide con su módulo.

### 4. Frontend

```powershell
cd client
flutter pub get
flutter run -d windows        # o: flutter run -d chrome
```

Si la API no está en `http://localhost:3000/api`, indícalo con
`--dart-define=API_URL=http://servidor:3000/api`.

## Pruebas

```powershell
cd server; npm test            # Jest: unitarias, de integración y de contrato (base *_test)
cd client; flutter test        # Pruebas de providers y widgets
```

Las pruebas de integración se ejecutan siempre contra la base de pruebas (el nombre debe terminar en `_test`) y
se niegan a ejecutarse contra la base principal. Para correr las del backend, la base de pruebas debe tener
aplicadas las migraciones.

## Convenciones

- Todo el texto para personas (documentación, comentarios, mensajes, pruebas) va en español; los identificadores
  del código, en inglés.
- Commits con Conventional Commits: tipo y alcance en inglés, descripción en español.
- Backend con ES Modules; los permisos se validan siempre en el backend.
- Sin secretos en el repositorio: `.env` está ignorado por Git.
