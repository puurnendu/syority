#Requires -Version 5.1
<#
.SYNOPSIS
  Windows restore from a backup directory produced by backup.sh or backup.ps1.

.DESCRIPTION
  Interchangeable with scripts/restore.sh. Expects:

    <backup-dir>/
      postgres_*.dump  and/or  postgres_*.sql.gz
      uploads.tar.gz
      SHA256SUMS (optional)

  Env vars: COMPOSE_FILES, PG_USER, PG_DB, SAFETY_ROOT

.EXAMPLE
  .\scripts\restore.ps1 .\backups\20260716T120000Z
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$BackupSrc
)

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

function Format-ProcessArgs([string[]]$ArgumentList) {
  ($ArgumentList | ForEach-Object {
    if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
  }) -join " "
}

# Capture binary stdout without PowerShell string encoding
function Invoke-BinaryStdout {
  param(
    [Parameter(Mandatory)][string]$FileName,
    [Parameter(Mandatory)][string[]]$ArgumentList,
    [Parameter(Mandatory)][string]$OutFile
  )
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FileName
  $psi.Arguments = (Format-ProcessArgs $ArgumentList)
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

function Send-BinaryStdin {
  param(
    [Parameter(Mandatory)][string]$FileName,
    [Parameter(Mandatory)][string[]]$ArgumentList,
    [Parameter(Mandatory)][string]$InFile,
    [int]$OkExitMax = 0
  )
  $bytes = [System.IO.File]::ReadAllBytes($InFile)
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FileName
  $psi.Arguments = (Format-ProcessArgs $ArgumentList)
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $p = [System.Diagnostics.Process]::Start($psi)
  $p.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
  $p.StandardInput.Close()
  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  if ($stdout) { Write-Host $stdout }
  if ($stderr) { Write-Host $stderr }
  if ($p.ExitCode -gt $OkExitMax) {
    throw "$FileName exited $($p.ExitCode)"
  }
}

if (-not (Test-IsWindowsHost)) {
  Write-Fail @"
This script is for Windows only.

On Linux (production), run:
  ./scripts/restore.sh /var/backups/syority/<TIMESTAMP>
"@
}

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RootDir

if (-not $BackupSrc) {
  Write-Fail "Usage: .\scripts\restore.ps1 <backup-directory-from-backup.ps1|backup.sh>"
}
if (-not (Test-Path -Path $BackupSrc -PathType Container)) {
  Write-Fail "Backup directory not found: $BackupSrc"
}
$BackupSrc = (Resolve-Path $BackupSrc).Path

$ComposeFilesRaw = if ($env:COMPOSE_FILES) { $env:COMPOSE_FILES } else { "-f docker-compose.yml -f docker-compose.prod.yml" }
$ComposeFileArgs = @($ComposeFilesRaw -split '\s+' | Where-Object { $_ -ne "" })
$PgUser = if ($env:PG_USER) { $env:PG_USER } else { "user" }
$PgDb = if ($env:PG_DB) { $env:PG_DB } else { "syority" }
$SafetyRoot = if ($env:SAFETY_ROOT) { $env:SAFETY_ROOT } else { Join-Path $RootDir "backups\_pre_restore" }

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Fail "Docker not found."
}

$SqlGz = Get-ChildItem -Path $BackupSrc -Filter "postgres_*.sql.gz" -File -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty FullName
$CustomDump = Get-ChildItem -Path $BackupSrc -Filter "postgres_*.dump" -File -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty FullName
$UploadsTar = Join-Path $BackupSrc "uploads.tar.gz"
if (-not (Test-Path $UploadsTar)) { Write-Fail "uploads.tar.gz missing in $BackupSrc" }
if (-not $CustomDump -and -not $SqlGz) {
  Write-Fail "No postgres_*.dump or postgres_*.sql.gz in $BackupSrc"
}

$script:SafetyDir = $null
$script:RollbackOnError = $false

function Test-Sha256Sums {
  $sums = Join-Path $BackupSrc "SHA256SUMS"
  if (-not (Test-Path $sums)) {
    Write-Log "WARNING: SHA256SUMS not found — skipping integrity check"
    return
  }
  Write-Log "Verifying SHA256SUMS..."
  Get-Content $sums | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    if ($line -notmatch '^([0-9a-fA-F]{64})\s+(.+)$') {
      Write-Fail "Malformed SHA256SUMS line: $line"
    }
    $expected = $Matches[1].ToLowerInvariant()
    $name = $Matches[2].Trim()
    $path = Join-Path $BackupSrc $name
    if (-not (Test-Path $path)) { Write-Fail "Missing file for checksum: $name" }
    $actual = (Get-FileHash -Algorithm SHA256 -Path $path).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
      Write-Fail "Checksum mismatch for $name"
    }
  }
  Write-Log "Checksums OK"
}

function New-SafetySnapshot {
  $ts = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
  $script:SafetyDir = Join-Path $SafetyRoot $ts
  New-Item -ItemType Directory -Force -Path $script:SafetyDir | Out-Null
  Write-Log "Creating pre-restore safety snapshot → $($script:SafetyDir)"

  try {
    & docker compose @ComposeFileArgs exec -T db pg_isready -U $PgUser -d $PgDb 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Invoke-BinaryStdout -FileName "docker" `
        -OutFile (Join-Path $script:SafetyDir "postgres_pre.dump") `
        -ArgumentList (
          @("compose") + $ComposeFileArgs + @(
            "exec", "-T", "db",
            "pg_dump", "-U", $PgUser, "-d", $PgDb, "-Fc", "--no-owner", "--no-acl"
          )
        )
    } else {
      Write-Log "WARNING: db not ready — skipping pre-restore DB dump"
    }
  } catch {
    Write-Log "WARNING: pre-restore DB dump failed: $_"
  }

  $appCid = (& docker compose @ComposeFileArgs ps -q app 2>$null | Select-Object -First 1)
  if ($appCid) {
    $appCid = $appCid.Trim()
    try {
      Invoke-BinaryStdout -FileName "docker" `
        -OutFile (Join-Path $script:SafetyDir "uploads_pre.tar.gz") `
        -ArgumentList @(
          "exec", $appCid, "sh", "-c",
          "if [ -d /app/uploads ]; then tar -C /app -czf - uploads; else tar -czf - --files-from /dev/null; fi"
        )
    } catch {
      Write-Log "WARNING: pre-restore uploads archive failed: $_"
    }
  }
}

