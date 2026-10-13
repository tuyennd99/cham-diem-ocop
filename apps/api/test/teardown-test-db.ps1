$ErrorActionPreference = 'Stop'

$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$defaultDataDir = Join-Path $PSScriptRoot '..\.postgres-test'
$dataDir = [System.IO.Path]::GetFullPath(
  $(if ($env:PG_TEST_DATA_DIR) { $env:PG_TEST_DATA_DIR } else { $defaultDataDir })
)
$port = 5433

if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION'))) {
  Write-Output 'PostgreSQL test cluster has not been initialized.'
  exit 0
}

& (Join-Path $pgBin 'pg_ctl.exe') -D $dataDir status | Out-Null
if ($LASTEXITCODE -eq 0) {
  & (Join-Path $pgBin 'pg_ctl.exe') -D $dataDir -m fast -w stop
  if ($LASTEXITCODE -ne 0) { throw "pg_ctl stop failed with exit code $LASTEXITCODE" }
}

Write-Output 'PostgreSQL test cluster stopped; data was preserved.'
