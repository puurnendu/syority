#Requires -Version 5.1
<#
.SYNOPSIS
  Windows backup of PostgreSQL + uploads (interchangeable with scripts/backup.sh).

.DESCRIPTION
  Produces the same folder layout and filenames as the Bash backup script:

    BACKUP_DIR/<yyyyMMddTHHmmssZ>/
      postgres_<db>.sql.gz
      postgres_<db>.dump
      uploads.tar.gz
      MANIFEST.txt
      SHA256SUMS

  Env vars (same names as Bash where applicable):
    BACKUP_DIR, COMPOSE_FILES, PG_USER, PG_DB, RETENTION_DAYS

.EXAMPLE
  .\scripts\backup.ps1

.EXAMPLE
  $env:BACKUP_DIR = "D:\backups\syority"; .\scripts\backup.ps1
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-IsWindowsHost {
  if ($PSVersionTable.PSEdition -eq "Core") {
    return $IsWindows -eq $true
  }
  return $true
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

On Linux (production), run:
  ./scripts/backup.sh
  BACKUP_DIR=/var/backups/syority ./scripts/backup.sh
"@
}

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RootDir

$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $RootDir "backups" }
$ComposeFilesRaw = if ($env:COMPOSE_FILES) { $env:COMPOSE_FILES } else { "-f docker-compose.yml -f docker-compose.prod.yml" }
$PgUser = if ($env:PG_USER) { $env:PG_USER } else { "user" }
$PgDb = if ($env:PG_DB) { $env:PG_DB } else { "syority" }
$RetentionDays = 14
if ($env:RETENTION_DAYS -match '^\d+$') { $RetentionDays = [int]$env:RETENTION_DAYS }

# Split compose file args: "-f a.yml -f b.yml" -> @("-f","a.yml","-f","b.yml")
$ComposeFileArgs = @($ComposeFilesRaw -split '\s+' | Where-Object { $_ -ne "" })

function Test-DockerCompose {
  try {
    docker compose version | Out-Null
    return $true
  } catch {
    return $false
  }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Fail "Docker not found. Run .\scripts\bootstrap.ps1 first."
}
if (-not (Test-DockerCompose)) {
  Write-Fail "Docker Compose V2 not available. Update Docker Desktop."
}

$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$RunDir = Join-Path $BackupDir $Timestamp
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
Write-Log "Backup starting → $RunDir"
Write-Log "Compose files: $ComposeFilesRaw"

# Capture binary stdout without PowerShell string encoding (required for .dump / .gz / .tar.gz)
function Invoke-BinaryStdout {
  param(
    [Parameter(Mandatory)][string]$FileName,
    [Parameter(Mandatory)][string[]]$ArgumentList,
    [Parameter(Mandatory)][string]$OutFile
  )
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FileName
  $psi.Arguments = ($ArgumentList | ForEach-Object {
    if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
  }) -join " "
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  $outStream = [System.IO.File]::Create($OutFile)
  try {
    $buffer = New-Object byte[] 81920
    while ($true) {
      $n = $p.StandardOutput.BaseStream.Read($buffer, 0, $buffer.Length)
      if ($n -le 0) { break }
      $outStream.Write($buffer, 0, $n)
    }
  } finally {
    $outStream.Close()
  }
  $err = $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  if ($err) { Write-Host $err }
  if ($p.ExitCode -ne 0) {
    throw "$FileName exited $($p.ExitCode)"
  }
}

# -----------------------------------------------------------------------------
# DB readiness
# -----------------------------------------------------------------------------
Write-Log "Dumping PostgreSQL ($PgDb)..."
$ready = $false
try {
  & docker compose @ComposeFileArgs exec -T db pg_isready -U $PgUser -d $PgDb 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $ready = $true }
} catch { $ready = $false }
if (-not $ready) {
  Write-Fail "Database container is not ready. Start the stack first (docker compose up -d)."
}

$SqlGz = Join-Path $RunDir "postgres_${PgDb}.sql.gz"
$CustomDump = Join-Path $RunDir "postgres_${PgDb}.dump"

# SQL gzip via gzip inside the db container
Write-Log "    creating $(Split-Path $SqlGz -Leaf)..."
try {
  Invoke-BinaryStdout -FileName "docker" -OutFile $SqlGz -ArgumentList (
    @("compose") + $ComposeFileArgs + @(
      "exec", "-T", "db", "sh", "-c",
      "pg_dump -U '$PgUser' -d '$PgDb' --no-owner --no-acl | gzip -c"
    )
  )
} catch {
  Write-Fail "pg_dump | gzip failed: $_"
}

