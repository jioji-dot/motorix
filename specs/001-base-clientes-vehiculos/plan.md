# Plan de implementación: Base del sistema, clientes y vehículos (Sprint 1)

**Rama**: `001-base-clientes-vehiculos` | **Fecha**: 2026-10-12 | **Especificación**: [spec.md](spec.md)

**Entrada**: Especificación de la funcionalidad en `/specs/001-base-clientes-vehiculos/spec.md`

## Resumen

Primer sprint del MVP de Motorix: establece la estructura del repositorio, la conexión a MySQL local con esquema y datos de ejemplo reproducibles, la autenticación con usuario o correo, la autorización por roles (ADMIN, RECEPTIONIST, MECHANIC) validada en el servidor, la gestión de usuarios y los módulos de clientes y vehículos. El flujo demostrable es: iniciar sesión → registrar cliente → registrar vehículo → asociarlo → consultar.

Enfoque técnico (detalle en [research.md](research.md)): API REST en Node.js con Express y ES Modules, acceso directo a MySQL con `mysql2`, JWT de 8 horas con el estado del usuario verificado en cada petición, bloqueo temporal tras 5 intentos fallidos, validación con esquemas, y una aplicación Flutter de escritorio con Material Design 3 y el sistema de diseño del proyecto.

## Contexto técnico

**Lenguaje/Versión**: Backend en JavaScript (ES Modules) sobre Node.js LTS (24); frontend en Dart con Flutter estable.

**Dependencias principales**:
- Backend: `express`, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`, `helmet`; desarrollo: `jest`, `supertest`.
- Frontend: `provider`, `http`, `google_fonts` y un único set de íconos (`lucide_icons_flutter`). Las tablas usan el `DataTable` nativo (ver D9 en research.md).

**Almacenamiento**: MySQL 8 local (InnoDB, `utf8mb4`), bases `motorix` y `motorix_test`, usuario dedicado `motorix_app`.

**Pruebas**: Jest (unitarias) y Jest + supertest (integración y contrato) contra `motorix_test`; `flutter test` en el frontend.

**Plataforma objetivo**: Servidor Node.js en el equipo de desarrollo; cliente Flutter para Windows de escritorio (prioridad de escritorio).

**Tipo de proyecto**: Aplicación web con API (frontend + backend + base de datos separados).

**Metas de rendimiento**: Inicio de sesión hasta la pantalla principal en menos de 15 s (SC-001); búsqueda de clientes en menos de 2 s con 500 clientes (SC-007).

**Restricciones**: Backend sin CommonJS y con `"type": "module"`; permisos validados en el servidor; sin secretos en el repositorio; conexión solo por variables de entorno; seeds idempotentes; pruebas de integración nunca contra la base principal; toda pantalla sigue `docs/design-system.md`.

**Escala/Alcance**: Un taller; 3 roles, decenas de usuarios como máximo y cientos de clientes y vehículos; 3 tablas funcionales y cerca de 5 pantallas de lista/detalle/formulario más acceso y cambio de contraseña.

## Verificación de la constitución

*COMPUERTA: debe aprobarse antes de la Fase 0. Se vuelve a evaluar tras el diseño de la Fase 1.*

| Principio | Evaluación | Estado |
|-----------|------------|:------:|
| I. Alcance, MVP y fuente de verdad | Solo se planea el Sprint 1; Mercado Pago, dashboard, tickets, citas y órdenes quedan fuera. Se respeta `docs/project-context.md`. | Aprobado |
| II. Arquitectura con responsabilidades separadas | `client/`, `server/`, `database/` separados; el backend usa `config`, `controllers`, `models`, `routes`, `services`, `middlewares`, `validators`, `utils`; la lógica de negocio va en `services/`. | Aprobado |
| III. Stack y base de datos local | Flutter/Dart, Node LTS + Express, MySQL local con usuario dedicado, ES Modules, JWT + bcrypt, login por usuario o correo, scripts SQL numerados en `database/`, InnoDB, FK y `utf8mb4`, seeds con datos de ejemplo e idempotentes. | Aprobado |
| IV. Seguridad | Contraseñas cifradas; secretos en `.env`; permisos y validación en el servidor; errores sin trazas; bloqueo por intentos fallidos. | Aprobado |
| V. Integridad de reglas de negocio | Vehículo siempre con propietario (FK); el kilometraje no baja sin corrección explícita. Las reglas de órdenes, stock y pagos no aplican aún. | Aprobado |
| VI. API consistente y errores | Contrato único con envoltorio de respuesta, códigos HTTP y manejador de errores centralizado ([contracts/api.md](contracts/api.md)). | Aprobado |
| VII. Pruebas | Unitarias, integración y contrato contra `motorix_test`; lógica de permisos, bloqueo y reglas de negocio con pruebas; criterio de terminado de extremo a extremo. | Aprobado |
| VIII. UX/UI | Material 3 con tema propio, tokens del sistema de diseño, confirmaciones obligatorias, máximo una librería de componentes (ninguna en este sprint). | Aprobado |

**Resultado de la compuerta**: sin violaciones; no se requiere tabla de complejidad.

**Reevaluación tras el diseño (Fase 1)**: se mantiene aprobado. Dos precisiones que no son violaciones:
- Los ejecutores de migraciones y seeds viven en `server/scripts/` y el SQL en `database/`, porque necesitan dependencias del servidor (D7).
- La estructura del backend no usa carpeta `src/`, según la decisión registrada en la constitución.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/001-base-clientes-vehiculos/
├── plan.md              # Este archivo (salida de /speckit-plan)
├── research.md          # Salida de la Fase 0
├── data-model.md        # Salida de la Fase 1
├── quickstart.md        # Salida de la Fase 1
├── contracts/
│   └── api.md           # Contrato de la API REST (Fase 1)
├── checklists/
│   └── requirements.md  # Calidad de la especificación
└── tasks.md             # Salida de /speckit-tasks (NO la crea /speckit-plan)
```

