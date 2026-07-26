# PowerShell script to help fix PostgreSQL password issue
Write-Host "`n=== PostgreSQL Password Fix Helper ===" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is running
Write-Host "Step 1: Checking PostgreSQL service..." -ForegroundColor Yellow
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgService) {
    Write-Host "   ✅ PostgreSQL service found: $($pgService.Name)" -ForegroundColor Green
    Write-Host "   Status: $($pgService.Status)" -ForegroundColor $(if ($pgService.Status -eq 'Running') { 'Green' } else { 'Red' })
} else {
    Write-Host "   ⚠️  PostgreSQL service not found. Is PostgreSQL installed?" -ForegroundColor Yellow
}

Write-Host "`nStep 2: Testing current .env password..." -ForegroundColor Yellow
node test-db-connection.js 2>&1 | Select-String -Pattern "SUCCESS|ERROR|Authentication|password" | ForEach-Object {
    if ($_.Line -match "SUCCESS") {
        Write-Host "   ✅ $($_.Line)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $($_.Line)" -ForegroundColor Red
    }
}

Write-Host "`nStep 3: Options to fix:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Option A: Update .env with correct password" -ForegroundColor Cyan
Write-Host "   1. Open .env file"
Write-Host "   2. Find: DATABASE_URL=`"postgresql://postgres:postgres@localhost:5432/postgres?schema=public`""
Write-Host "   3. Replace 'postgres' (password part) with your actual PostgreSQL password"
Write-Host "   4. Save and run: node test-db-connection.js"
Write-Host ""
Write-Host "   Option B: Reset PostgreSQL password to 'postgres'" -ForegroundColor Cyan
Write-Host "   Run these commands in PowerShell (as Administrator):"
Write-Host "   psql -U postgres"
Write-Host "   ALTER USER postgres WITH PASSWORD 'postgres';"
Write-Host "   \q"
Write-Host ""
Write-Host "   Option C: Find your PostgreSQL password" -ForegroundColor Cyan
Write-Host "   - Check installation notes"
Write-Host "   - Check pg_hba.conf or pgpass file"
Write-Host "   - Or reset using Option B"
Write-Host ""
