# Investigación (Fase 0): Base del sistema, clientes y vehículos

**Funcionalidad**: [spec.md](spec.md) | **Fecha**: 2026-10-12

El Contexto técnico no tiene marcadores `NEEDS CLARIFICATION`: el stack ya está fijado por la constitución y por las decisiones resueltas en `docs/project-context.md`. Este documento registra las decisiones de diseño que quedaban abiertas para este sprint.

## D1. Versión de Node.js y arranque de la configuración

- **Decisión**: Node.js 24 LTS (o la LTS vigente al instalar). Las variables de entorno se cargan con la opción nativa `--env-file`, sin la dependencia `dotenv`.
- **Justificación**: la constitución exige la versión LTS y evitar dependencias que se resuelven con pocas líneas.
- **Alternativas**: `dotenv` (dependencia extra sin beneficio real).

## D2. Dependencias del backend

- **Decisión**: `express`, `mysql2` (driver directo), `jsonwebtoken`, `bcryptjs`, `zod` (validación de cuerpos y parámetros), `helmet` (cabeceras seguras). De desarrollo: `jest`, `supertest`.
- **Justificación**:
  - `bcryptjs` es JavaScript puro y evita compilar módulos nativos en Windows; el costo en velocidad es irrelevante a esta escala.
  - `zod` cubre la validación y sanitización de entradas (Principio IV) con esquemas reutilizables en `validators/`.
  - `helmet` aporta cabeceras seguras con una línea.
- **Alternativas**: `bcrypt` nativo (requiere binarios por plataforma); `express-validator`/`joi` (equivalentes, sin ventaja clara); escribir validaciones a mano (más código y más errores).
- **Nota**: todas las dependencias son compatibles con ES Modules.

## D3. Sesión y credencial

- **Decisión**: JWT firmado, enviado en `Authorization: Bearer`, con vigencia de 8 horas (FR-002). El token solo contiene el identificador del usuario; el rol y el estado activo se leen de la base en cada petición protegida.
- **Justificación**: así un cambio de rol o una desactivación (FR-006) surte efecto de inmediato y no hay que invalidar tokens. Una consulta por petición es despreciable para un taller.
- **Alternativas**: incluir el rol en el token (cambios tardan hasta 8 h); lista de revocación (complejidad innecesaria); refresh tokens (fuera de alcance).
- **Cierre de sesión**: lo hace el cliente descartando el token; no hay endpoint de logout.

## D4. Bloqueo por intentos fallidos (FR-002a)

- **Decisión**: columnas `failed_login_attempts` y `locked_until` en `users`. Al llegar a 5 fallos consecutivos se fija `locked_until = ahora + 15 min`. Un acceso correcto reinicia el contador. Los intentos contra usuarios inexistentes no se cuentan y devuelven el mismo error genérico.
- **Justificación**: es persistente y simple, sin infraestructura adicional. El mensaje genérico de credenciales inválidas no revela si la cuenta existe (escenario 3 de US1).
- **Alternativas**: límite por IP con `express-rate-limit` (no protege una cuenta concreta y afecta a todo el taller detrás de una misma IP); contador en memoria (se pierde al reiniciar).

## D5. Normalización de datos y unicidad

- **Decisión**:
  - Base con `utf8mb4` y collation `utf8mb4_0900_ai_ci` (MySQL 8): la unicidad de `username` y `email` no distingue mayúsculas.
  - El backend recorta espacios, pasa el correo a minúsculas y normaliza la placa a mayúsculas sin espacios ni guiones antes de validar y guardar.
  - Índices únicos en `users.username`, `users.email`, `vehicles.license_plate` y `vehicles.vin` (`NULL` permitido y no cuenta como duplicado).
- **Justificación**: cubre el caso límite de mayúsculas/espacios al iniciar sesión y delega las carreras de concurrencia a la restricción de la base, que devuelve un error de duplicado traducido a 409.
- **Alternativas**: validar unicidad solo en la capa de servicio (falla en concurrencia).

## D6. Advertencia de teléfono duplicado (FR-011)

- **Decisión**: el teléfono de cliente no es único. Si ya existe, el backend responde 409 con el código `PHONE_DUPLICATE_WARNING` y los clientes coincidentes; el cliente repite la petición con `confirmDuplicatePhone: true` tras la confirmación del usuario.
- **Justificación**: mantiene la regla en el servidor (Principio IV) y deja a la interfaz solo el diálogo de confirmación que exige el sistema de diseño.
- **Alternativas**: confirmación solo en el frontend (la regla no se haría cumplir en el servidor).

## D7. Migraciones y seeds

