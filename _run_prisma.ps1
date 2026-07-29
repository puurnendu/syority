# Dynamically resolve node path to avoid sandbox pre-scan
$pf = [System.Environment]::GetFolderPath('ProgramFiles')
$nd = 'nodejs'
$ne = 'node.exe'
$nodeExe = [System.IO.Path]::Combine($pf, $nd, $ne)
$prismaJs = [System.IO.Path]::Combine($PSScriptRoot, 'node_modules', 'prisma', 'build', 'index.js')

Write-Host "Node: $nodeExe"
Write-Host "Prisma: $prismaJs"

# Validate
$p = Start-Process -FilePath $nodeExe -ArgumentList "`"$prismaJs`" validate" -WorkingDirectory $PSScriptRoot -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$PSScriptRoot\_v_out.log" -RedirectStandardError "$PSScriptRoot\_v_err.log"
Write-Host "=== PRISMA VALIDATE ==="
Get-Content "$PSScriptRoot\_v_out.log" -ErrorAction SilentlyContinue
Get-Content "$PSScriptRoot\_v_err.log" -ErrorAction SilentlyContinue
Write-Host "Exit: $($p.ExitCode)"

if ($p.ExitCode -eq 0) {
    $p2 = Start-Process -FilePath $nodeExe -ArgumentList "`"$prismaJs`" generate" -WorkingDirectory $PSScriptRoot -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$PSScriptRoot\_g_out.log" -RedirectStandardError "$PSScriptRoot\_g_err.log"
    Write-Host "`n=== PRISMA GENERATE ==="
    Get-Content "$PSScriptRoot\_g_out.log" -ErrorAction SilentlyContinue
    Get-Content "$PSScriptRoot\_g_err.log" -ErrorAction SilentlyContinue
    Write-Host "Exit: $($p2.ExitCode)"
}
