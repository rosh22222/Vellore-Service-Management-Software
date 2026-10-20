param(
  [ValidateSet("start", "stop", "status")]
  [string]$Action = "start"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$DataDir = Join-Path $ProjectRoot ".runtime\postgres-data"
$LogFile = Join-Path $ProjectRoot ".runtime\postgres.log"
$Port = "55432"

$pgCtlFromPath = Get-Command pg_ctl -ErrorAction SilentlyContinue
$Candidates = @(
  @(
    $(if ($pgCtlFromPath) { $pgCtlFromPath.Source }),
    "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
)

if (-not $Candidates) {
  throw "pg_ctl.exe was not found. Install PostgreSQL 17 or add pg_ctl to PATH."
}

if (-not (Test-Path -LiteralPath $DataDir)) {
  throw "Local PostgreSQL data directory was not found: $DataDir"
}

$PgCtl = $Candidates[0]

switch ($Action) {
  "start" {
    & $PgCtl -D $DataDir status
    if ($LASTEXITCODE -eq 0) { exit 0 }
    & $PgCtl -D $DataDir -l $LogFile -o "-p $Port" start
  }
  "stop" {
    & $PgCtl -D $DataDir stop
  }
  "status" {
    & $PgCtl -D $DataDir status
  }
}
exit $LASTEXITCODE
