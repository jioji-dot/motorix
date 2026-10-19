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
./database/scripts/crear-entorno.ps1 -Puerto 3307 -Base motorix_sdd -BasePrueba motorix_sdd_test
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
