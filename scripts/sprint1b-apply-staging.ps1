$ErrorActionPreference = "Stop"
$env:PGPASSWORD = "postgres"
$bin = "C:\Program Files\PostgreSQL\17\bin"
$psql = "$bin\psql.exe"
$sql = "C:\DEV\STO\prisma\migrations\20260911000000_sprint1b_planned_date_overrides\migration.sql"
$verify = "C:\DEV\STO\scripts\sprint1b-verify-snapshot.sql"
$db = "syority_sprint1b_staging"

Write-Host "Applying sprint1b migration to $db"
& $psql -h localhost -U postgres -d $db -v ON_ERROR_STOP=1 -f $sql
if ($LASTEXITCODE -ne 0) { throw "migration failed: $LASTEXITCODE" }

Write-Host "==== PRE-FLIP SNAPSHOT CENSUS (staging) ===="
& $psql -h localhost -U postgres -d $db -f $verify
if ($LASTEXITCODE -ne 0) { throw "verify failed: $LASTEXITCODE" }
Write-Host "STAGING_MIGRATION_OK"
