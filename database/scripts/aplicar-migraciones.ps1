<#
.SYNOPSIS
  Aplica en orden los scripts de database/migrations/ que aún no se hayan ejecutado.

.DESCRIPTION
  Es idempotente: cada script aplicado se registra en la tabla schema_migrations y no se repite.
  Se conecta con el usuario dedicado definido en .env (no usa root).

.EXAMPLE
  ./database/scripts/aplicar-migraciones.ps1 -Base motorix_sdd
  ./database/scripts/aplicar-migraciones.ps1 -Base motorix_sdd_test
#>
[CmdletBinding()]
param(
  [string]$Base,
  [string]$ServidorMysql,
  [int]$Puerto
)

$ErrorActionPreference = 'Stop'

$raiz = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$archivoEnv = Join-Path $raiz '.env'
if (-not (Test-Path $archivoEnv)) { throw 'No existe .env. Ejecuta primero crear-entorno.ps1.' }

$config = @{}
foreach ($linea in Get-Content $archivoEnv) {
  if ($linea -match '^\s*([A-Z_]+)=(.*)$') { $config[$Matches[1]] = $Matches[2] }
}
if (-not $Base) { $Base = $config['DB_NAME'] }
if (-not $ServidorMysql) { $ServidorMysql = $config['DB_HOST'] }
if (-not $Puerto) { $Puerto = [int]$config['DB_PORT'] }
if ($ServidorMysql -eq 'localhost') { $ServidorMysql = '127.0.0.1' }

$mysql = (Get-Command mysql -ErrorAction SilentlyContinue).Source
if (-not $mysql) {
  $mysql = Get-ChildItem 'C:\Program Files\MySQL\MySQL Server 8.*\bin\mysql.exe' -ErrorAction SilentlyContinue |
    Sort-Object FullName | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $mysql) { throw 'No se encontró el cliente mysql. Agrégalo al PATH.' }

function Invoke-Mysql([string[]]$extra, [string]$sql) {
  $env:MYSQL_PWD = $config['DB_PASSWORD']
  try {
    $argumentos = @('-h', $ServidorMysql, '-P', $Puerto, '-u', $config['DB_USER'], '--default-character-set=utf8mb4', '-N', '-B') + $extra
    if ($sql) { $sql | & $mysql @argumentos 2>&1 } else { & $mysql @argumentos 2>&1 }
    if ($LASTEXITCODE -ne 0) { throw "mysql terminó con código $LASTEXITCODE" }
  } finally { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue }
}

Invoke-Mysql @($Base) @'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version   VARCHAR(100) NOT NULL PRIMARY KEY,
  appliedAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
'@ | Out-Null

$aplicadas = @(Invoke-Mysql @($Base) 'SELECT version FROM schema_migrations;')
$carpeta = Join-Path $raiz 'database\migrations'
$nuevas = 0

foreach ($archivo in Get-ChildItem $carpeta -Filter '*.sql' | Sort-Object Name) {
  if ($aplicadas -contains $archivo.Name) {
    Write-Host "Ya aplicada: $($archivo.Name)"
    continue
  }
  Write-Host "Aplicando:   $($archivo.Name)"
  $ruta = $archivo.FullName.Replace('\', '/')
  Invoke-Mysql @($Base, "--execute=source $ruta") $null | Out-Null
  Invoke-Mysql @($Base) "INSERT INTO schema_migrations (version) VALUES ('$($archivo.Name)');" | Out-Null
  $nuevas++
}

Write-Host "Listo en '$Base': $nuevas migración(es) nueva(s)."
