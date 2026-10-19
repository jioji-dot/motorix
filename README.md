# Motorix

Sistema de Gestión para Taller Mecánico. Proyecto académico de Ingeniería en Sistemas Computacionales,
desarrollado con **Desarrollo Guiado por Especificaciones (SDD)** usando Spec Kit.

Este repositorio contiene los **Sprints 1, 2 y 3** del MVP:

- **Sprint 1**: autenticación con roles, gestión de usuarios, clientes y vehículos.
- **Sprint 2**: agenda de citas y órdenes de servicio (asignación de mecánico, diagnóstico, servicios, mano de obra,
  total calculado, estados con historial y cancelación).
- **Sprint 3**: historial de servicios del vehículo, mantenimientos programados (próximos y vencidos) e inventario de
  refacciones con movimientos, uso en las órdenes y alertas de stock bajo.

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
y 7 mantenimientos programados en cada clasificación, para que cada pantalla muestre información al abrirla.

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
| Mecánico | Consulta | Programa y edita | Consulta (sin precio de compra) | Solo en sus órdenes en curso |

- El **historial** es una vista calculada: las órdenes Terminadas y Entregadas del vehículo, de la más reciente a la más
  antigua, con el kilometraje del servicio (o el de entrada si falta).
- Un **mantenimiento** se programa por fecha, por kilometraje o por ambos y se clasifica al consultarlo: **Vencido** si
  la fecha pasó o el kilometraje actual alcanzó el próximo; **Próximo** si faltan 15 días o menos, o 500 km o menos;
  **Normal** en otro caso. Registrar otro del mismo tipo deja el anterior como Atendido.
- El **stock** de cada refacción solo cambia con movimientos inmutables (entrada, salida o ajuste) dentro de una
  transacción que impide dejarlo negativo; siempre es igual a la suma de sus movimientos. Cada uso en una orden genera una
  salida ligada a ella (con el precio de venta vigente, que se conserva) y cancelar la orden regresa las piezas.

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
