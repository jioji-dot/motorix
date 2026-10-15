# Base de datos de Motorix (MySQL local)

Durante los cuatro sprints del MVP cada integrante trabaja con **su propia instancia local de MySQL 8**
(instalación nativa, sin Docker). No se usa base de datos en la nube. Solo el backend accede a la base.

## Estructura

```text
database/
├── migrations/   # Esquema: scripts SQL numerados e inmutables
├── seeds/        # Datos de ejemplo (idempotentes)
├── scripts/      # 00_create_database.sql: crea las bases y el usuario dedicado
├── data/         # (opcional) datadir local; está ignorada por Git
└── README.md
```

Los ejecutores de migraciones y seeds están en `server/scripts/` (necesitan las dependencias del
servidor). El SQL vive aquí.

## 1. Crear las bases y el usuario dedicado (una sola vez)

1. Abre `scripts/00_create_database.sql` y reemplaza `CAMBIAR_CONTRASENA` por una contraseña propia.
2. Ejecútalo con un usuario administrador de MySQL:

   ```text
   mysql -u root -p < database/scripts/00_create_database.sql
   ```

Esto crea las bases `motorix` (desarrollo) y `motorix_test` (pruebas) con `utf8mb4`, y el usuario
`motorix_app` con permisos solo sobre ellas. **La aplicación nunca debe conectarse como `root`.**

## 2. Configurar el entorno

En la raíz del repositorio:

1. Copia `.env.example` a `.env` y completa:
   - `DB_HOST`, `DB_PORT`, `DB_USER=motorix_app`, `DB_PASSWORD` (la que elegiste), `DB_NAME=motorix`.
   - `JWT_SECRET` con una cadena larga y aleatoria.
   - `SEED_ADMIN_PASSWORD`, `SEED_RECEPTION_PASSWORD`, `SEED_MECHANIC_PASSWORD`: las contraseñas
     iniciales del estándar del MVP (ver `docs/project-context.md`, sección 5.1). Solo para entorno local.
2. Copia `.env` a `.env.test` y cambia `DB_NAME=motorix_test` y `NODE_ENV=test`. Las pruebas de
   integración y contrato **solo** corren contra una base cuyo nombre termina en `_test`.

`.env` y `.env.test` están en `.gitignore`: nunca se suben al repositorio.

## 3. Comandos (desde `server/`)

| Comando | Qué hace |
|---------|----------|
| `npm run db:migrate` | Aplica las migraciones pendientes y las registra en `schema_migrations` |
| `npm run db:seed` | Carga usuarios, clientes, vehículos, citas, órdenes, refacciones, mantenimientos, pagos y tickets de ejemplo (idempotente) |
| `npm run db:reset` | Elimina las tablas, aplica migraciones y carga los seeds (no corre con `NODE_ENV=production`) |

## Reglas de las migraciones

- Cada archivo `NNN_descripcion.sql` se aplica una sola vez, en orden numérico.
- Se guarda el checksum SHA-256 de cada archivo aplicado. **Si un archivo ya aplicado cambia, el
  ejecutor se niega a continuar.** Los cambios de esquema se agregan como un nuevo script numerado;
  nunca se editan los de sprints ya aplicados.
- Motor InnoDB, llaves foráneas, restricciones `NOT NULL`/`UNIQUE` y codificación `utf8mb4`.

## Datos de ejemplo

| Contenido | Sprint | Cantidad |
|-----------|:------:|:--------:|
| Usuarios `admin`, `recepcion`, `mecanico` (uno por rol, contraseña cifrada con bcrypt) | 1 | 3 |
| Clientes | 1 | 8 |
| Vehículos (un cliente con 2 o más y otro sin vehículos) | 1 | 12 |
| Citas: 2 pendientes, 1 confirmada, 1 en proceso, 1 completada y 1 cancelada | 2 | 6 |
| Órdenes de servicio en los seis estados (6 asignadas a `mecanico` y 1 sin mecánico) | 2 | 7 |
| Servicios realizados y líneas de mano de obra, con historial de estados coherente | 2 | 8 y 4 |

| Refacciones: 9 con existencia normal, 3 con stock bajo, 2 agotadas y 1 inactiva | 3 | 15 |
| Movimientos de inventario (entradas, salidas ligadas a órdenes y ajustes) | 3 | 34 |
| Órdenes entregadas para el historial (3 del mismo vehículo, con kilometraje de servicio) | 3 | 5 |
| Refacciones usadas en órdenes | 3 | 15 |
| Mantenimientos: 2 vencidos, 2 próximos, 1 lejano, 1 realizado y 1 cancelado | 3 | 7 |
| Pagos: 4 manuales aprobados (efectivo, tarjeta con autorización, transferencia), 1 anulado con motivo y 3 de Mercado Pago (aprobado, pendiente y cancelado, con referencias ficticias «EJEMPLO») | 4 | 8 |
| Tickets de las órdenes pagadas y con abono parcial (folio `TK-` + 6 dígitos) | 4 | 5 |

