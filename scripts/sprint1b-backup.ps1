$ErrorActionPreference = "Stop"
$env:PGPASSWORD = "postgres"
$bin = "C:\Program Files\PostgreSQL\17\bin"
$ts = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$out = "C:\DEV\STO\backups\sprint1b_pre_$ts"
New-Item -ItemType Directory -Force -Path $out | Out-Null
Write-Host "BACKUP_DIR=$out"
& "$bin\pg_dump.exe" -h localhost -U postgres -d syority -F c -f "$out\syority.dump"
if ($LASTEXITCODE -ne 0) { throw "pg_dump custom format failed: $LASTEXITCODE" }
& "$bin\pg_dump.exe" -h localhost -U postgres -d syority --no-owner --no-acl -f "$out\syority.sql"
if ($LASTEXITCODE -ne 0) { throw "pg_dump sql failed: $LASTEXITCODE" }
Get-ChildItem $out | Format-Table Name, Length -AutoSize
Write-Host "BACKUP_OK $out"
