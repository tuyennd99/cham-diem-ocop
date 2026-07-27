$ErrorActionPreference = 'Stop'

$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$defaultDataDir = Join-Path $PSScriptRoot '..\.postgres-test'
$dataDir = [System.IO.Path]::GetFullPath(
  $(if ($env:PG_TEST_DATA_DIR) { $env:PG_TEST_DATA_DIR } else { $defaultDataDir })
)
$logPath = Join-Path (Split-Path $dataDir -Parent) '.postgres-test.log'
$port = 5433
$database = 'congan_task_test'

foreach ($executable in @('initdb.exe', 'pg_ctl.exe', 'pg_isready.exe', 'psql.exe', 'createdb.exe')) {
  if (-not (Test-Path -LiteralPath (Join-Path $pgBin $executable))) {
    throw "PostgreSQL 18 executable not found: $executable"
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION'))) {
  New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
  & (Join-Path $pgBin 'initdb.exe') -D $dataDir --auth=trust --username=postgres --encoding=UTF8
  if ($LASTEXITCODE -ne 0) { throw "initdb failed with exit code $LASTEXITCODE" }
}

& (Join-Path $pgBin 'pg_isready.exe') -h 127.0.0.1 -p $port | Out-Null
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $pgBin 'pg_ctl.exe') -D $dataDir -l $logPath -o "-p $port -h 127.0.0.1" -w start
  if ($LASTEXITCODE -ne 0) { throw "pg_ctl start failed with exit code $LASTEXITCODE" }
}

$exists = & (Join-Path $pgBin 'psql.exe') -h 127.0.0.1 -p $port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$database'"
if ($LASTEXITCODE -ne 0) { throw "Database existence check failed with exit code $LASTEXITCODE" }
if ($null -eq $exists -or "$exists".Trim() -ne '1') {
  & (Join-Path $pgBin 'createdb.exe') -h 127.0.0.1 -p $port -U postgres $database
  if ($LASTEXITCODE -ne 0) { throw "createdb failed with exit code $LASTEXITCODE" }
}

Write-Output "PostgreSQL test database ready on 127.0.0.1:$port/$database"