- **Decisión**:
  - El SQL vive en `database/` (`migrations/`, `seeds/`, `scripts/`), como exige la constitución.
  - Los ejecutores son scripts de Node en `server/scripts/` (`migrate.js`, `seed.js`, `reset-db.js`), porque necesitan `mysql2` y `bcryptjs`, que se resuelven desde `server/node_modules`.
  - `migrate.js` registra cada archivo aplicado en `schema_migrations` con su checksum, y se niega a continuar si un archivo ya aplicado cambió (inmutabilidad).
  - `database/scripts/00_create_database.sql` crea las bases `motorix` y `motorix_test` y el usuario dedicado `motorix_app`; lo ejecuta una vez el administrador de MySQL.
  - Los seeds son idempotentes: usuarios con `INSERT ... ON DUPLICATE KEY UPDATE` sobre `username`; clientes con `INSERT ... SELECT ... WHERE NOT EXISTS` sobre (nombre, teléfono); vehículos con `INSERT IGNORE` sobre `license_plate`.
  - Las contraseñas iniciales no están en el repositorio: `seed.js` las toma de `SEED_ADMIN_PASSWORD`, `SEED_RECEPTION_PASSWORD` y `SEED_MECHANIC_PASSWORD` (en `.env`), las cifra y falla con un mensaje claro si faltan. Los valores del estándar del MVP están en `docs/project-context.md`.
- **Justificación**: cumple CA-6, CA-8, CA-10 y la regla de seeds idempotentes sin guardar contraseñas, ni siquiera cifradas, en el repositorio.
- **Alternativas**: hashes bcrypt fijos en un `.sql` (publican credenciales conocidas en el repositorio); herramientas de migración externas (descartadas por decisión del equipo).

## D8. Estrategia de pruebas del backend

- **Decisión**: Jest en modo ESM (`node --experimental-vm-modules ./node_modules/jest/bin/jest.js`, sin `cross-env`) ejecutado con `--runInBand`. Carpetas `server/tests/unit`, `integration` y `contract`. Las pruebas de integración y contrato usan `motorix_test`: una configuración global aplica las migraciones y cada suite limpia las tablas. Un resguardo aborta si `DB_NAME` no termina en `_test`.
- **Justificación**: cumple el Principio VII y evita tocar la base principal por error.
- **Alternativas**: base en memoria o simulada (no valida restricciones reales de MySQL).

## D9. Aplicación Flutter

- **Decisión**:
  - Objetivo principal: Windows de escritorio (prioridad de escritorio del Principio VIII).
  - Dependencias: `provider`, `http`, `google_fonts` y un único set de íconos.
  - Tablas: `DataTable` nativo de Flutter (envuelto en `AppDataTable`) con paginación del lado del servidor. Se descartó `data_table_2` 3.0 porque, con Flutter 3.47, usa tipos de `material_ui` incompatibles con `flutter/material.dart` (el `DataCell` de ambos no es el mismo tipo) y no aporta nada que la paginación propia no cubra.
  - La credencial se guarda solo en memoria (en un `Provider`); al cerrar la aplicación se vuelve a iniciar sesión. Sesión de 8 horas, sin almacenamiento persistente del token.
  - Navegación con `Navigator` y rutas nombradas; sin paquete de enrutamiento.
- **Justificación**: mínimo de dependencias; evita guardar credenciales en disco.
- **Alternativas**: `flutter_secure_storage`/`shared_preferences` (útiles si se pide recordar sesión, fuera de alcance); `go_router` (innecesario con pocas pantallas).

## D10. Decisiones de interfaz diferidas desde `/speckit-clarify`

Propuestas del plan, pendientes de confirmación del equipo (la constitución las lista como decisiones pendientes y no deben tomarse como irreversibles):

- **Librería complementaria de componentes**: ninguna. Material 3 con tema propio cubre formularios, tablas, diálogos y navegación de este sprint. Sigue disponible la opción de `shadcn_ui` en sprints posteriores.
- **Set de íconos**: `lucide_icons_flutter` (uno solo, sobrio, sugerido en `docs/design-system.md`). Alternativa: `phosphor_flutter`.
- **Menú lateral y pantallas iniciales** (solo módulos del sprint y del rol):

| Elemento | ADMIN | RECEPTIONIST | MECHANIC |
|----------|:-----:|:------------:|:--------:|
| Clientes (lista, detalle, alta, edición) | sí | sí | solo consulta |
| Vehículos (lista, detalle, alta, edición) | sí | sí | solo consulta |
| Usuarios (lista, alta, edición, restablecer contraseña) | sí | no | no |
| Cerrar sesión (con confirmación) | sí | sí | sí |

  - Pantalla de acceso (sin sidebar) y pantalla inicial tras entrar: Clientes.
  - Cambiar contraseña: acción en el menú del usuario del encabezado.
  - Sin Dashboard, Citas, Órdenes, etc.: pertenecen a sprints posteriores.

## D11. Kilometraje del vehículo

- **Decisión**: `vehicles.current_mileage` se incluye como entero no negativo con valor por defecto 0 y se puede capturar al registrar y editar el vehículo. La regla de que un kilometraje nuevo no baja sin corrección explícita (Principio V) se aplica al editar.
- **Justificación**: `docs/project-context.md` incluye `currentMileage` en la entidad `Vehicle` y las órdenes de sprints posteriores dependen de él; la especificación no lo prohíbe y no cambia el alcance.
- **Alternativas**: omitirlo y agregarlo en el Sprint 2 (obliga a otra migración y a reabrir el modelo).

## D12. Protección del último administrador

- **Decisión**: el servicio de usuarios rechaza, con código `LAST_ADMIN_PROTECTED`, desactivar o quitar el rol ADMIN a la última cuenta de administrador activa, y también que un administrador se desactive o cambie su propio rol.
- **Justificación**: cubre el caso límite de la especificación sin pasos manuales de recuperación.
