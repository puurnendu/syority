# ============================================================================
# Syority — one-shot VPS migration. Run from the project root in PowerShell:
#
#   cd E:\Users\purne\.gemini\antigravity\scratch\STO\aurianoa-sto-v2
#   .\migrate-to-vps.ps1
#
# You will type the server password at most twice (SSH key install + sudo).
# Everything after that is automated: code upload, Docker install, firewall,
# .env generation, build, migrations, seed, and health check.
# ============================================================================
$ErrorActionPreference = "Stop"

$VpsIp   = "66.116.246.67"
$VpsUser = "raaju"
$Target  = "$VpsUser@$VpsIp"
$SshOpts = @("-o", "StrictHostKeyChecking=accept-new")

$Proj = $PSScriptRoot
if (-not (Test-Path (Join-Path $Proj "docker-compose.yml"))) {
    Write-Error "Run this script from the project root (docker-compose.yml not found)."
}

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-Error "OpenSSH client not found. Install it: Settings > Apps > Optional Features > OpenSSH Client"
}

# --- 1. SSH key setup (asks for the server password ONCE) -------------------
$KeyFile = "$env:USERPROFILE\.ssh\id_ed25519"
if (-not (Test-Path $KeyFile)) {
    Write-Host "==> Generating SSH key..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.ssh" | Out-Null
    ssh-keygen -t ed25519 -f $KeyFile -N '""' | Out-Null
}
Write-Host "==> Installing SSH key on the server (enter the server password when asked)..." -ForegroundColor Cyan
$PubKey = Get-Content "$KeyFile.pub"
ssh @SshOpts $Target "mkdir -p ~/.ssh && grep -qF '$PubKey' ~/.ssh/authorized_keys 2>/dev/null || echo '$PubKey' >> ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys"
if ($LASTEXITCODE -ne 0) { Write-Error "Could not reach $Target over SSH." }

# --- 2. Bundle the code (excludes build artifacts & junk) -------------------
Write-Host "==> Packaging project..." -ForegroundColor Cyan
$Tarball = Join-Path $env:TEMP "syority-code.tar.gz"
if (Test-Path $Tarball) { Remove-Item $Tarball }
$Excludes = @(
    "./node_modules", "./.next", "./.git", "./.antigravity",
    "./scratch", "./test-app", "./certbot", "./uploads", "./dev.log"
) | ForEach-Object { @("--exclude", $_, "--exclude", "$_/*") }
tar -czf $Tarball @Excludes -C $Proj .
if ($LASTEXITCODE -ne 0) { Write-Error "tar failed." }
Write-Host ("    Bundle size: {0:N1} MB" -f ((Get-Item $Tarball).Length / 1MB))

# --- 3. Upload -------------------------------------------------------------
Write-Host "==> Uploading to $VpsIp..." -ForegroundColor Cyan
scp @SshOpts $Tarball "${Target}:/tmp/syority-code.tar.gz"
scp @SshOpts (Join-Path $Proj "scripts\vps-setup.sh") "${Target}:/tmp/vps-setup.sh"
if ($LASTEXITCODE -ne 0) { Write-Error "Upload failed." }

# --- 4. Run the server-side setup (sudo may ask for the password once) ------
Write-Host "==> Running server setup (build + deploy — first run takes several minutes)..." -ForegroundColor Cyan
Write-Host "    IMPORTANT: the platform admin password is printed during setup — save it." -ForegroundColor Yellow
ssh -t @SshOpts $Target "sudo sed -i 's/\r\$//' /tmp/vps-setup.sh && sudo PUBLIC_IP=$VpsIp bash /tmp/vps-setup.sh"
if ($LASTEXITCODE -ne 0) { Write-Error "Server setup failed — scroll up for the error." }

# --- 5. Verify from this machine --------------------------------------------
Write-Host "==> Verifying..." -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest -Uri "http://$VpsIp/api/health" -UseBasicParsing -TimeoutSec 20
    Write-Host "    Health check: HTTP $($r.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "    Health endpoint not reachable yet — check: ssh $Target 'cd /var/www/syority && docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.http.yml logs app --tail 50'" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. App: http://$VpsIp" -ForegroundColor Green
Write-Host "Security reminder: change the '$VpsUser' password now (it was shared in chat):  ssh $Target passwd" -ForegroundColor Yellow