# Custom format dump (binary)
Write-Log "    creating $(Split-Path $CustomDump -Leaf)..."
try {
  Invoke-BinaryStdout -FileName "docker" -OutFile $CustomDump -ArgumentList (
    @("compose") + $ComposeFileArgs + @(
      "exec", "-T", "db",
      "pg_dump", "-U", $PgUser, "-d", $PgDb, "-Fc", "--no-owner", "--no-acl"
    )
  )
} catch {
  Write-Fail "pg_dump -Fc failed: $_"
}

Write-Log "    wrote $(Split-Path $SqlGz -Leaf) ($((Get-Item $SqlGz).Length) bytes)"
Write-Log "    wrote $(Split-Path $CustomDump -Leaf) ($((Get-Item $CustomDump).Length) bytes)"

# -----------------------------------------------------------------------------
# Uploads
# -----------------------------------------------------------------------------
Write-Log "Archiving uploads..."
$UploadsTar = Join-Path $RunDir "uploads.tar.gz"
$AppCid = (& docker compose @ComposeFileArgs ps -q app 2>$null | Select-Object -First 1)
if ($AppCid) {
  $AppCid = $AppCid.Trim()
  try {
    Invoke-BinaryStdout -FileName "docker" -OutFile $UploadsTar -ArgumentList @(
      "exec", $AppCid, "sh", "-c",
      "if [ -d /app/uploads ]; then tar -C /app -czf - uploads; else tar -czf - --files-from /dev/null; fi"
    )
  } catch {
    Write-Fail "docker exec tar (uploads) failed: $_"
  }
} else {
  Write-Log "    WARNING: app container not running — trying host .\uploads"
  $hostUploads = Join-Path $RootDir "uploads"
  if (Test-Path $hostUploads) {
    try {
      Invoke-BinaryStdout -FileName "docker" -OutFile $UploadsTar -ArgumentList @(
        "run", "--rm", "-v", "${hostUploads}:/uploads:ro", "alpine:3.19",
        "sh", "-c", "tar -C / -czf - uploads"
      )
    } catch {
      Write-Fail "host uploads tar failed: $_"
    }
  } else {
    Invoke-BinaryStdout -FileName "docker" -OutFile $UploadsTar -ArgumentList @(
      "run", "--rm", "alpine:3.19", "sh", "-c", "tar -czf - --files-from /dev/null"
    )
    Write-Log "    WARNING: no uploads found; wrote empty archive"
  }
}
Write-Log "    wrote $(Split-Path $UploadsTar -Leaf) ($((Get-Item $UploadsTar).Length) bytes)"
# -----------------------------------------------------------------------------
# Manifest + SHA256SUMS (sha256sum-compatible: "<hash>  <filename>")
# -----------------------------------------------------------------------------
Write-Log "Writing checksums..."
$Manifest = Join-Path $RunDir "MANIFEST.txt"
@(
  "timestamp=$Timestamp"
  "host=$env:COMPUTERNAME"
  "pg_user=$PgUser"
  "pg_db=$PgDb"
  "compose_files=$ComposeFilesRaw"
  "created_by=backup.ps1"
) | Set-Content -Path $Manifest -Encoding utf8

$sumsPath = Join-Path $RunDir "SHA256SUMS"
$filesForHash = @(
  "postgres_${PgDb}.sql.gz",
  "postgres_${PgDb}.dump",
  "uploads.tar.gz"
)
$lines = foreach ($name in $filesForHash) {
  $path = Join-Path $RunDir $name
  $hash = (Get-FileHash -Algorithm SHA256 -Path $path).Hash.ToLowerInvariant()
  "{0}  {1}" -f $hash, $name
}
$lines | Set-Content -Path $sumsPath -Encoding ascii
Write-Log "    SHA256SUMS written"

# -----------------------------------------------------------------------------
# Retention
# -----------------------------------------------------------------------------
if ($RetentionDays -gt 0) {
  Write-Log "Applying retention ($RetentionDays days) under $BackupDir..."
  $cutoff = (Get-Date).ToUniversalTime().AddDays(-$RetentionDays)
  Get-ChildItem -Path $BackupDir -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne "_pre_restore" -and $_.LastWriteTimeUtc -lt $cutoff } |
    ForEach-Object {
      Write-Log "    removing old backup $($_.FullName)"
      Remove-Item -Recurse -Force $_.FullName
    }
}

Write-Log "Backup complete: $RunDir"
Get-ChildItem $RunDir | Format-Table Name, Length -AutoSize