### Código fuente (raíz del repositorio)

```text
client/                                  # Flutter (Windows de escritorio)
├── lib/
│   ├── models/                          # User, Client, Vehicle, ApiError
│   ├── providers/                       # AuthProvider, ClientsProvider, VehiclesProvider, UsersProvider, SidebarProvider
│   ├── services/                        # ApiClient (http + token) y servicios por recurso
│   ├── screens/                         # login, clients (lista/detalle/formulario), vehicles, users, change_password
│   ├── widgets/                         # AppShell (sidebar + header), diálogo de confirmación, estados vacío/carga/error
│   ├── utils/                           # app_theme.dart (tokens del sistema de diseño), validadores
│   └── main.dart
├── test/                                # flutter test (providers, validadores y widgets clave)
├── assets/
└── pubspec.yaml

server/                                  # Node.js + Express (ES Modules)
├── config/                              # env, base de datos (pool mysql2), constantes
├── controllers/                         # auth, users, clients, vehicles
├── models/                              # consultas SQL por tabla (users, clients, vehicles)
├── routes/                              # auth, users, clients, vehicles, health
├── services/                            # reglas de negocio: auth, users, clients, vehicles
├── middlewares/                         # authenticate, authorize(roles), validate, errorHandler, notFound
├── validators/                          # esquemas zod por recurso
├── utils/                               # AppError, normalizadores, políticas de contraseña
├── scripts/                             # migrate.js, seed.js, reset-db.js
├── tests/
│   ├── unit/
│   ├── integration/
│   └── contract/
├── app.js                               # crea la aplicación Express (sin escuchar)
├── server.js                            # arranca el servidor
└── package.json                         # "type": "module"

database/
├── migrations/
│   └── 001_sprint1_users_clients_vehicles.sql
├── seeds/
│   └── 001_sample_clients_vehicles.sql
├── scripts/
│   └── 00_create_database.sql           # bases, usuario motorix_app (se ejecuta con un administrador de MySQL)
├── data/                                # opcional, ignorada por Git
└── README.md

docs/
├── project-context.md
├── design-system.md
└── api.md                               # se genera a partir de contracts/api.md al implementar

.env.example                             # DB_*, JWT_SECRET, SEED_*_PASSWORD, PORT, sin valores sensibles
.gitignore                               # incluye .env y database/data/
README.md
```

**Decisión de estructura**: aplicación web con API y base de datos en tres carpetas raíz (`client/`, `server/`, `database/`), tal como exige el Principio II. `app.js` se separa de `server.js` para que supertest ejercite la aplicación sin abrir un puerto.

## Fases de ejecución sugeridas (insumo para `/speckit-tasks`)

El orden respeta la dependencia entre historias y mantiene cada una probable por separado:

1. **Fundamentos**: estructura del repositorio, `.gitignore`, `.env.example`, configuración, pool de MySQL, manejador de errores, envoltorio de respuestas, resguardo de `motorix_test`.
2. **Base de datos**: script de creación, migración 001, ejecutor de migraciones con checksum, seeds idempotentes y `db:reset`.
3. **US1 — Acceso y roles**: login por usuario o correo, bloqueo de cuenta, middlewares `authenticate` y `authorize`, `me` y cambio de contraseña; pantalla de acceso y estructura de la aplicación (tema, sidebar, encabezado, cierre de sesión con confirmación).
4. **US3/US4 — Clientes**: servicio, endpoints, advertencia de teléfono duplicado; pantallas de lista, detalle y formulario.
5. **US5 — Vehículos**: servicio, endpoints, reglas de propietario y kilometraje; pantallas de lista, detalle y formulario con selección de propietario.
6. **US2 — Usuarios**: servicio con protección del último administrador, endpoints y pantallas.
7. **Cierre**: pruebas de contrato, documentación (`README.md`, `docs/api.md`, `database/README.md`), revisión contra la lista de "terminado" de UI y recorrido de [quickstart.md](quickstart.md).

## Decisiones que requieren confirmación del equipo

Propuestas del plan para los puntos que la constitución mantiene como pendientes (ver D10 en [research.md](research.md)); no se tratan como irreversibles:

- Librería complementaria de componentes de UI: ninguna en el Sprint 1.
- Set de íconos: `lucide_icons_flutter`.
- Menú lateral: Clientes, Vehículos y Usuarios (solo ADMIN); pantalla inicial: Clientes.
- Contraseñas iniciales del estándar tomadas de variables de entorno en lugar de estar en el repositorio (D7).

## Seguimiento de complejidad

Sin violaciones de la constitución que justificar.
