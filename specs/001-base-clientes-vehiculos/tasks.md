---

description: "Lista de tareas del Sprint 1: base del sistema, clientes y vehículos"
---

# Tareas: Base del sistema, clientes y vehículos (Sprint 1)

**Entrada**: Documentos de diseño en `/specs/001-base-clientes-vehiculos/`

**Requisitos previos**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Pruebas**: Se incluyen tareas de pruebas porque la constitución (Principio VII) exige pruebas para la lógica de negocio y los permisos, y pruebas de integración y contrato contra `motorix_test`. Escribirlas primero y comprobar que fallan antes de implementar.

**Organización**: Las tareas se agrupan por historia de usuario para implementarlas y probarlas de forma independiente.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Historia]**: Historia de usuario a la que pertenece (US1, US2, ...)
- Todas las rutas son relativas a la raíz del repositorio (`C:\sdd\motorix`)

## Convenciones de rutas

- Backend: `server/` (sin carpeta `src/`), con `config/`, `controllers/`, `models/`, `routes/`, `services/`, `middlewares/`, `validators/`, `utils/`, `scripts/`, `tests/`
- Frontend: `client/lib/` (`models/`, `providers/`, `services/`, `screens/`, `widgets/`, `utils/`) y `client/test/`
- Base de datos: `database/` (`migrations/`, `seeds/`, `scripts/`)
- Comentarios, mensajes al usuario y nombres de pruebas en español; identificadores en inglés (constitución y `CLAUDE.md`)
- Las pruebas de integración y contrato usan SIEMPRE la base `motorix_test`

## Mapa de historias

| Historia | Título | Prioridad | Fase |
|----------|--------|:---------:|:----:|
| US1 | Iniciar sesión según mi rol | P1 | 3 |
| US3 | Registrar y consultar clientes | P1 | 4 |
| US5 | Registrar vehículos con su propietario | P1 | 5 |
| US2 | Gestionar usuarios y roles | P2 | 6 |
| US4 | Editar clientes | P2 | 7 |
| US6 | Datos de ejemplo al arrancar | P3 | 8 |

---

## Fase 1: Preparación (infraestructura compartida)

**Propósito**: Estructura inicial del repositorio y de los proyectos.

- [X] T001 Crear la estructura de carpetas `client/`, `server/` (con `config/`, `controllers/`, `models/`, `routes/`, `services/`, `middlewares/`, `validators/`, `utils/`, `scripts/`, `tests/unit/`, `tests/integration/`, `tests/contract/`, `tests/helpers/`), `database/migrations/`, `database/seeds/`, `database/scripts/` y crear `.gitignore` en la raíz que ignore `.env`, `.env.test`, `node_modules/`, `database/data/` y los artefactos de compilación de Flutter
- [X] T002 Crear `.env.example` en la raíz con `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `SEED_ADMIN_PASSWORD`, `SEED_RECEPTION_PASSWORD` y `SEED_MECHANIC_PASSWORD`, todos sin valores sensibles y con un comentario en español por variable
- [X] T003 Crear `server/package.json` con `"type": "module"`, las dependencias `express`, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`, `helmet`, las de desarrollo `jest` y `supertest`, y los scripts `start`, `dev`, `test` (`node --experimental-vm-modules ./node_modules/jest/bin/jest.js --runInBand`), `db:migrate`, `db:seed` y `db:reset`, usando `--env-file` para cargar el entorno (sin `dotenv`)
- [X] T004 [P] Crear `server/jest.config.js` en modo ESM con `testEnvironment: node`, `globalSetup` apuntando a `server/tests/helpers/globalSetup.js` y los patrones de `tests/unit`, `tests/integration` y `tests/contract`
- [X] T005 [P] Crear el proyecto Flutter para Windows de escritorio en `client/` y declarar en `client/pubspec.yaml` las dependencias `provider`, `http`, `google_fonts`, `data_table_2` y `lucide_icons_flutter`, con `useMaterial3` habilitado en el tema

---

## Fase 2: Fundamentos (prerrequisitos bloqueantes)

**Propósito**: Infraestructura que DEBE estar completa antes de cualquier historia de usuario.

**⚠️ CRÍTICO**: Ninguna historia puede comenzar hasta terminar esta fase.

### Backend: configuración y utilidades

