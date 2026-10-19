# Motorix

Sistema de Gestión para Taller Mecánico. Proyecto académico de Ingeniería en Sistemas Computacionales,
desarrollado con **Desarrollo Guiado por Especificaciones (SDD)** usando Spec Kit.

Este repositorio contiene el **Sprint 1** del MVP: autenticación con roles, gestión de usuarios, clientes y
vehículos. El alcance completo y las reglas de negocio están en [`docs/project-context.md`](docs/project-context.md)
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

La documentación de la funcionalidad del Sprint 1 está en [`specs/001-base-clientes-vehiculos/`](specs/001-base-clientes-vehiculos/):
`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`, `tasks.md` y
`validacion-quickstart.md`.

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

Cuentas iniciales: `admin`, `recepcion` y `mecanico` (se puede entrar con el usuario o con el correo).

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
