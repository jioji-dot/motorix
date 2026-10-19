# Investigación (Fase 0): Base del sistema, clientes y vehículos

No quedaron marcadores `NEEDS CLARIFICATION` en el contexto técnico. Esta investigación consolida las decisiones que fijan el plan; la mayoría ya estaban resueltas por el equipo en `docs/project-context.md` (sección 27) y en la sesión de aclaraciones del 2026-10-19.

## 1. Acceso a datos

- **Decisión**: driver `mysql2` (API de promesas) con un pool de conexiones, sin ORM ni constructor de consultas. Las consultas son siempre parametrizadas.
- **Justificación**: es compatible con ES Modules, evita dependencias grandes y mantiene el SQL visible para el reporte. Las consultas parametrizadas previenen inyección SQL.
- **Alternativas**: Sequelize/Prisma (más dependencias y abstracción innecesaria para 3 tablas); `mysql` clásico (sin promesas nativas).

## 2. Migraciones y semillas

- **Decisión**: scripts SQL numerados e inmutables en `database/migrations/`, aplicados por un script de PowerShell idempotente que registra lo ejecutado en la tabla `schema_migrations`. Los seeds usan `INSERT ... ON DUPLICATE KEY UPDATE` sobre claves únicas.
- **Justificación**: permite recrear la base desde cero (SC-007) y repetir los seeds sin duplicar (FR-027).
- **Alternativas**: herramienta de migraciones de terceros (dependencia adicional); sincronización automática de un ORM (descartada junto con el ORM).

## 3. Autenticación y sesión

- **Decisión**: JWT firmado con secreto de variable de entorno y duración de 8 horas; contraseñas con `bcryptjs` (costo 10). El middleware de autenticación consulta en cada petición el rol y el estado activo del usuario en la base. Bloqueo de 15 minutos tras 5 intentos fallidos consecutivos, con contador y fecha de bloqueo guardados en `users`.
- **Justificación**: cumple FR-003, FR-004 y FR-009 (los cambios de rol o desactivación aplican de inmediato) sin mantener listas de revocación. `bcryptjs` es JavaScript puro y evita compilar módulos nativos en Windows.
- **Alternativas**: `bcrypt` nativo (compilación en Windows); sesiones en servidor (el equipo fijó JWT); listas de revocación de tokens (complejidad innecesaria).

## 4. Identificación por usuario o correo

- **Decisión**: un único campo `identifier`; si contiene `@` se busca por `email`, si no por `username`. Ambos se comparan sin distinguir mayúsculas y con espacios recortados.
- **Justificación**: regla RN-16 y CA-9. Ambos campos son únicos, por lo que no hay ambigüedad.
- **Alternativas**: dos campos separados (contradice la regla de campo único).

## 5. Validación de entradas

- **Decisión**: `zod` con esquemas en `server/validators/` y mensajes en español; la validación ocurre antes de llegar a los servicios.
- **Justificación**: FR-025 exige validar en el servidor con mensajes comprensibles.
- **Alternativas**: validación manual (repetitiva y propensa a errores); `joi` (equivalente, pero ya se eligió `zod`).

## 6. Autorización por rol

- **Decisión**: middleware `authorize(...roles)` por ruta, aplicado después de la autenticación. Matriz: ADMIN gestiona usuarios; ADMIN y RECEPTIONIST escriben clientes y vehículos; MECHANIC solo consulta.
- **Justificación**: FR-008 a FR-010; los permisos viven en el backend, no en la interfaz.
- **Alternativas**: permisos por recurso configurables (fuera del alcance del MVP).

## 7. Formato de respuestas y errores

- **Decisión**: respuestas JSON `{ "data": ... }` en éxito y `{ "error": { "code", "message", "details" } }` en error; un único manejador de errores centralizado que nunca expone trazas.
- **Justificación**: principio VI y FR-025.
- **Alternativas**: respuestas libres por endpoint (inconsistentes).

## 8. Reglas de datos

- **Decisión**: la unicidad de `username`, `email`, `licensePlate` y `vin` se garantiza con restricciones `UNIQUE` en la base y se traduce a errores 409 en el servicio. `vin` admite `NULL` (varios vehículos sin VIN). La desactivación de clientes y usuarios es lógica (`active = 0`). Un teléfono repetido en clientes devuelve una advertencia 409 con código `DUPLICATE_PHONE` y se acepta al reenviar con `confirmDuplicatePhone: true`.
- **Justificación**: FR-017, FR-019, FR-022; la restricción en la base evita condiciones de carrera.
- **Alternativas**: validar solo en el servicio (vulnerable a concurrencia).

## 9. Último administrador activo

- **Decisión**: el servicio de usuarios rechaza desactivar o cambiar de rol al último ADMIN activo, con la verificación y la actualización dentro de una transacción.
- **Justificación**: FR-013.
- **Alternativas**: solo verificar en la interfaz (insuficiente según RN-15).

## 10. Frontend

- **Decisión**: Flutter 3.47.5 con Material 3 y `ThemeData` propio en `client/lib/utils/app_theme.dart`; estado con Provider; `google_fonts` (IBM Plex Sans), `data_table_2` 2.6.0 (la 3.x no es compatible con esta versión de Flutter), `lucide_icons_flutter` y cliente HTTP `http`. Sin librería complementaria de componentes (aclaración). Barra lateral con `NavigationRail`: Clientes y Vehículos para todos y Usuarios solo para ADMIN; pantalla inicial Clientes.
- **Justificación**: `docs/design-system.md` y las aclaraciones de la especificación.
- **Alternativas**: `shadcn_ui` (descartada por el equipo en la aclaración); `dio` en lugar de `http` (más funciones de las necesarias).

## 11. Estrategia de pruebas

- **Decisión**: Jest para unitarias; Jest + supertest para integración y contrato contra la base `motorix_test`, que se recrea con las migraciones antes de la suite; `flutter test` para providers y widgets. Se prueba cada rol contra cada endpoint protegido (SC-003).
- **Justificación**: constitución, principio VII.
- **Alternativas**: pruebas contra la base principal (prohibido).

## 12. Configuración del entorno

- **Decisión**: variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, más `JWT_SECRET`, `JWT_EXPIRES_IN` y `PORT`, definidas en `.env` (ignorado por Git) y documentadas en `.env.example` sin valores sensibles. Cada integrante usa su puerto local de MySQL (en este equipo, 3307). La aplicación se conecta con `motorix_app`, nunca con `root`; la contraseña de `root` solo se usa en el script de creación del entorno y no se guarda en el repositorio.
- **Justificación**: principios III y IV.
- **Alternativas**: valores fijos en código (prohibido).
