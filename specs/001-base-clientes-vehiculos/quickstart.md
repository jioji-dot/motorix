# Guía de validación rápida: Sprint 1

Guía para comprobar de extremo a extremo que la funcionalidad opera. Los detalles de campos y respuestas están en [data-model.md](data-model.md) y [contracts/api.md](contracts/api.md).

## Requisitos previos

- Node.js 24, Flutter 3.47.5 y MySQL 8.0 local (en este equipo, puerto 3307).
- Archivo `.env` creado a partir de `.env.example` (nunca se versiona). Contiene `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN` y `PORT`.

## 1. Preparar la base de datos

1. Crear la base `motorix`, la base `motorix_test` y el usuario `motorix_app` con `database/scripts/crear-entorno.ps1` (requiere la contraseña de `root` solo en ese paso, que se pasa por entorno y no se guarda en el repositorio).
2. Aplicar el esquema con `database/scripts/aplicar-migraciones.ps1`.
3. Cargar los datos de ejemplo con los seeds. **Esperado**: tablas `users`, `clients`, `vehicles` y `schema_migrations`; 3 usuarios, al menos 5 clientes con vehículos.
4. Repetir el paso 2 y el 3. **Esperado**: sin errores y sin registros duplicados (FR-027).

## 2. Ejecutar la aplicación

1. Backend: `cd server`, `npm install`, `npm start`. **Esperado**: API escuchando en el puerto configurado.
2. Frontend: `cd client`, `flutter pub get`, `flutter run`. **Esperado**: pantalla de inicio de sesión.

## 3. Escenarios de validación

| # | Escenario | Pasos | Resultado esperado |
|---|-----------|-------|--------------------|
| 1 | Inicio con usuario | Entrar como `recepcion` | Acceso; pantalla inicial Clientes con datos de ejemplo |
| 2 | Inicio con correo | Entrar con el correo de `recepcion` | Mismo resultado que el escenario 1 |
| 3 | Credenciales incorrectas | Contraseña errónea | Mensaje genérico en español |
| 4 | Bloqueo | 5 intentos fallidos seguidos | Cuenta bloqueada 15 min con aviso del tiempo |
| 5 | Flujo principal | Registrar cliente → registrar vehículo → asociarlo → consultar el detalle | El detalle del cliente lista el vehículo |
| 6 | Vehículo sin propietario | Registrar vehículo sin cliente | Rechazo por propietario obligatorio |
| 7 | Placas duplicadas | Repetir placas | Rechazo con mensaje claro |
| 8 | Teléfono repetido | Registrar un teléfono existente | Aviso y petición de confirmación |
| 9 | Permisos del mecánico | Entrar como `mecanico` e intentar crear un cliente | Sin opción en la interfaz y 403 desde la API |
| 10 | Gestión de usuarios | Como `admin`, crear un mecánico y desactivarlo | El usuario entra y, al desactivarlo, deja de poder entrar de inmediato |
| 11 | Último administrador | Desactivar al único `admin` | Rechazo `LAST_ADMIN` |
| 12 | Cambio de contraseña | Cambiar con y sin cumplir la política | Se acepta solo si cumple 8 caracteres, mayúscula, minúscula y número |
| 13 | Cierre de sesión | Cerrar sesión desde el usuario al pie de la barra | Pide confirmación y termina la sesión |

## 4. Ejecutar las pruebas automatizadas

1. Backend: `cd server`, `npm test`. **Esperado**: pruebas unitarias, de integración y de contrato en verde; las de integración usan `motorix_test`, nunca `motorix`.
2. Frontend: `cd client`, `flutter test`. **Esperado**: pruebas de providers y widgets en verde.

## 5. Revisión de seguridad

- `git ls-files` no incluye `.env`; `.env.example` no contiene valores sensibles.
- Ninguna contraseña en texto plano en el repositorio ni en la columna `passwordHash`.
- Un error forzado de la API no devuelve trazas ni detalles internos.
