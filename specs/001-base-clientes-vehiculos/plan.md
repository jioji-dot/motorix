# Plan de implementación: Base del sistema, clientes y vehículos

**Rama**: `sdd-speckit` (carpeta de la feature `001-base-clientes-vehiculos`) | **Fecha**: 2026-10-19 | **Especificación**: [spec.md](spec.md)

**Entrada**: Especificación de la funcionalidad en `specs/001-base-clientes-vehiculos/spec.md`

## Resumen

El Sprint 1 entrega la base de Motorix: autenticación por usuario o correo con roles, gestión de usuarios (solo ADMIN), clientes y vehículos asociados a su propietario. El enfoque técnico es una API REST en Node.js/Express (ES Modules) que accede a MySQL local con `mysql2`, con JWT y bcrypt para la sesión, y una aplicación Flutter con Material 3 y tema propio que consume esa API. El esquema se versiona como migraciones SQL numeradas y los datos de ejemplo como seeds idempotentes. Las decisiones técnicas están resueltas en [research.md](research.md).

## Contexto técnico

**Lenguaje/Versión**: Node.js 24 (LTS vigente en el equipo) con JavaScript ES Modules; Dart con Flutter 3.47.5

**Dependencias principales**: Backend: `express`, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`, `dotenv`, `cors`. Frontend: `provider`, `http`, `google_fonts`, `data_table_2` 2.6.0, `lucide_icons_flutter`. Sin librería complementaria de componentes (aclaración del 2026-10-19).

**Almacenamiento**: MySQL 8.0 local (instalación nativa, puerto 3307 en este equipo), InnoDB, `utf8mb4`, usuario dedicado `motorix_app`

**Pruebas**: Backend: Jest (unitarias) y Jest + supertest (integración y contrato) contra la base `motorix_test`. Frontend: `flutter test` (providers y widgets).

**Plataforma objetivo**: Aplicación Flutter de escritorio/web con prioridad en escritorio; API REST local en Node.js

**Tipo de proyecto**: Aplicación web con frontend y backend separados (`client/` y `server/`)

**Metas de rendimiento**: Inicio de sesión y consultas de listados en menos de 1 segundo en entorno local con cientos de registros; flujo completo de demostración en menos de 3 minutos (SC-002)

**Restricciones**: Backend solo ESM; solo el backend accede a la base de datos; permisos validados en backend; sin secretos en el repositorio; mensajes en español sin trazas internas; toda pantalla sigue `docs/design-system.md`

**Escala/Alcance**: Un taller; decenas de usuarios, cientos de clientes y vehículos; 3 módulos (usuarios, clientes, vehículos) más inicio de sesión, aproximadamente 6 pantallas

## Verificación de la constitución

*PUERTA: debe aprobarse antes de la investigación de la Fase 0. Se vuelve a verificar tras el diseño de la Fase 1.*

| Principio | Cumplimiento | Evidencia en el plan |
|-----------|--------------|----------------------|
| I. Alcance, MVP y fuente de verdad | Cumple | Solo Sprint 1; sin citas, órdenes, pagos ni dashboard |
| II. Arquitectura con responsabilidades separadas | Cumple | `client/`, `server/`, `database/`; lógica en `services/` |
| III. Stack y base de datos local | Cumple | Flutter, Node ESM, MySQL local, `mysql2`, migraciones y seeds idempotentes, usuario `motorix_app` |
| IV. Seguridad | Cumple | bcrypt, JWT, `.env` fuera de Git, validación y rol en backend, errores sin trazas |
| V. Reglas de negocio | Cumple | Vehículo siempre con propietario (llave foránea `NOT NULL`); placas únicas |
| VI. API consistente | Cumple | Formato JSON uniforme y manejo centralizado de errores ([contracts/api.md](contracts/api.md)) |
| VII. Pruebas | Cumple | Jest + supertest contra `motorix_test`; `flutter test` |
| VIII. UX/UI | Cumple | Material 3 con tema propio, tokens, sin librería extra, confirmaciones |

**Resultado**: sin violaciones; la tabla de seguimiento de complejidad queda vacía. Se reevaluó tras el diseño de la Fase 1 con el mismo resultado.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/001-base-clientes-vehiculos/
├── plan.md              # Este archivo (salida de /speckit-plan)
├── research.md          # Salida de la Fase 0
├── data-model.md        # Salida de la Fase 1
├── quickstart.md        # Salida de la Fase 1
├── contracts/
│   └── api.md           # Contrato de la API REST
├── checklists/
│   └── requirements.md
└── tasks.md             # Salida de /speckit-tasks (NO la crea /speckit-plan)
```

### Código fuente (raíz del repositorio)

```text
server/
├── config/              # env.js, db.js
├── controllers/         # auth, users, clients, vehicles
├── models/              # acceso a datos con mysql2
├── routes/
├── services/            # lógica de negocio
├── middlewares/         # authenticate, authorize, errorHandler
├── validators/          # esquemas zod en español
├── utils/
├── scripts/             # create-admin.js
├── tests/
│   ├── unit/
│   ├── integration/
│   └── contract/
├── app.js
├── server.js
└── package.json         # "type": "module"

client/
├── lib/
│   ├── models/
│   ├── screens/         # login, clients, vehicles, users, change_password
│   ├── widgets/
│   ├── services/        # cliente HTTP de la API
│   ├── providers/       # auth, sidebar, clients, vehicles, users
│   ├── utils/           # app_theme.dart y tokens
│   └── main.dart
├── test/
└── pubspec.yaml

database/
├── migrations/          # 001_sprint1_users_clients_vehicles.sql
├── seeds/               # 001_initial_users_clients_vehicles.sql
├── scripts/             # crear-entorno.ps1, aplicar-migraciones.ps1
└── README.md

.env.example
```

**Decisión de estructura**: aplicación web con frontend y backend separados, según la sección 11 de `docs/project-context.md`. El backend no usa carpeta `src/` intermedia; las capas viven directamente en `server/`.

## Seguimiento de complejidad

> Sin violaciones de la constitución; no se requiere justificación.

| Violación | Por qué se necesita | Alternativa más simple descartada porque |
|-----------|---------------------|------------------------------------------|
| Ninguna | N/A | N/A |