Las fechas de las citas, las órdenes y los mantenimientos se calculan a partir del día de la primera carga.

- Los seeds son idempotentes: ejecutarlos de nuevo no duplica registros.
- Un usuario que ya existe no se modifica, así que una contraseña cambiada desde la aplicación no se
  sobrescribe al volver a cargar los seeds.
- Las contraseñas iniciales no están en el repositorio: salen de las variables `SEED_*_PASSWORD`.
- En el Sprint 3 la existencia de cada refacción se recalcula en cada carga como la suma de sus movimientos
  (`parts.stock = SUM(inventory_movements.quantity)`), así que volver a cargar los seeds no altera las
  existencias que cambiaron desde la aplicación. Los movimientos de ejemplo llevan un motivo que empieza por
  "Semilla:".

## Tablas

- **Sprint 1**: `users`, `clients`, `vehicles` (más `schema_migrations`, creada por el ejecutor).
  Detalle en `specs/001-base-clientes-vehiculos/data-model.md`.
- **Sprint 2**: `appointments`, `service_orders`, `order_services`, `order_labor` y
  `order_status_history` (migración `002`). Detalle en `specs/002-citas-ordenes-servicio/data-model.md`.
  Las llaves foráneas usan `ON DELETE RESTRICT`: no se pueden borrar clientes, vehículos ni usuarios con
  citas u órdenes, y la aplicación no ofrece borrar citas ni órdenes.
- **Sprint 3**: `parts`, `inventory_movements`, `order_parts`, `maintenance` y `app_settings` (migración
  `003`), más la columna `service_mileage` en `service_orders` y un índice en `order_status_history`. Detalle en
  `specs/003-historial-inventario/data-model.md`. La existencia (`parts.stock`) nunca puede ser negativa
  (restricción `CHECK`) y solo cambia junto con un movimiento de inventario; un vehículo tiene a lo sumo un
  mantenimiento pendiente (índice único).

- **Sprint 4**: `payments` y `tickets` (migración `004`), más tres claves del taller en `app_settings`.
  Detalle en `specs/004-pagos-tickets-dashboard/data-model.md`. Los pagos nunca se eliminan y solo el estado
  `APROBADO` cuenta como pagado; no existe ninguna columna para datos de tarjeta. Una orden tiene a lo sumo un
  cobro de Mercado Pago pendiente (columna generada con índice único) y un ticket (índice único por orden). El
  seed 004 deja 3 órdenes pagadas, 2 con pago parcial y 2 sin pagar; sus cobros de Mercado Pago son ficticios y
  nunca se consultan en Mercado Pago real. El panel de control no tiene tablas: se calcula al consultarlo.

## Datos del taller en el ticket

El ticket imprime el nombre, la dirección y el teléfono del taller, que se leen de `app_settings` en cada
consulta (sin reiniciar la API) y se cambian con SQL, igual que los umbrales de mantenimiento:

| Clave | Valor inicial |
|-------|---------------|
| `workshop_name` | Motorix Taller Mecánico |
| `workshop_address` | Av. Principal 123, Ciudad de México |
| `workshop_phone` | 5555123456 |

```sql
UPDATE app_settings SET setting_value = 'Taller Los Pinos' WHERE setting_key = 'workshop_name';
```

Si falta una clave o está vacía, el ticket usa los valores iniciales.

## Umbrales de aviso de mantenimiento

Los avisos de mantenimiento próximo usan dos valores de la tabla `app_settings`, que se cambian con SQL (no hay
pantalla de configuración en el MVP) y se leen en cada consulta, sin reiniciar la API:

| Clave | Valor inicial | Significado |
|-------|:-------------:|-------------|
| `maintenance_warning_days` | 30 | Un mantenimiento con fecha se avisa cuando faltan estos días o menos |
| `maintenance_warning_km` | 1000 | Un mantenimiento con kilometraje se avisa cuando faltan estos kilómetros o menos |

```sql
UPDATE app_settings SET setting_value = '45' WHERE setting_key = 'maintenance_warning_days';
```

Un mantenimiento está *vencido* cuando su fecha ya pasó o el kilometraje actual del vehículo superó el objetivo.
Si falta una clave o su valor no es un entero positivo, se usan los valores iniciales.