function Restore-DbDump([string]$DumpFile) {
  Write-Log "Restoring PostgreSQL from $(Split-Path $DumpFile -Leaf)..."

  $terminateSql = @"
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$PgDb' AND pid <> pg_backend_pid();
"@
  $terminateSql | & docker compose @ComposeFileArgs exec -T db `
    psql -U $PgUser -d postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw "Failed terminating DB sessions" }

  $recreateSql = @"
DROP DATABASE IF EXISTS $PgDb;
CREATE DATABASE $PgDb OWNER $PgUser;
"@
  $recreateSql | & docker compose @ComposeFileArgs exec -T db `
    psql -U $PgUser -d postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw "Failed recreating database $PgDb" }

  if ($DumpFile -like "*.dump") {
    # pg_restore often returns 1 for non-fatal warnings; validate tables afterward
    Send-BinaryStdin -FileName "docker" -InFile $DumpFile -OkExitMax 1 -ArgumentList (
      @("compose") + $ComposeFileArgs + @(
        "exec", "-T", "db",
        "pg_restore", "-U", $PgUser, "-d", $PgDb, "--no-owner", "--role=$PgUser", "-v"
      )
    )
  } else {
    # sql.gz — gunzip inside the container
    Send-BinaryStdin -FileName "docker" -InFile $DumpFile -ArgumentList (
      @("compose") + $ComposeFileArgs + @(
        "exec", "-T", "db",
        "sh", "-c", "gunzip -c | psql -U '$PgUser' -d '$PgDb' -v ON_ERROR_STOP=1"
      )
    )
  }
  Write-Log "PostgreSQL restore finished"
}

function Restore-UploadsTar([string]$TarFile) {
  Write-Log "Restoring uploads from $(Split-Path $TarFile -Leaf)..."
  $appCid = (& docker compose @ComposeFileArgs ps -q app 2>$null | Select-Object -First 1)
  if (-not $appCid) { throw "app container not running — start stack before restoring uploads" }
  $appCid = $appCid.Trim()

  & docker exec -u root $appCid sh -c `
    'rm -rf /app/uploads/* /app/uploads/.[!.]* 2>/dev/null || true; mkdir -p /app/uploads'
  if ($LASTEXITCODE -ne 0) { throw "Failed clearing /app/uploads" }

  Send-BinaryStdin -FileName "docker" -InFile $TarFile -ArgumentList @(
    "exec", "-i", "-u", "root", $appCid, "tar", "-C", "/app", "-xzf", "-"
  )

  & docker exec -u root $appCid chown -R 1001:1001 /app/uploads 2>$null | Out-Null
  Write-Log "Uploads restore finished"
}

function Test-RestoreValid {
  Write-Log "Validating restore..."
  & docker compose @ComposeFileArgs exec -T db pg_isready -U $PgUser -d $PgDb | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "pg_isready failed after restore" }

  $tableCount = (& docker compose @ComposeFileArgs exec -T db `
    psql -U $PgUser -d $PgDb -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" |
    Out-String).Trim()
  Write-Log "    public tables: $tableCount"
  if (-not $tableCount -or [int]$tableCount -lt 1) {
    throw "Validation failed: no tables in public schema after restore"
  }

  $appCid = (& docker compose @ComposeFileArgs ps -q app 2>$null | Select-Object -First 1)
  if ($appCid) {
    & docker exec $appCid.Trim() sh -c 'test -d /app/uploads'
    if ($LASTEXITCODE -ne 0) { throw "uploads directory missing after restore" }
  }
  Write-Log "Validation OK"
}

function Invoke-Rollback {
  if (-not $script:SafetyDir -or -not (Test-Path $script:SafetyDir)) {
    Write-Log "No safety snapshot available for rollback"
    return
  }
  Write-Log "ROLLBACK: restoring pre-restore safety snapshot from $($script:SafetyDir)"
  $preDump = Join-Path $script:SafetyDir "postgres_pre.dump"
  $preUploads = Join-Path $script:SafetyDir "uploads_pre.tar.gz"
  try {
    if (Test-Path $preDump) { Restore-DbDump $preDump }
    if (Test-Path $preUploads) { Restore-UploadsTar $preUploads }
  } catch {
    Write-Log "ROLLBACK encountered errors: $_"
  }
  Write-Log "ROLLBACK attempt finished — verify data manually"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
try {
  Test-Sha256Sums
  New-SafetySnapshot
  $script:RollbackOnError = $true

  if ($CustomDump) {
    Restore-DbDump $CustomDump
  } else {
    Restore-DbDump $SqlGz
  }
  Restore-UploadsTar $UploadsTar
  Test-RestoreValid

  $script:RollbackOnError = $false
  Write-Log "Restore complete from $BackupSrc"
  Write-Log "Pre-restore safety snapshot kept at: $($script:SafetyDir)"
} catch {
  Write-Log "Restore failed — attempting rollback..."
  if ($script:RollbackOnError) { Invoke-Rollback }
  Write-Fail $_.Exception.Message
}