- [X] T006 [P] Implementar `server/config/env.js` que lea y valide `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN` (por defecto `8h`) y `PORT`, y falle con un mensaje claro en español si falta alguna obligatoria
- [X] T007 [P] Implementar `server/config/database.js` con un pool de `mysql2/promise` (charset `utf8mb4`) y una función auxiliar para ejecutar transacciones
- [X] T008 [P] Implementar `server/config/constants.js` con los roles `ADMIN`, `RECEPTIONIST`, `MECHANIC`, `LOGIN_MAX_ATTEMPTS = 5`, `LOGIN_LOCK_MINUTES = 15`, `DEFAULT_PAGE_SIZE = 20` y `MAX_PAGE_SIZE = 100`
- [X] T009 [P] Implementar `server/utils/AppError.js` con `status`, `code`, `message` y `details`, y fábricas para los códigos de `contracts/api.md` (`VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_USERNAME`, `DUPLICATE_EMAIL`, `DUPLICATE_LICENSE_PLATE`, `DUPLICATE_VIN`, `PHONE_DUPLICATE_WARNING`, `LAST_ADMIN_PROTECTED`, `MILEAGE_DECREASE`, `ACCOUNT_LOCKED`, `INTERNAL_ERROR`)
- [X] T010 [P] Implementar `server/utils/normalizers.js` con: recorte de espacios; correo en minúsculas; placa en mayúsculas sin espacios ni guiones; VIN en mayúsculas; paginación (`page`, `pageSize`) con los límites de `constants.js`
- [X] T011 [P] Implementar `server/utils/password.js` con la política (mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número) y funciones `hashPassword`/`comparePassword` con `bcryptjs`
- [X] T012 [P] Implementar `server/utils/response.js` con los envoltorios `{ data }` y `{ data, meta: { page, pageSize, total } }`
- [X] T013 [P] Pruebas unitarias en `server/tests/unit/normalizers.test.js` y `server/tests/unit/password.test.js` con nombres en español (por ejemplo `test_rechaza_contrasena_sin_mayuscula`) que cubran la normalización de placa, correo y VIN, y cada regla de la política de contraseña
- [X] T014 Implementar `server/middlewares/errorHandler.js` y `server/middlewares/notFound.js`: manejo centralizado que devuelva `{ error: { code, message, details } }`, traduzca errores de `zod` a `VALIDATION_ERROR` y los de duplicado de MySQL (`ER_DUP_ENTRY`) al código `DUPLICATE_*` según el índice, y NUNCA exponga trazas internas
- [X] T015 [P] Implementar `server/middlewares/validate.js` que valide `body`, `query` y `params` con un esquema `zod` y lance `VALIDATION_ERROR` con un `details` por campo
- [X] T016 Implementar `server/app.js` (helmet, `express.json`, `GET /api/health` en `server/routes/healthRoutes.js`, `notFound`, `errorHandler`, sin escuchar puerto) y `server/server.js` que arranque el servidor con el puerto de `env.js`

### Base de datos

