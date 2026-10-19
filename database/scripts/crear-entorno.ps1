<#
.SYNOPSIS
  Crea las bases de datos y el usuario dedicado de Motorix en el MySQL local y genera el archivo .env.

.DESCRIPTION
  - Crea la base principal y la base de pruebas (InnoDB, utf8mb4).
  - Crea un usuario dedicado (nunca root) con permisos solo sobre esas dos bases.
  - Escribe el archivo .env de la raíz con una contraseña y un JWT_SECRET generados al azar.
  La contraseña de root se recibe SOLO por la variable de entorno MYSQL_ROOT_PASSWORD y no se guarda.

.EXAMPLE
  $env:MYSQL_ROOT_PASSWORD = (Get-Content C:\ruta\contrasena.txt -Raw).Trim()
  ./database/scripts/crear-entorno.ps1 -Puerto 3307 -Base motorix_sdd -BasePrueba motorix_sdd_test -Usuario motorix_sdd_app
#>
[CmdletBinding()]
param(
  [string]$ServidorMysql = '127.0.0.1',
  [int]$Puerto = 3306,
  [string]$Base = 'motorix',
  [string]$BasePrueba = 'motorix_test',
  [string]$Usuario = 'motorix_app',
  [int]$PuertoApi = 3000,
  [switch]$Reiniciar
)

$ErrorActionPreference = 'Stop'

if (-not $env:MYSQL_ROOT_PASSWORD) {
  throw 'Define la variable de entorno MYSQL_ROOT_PASSWORD con la contraseña de root de MySQL.'
}
if (-not $BasePrueba.EndsWith('_test')) {
  throw 'El nombre de la base de pruebas debe terminar en "_test".'
}
foreach ($nombre in @($Base, $BasePrueba, $Usuario)) {
  if ($nombre -notmatch '^[A-Za-z0-9_]+$') { throw "Nombre no válido: $nombre" }
}

$raiz = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$archivoEnv = Join-Path $raiz '.env'

$mysql = (Get-Command mysql -ErrorAction SilentlyContinue).Source
if (-not $mysql) {
  $mysql = Get-ChildItem 'C:\Program Files\MySQL\MySQL Server 8.*\bin\mysql.exe' -ErrorAction SilentlyContinue |
    Sort-Object FullName | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $mysql) { throw 'No se encontró el cliente mysql. Agrégalo al PATH.' }

function Invoke-MysqlRoot([string]$sql) {
  $env:MYSQL_PWD = $env:MYSQL_ROOT_PASSWORD
  try {
    $sql | & $mysql -h $ServidorMysql -P $Puerto -u root --default-character-set=utf8mb4 2>&1
    if ($LASTEXITCODE -ne 0) { throw "mysql terminó con código $LASTEXITCODE" }
  } finally { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue }
}

function Get-EnvValor([string]$clave) {
  if (-not (Test-Path $archivoEnv)) { return $null }
  $linea = Get-Content $archivoEnv | Where-Object { $_ -match "^$clave=" } | Select-Object -First 1
  if ($linea) { return $linea.Substring($clave.Length + 1) }
  return $null
}

# Si el usuario ya existe y no tenemos su contraseña en .env, no la tocamos (podría usarla otro proyecto).
$existe = (Invoke-MysqlRoot "SELECT COUNT(*) FROM mysql.user WHERE user='$Usuario' AND host='localhost';" |
  Select-Object -Last 1).ToString().Trim()
$passwordExistente = if ((Get-EnvValor 'DB_USER') -eq $Usuario) { Get-EnvValor 'DB_PASSWORD' } else { $null }

if ($existe -ne '0' -and -not $passwordExistente) {
  throw "El usuario '$Usuario' ya existe en MySQL y no hay contraseña en .env. No se modifica: elige otro nombre con -Usuario."
}

if ($Reiniciar) {
  Write-Host "Reiniciando SOLO las bases '$Base' y '$BasePrueba'..."
  Invoke-MysqlRoot "DROP DATABASE IF EXISTS ``$Base``; DROP DATABASE IF EXISTS ``$BasePrueba``;" | Out-Null
}

$password = if ($passwordExistente) { $passwordExistente } else {
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  [Convert]::ToBase64String($bytes).Replace('+', 'A').Replace('/', 'b').Replace('=', 'c')
}

$sql = @"
CREATE DATABASE IF NOT EXISTS ``$Base`` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS ``$BasePrueba`` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS '$Usuario'@'localhost' IDENTIFIED BY '$password';
GRANT ALL PRIVILEGES ON ``$Base``.* TO '$Usuario'@'localhost';
GRANT ALL PRIVILEGES ON ``$BasePrueba``.* TO '$Usuario'@'localhost';
FLUSH PRIVILEGES;
"@
Invoke-MysqlRoot $sql | Out-Null
Write-Host "Bases '$Base' y '$BasePrueba' y usuario '$Usuario' listos."

if (-not $passwordExistente) {
  $bytes = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $jwt = [Convert]::ToBase64String($bytes)
  $contenido = @(
    '# Generado por database/scripts/crear-entorno.ps1. NO se versiona.',
    'DB_HOST=localhost',
    "DB_PORT=$Puerto",
    "DB_USER=$Usuario",
    "DB_PASSWORD=$password",
    "DB_NAME=$Base",
    "DB_NAME_TEST=$BasePrueba",
    "JWT_SECRET=$jwt",
    'JWT_EXPIRES_IN=8h',
    "PORT=$PuertoApi"
  ) -join "`n"
  [IO.File]::WriteAllText($archivoEnv, $contenido + "`n", (New-Object Text.UTF8Encoding $false))
  Write-Host "Archivo .env creado en $archivoEnv (ignorado por Git)."
} else {
  Write-Host 'Se conserva el .env existente.'
}
