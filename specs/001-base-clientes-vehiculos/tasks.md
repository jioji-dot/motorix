---

description: "Lista de tareas para implementar el Sprint 1: base del sistema, clientes y vehículos"
---

# Tareas: Base del sistema, clientes y vehículos

**Entrada**: Documentos de diseño en `specs/001-base-clientes-vehiculos/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Pruebas**: Se incluyen porque la constitución (principio VII) exige pruebas para la lógica de negocio y los permisos. Backend: Jest y Jest + supertest contra `motorix_test`. Frontend: `flutter test`. Las pruebas de cada historia se escriben primero y DEBEN fallar antes de implementar.

**Organización**: Las tareas se agrupan por historia de usuario para implementarlas y probarlas de forma independiente.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US1]–[US4]**: Historia de usuario a la que pertenece la tarea (US1 inicio de sesión, US2 clientes, US3 vehículos, US4 usuarios y roles)
- Todas las rutas son relativas a la raíz del repositorio

## Convenciones de rutas

- Backend: `server/` (sin carpeta `src/`), con ES Modules
- Frontend: `client/lib/` y `client/test/`
- Base de datos: `database/`
- Pruebas del backend: `server/tests/unit/`, `server/tests/integration/`, `server/tests/contract/`

---

## Fase 1: Preparación (infraestructura compartida)

**Propósito**: Inicializar el proyecto y su estructura básica

- [X] T001 Crear la estructura de carpetas del plan: `server/{config,controllers,models,routes,services,middlewares,validators,utils,scripts,tests}`, `client/`, `database/{migrations,seeds,scripts}`
- [X] T002 Inicializar el backend en `server/package.json` con `"type": "module"`, dependencias `express`, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`, `dotenv`, `cors` y de desarrollo `jest`, `supertest`, con los scripts `start`, `dev` y `test`
- [X] T003 [P] Inicializar el frontend Flutter en `client/` y agregar a `client/pubspec.yaml` `provider`, `http`, `google_fonts`, `data_table_2` 2.6.0 y `lucide_icons_flutter` (sin librería complementaria de componentes)
- [X] T004 [P] Crear `.env.example` en la raíz con `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN` y `PORT` sin valores sensibles, y confirmar que `.env` sigue en `.gitignore`
- [X] T005 [P] Configurar Jest para ES Modules en `server/jest.config.js` y la validación de lint/formato del backend en `server/eslint.config.js`
- [X] T006 [P] Crear `database/README.md` en español con el procedimiento para crear y reiniciar la base local

---

## Fase 2: Fundamentos (prerrequisitos bloqueantes)

**Propósito**: Infraestructura central que DEBE terminar antes de cualquier historia de usuario

**⚠️ CRÍTICO**: Ninguna historia puede empezar hasta completar esta fase