- [X] T017 [P] Crear `database/scripts/00_create_database.sql` que cree las bases `motorix` y `motorix_test` con `utf8mb4` y collation `utf8mb4_0900_ai_ci`, y el usuario dedicado `motorix_app` con permisos solo sobre esas bases (nunca `root`), con comentarios en español sobre cómo ejecutarlo
- [X] T018 Crear `database/migrations/001_sprint1_users_clients_vehicles.sql` (InnoDB, `utf8mb4`) con las tablas del modelo de datos:
  - `users`: `id` INT UNSIGNED PK AUTO_INCREMENT; `username` VARCHAR(50) NOT NULL UNIQUE; `name` VARCHAR(100) NOT NULL; `email` VARCHAR(150) NOT NULL UNIQUE; `password_hash` VARCHAR(100) NOT NULL; `role` ENUM('ADMIN','RECEPTIONIST','MECHANIC') NOT NULL; `active` TINYINT(1) NOT NULL DEFAULT 1; `failed_login_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0; `locked_until` DATETIME NULL; `created_at` y `updated_at` DATETIME NOT NULL (este último con actualización automática)
  - `clients`: `id` INT UNSIGNED PK AUTO_INCREMENT; `name` VARCHAR(120) NOT NULL; `phone` VARCHAR(20) NOT NULL; `email` VARCHAR(150) NULL; `address` VARCHAR(255) NULL; `active` TINYINT(1) NOT NULL DEFAULT 1; `created_at`, `updated_at`; índices `idx_clients_name (name)` e `idx_clients_phone (phone)`
  - `vehicles`: `id` INT UNSIGNED PK AUTO_INCREMENT; `client_id` INT UNSIGNED NOT NULL con FK a `clients.id` ON DELETE RESTRICT; `brand` VARCHAR(60) NOT NULL; `model` VARCHAR(60) NOT NULL; `year` SMALLINT UNSIGNED NOT NULL; `license_plate` VARCHAR(15) NOT NULL UNIQUE; `vin` CHAR(17) NULL UNIQUE; `color` VARCHAR(30) NULL; `current_mileage` INT UNSIGNED NOT NULL DEFAULT 0; `created_at`, `updated_at`; índice `idx_vehicles_client (client_id)`
- [X] T019 Implementar `server/scripts/migrate.js`: crea `schema_migrations` (`filename` VARCHAR(255) PK, `checksum` CHAR(64), `applied_at` DATETIME) si no existe, aplica en orden los archivos de `database/migrations/` aún no registrados, guarda el SHA-256 de cada uno y se niega a continuar, con mensaje en español, si un archivo ya aplicado cambió; debe ser idempotente
- [X] T020 [P] Implementar `server/scripts/reset-db.js` que elimine todas las tablas de `DB_NAME`, vuelva a aplicar las migraciones y cargue los seeds; debe negarse a ejecutarse si `NODE_ENV` es `production`
- [X] T021 Crear los ayudantes de pruebas en `server/tests/helpers/`: `globalSetup.js` (aplica las migraciones en `motorix_test`), `testDb.js` (resguardo que aborta si `DB_NAME` no termina en `_test`, y limpieza de tablas entre suites) y `factories.js` (crear usuarios por rol con contraseña cifrada, clientes y vehículos, y obtener un token por rol); crear `.env.test` de ejemplo documentado en `database/README.md`

### Frontend: base visual y de servicios

- [X] T022 [P] Implementar `client/lib/utils/app_theme.dart` como única fuente de estilos según `docs/design-system.md`: `ColorScheme` con los tokens de la sección 4, colores `sidebar`, `sidebarActive`, `warning`, `success`, `danger`, IBM Plex Sans con `google_fonts` y la escala de 4 tamaños (12, 14, 18, 28), espaciado 4/8/12/16/24/32, radios 6/8/12, y los temas de `NavigationRail`, `DataTable`, `Chip`, `InputDecoration`, botones, tarjetas, divisores, tooltips y `PageTransitionsTheme` (fade + slide leve, 250 ms)
- [X] T023 [P] Implementar `client/lib/models/api_error.dart` y `client/lib/services/api_client.dart`: cliente `http` con URL base configurable, cabecera `Authorization: Bearer` con el token en memoria, conversión de respuestas `{ error: { code, message, details } }` a `ApiError` y manejo de `401` para cerrar la sesión
- [X] T024 [P] Implementar `client/lib/widgets/confirm_dialog.dart` (botones "Confirmar" y "Cancelar", texto "¿Seguro que quieres [acción]? Esta acción no se puede deshacer.") y `client/lib/widgets/state_views.dart` (estados vacío con acción sugerida, cargando discreto y error en español sin trazas)
- [X] T025 [P] Implementar `client/lib/utils/validators.dart` con validadores de formulario en español: contraseña (mínimo 8 caracteres, una mayúscula, una minúscula y un número), correo, teléfono (7–15 dígitos, admite `+`, espacios y guiones), placa, VIN (17 caracteres alfanuméricos sin I, O ni Q), año (entre 1950 y el año actual + 1), username (3–50 caracteres: letras, números, `.`, `_`, `-`) y kilometraje (entero no negativo), con sus pruebas en `client/test/validators_test.dart`

**Punto de control**: Fundamentos listos; `npm run db:migrate` crea el esquema en `motorix_test` y `GET /api/health` responde 200.

---

## Fase 3: Historia de usuario 1 - Iniciar sesión según mi rol (Prioridad: P1) 🎯 MVP

**Objetivo**: Que un usuario inicie sesión con su usuario o correo, acceda solo a las funciones de su rol y que el servidor haga cumplir los permisos.

**Prueba independiente**: Con usuarios de prueba por rol, iniciar sesión con usuario y con correo, comprobar el rechazo de credenciales inválidas, el bloqueo tras 5 fallos y los `403`/`401` en endpoints protegidos.

### Pruebas de la historia 1 ⚠️ (escribir primero y comprobar que fallan)

- [X] T026 [P] [US1] Prueba de contrato de `POST /api/auth/login`, `GET /api/auth/me` y `POST /api/auth/change-password` (formas de respuesta y códigos de `contracts/api.md`) en `server/tests/contract/auth.contract.test.js`
- [X] T027 [P] [US1] Prueba de integración en `server/tests/integration/auth.test.js` que cubra: acceso por usuario, acceso por correo, mayúsculas y espacios sobrantes, contraseña incorrecta y usuario inexistente con el mismo mensaje genérico, cuenta inactiva (`401 INVALID_CREDENTIALS`), bloqueo con `423 ACCOUNT_LOCKED` al 5.º fallo consecutivo, reinicio del contador tras un acceso correcto, token ausente/inválido/expirado (`401 UNAUTHENTICATED`) y cambio de contraseña (rechazo de la política mínima y de contraseña actual incorrecta)
- [X] T028 [P] [US1] Prueba unitaria de los middlewares `authenticate` y `authorize` en `server/tests/unit/authMiddlewares.test.js` (rol permitido, rol no permitido `403 FORBIDDEN`, usuario desactivado tras emitir el token)

### Implementación de la historia 1 (backend)

- [X] T029 [P] [US1] Implementar `server/models/userModel.js` con `findByUsername`, `findByEmail`, `findById`, `updateLoginState` (contador y `locked_until`) y `updatePasswordHash`
- [X] T030 [P] [US1] Implementar `server/validators/authValidators.js` con esquemas `zod` para `login` (`identifier`, `password`) y `changePassword` (`currentPassword`, `newPassword`), aplicando la política mínima de contraseña
- [X] T031 [US1] Implementar `server/services/authService.js`: `login` (busca por correo si `identifier` contiene `@`, si no por `username`; normaliza mayúsculas y espacios; compara con bcrypt; cuenta fallos solo de usuarios existentes; fija `locked_until` a 15 minutos al 5.º fallo consecutivo; reinicia el contador al acertar; emite el JWT con solo el id y vigencia de 8 horas), `getProfile` y `changePassword` (exige contraseña actual y que la nueva sea distinta) (depende de T029 y T011)
- [X] T032 [US1] Implementar `server/middlewares/authenticate.js` (verifica el JWT, carga el usuario de la base en cada petición y rechaza si está inactivo) y `server/middlewares/authorize.js` (`authorize(...roles)` que devuelve `403 FORBIDDEN`) (depende de T029)
- [X] T033 [US1] Implementar `server/controllers/authController.js` y `server/routes/authRoutes.js` (`POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password` con `204`) y montarlos en `server/app.js` (depende de T031 y T032)

### Implementación de la historia 1 (frontend)

- [X] T034 [P] [US1] Implementar `client/lib/models/user.dart` y `client/lib/services/auth_service.dart` (llamadas a login, me y change-password)
- [X] T035 [P] [US1] Implementar `client/lib/providers/auth_provider.dart` (token solo en memoria, usuario actual, rol, `login`, `logout`, `changePassword`, manejo de sesión expirada) y `client/lib/providers/sidebar_provider.dart` (expandido/colapsado, colapsado si el ancho es menor a 1000 px)
- [X] T036 [US1] Implementar `client/lib/widgets/app_shell.dart`: sidebar colapsable (260 px / 72 px, animación de 200 ms, `Tooltip` en modo colapsado) que muestre solo los módulos del sprint permitidos por rol, encabezado con nombre de sección, usuario y rol, menú del usuario con "Cambiar contraseña", y "Cerrar sesión" con `ConfirmDialog` (depende de T022, T024 y T035)
- [X] T037 [P] [US1] Implementar `client/lib/screens/login_screen.dart`: un único campo "Usuario o correo electrónico", contraseña, mensajes de error en español (credenciales inválidas, cuenta bloqueada con tiempo restante) y estado de carga
- [X] T038 [P] [US1] Implementar `client/lib/screens/change_password_screen.dart` con validación de la política mínima y mensajes de éxito o error
- [X] T039 [US1] Configurar `client/lib/main.dart` con `MultiProvider`, el tema de `app_theme.dart`, rutas nombradas y una guarda que redirija a acceso cuando no haya sesión (depende de T036 a T038)
- [X] T040 [P] [US1] Pruebas de Flutter en `client/test/` (`auth_provider_test.dart`, `login_screen_test.dart`, `app_shell_menu_test.dart`) que verifiquen el inicio de sesión, el cierre con confirmación y que cada rol vea solo sus opciones de menú

**Punto de control**: US1 funciona por sí sola: se puede entrar con usuario o correo y los permisos por rol se validan en el servidor.

---

## Fase 4: Historia de usuario 3 - Registrar y consultar clientes (Prioridad: P1)

**Objetivo**: Registrar clientes, listarlos, buscarlos y ver su detalle con los vehículos asociados.

**Prueba independiente**: Como recepcionista, registrar un cliente, encontrarlo en el listado por nombre y abrir su detalle.

### Pruebas de la historia 3 ⚠️

- [X] T041 [P] [US3] Prueba de contrato de `GET /api/clients`, `POST /api/clients` y `GET /api/clients/:id` en `server/tests/contract/clients.contract.test.js`
- [X] T042 [P] [US3] Prueba de integración en `server/tests/integration/clients.test.js`: alta válida; `name` y `phone` obligatorios; formato de teléfono y correo; búsqueda por nombre, teléfono y correo; paginación (20 por defecto, máximo 100); detalle con sus vehículos (CA-4); `403` para MECHANIC en el alta y `200` en la consulta; `401` sin token; `409 PHONE_DUPLICATE_WARNING` y alta correcta con `confirmDuplicatePhone: true`

### Implementación de la historia 3 (backend)

- [X] T043 [P] [US3] Implementar `server/models/clientModel.js` con `insert`, `list` (búsqueda y paginación), `findById`, `findByPhone` y `findByIdWithVehicles`
- [X] T044 [P] [US3] Implementar `server/validators/clientValidators.js` con `zod`: `name` obligatorio VARCHAR(120); `phone` obligatorio VARCHAR(20), 7–15 dígitos, admite `+`, espacios y guiones; `email` opcional VARCHAR(150) con formato válido y en minúsculas; `address` opcional VARCHAR(255); `confirmDuplicatePhone` booleano opcional; parámetros de listado `search`, `page`, `pageSize`
- [X] T045 [US3] Implementar `server/services/clientService.js` con `createClient` (normaliza, comprueba teléfono duplicado y lanza `PHONE_DUPLICATE_WARNING` con `details.matches` salvo que venga `confirmDuplicatePhone: true`), `listClients` y `getClientById` (con vehículos; `404 NOT_FOUND` si no existe) (depende de T043 y T044)
- [X] T046 [US3] Implementar `server/controllers/clientController.js` y `server/routes/clientRoutes.js` (`GET` y `GET /:id` para todos los roles autenticados; `POST` solo para `ADMIN` y `RECEPTIONIST`) y montarlos en `server/app.js` (depende de T045)

### Implementación de la historia 3 (frontend)

- [X] T047 [P] [US3] Implementar `client/lib/models/client.dart` y `client/lib/services/clients_service.dart`
- [X] T048 [P] [US3] Implementar `client/lib/providers/clients_provider.dart` (listado con búsqueda y paginación, detalle, alta, estados de carga y error)
- [X] T049 [US3] Implementar `client/lib/screens/clients/clients_list_screen.dart`: tabla con el `DataTable` nativo (`AppDataTable`; `data_table_2` se descartó, ver research.md D9), búsqueda arriba, paginación, hover suave de fila, estados vacío/cargando/error y botón "Nuevo cliente" oculto para MECHANIC (depende de T036 y T048)
- [X] T050 [US3] Implementar `client/lib/screens/clients/client_detail_screen.dart` con los datos del cliente y la lista de sus vehículos (depende de T048)
- [X] T051 [US3] Implementar `client/lib/screens/clients/client_form_screen.dart` en modo alta: validación visible en español, botón principal a la derecha, diálogo de confirmación cuando el teléfono ya existe, confirmación al salir con cambios sin guardar y snackbar de éxito o error (depende de T025 y T048)
- [X] T052 [US3] Registrar las rutas de clientes y la entrada "Clientes" (pantalla inicial tras iniciar sesión) en `client/lib/main.dart` y `client/lib/widgets/app_shell.dart`
- [X] T053 [P] [US3] Pruebas de Flutter en `client/test/clients_provider_test.dart` y `client/test/client_form_screen_test.dart` (validaciones, advertencia de teléfono duplicado, ausencia del botón de alta para MECHANIC)

**Punto de control**: US1 y US3 funcionan de forma independiente.

---

## Fase 5: Historia de usuario 5 - Registrar vehículos con su propietario (Prioridad: P1)

**Objetivo**: Registrar vehículos, asociarlos a un cliente y consultarlos con su propietario.

**Prueba independiente**: Registrar un vehículo para un cliente existente y verlo en el detalle del cliente; comprobar que sin propietario válido se rechaza.

### Pruebas de la historia 5 ⚠️

- [X] T054 [P] [US5] Prueba de contrato de `GET /api/vehicles`, `POST /api/vehicles`, `GET /api/vehicles/:id` y `PATCH /api/vehicles/:id` en `server/tests/contract/vehicles.contract.test.js`
- [X] T055 [P] [US5] Prueba de integración en `server/tests/integration/vehicles.test.js`: alta con propietario; rechazo sin `clientId` (`400`) y con propietario inexistente (`404`, `details.field = "clientId"`); `409 DUPLICATE_LICENSE_PLATE` (incluida la misma placa con otro formato, por ejemplo minúsculas o con guiones) y `409 DUPLICATE_VIN`; VIN ausente permitido en varios vehículos; año fuera de rango; detalle con propietario; el vehículo aparece en el detalle del cliente; edición sin aceptar `clientId`; `409 MILEAGE_DECREASE` y edición correcta con `mileageCorrection: true`; `403` para MECHANIC en alta y edición; alta concurrente con la misma placa (solo una se guarda)

### Implementación de la historia 5 (backend)

- [X] T056 [P] [US5] Implementar `server/models/vehicleModel.js` con `insert`, `list` (búsqueda por placa, marca, modelo y propietario; filtro `clientId`; paginación), `findByIdWithOwner` y `update`
- [X] T057 [P] [US5] Implementar `server/validators/vehicleValidators.js` con `zod`: `clientId` obligatorio; `brand` obligatorio VARCHAR(60); `model` obligatorio VARCHAR(60); `year` obligatorio entre 1950 y el año actual + 1; `licensePlate` obligatoria VARCHAR(15), normalizada a mayúsculas sin espacios ni guiones; `vin` opcional de 17 caracteres alfanuméricos sin I, O ni Q, en mayúsculas; `color` opcional VARCHAR(30); `currentMileage` entero no negativo con valor por defecto 0; en la edición, `clientId` NO se acepta y se admite `mileageCorrection` booleano
- [X] T058 [US5] Implementar `server/services/vehicleService.js` con `createVehicle` (verifica que el propietario exista), `listVehicles`, `getVehicleById` y `updateVehicle` (rechaza `clientId`; aplica la regla `MILEAGE_DECREASE` salvo `mileageCorrection: true`) (depende de T056 y T057)
- [X] T059 [US5] Implementar `server/controllers/vehicleController.js` y `server/routes/vehicleRoutes.js` (`GET` para todos los roles; `POST` y `PATCH` solo `ADMIN` y `RECEPTIONIST`) y montarlos en `server/app.js` (depende de T058)

### Implementación de la historia 5 (frontend)

- [X] T060 [P] [US5] Implementar `client/lib/models/vehicle.dart` y `client/lib/services/vehicles_service.dart`
- [X] T061 [P] [US5] Implementar `client/lib/providers/vehicles_provider.dart` (listado, detalle, alta y edición, estados de carga y error)
- [X] T062 [US5] Implementar `client/lib/screens/vehicles/vehicles_list_screen.dart` (tabla con búsqueda, paginación, propietario visible y estados vacío/cargando/error) y `client/lib/screens/vehicles/vehicle_detail_screen.dart` con los datos del vehículo y su propietario enlazado al cliente (depende de T036 y T061)
- [X] T063 [US5] Implementar `client/lib/screens/vehicles/vehicle_form_screen.dart` (alta y edición): selector de propietario con búsqueda (obligatorio; bloqueado en edición), validaciones de placa, VIN, año y kilometraje, aviso de duplicados, confirmación del kilometraje menor con corrección explícita y confirmación al salir con cambios sin guardar (depende de T025 y T061)
- [X] T064 [US5] Agregar el botón "Agregar vehículo" en `client/lib/screens/clients/client_detail_screen.dart` que preseleccione al propietario, y registrar las rutas de vehículos y la entrada "Vehículos" en `client/lib/main.dart` y `client/lib/widgets/app_shell.dart`
- [X] T065 [P] [US5] Pruebas de Flutter en `client/test/vehicles_provider_test.dart` y `client/test/vehicle_form_screen_test.dart` (propietario obligatorio, validaciones, ausencia de acciones de alta y edición para MECHANIC)

**Punto de control**: el flujo demostrable (iniciar sesión → cliente → vehículo → asociarlo → consultar) funciona de extremo a extremo.

---

## Fase 6: Historia de usuario 2 - Gestionar usuarios y roles (Prioridad: P2)

**Objetivo**: Que el administrador cree, edite, active/desactive usuarios, cambie roles y restablezca contraseñas.

**Prueba independiente**: Como administrador crear un usuario, cambiar su rol y desactivarlo; comprobar que un usuario no administrador recibe `403`.

### Pruebas de la historia 2 ⚠️

- [X] T066 [P] [US2] Prueba de contrato de los endpoints de `/api/users` y `POST /api/users/:id/reset-password` en `server/tests/contract/users.contract.test.js`
- [X] T067 [P] [US2] Prueba de integración en `server/tests/integration/users.test.js`: alta correcta que luego inicia sesión; `409 DUPLICATE_USERNAME` y `409 DUPLICATE_EMAIL` (sin distinguir mayúsculas); política de contraseña en alta y restablecimiento; cambio de rol y de estado con efecto inmediato; usuario desactivado sin acceso; `409 LAST_ADMIN_PROTECTED` al desactivar o quitar el rol a la última cuenta de administrador activa y al intentarlo sobre sí mismo; `username` inmutable; `403` para RECEPTIONIST y MECHANIC; la respuesta nunca incluye datos de contraseña

### Implementación de la historia 2 (backend)

- [X] T068 [P] [US2] Ampliar `server/models/userModel.js` con `insert`, `list` (filtros `search`, `role`, `active` y paginación), `update` y `countActiveAdmins`
- [X] T069 [P] [US2] Implementar `server/validators/userValidators.js` con `zod`: `username` obligatorio de 3 a 50 caracteres (letras, números, `.`, `_`, `-`); `name` obligatorio VARCHAR(100); `email` obligatorio VARCHAR(150), válido y en minúsculas; `role` en `ADMIN`, `RECEPTIONIST` o `MECHANIC`; `password` y `newPassword` con la política mínima; en la edición solo `name`, `email`, `role` y `active`
- [X] T070 [US2] Implementar `server/services/userService.js` con `createUser`, `listUsers`, `getUserById`, `updateUser` (regla `LAST_ADMIN_PROTECTED` y prohibición de que un administrador se desactive o cambie su propio rol) y `resetPassword` (depende de T068 y T069)
- [X] T071 [US2] Implementar `server/controllers/userController.js` y `server/routes/userRoutes.js` restringidos a `ADMIN` con `authorize('ADMIN')` y montarlos en `server/app.js` (depende de T070)

### Implementación de la historia 2 (frontend)

- [X] T072 [P] [US2] Implementar `client/lib/services/users_service.dart` y `client/lib/providers/users_provider.dart`
- [X] T073 [US2] Implementar `client/lib/screens/users/users_list_screen.dart` (tabla con rol y estado en chips, filtros y paginación) y `client/lib/screens/users/user_form_screen.dart` (alta y edición, restablecer contraseña, activar/desactivar con `ConfirmDialog`) (depende de T036 y T072)
- [X] T074 [US2] Registrar las rutas de usuarios y mostrar la entrada "Usuarios" en el menú solo para ADMIN en `client/lib/main.dart` y `client/lib/widgets/app_shell.dart`
- [X] T075 [P] [US2] Pruebas de Flutter en `client/test/users_provider_test.dart` y `client/test/users_screens_test.dart` (confirmación al desactivar, política de contraseña y entrada visible solo para ADMIN)

**Punto de control**: US2 funciona de forma independiente.

---

## Fase 7: Historia de usuario 4 - Editar clientes (Prioridad: P2)

**Objetivo**: Corregir o actualizar los datos de un cliente existente.

**Prueba independiente**: Modificar el teléfono de un cliente y comprobar el cambio en listado y detalle; un MECHANIC no puede editar.

### Pruebas de la historia 4 ⚠️

- [X] T076 [P] [US4] Ampliar `server/tests/contract/clients.contract.test.js` con `PATCH /api/clients/:id`
- [X] T077 [P] [US4] Ampliar `server/tests/integration/clients.test.js` con: edición correcta y visible en listado y detalle; datos inválidos rechazados conservando los anteriores; `404` en cliente inexistente; `403` para MECHANIC; `409 PHONE_DUPLICATE_WARNING` al cambiar a un teléfono existente y guardado con `confirmDuplicatePhone: true`; no cambiar el teléfono a su mismo valor no genera advertencia

### Implementación de la historia 4

- [X] T078 [US4] Agregar `update` a `server/models/clientModel.js` y `updateClient` a `server/services/clientService.js` (edición parcial; ignora el propio cliente al buscar teléfonos duplicados)
- [X] T079 [US4] Agregar `PATCH /api/clients/:id` con permiso `ADMIN` y `RECEPTIONIST` y el esquema parcial en `server/validators/clientValidators.js`, `server/controllers/clientController.js` y `server/routes/clientRoutes.js`
- [X] T080 [US4] Agregar el modo edición a `client/lib/screens/clients/client_form_screen.dart` y el botón "Editar" (oculto para MECHANIC) a `client/lib/screens/clients/client_detail_screen.dart`, con la confirmación al salir con cambios sin guardar
- [X] T081 [P] [US4] Ampliar `client/test/client_form_screen_test.dart` con el modo edición y la ausencia del botón "Editar" para MECHANIC

**Punto de control**: US4 funciona de forma independiente.

---

## Fase 8: Historia de usuario 6 - Datos de ejemplo al arrancar (Prioridad: P3)

**Objetivo**: Que tras instalar y cargar los seeds la aplicación muestre información sin capturar nada a mano, y que cargarlos de nuevo no duplique registros.

**Prueba independiente**: Recrear la base desde cero, cargar los seeds, iniciar sesión con las tres cuentas y ver clientes y vehículos; cargar los seeds otra vez sin cambios en las cantidades.

### Pruebas de la historia 6 ⚠️

- [X] T082 [P] [US6] Prueba de integración en `server/tests/integration/seeds.test.js` (sobre `motorix_test`): tras `seed` existen 3 usuarios (uno por rol, con contraseñas cifradas y no en texto plano), 8 clientes y 12 vehículos; una segunda ejecución deja exactamente las mismas cantidades; el seed falla con mensaje claro si falta una variable `SEED_*_PASSWORD`; las migraciones vuelven a aplicarse sin cambios y se rechaza un archivo ya aplicado modificado

### Implementación de la historia 6

- [X] T083 [P] [US6] Crear `database/seeds/001_sample_clients_vehicles.sql` con 8 clientes y 12 vehículos de ejemplo (al menos un cliente con 2 vehículos y otro sin vehículos), idempotente: clientes con `INSERT ... SELECT ... WHERE NOT EXISTS` sobre (`name`, `phone`) y vehículos con `INSERT IGNORE` sobre `license_plate`
- [X] T084 [US6] Implementar `server/scripts/seed.js`: crea o actualiza con `INSERT ... ON DUPLICATE KEY UPDATE` sobre `username` los usuarios `admin`, `recepcion` y `mecanico` (uno por rol, con correos de ejemplo `@motorix.local`), cifra con bcrypt las contraseñas tomadas de `SEED_ADMIN_PASSWORD`, `SEED_RECEPTION_PASSWORD` y `SEED_MECHANIC_PASSWORD`, falla con mensaje en español si falta alguna, y luego ejecuta los archivos de `database/seeds/`; debe ser idempotente (depende de T083)
- [X] T085 [US6] Escribir `database/README.md` en español: cómo ejecutar `00_create_database.sql`, crear `.env` y `.env.test`, usar `db:migrate`, `db:seed` y `db:reset`, reglas de inmutabilidad de migraciones y que `database/data/` no se versiona

**Punto de control**: US6 funciona; el flujo demostrable puede arrancar con datos desde cero.

---

## Fase 9: Pulido y aspectos transversales

**Propósito**: Mejoras que afectan a varias historias y cierre del sprint.

- [X] T086 [P] Escribir `README.md` en la raíz en español: descripción de Motorix, requisitos, instalación, ejecución del servidor y del cliente, ejecución de pruebas y enlaces a `docs/`
- [X] T087 [P] Generar `docs/api.md` a partir de `specs/001-base-clientes-vehiculos/contracts/api.md` y mantener ambos sincronizados
- [X] T088 [P] Prueba de rendimiento en `server/tests/integration/clientsSearchPerformance.test.js` que inserte 500 clientes y compruebe que la búsqueda responde en menos de 2 segundos (SC-007)
- [X] T089 Revisión de seguridad: confirmar con `Grep` que no hay `require(`/`module.exports` en `server/`, que `package.json` declara `"type": "module"`, que no hay secretos ni contraseñas en el repositorio, que ninguna respuesta incluye `password_hash` ni trazas y que `.env` está en `.gitignore` (CA-5, CA-7, CA-8, SC-008)
- [X] T090 Revisión de interfaz contra la lista de "terminado" de `docs/design-system.md` (sección 11) para cada pantalla: tokens, sidebar expandido y colapsado, estados vacío/cargando/error, transiciones suaves, confirmaciones obligatorias y ventana angosta (CA-12)
- [X] T091 Ejecutar `npm test` en `server/` y `flutter test` en `client/` hasta que ambos pasen al 100 %
- [X] T092 Recorrer `specs/001-base-clientes-vehiculos/quickstart.md` completo sobre una base recreada con `npm run db:reset` y registrar cualquier diferencia
- [ ] T093 Actualizar `docs/project-context.md` y la sección de decisiones de `.specify/memory/constitution.md` con las decisiones confirmadas por el equipo (librería de UI, set de íconos, menú lateral y contraseñas iniciales por variables de entorno) si el equipo las aprueba

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias; puede empezar de inmediato.
- **Fundamentos (Fase 2)**: depende de la Fase 1 y BLOQUEA todas las historias.
- **Historias (Fases 3 a 8)**: dependen de la Fase 2.
- **Pulido (Fase 9)**: depende de las historias que se vayan a entregar.

### Dependencias entre historias

- **US1 (P1)**: tras la Fase 2; no depende de otras historias. Proporciona `authenticate`, `authorize` y la estructura de la aplicación que usan las demás.
- **US3 (P1)**: tras US1 (necesita autenticación y el armazón de pantallas). La consulta de vehículos en el detalle usa la tabla ya creada en la migración y no requiere US5.
- **US5 (P1)**: tras US1; necesita que existan clientes, por lo que se prueba con las fábricas de pruebas aunque US3 no esté terminada. Para el flujo completo conviene terminar US3 antes.
- **US2 (P2)**: tras US1; amplía `userModel.js` (T068 después de T029).
- **US4 (P2)**: tras US3 (reutiliza modelo, servicio, ruta y formulario de clientes).
- **US6 (P3)**: tras la Fase 2; independiente del resto en el código, pero su valor se ve al terminar US1, US3 y US5.

### Dentro de cada historia

- Las pruebas se escriben primero y deben fallar antes de implementar.
- Modelos y validadores → servicios → controladores y rutas → frontend.
- Cada historia debe cumplir su punto de control antes de pasar a la siguiente prioridad.

### Oportunidades de paralelismo

- Fase 1: T004 y T005.
- Fase 2: T006 a T013, T015, T017, T020 y T022 a T025 (archivos distintos).
- Dentro de cada historia: las pruebas marcadas [P], los modelos y validadores [P], y las tareas de frontend [P] mientras el backend avanza.
- Con varias personas, tras la Fase 2 y US1: una persona en US3/US4, otra en US5 y otra en US2/US6.

---

## Ejemplo de paralelismo: Historia 1

```bash
# Pruebas de la historia 1 (a la vez):
Tarea: "Prueba de contrato de auth en server/tests/contract/auth.contract.test.js"
Tarea: "Prueba de integración de auth en server/tests/integration/auth.test.js"
Tarea: "Prueba unitaria de middlewares en server/tests/unit/authMiddlewares.test.js"

# Modelo y validadores (a la vez):
Tarea: "userModel en server/models/userModel.js"
Tarea: "authValidators en server/validators/authValidators.js"

# Frontend (a la vez):
Tarea: "login_screen en client/lib/screens/login_screen.dart"
Tarea: "change_password_screen en client/lib/screens/change_password_screen.dart"
```

---

## Estrategia de implementación

### Primero el MVP (solo la historia 1)

1. Completar la Fase 1 (Preparación).
2. Completar la Fase 2 (Fundamentos).
3. Completar la Fase 3 (US1).
4. **DETENERSE y VALIDAR**: iniciar sesión por usuario y por correo, y comprobar los permisos por rol.

### Entrega incremental

1. Preparación + Fundamentos → base lista.
2. US1 → validar (acceso y roles).
3. US3 → validar (clientes).
4. US5 → validar el flujo demostrable completo (cliente → vehículo → consulta).
5. US2 → validar (usuarios).
6. US4 → validar (edición de clientes).
7. US6 → validar (datos de ejemplo desde cero).
8. Pulido y recorrido del `quickstart.md`.

### Estrategia con varias personas

1. El equipo completa Preparación + Fundamentos y US1 junto.
2. Después: Persona A en US3 y US4; Persona B en US5; Persona C en US2 y US6.
3. Las historias se integran sin romper las anteriores.

---

## Notas

- [P] = archivos distintos y sin dependencias pendientes.
- La etiqueta [Historia] asocia cada tarea con su historia para dar trazabilidad.
- Comprobar que las pruebas fallan antes de implementar.
- Hacer commit tras cada tarea o grupo lógico, con el formato `tipo(alcance): descripción en español` de `CLAUDE.md`.
- No trabajar sobre `main`; la rama de la funcionalidad es `001-base-clientes-vehiculos`.
- Evitar tareas vagas, conflictos en un mismo archivo y dependencias entre historias que rompan su independencia.
