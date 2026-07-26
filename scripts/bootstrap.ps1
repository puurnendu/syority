#Requires -Version 5.1
<#
.SYNOPSIS
  Windows-local bootstrap for Aurianoa OS / Syority development prerequisites.

.DESCRIPTION
  Verifies/installs Docker Desktop, Git, and creates local directories.
  Does NOT deploy the application. Does NOT configure a Linux VPS.

  For production VPS setup, use:  sudo bash scripts/bootstrap.sh

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1

.EXAMPLE
  $env:BACKUP_DIR = "D:\backups\syority"; .\scripts\bootstrap.ps1
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-IsWindowsHost {
  if ($PSVersionTable.PSEdition -eq "Core") {
    return $IsWindows -eq $true
  }
  return $true  # Windows PowerShell 5.x
}

function Get-LogTimestamp { (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ") }
function Write-Log([string]$Message) { Write-Host "[$(Get-LogTimestamp)] $Message" }
function Write-Fail([string]$Message) {
  Write-Host "[$(Get-LogTimestamp)] ERROR: $Message" -ForegroundColor Red
  exit 1
}

if (-not (Test-IsWindowsHost)) {
  Write-Fail @"
This script is for Windows only.

On Linux (production VPS), run:
  sudo bash scripts/bootstrap.sh
"@
}

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$AppDir = if ($env:APP_DIR) { $env:APP_DIR } else { $RootDir }
$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $RootDir "backups" }

Write-Log "==> Windows bootstrap starting"
Write-Log "    APP_DIR=$AppDir"
Write-Log "    BACKUP_DIR=$BackupDir"
Write-Log "    (Production VPS bootstrap remains scripts/bootstrap.sh)"

# -----------------------------------------------------------------------------
# 1. Git
# -----------------------------------------------------------------------------
Write-Log "==> 1/5 Checking Git..."
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  Write-Log "    Git not found — attempting winget install..."
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
  } else {
    Write-Fail "Git is not installed. Install from https://git-scm.com/download/win then re-run."
  }
  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) { Write-Fail "Git still not available on PATH (open a new PowerShell window)." }
}
Write-Log "    OK  $($git.Source) — $(git --version)"

# -----------------------------------------------------------------------------
# 2. Docker Desktop / Engine
# -----------------------------------------------------------------------------
Write-Log "==> 2/5 Checking Docker..."
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Write-Log "    Docker not found — attempting winget install of Docker Desktop..."
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    winget install --id Docker.DockerDesktop -e --accept-source-agreements --accept-package-agreements
    Write-Log "    Docker Desktop installed. Start Docker Desktop, wait until it is running, then re-run this script."
    exit 0
  }
  Write-Fail "Docker is not installed. Install Docker Desktop from https://www.docker.com/products/docker-desktop/ then re-run."
}

try {
  docker version --format "{{.Server.Version}}" | Out-Null
} catch {
  Write-Fail "Docker CLI found but the engine is not running. Start Docker Desktop and wait until it shows 'Running'."
}
Write-Log "    OK  $(docker --version)"

# -----------------------------------------------------------------------------
# 3. Docker Compose V2
# -----------------------------------------------------------------------------
Write-Log "==> 3/5 Checking Docker Compose V2..."
$composeOk = $false
try {
  docker compose version | Out-Null
  $composeOk = $true
} catch {
  $composeOk = $false
}
if (-not $composeOk) {
  Write-Fail "docker compose (V2 plugin) is missing. Update Docker Desktop to a current version (Compose v2.24+ recommended)."
}
$composeVer = (docker compose version --short 2>$null)
if (-not $composeVer) { $composeVer = (docker compose version | Select-Object -First 1) }
Write-Log "    OK  compose $composeVer"

# -----------------------------------------------------------------------------
# 4. Directories
# -----------------------------------------------------------------------------
Write-Log "==> 4/5 Creating directories..."
@(
  $AppDir,
  $BackupDir,
  (Join-Path $AppDir "certbot\conf"),
  (Join-Path $AppDir "certbot\www"),
  (Join-Path $AppDir "uploads")
) | ForEach-Object {
  New-Item -ItemType Directory -Force -Path $_ | Out-Null
  Write-Log "    OK  $_"
}

# -----------------------------------------------------------------------------
# 5. Prerequisite summary
# -----------------------------------------------------------------------------
Write-Log "==> 5/5 Verifying prerequisites..."
$missing = $false
foreach ($cmd in @("docker", "git")) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) {
    Write-Log "    OK  $cmd"
  } else {
    Write-Log "    MISSING  $cmd"
    $missing = $true
  }
}
try {
  docker compose version | Out-Null
  Write-Log "    OK  docker compose"
} catch {
  Write-Log "    MISSING  docker compose"
  $missing = $true
}
if ($missing) { Write-Fail "One or more prerequisites are missing." }

Write-Log "==> Bootstrap complete — application NOT deployed."
Write-Host @"

Next steps (Windows development):
  1. Ensure .env exists (copy from .env.example) — never commit .env
  2. Start stack:  docker compose -f docker-compose.yml up -d --build
  3. Local backup: `$env:BACKUP_DIR = "$BackupDir"; .\scripts\backup.ps1`

Production VPS (Linux only):
  sudo bash scripts/bootstrap.sh
  ./scripts/init-letsencrypt.sh <email>
  ./scripts/deploy.sh

"@
