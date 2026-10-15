# Guía de validación rápida: Base del sistema, clientes y vehículos

**Funcionalidad**: [spec.md](spec.md) | **Contrato**: [contracts/api.md](contracts/api.md) | **Modelo**: [data-model.md](data-model.md)

Esta guía comprueba de extremo a extremo que el Sprint 1 funciona. Los nombres de comandos y variables son el objetivo del plan; se confirman al implementar.

## Requisitos previos

- Node.js LTS, Flutter estable con soporte para Windows de escritorio y MySQL 8 instalado de forma nativa (no Docker).
- Acceso a MySQL con un usuario administrador (solo para el paso 1).

## 1. Crear las bases de datos y el usuario dedicado

Ejecutar una sola vez con un usuario administrador de MySQL el script `database/scripts/00_create_database.sql`. Crea las bases `motorix` y `motorix_test` y el usuario `motorix_app` (nunca `root`).

## 2. Configurar el entorno

1. Copiar `.env.example` a `.env` (el archivo `.env` está en `.gitignore`).
2. Completar `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET` y las contraseñas iniciales `SEED_ADMIN_PASSWORD`, `SEED_RECEPTION_PASSWORD`, `SEED_MECHANIC_PASSWORD` (valores del estándar en `docs/project-context.md`).
3. Instalar dependencias del servidor: `npm install` dentro de `server/`.

## 3. Aplicar el esquema y cargar los datos de ejemplo

Desde `server/`:

- `npm run db:migrate` — aplica `database/migrations/` y registra cada archivo en `schema_migrations`.
- `npm run db:seed` — carga usuarios, clientes y vehículos de ejemplo.

**Resultado esperado**:

- Existen las tablas `users`, `clients`, `vehicles` y `schema_migrations`.
- Hay 3 usuarios, 8 clientes y 12 vehículos.
- Ejecutar `npm run db:seed` otra vez no cambia esas cantidades (SC-006).
- `npm run db:reset` recrea la base desde cero (CA-6).
- Ninguna contraseña aparece en texto plano en la base (SC-008).

## 4. Iniciar el servidor y comprobar su estado

`npm start` en `server/`; luego `GET /api/health` responde `200` con `status: ok`.

## 5. Recorrer el flujo demostrable

Con la aplicación Flutter (`flutter run -d windows` dentro de `client/`):

| Paso | Acción | Resultado esperado |
|:----:|--------|--------------------|
| 1 | Iniciar sesión como `recepcion` con su usuario | Entra y ve Clientes y Vehículos, sin Usuarios |
| 2 | Cerrar sesión e iniciar con el correo del mismo usuario | Entra igual (FR-001) |
| 3 | Registrar un cliente nuevo (nombre y teléfono) | Aparece en el listado |
| 4 | Registrar un vehículo y elegir ese cliente como propietario | Aparece en el detalle del cliente |
| 5 | Intentar registrar otro vehículo con la misma placa | Aviso de placa duplicada; no se guarda |
| 6 | Editar el teléfono del cliente | El cambio se ve en listado y detalle |
| 7 | Registrar un cliente con un teléfono ya existente | Advertencia con confirmación; se guarda solo si se confirma |
| 8 | Buscar un cliente por nombre | El listado se reduce a las coincidencias |
| 9 | Cerrar sesión e iniciar como `mecanico` | Ve clientes y vehículos sin botones de alta ni edición |
| 10 | Iniciar como `admin`, crear un usuario y cambiar su rol | Aparece en Usuarios; el nuevo usuario entra con su rol |
| 11 | Cambiar una contraseña por otra sin mayúscula | Se rechaza con mensaje de la política mínima |
| 12 | Cinco contraseñas incorrectas seguidas en una cuenta | Al quinto intento se indica que la cuenta está bloqueada 15 minutos (también rechaza la contraseña correcta) |

## 6. Verificar los permisos en el servidor (CA-2, SC-002)

Con el token de `mecanico`, `POST /api/clients` responde `403 FORBIDDEN`; con el de `recepcion`, `GET /api/users` responde `403 FORBIDDEN`; sin token, cualquier endpoint protegido responde `401 UNAUTHENTICATED`.

## 7. Ejecutar las pruebas automáticas

- Backend (desde `server/`): `npm test` — unitarias, integración y contrato contra `motorix_test`. Debe aprobar al 100 %.
- Frontend (desde `client/`): `flutter test`.

## 8. Revisión de higiene del repositorio

- `.env` no está versionado y `.env.example` solo contiene las variables sin valores sensibles (CA-7, CA-8).
- `server/package.json` declara `"type": "module"` y el código no usa `require` (CA-5).
- Cada pantalla cumple la lista de "terminado" de `docs/design-system.md` (CA-12).