- [X] T007 Crear `database/scripts/crear-entorno.ps1` que crea las bases `motorix` y `motorix_test` (InnoDB, `utf8mb4`) y el usuario dedicado `motorix_app` (nunca `root` para la aplicación); la contraseña de `root` se recibe por entorno y no se guarda en el repositorio
- [X] T008 Crear `database/scripts/aplicar-migraciones.ps1` idempotente que aplica en orden los scripts de `database/migrations/` y registra cada uno en `schema_migrations` (`version` VARCHAR(100) PK, `appliedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)
- [X] T009 Escribir la migración `database/migrations/001_sprint1_users_clients_vehicles.sql` con las tablas `users`, `clients` y `vehicles` exactamente según `data-model.md`: `users.username` VARCHAR(50) NOT NULL UNIQUE; `users.email` VARCHAR(120) NOT NULL UNIQUE; `users.passwordHash` VARCHAR(100) NOT NULL; `users.role` ENUM('ADMIN','RECEPTIONIST','MECHANIC') NOT NULL; `users.active` TINYINT(1) NOT NULL DEFAULT 1; `users.failedAttempts` TINYINT UNSIGNED NOT NULL DEFAULT 0; `users.lockedUntil` DATETIME NULL; `clients.name` VARCHAR(120) NOT NULL; `clients.phone` VARCHAR(20) NOT NULL con índice (no único); `clients.email` VARCHAR(120) NULL; `vehicles.clientId` INT UNSIGNED NOT NULL con llave foránea a `clients.id` sin cascada; `vehicles.licensePlate` VARCHAR(15) NOT NULL UNIQUE; `vehicles.vin` VARCHAR(17) NULL UNIQUE; `vehicles.year` SMALLINT UNSIGNED NOT NULL; `vehicles.currentMileage` INT UNSIGNED NOT NULL DEFAULT 0; todas con `createdAt` y `updatedAt`
- [X] T010 [P] Crear `server/config/env.js` que carga y valida las variables de entorno con `dotenv` y falla con un mensaje en español si falta alguna obligatoria
- [X] T011 [P] Crear `server/config/db.js` con un pool de `mysql2/promise` (consultas parametrizadas, `utf8mb4`) y una función de transacción reutilizable
- [X] T012 [P] Crear `server/utils/httpError.js` con la clase de error de aplicación (código, estado HTTP, mensaje en español y detalles) según los códigos de `contracts/api.md`
- [X] T013 Crear `server/middlewares/errorHandler.js` centralizado que devuelve `{ "error": { "code", "message", "details" } }`, traduce errores de validación y de duplicados, y nunca expone trazas ni detalles internos (500 genérico `INTERNAL_ERROR`)
- [X] T014 [P] Crear `server/middlewares/validate.js` que aplica un esquema `zod` al cuerpo o a los parámetros y lo convierte en `VALIDATION_ERROR` con mensajes en español
- [X] T015 Crear `server/middlewares/authenticate.js` que verifica el JWT y consulta en cada petición el rol y `active` del usuario en la base (FR-009), respondiendo 401 `UNAUTHENTICATED` o 403 `ACCOUNT_DISABLED`
- [X] T016 [P] Crear `server/middlewares/authorize.js` con `authorize(...roles)` que responde 403 `FORBIDDEN` según la matriz de permisos de `contracts/api.md`
- [X] T017 Crear `server/app.js` (Express con `cors`, JSON, rutas bajo `/api`, `errorHandler`) y `server/server.js` que arranca el servicio en el puerto configurado
- [X] T018 [P] Crear `server/tests/env.js` y `server/tests/helpers.js` que apuntan las pruebas a la base de pruebas (nombre terminado en `_test`, ya migrada), se niegan a operar sobre otra base, vacían las tablas y exponen ayudantes para obtener un token de cada rol
- [X] T019 [P] Crear `client/lib/utils/app_theme.dart` con el `ThemeData` propio (`useMaterial3: true`), `ColorScheme.fromSeed` con `#9B4F55` y los tokens de color, tipografía IBM Plex Sans (12, 14, 18, 28), espaciado (4, 8, 12, 16, 24, 32) y radios de `docs/design-system.md`
- [X] T020 [P] Crear `client/lib/services/api_client.dart` que envuelve `http`, agrega el token `Bearer`, interpreta el formato de error de la API y redirige al inicio de sesión ante 401
- [X] T021 [P] Crear `client/lib/providers/auth_provider.dart` con el estado de sesión (usuario, rol, token) y `client/lib/providers/sidebar_provider.dart` con el estado expandido/colapsado de la barra lateral
- [X] T022 Crear `client/lib/widgets/app_shell.dart` con el diseño base de `docs/design-system.md`: `NavigationRail` extendido (~260 px / ~72 px, animado 200 ms), encabezado y usuario al pie, mostrando solo Clientes y Vehículos para todos y Usuarios solo para ADMIN (FR-029), más widgets reutilizables de estados vacío, cargando, error y éxito, y el diálogo de confirmación "Confirmar" / "Cancelar"
- [X] T023 Crear `client/lib/main.dart` con `Provider`, rutas protegidas por sesión y pantalla inicial Clientes tras iniciar sesión

**Punto de control**: Base lista; las historias de usuario pueden comenzar

---

## Fase 3: Historia de usuario 1 - Iniciar sesión según mi rol (Prioridad: P1) 🎯 MVP

**Objetivo**: Acceder con usuario o correo, con bloqueo temporal, cambio de contraseña y cierre de sesión con confirmación.

**Prueba independiente**: Iniciar sesión con `admin`, `recepcion` y `mecanico` por usuario y por correo; comprobar el bloqueo tras 5 intentos fallidos y el cambio de contraseña con la política (escenarios 1–4, 9, 12 y 13 de `quickstart.md`).

### Pruebas de la historia 1 ⚠️ (escribir primero; deben fallar)

- [X] T024 [P] [US1] Prueba unitaria de la política de contraseñas ("mínimo 8 caracteres, con mayúscula, minúscula y número") en `server/tests/unit/passwordPolicy.test.js`
- [X] T025 [P] [US1] Prueba unitaria del servicio de autenticación (identificador con `@` busca por `email`, si no por `username`, sin distinguir mayúsculas y con espacios recortados; bloqueo al llegar a 5 intentos por 15 minutos; reinicio del contador al acertar) en `server/tests/unit/authService.test.js`
- [X] T026 [P] [US1] Prueba de contrato de `POST /auth/login`, `GET /auth/me` y `POST /auth/change-password` (formas de éxito y de error, 401, 403, 423) en `server/tests/contract/auth.contract.test.js`
- [X] T027 [P] [US1] Prueba de integración de inicio de sesión de los tres roles con usuario y con correo, cuenta desactivada y cuenta bloqueada, contra `motorix_test`, en `server/tests/integration/auth.test.js`
- [X] T028 [P] [US1] Prueba de widgets de la pantalla de inicio de sesión y del diálogo de cierre de sesión en `client/test/screens/login_screen_test.dart`

### Implementación de la historia 1

- [X] T029 [P] [US1] Crear el modelo de acceso a datos de usuarios con consultas parametrizadas (buscar por identificador, por id, actualizar intentos y bloqueo, actualizar contraseña) en `server/models/userModel.js`
- [X] T030 [P] [US1] Crear los esquemas `zod` de inicio de sesión y cambio de contraseña, con la política de contraseña, en `server/validators/authValidator.js`
- [X] T031 [US1] Implementar `server/services/authService.js`: verificación con `bcryptjs` (costo 10), emisión de JWT de 8 horas (28800 s), bloqueo de 15 minutos tras 5 intentos fallidos, mensaje genérico `INVALID_CREDENTIALS` y cambio de contraseña verificando la actual
- [X] T032 [US1] Implementar `server/controllers/authController.js` y `server/routes/authRoutes.js` con `POST /api/auth/login`, `GET /api/auth/me` y `POST /api/auth/change-password`, y registrar las rutas en `server/app.js`
- [X] T033 [US1] Crear `server/scripts/create-admin.js` que genera el hash bcrypt de una contraseña recibida por argumento o entorno y crea o actualiza una cuenta de usuario (sin contraseñas en texto plano en SQL)
- [X] T034 [US1] Crear `server/scripts/seed.js` (comando `npm run seed`) que carga las cuentas `admin`, `recepcion` y `mecanico` con contraseña hasheada con bcrypt, de forma idempotente (`ON DUPLICATE KEY UPDATE`) y solo para entornos locales; las contraseñas del estándar se leen de variables de entorno locales (`SEED_PASSWORD_*`), no del código
- [X] T035 [P] [US1] Crear `client/lib/models/user.dart` y la pantalla `client/lib/screens/login_screen.dart` con un único campo "Usuario o correo", estados de carga y error, y mensajes en español
- [X] T036 [US1] Completar `client/lib/providers/auth_provider.dart` (iniciar y cerrar sesión, guardar el token, cargar `/auth/me`) y agregar al pie de la barra el menú del usuario con "Cambiar contraseña" y "Cerrar sesión" con confirmación (FR-030) en `client/lib/widgets/app_shell.dart`
- [X] T037 [US1] Crear `client/lib/screens/change_password_screen.dart` con validación de la política y confirmación al salir con cambios sin guardar

**Punto de control**: Se puede iniciar sesión con los tres roles y la sesión funciona de extremo a extremo

---

## Fase 4: Historia de usuario 2 - Gestionar clientes (Prioridad: P1)

**Objetivo**: Registrar, consultar, buscar, editar y desactivar clientes, con aviso de teléfono repetido.

**Prueba independiente**: Con `recepcion`, registrar un cliente, buscarlo, editarlo y consultar su detalle; con `mecanico`, comprobar que solo consulta (escenarios 5, 8 y 9 de `quickstart.md`).

### Pruebas de la historia 2 ⚠️

- [X] T038 [P] [US2] Prueba unitaria del servicio de clientes (normalización de teléfono a "10 dígitos", `name` obligatorio de hasta 120 caracteres, `email` opcional con formato válido, aviso por teléfono repetido) en `server/tests/unit/clientService.test.js`
- [X] T039 [P] [US2] Prueba de contrato de `GET /clients`, `GET /clients/:id`, `POST /clients` y `PATCH /clients/:id`, incluido 409 `DUPLICATE_PHONE`, en `server/tests/contract/clients.contract.test.js`
- [X] T040 [P] [US2] Prueba de integración de clientes: ADMIN y RECEPTIONIST crean y editan, MECHANIC solo consulta (403 al escribir), búsqueda por nombre, teléfono y correo, y el detalle incluye `vehicles`, en `server/tests/integration/clients.test.js`
- [X] T041 [P] [US2] Prueba de provider y de widgets de la lista y el formulario de clientes en `client/test/screens/clients_screen_test.dart`

### Implementación de la historia 2

- [X] T042 [P] [US2] Crear `server/models/clientModel.js` con búsqueda (`search`, `active`, paginación), detalle con vehículos asociados, alta y edición
- [X] T043 [P] [US2] Crear `server/validators/clientValidator.js` con los esquemas de alta y edición, incluida la confirmación `confirmDuplicatePhone`
- [X] T044 [US2] Implementar `server/services/clientService.js` con la regla de teléfono repetido (409 `DUPLICATE_PHONE` con coincidencias en `details` salvo confirmación) y desactivación lógica sin borrar información
- [X] T045 [US2] Implementar `server/controllers/clientController.js` y `server/routes/clientRoutes.js` con `authenticate` y `authorize` por rol (lectura: los tres roles; escritura: ADMIN y RECEPTIONIST) y registrarlas en `server/app.js`
- [X] T046 [P] [US2] Crear `client/lib/models/client.dart` y `client/lib/providers/clients_provider.dart`
- [X] T047 [US2] Crear `client/lib/screens/clients_screen.dart` (tabla con búsqueda, chips de estado y acciones al final, estados vacío/cargando/error) y `client/lib/screens/client_form_screen.dart` (alta y edición con aviso de teléfono repetido y confirmación al desactivar o salir con cambios)
- [X] T048 [US2] Crear `client/lib/screens/client_detail_screen.dart` con los datos del cliente, sus vehículos y el estado vacío con la opción de registrar uno; ocultar las acciones de escritura al rol MECHANIC
- [X] T049 [US2] Agregar a `database/seeds/` los clientes de ejemplo (al menos 5, uno sin vehículos) de forma idempotente

**Punto de control**: Las historias 1 y 2 funcionan de forma independiente

---

## Fase 5: Historia de usuario 3 - Registrar vehículos y asociarlos a su propietario (Prioridad: P1)

**Objetivo**: Registrar, consultar, buscar y editar vehículos siempre ligados a un cliente.

**Prueba independiente**: Con un cliente existente, registrar un vehículo y verlo en el detalle del cliente; comprobar los rechazos por falta de propietario y por placas o VIN duplicados (escenarios 5, 6 y 7 de `quickstart.md`).

### Pruebas de la historia 3 ⚠️

- [X] T050 [P] [US3] Prueba unitaria del servicio de vehículos (`licensePlate` en mayúsculas y sin espacios; `vin` de 17 caracteres alfanuméricos y opcional; `year` entre 1950 y el año actual más 1; `currentMileage` entero mayor o igual a 0 que no disminuye sin `mileageCorrection: true`) en `server/tests/unit/vehicleService.test.js`
- [X] T051 [P] [US3] Prueba de contrato de `GET /vehicles`, `GET /vehicles/:id`, `POST /vehicles` y `PATCH /vehicles/:id`, incluidos 404, 409 `DUPLICATE_VALUE` y 409 `MILEAGE_DECREASE`, en `server/tests/contract/vehicles.contract.test.js`
- [X] T052 [P] [US3] Prueba de integración de vehículos: sin `clientId` se rechaza, cliente inexistente da 404, placas y VIN duplicados dan 409, varios vehículos sin VIN se permiten, el vehículo aparece en el detalle del cliente, y MECHANIC solo consulta, en `server/tests/integration/vehicles.test.js`
- [X] T053 [P] [US3] Prueba de provider y de widgets de la lista y el formulario de vehículos en `client/test/screens/vehicles_screen_test.dart`

### Implementación de la historia 3

- [X] T054 [P] [US3] Crear `server/models/vehicleModel.js` con búsqueda por placas, marca, modelo o propietario, detalle con datos del cliente, alta y edición
- [X] T055 [P] [US3] Crear `server/validators/vehicleValidator.js` con los esquemas de alta y edición según las reglas de `data-model.md`
- [X] T056 [US3] Implementar `server/services/vehicleService.js`: propietario obligatorio y existente, traducción de duplicados de placas o VIN a 409 `DUPLICATE_VALUE` y regla de kilometraje con `MILEAGE_DECREASE`
- [X] T057 [US3] Implementar `server/controllers/vehicleController.js` y `server/routes/vehicleRoutes.js` con los permisos de la matriz y registrarlas en `server/app.js`
- [X] T058 [P] [US3] Crear `client/lib/models/vehicle.dart` y `client/lib/providers/vehicles_provider.dart`
- [X] T059 [US3] Crear `client/lib/screens/vehicles_screen.dart`, `client/lib/screens/vehicle_form_screen.dart` (propietario obligatorio mediante selector de clientes) y `client/lib/screens/vehicle_detail_screen.dart` con el propietario, respetando el rol MECHANIC de solo lectura
- [X] T060 [US3] Agregar a `database/seeds/` los vehículos de ejemplo (1 a 2 por cliente, uno sin VIN) de forma idempotente y verificar que cargar los seeds dos veces no duplica registros

**Punto de control**: El flujo principal completo funciona: iniciar sesión → registrar cliente → registrar vehículo → asociarlo → consultar

---

## Fase 6: Historia de usuario 4 - Administrar usuarios y roles (Prioridad: P2)

**Objetivo**: ADMIN crea, edita, activa o desactiva usuarios y asigna roles, sin dejar el taller sin administrador.

**Prueba independiente**: Con `admin`, crear un mecánico, iniciar sesión con él, desactivarlo y comprobar que deja de entrar de inmediato; intentar desactivar al único ADMIN (escenarios 10 y 11 de `quickstart.md`).

### Pruebas de la historia 4 ⚠️

- [X] T061 [P] [US4] Prueba unitaria del servicio de usuarios (`username` de 3 a 50 caracteres sin espacios y único sin distinguir mayúsculas; `email` válido y único; rechazo de desactivar o cambiar de rol al último ADMIN activo) en `server/tests/unit/userService.test.js`
- [X] T062 [P] [US4] Prueba de contrato de `GET /users`, `GET /users/:id`, `POST /users` y `PATCH /users/:id`, incluidos 409 `DUPLICATE_VALUE` y 409 `LAST_ADMIN`, en `server/tests/contract/users.contract.test.js`
- [X] T063 [P] [US4] Prueba de integración de usuarios: solo ADMIN accede (403 para los demás), el cambio de rol y la desactivación surten efecto en la siguiente petición, y se rechaza dejar al taller sin ADMIN activo, en `server/tests/integration/users.test.js`
- [X] T064 [P] [US4] Prueba de provider y de widgets de la pantalla de usuarios en `client/test/screens/users_screen_test.dart`

### Implementación de la historia 4

- [X] T065 [US4] Ampliar `server/models/userModel.js` con listado con filtros (`search`, `role`, `active`, paginación), alta y edición sin devolver `passwordHash`
- [X] T066 [P] [US4] Crear `server/validators/userValidator.js` con los esquemas de alta y edición, incluida la política de contraseña
- [X] T067 [US4] Implementar `server/services/userService.js` con la regla del último ADMIN activo dentro de una transacción y la traducción de duplicados a 409 `DUPLICATE_VALUE`
- [X] T068 [US4] Implementar `server/controllers/userController.js` y `server/routes/userRoutes.js` restringidas a ADMIN y registrarlas en `server/app.js`
- [X] T069 [P] [US4] Crear `client/lib/providers/users_provider.dart` y ampliar `client/lib/models/user.dart`
- [X] T070 [US4] Crear `client/lib/screens/users_screen.dart` y `client/lib/screens/user_form_screen.dart` (rol, estado, restablecimiento de contraseña, confirmación al desactivar y mensaje claro si es el último ADMIN) y mostrar la sección Usuarios solo a ADMIN

**Punto de control**: Las cuatro historias funcionan de forma independiente

---

## Fase 7: Pulido y temas transversales

**Propósito**: Mejoras que afectan a varias historias

- [X] T071 [P] Escribir la prueba de seguridad de que ninguna ruta protegida acepta peticiones sin token ni con rol no autorizado (matriz completa de `contracts/api.md`) en `server/tests/integration/permissions.test.js`
- [X] T072 [P] Revisar que ninguna contraseña ni secreto aparezca en texto plano en el repositorio ni en seeds, y que `.env` no esté versionado
- [X] T073 [P] Verificar contra la lista de revisión de `docs/design-system.md` (sección 11) cada pantalla: tokens, transiciones suaves, estados vacío/cargando/error/éxito y confirmaciones obligatorias
- [X] T074 [P] Actualizar `README.md` en español con la instalación, la creación de la base local, las migraciones, los seeds, el arranque y las pruebas
- [X] T075 [P] Actualizar `docs/project-context.md` con las decisiones del sprint que hayan cambiado, según el principio I de la constitución
- [X] T076 Ejecutar la suite completa del backend (`npm test`) y del frontend (`flutter test`) y corregir fallos
- [X] T077 Ejecutar la validación de `quickstart.md` de principio a fin (escenarios 1 a 13) y registrar el resultado

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias; puede comenzar de inmediato
- **Fundamentos (Fase 2)**: depende de la Fase 1; BLOQUEA todas las historias
- **Historias (Fase 3 en adelante)**: dependen de la Fase 2
  - Las historias pueden avanzar en paralelo si hay personal
  - O en orden de prioridad: US1 → US2 → US3 → US4
- **Pulido (Fase 7)**: depende de las historias deseadas

### Dependencias entre historias

- **US1 (P1)**: tras la Fase 2; sin dependencia de otras historias. Es el MVP.
- **US2 (P1)**: tras la Fase 2; requiere el inicio de sesión de US1 para probarse desde la interfaz, pero la API se prueba de forma independiente con tokens de prueba.
- **US3 (P1)**: tras la Fase 2; usa clientes (de los seeds o de US2) como propietarios. La pantalla de detalle del cliente (T048) muestra los vehículos que registra esta historia.
- **US4 (P2)**: tras la Fase 2; amplía `userModel.js` creado en US1 (T065 depende de T029).

### Dentro de cada historia

- Las pruebas se escriben primero y DEBEN fallar antes de implementar
- Modelos y validadores antes de servicios
- Servicios antes de controladores y rutas
- Backend completo antes de las pantallas que lo consumen

### Oportunidades de paralelismo

- En la Fase 1: T003 a T006 en paralelo
- En la Fase 2: T010 a T012, T014, T016, T018 a T021 en paralelo
- Todas las pruebas marcadas [P] de una historia pueden correr juntas
- Modelos y validadores de una historia ([P]) en paralelo; backend y frontend de una misma historia pueden avanzar a la vez una vez fijado el contrato
- Distintas historias pueden asignarse a distintos integrantes tras la Fase 2

---

## Ejemplo de paralelismo: Historia de usuario 1

```bash
# Pruebas de la historia 1 juntas:
Tarea: "Prueba unitaria de la política de contraseñas en server/tests/unit/passwordPolicy.test.js"
Tarea: "Prueba unitaria del servicio de autenticación en server/tests/unit/authService.test.js"
Tarea: "Prueba de contrato de auth en server/tests/contract/auth.contract.test.js"
Tarea: "Prueba de integración de auth en server/tests/integration/auth.test.js"

# Modelo y validadores juntos:
Tarea: "Crear el modelo de usuarios en server/models/userModel.js"
Tarea: "Crear los esquemas de autenticación en server/validators/authValidator.js"
```

---

## Estrategia de implementación

### Primero el MVP (solo historia 1)

1. Completar la Fase 1: Preparación
2. Completar la Fase 2: Fundamentos (CRÍTICA, bloquea todo)
3. Completar la Fase 3: Historia 1
4. **DETENERSE Y VALIDAR**: probar el inicio de sesión de forma independiente
5. Demostrar si está lista

### Entrega incremental

1. Preparación + Fundamentos → base lista
2. Historia 1 → probar → demostrar (MVP)
3. Historia 2 → probar → demostrar
4. Historia 3 → probar → demostrar (flujo principal completo del sprint)
5. Historia 4 → probar → demostrar
6. Cada historia agrega valor sin romper las anteriores

### Estrategia en equipo

1. El equipo completa Preparación y Fundamentos en conjunto
2. Después:
   - Persona A: historia 1
   - Persona B: historia 2
   - Persona C: historia 3
   - Persona D: historia 4
3. Las historias se integran de forma independiente

---

## Notas

- [P] = archivos distintos y sin dependencias pendientes
- La etiqueta [Historia] vincula cada tarea con su historia para la trazabilidad
- Cada historia debe poder completarse y probarse por separado
- Verificar que las pruebas fallen antes de implementar
- Confirmar un commit por tarea o por grupo lógico, en la rama `sdd-speckit`, con Conventional Commits y descripción en español
- Evitar tareas vagas, conflictos en el mismo archivo y dependencias entre historias que rompan su independencia
