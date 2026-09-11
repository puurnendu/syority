$ErrorActionPreference = "Stop"
$env:PGPASSWORD = "postgres"
Set-Location C:\DEV\STO
Write-Host "Applying pending Prisma migrations to live syority"
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw "migrate deploy failed: $LASTEXITCODE" }
npx prisma generate
if ($LASTEXITCODE -ne 0) { throw "prisma generate failed: $LASTEXITCODE" }
Write-Host "==== LIVE SNAPSHOT CENSUS ===="
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -U postgres -d syority -f C:\DEV\STO\scripts\sprint1b-verify-snapshot.sql
Write-Host "LIVE_MIGRATION_OK"
