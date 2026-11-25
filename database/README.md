# Base de datos de Motorix

MySQL 8.0 local, motor InnoDB y codificación `utf8mb4`. Cada integrante usa su propia instancia. El
esquema y los datos de ejemplo se definen únicamente con los scripts de esta carpeta, de modo que la
base puede recrearse desde cero.

```text
database/
├── migrations/   scripts SQL numerados e inmutables (no se editan una vez aplicados)
├── seeds/        datos de ejemplo idempotentes (SQL)
├── scripts/      crear-entorno.ps1 y aplicar-migraciones.ps1
└── README.md
```

## Requisitos

- MySQL 8.0 en ejecución (en este equipo, puerto 3307).
- Cliente `mysql` accesible (se detecta en `C:\Program Files\MySQL\MySQL Server 8.0\bin`).
- La contraseña del usuario administrador de MySQL (`root`) se entrega **solo por variable de entorno**
  (`MYSQL_ROOT_PASSWORD`) durante la creación del entorno; nunca se guarda en el repositorio.

## Nombres de las bases

Por defecto el proyecto usa `motorix` y `motorix_test`. Si en tu servidor ya existen con otro contenido,
usa otros nombres con los parámetros `-Base` y `-BasePrueba` (por ejemplo `motorix_sdd` y
`motorix_sdd_test`) y los mismos valores en `DB_NAME` de tu `.env`. Las pruebas de integración se ejecutan
siempre contra la base de pruebas (el nombre debe terminar en `_test`), nunca contra la base principal.

## Crear el entorno local

```powershell
$env:MYSQL_ROOT_PASSWORD = (Get-Content C:\ruta\a\tu\contrasena.txt -Raw).Trim()
./database/scripts/crear-entorno.ps1 -Puerto 3307 -Base motorix_sdd -BasePrueba motorix_sdd_test -Usuario motorix_sdd_app
```

El script crea las bases y el usuario dedicado `motorix_app` (la aplicación nunca usa `root`), y
escribe `.env` en la raíz con una contraseña generada para ese usuario y un `JWT_SECRET` aleatorio. Ese
archivo está en `.gitignore`.

## Aplicar migraciones y datos de ejemplo

```powershell
./database/scripts/aplicar-migraciones.ps1 -Puerto 3307 -Base motorix_sdd
./database/scripts/aplicar-migraciones.ps1 -Puerto 3307 -Base motorix_sdd_test
cd server
npm run seed
```

- Las migraciones se registran en `schema_migrations`; volver a ejecutar el script no repite las ya
  aplicadas.
- `npm run seed` carga usuarios, clientes y vehículos de ejemplo. Es idempotente: ejecutarlo de nuevo no
  duplica registros. Las contraseñas se guardan con hash bcrypt, nunca en texto plano.

## Reiniciar desde cero

```powershell
./database/scripts/crear-entorno.ps1 -Puerto 3307 -Base motorix_sdd -BasePrueba motorix_sdd_test -Reiniciar
```

`-Reiniciar` elimina y vuelve a crear **solo** las bases indicadas en `-Base` y `-BasePrueba`.

## Migraciones y datos de ejemplo por sprint

| Sprint | Migración | Datos de ejemplo |
|--------|-----------|------------------|
| 1 | `001_sprint1_users_clients_vehicles.sql` | `001_clients.sql`, `002_vehicles.sql` (y los usuarios de `npm run seed`) |
| 2 | `002_sprint2_appointments_orders.sql` | `003_appointments.sql`, `004_service_orders.sql` |
| 3 | `003_sprint3_maintenance_inventory.sql` | `005_parts.sql`, `006_order_parts.sql`, `007_maintenance.sql` |
| 4 | `004_sprint4_payments_tickets.sql` | `008_payments_tickets.sql` |
| 5 | (sin migración: endurece lo anterior) | (sin seeds nuevos) |
| 6 | `005_sprint6_notificaciones.sql`: tablas `notification_reads` (lecturas de avisos por usuario) y `client_notices` (clientes ya avisados, único por tipo de hecho y hecho) | `009_notificaciones.sql`: una cita de hoy, una orden detenida del mecánico y un cliente ya avisado, con fechas relativas a la carga |
| 7 | `006_sprint7_configuracion_seguridad.sql`: tablas `settings`, `service_types`, `terms_versions`, `terms_acceptances` y `audit_log`; columnas `order_services.serviceTypeId`, `users.lastActivityAt` y la instantánea de `tickets` | `010_configuracion.sql`: configuración inicial, cinco tipos de servicio con intervalos, líneas enlazadas a un tipo y la versión 1 de los términos |

Los avisos **no se guardan**: se calculan al consultar; solo se guarda su lectura y los avisos hechos a clientes. Los seeds de cada sprint son
idempotentes (cargarlos dos veces no cambia ningún conteo).
