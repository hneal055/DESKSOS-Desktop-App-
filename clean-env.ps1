# ==============================================================================
# DeskSOS Environment Cleaner
#
# Stops DeskSOS dev processes (backend, Vite, tauri dev / cargo, desksos.exe),
# frees ports 5000, 5001 and 1420, and clears the Vite cache.
#
# Only DeskSOS processes from THIS repo are stopped. Anything else holding a
# port (e.g. the other DESKSOS project's PM2 backend on 5000, or a non-node
# app) is reported and left alone.
#
# Usage (from anywhere):  pwsh .\clean-env.ps1
# ==============================================================================

$RepoRoot = $PSScriptRoot

function Get-ProcInfo([int]$ProcessId) {
    Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
}

function Test-IsRepoProcess($proc) {
    if (-not $proc) { return $false }
    $text = "$($proc.ExecutablePath) $($proc.CommandLine)"
    return $text -like "*$RepoRoot*"
}

# True if a node process runs a script given by an absolute path outside this
# repo (e.g. PM2, global CLIs). Relative-path commands such as
# "node dist/server.js" can't be attributed and are treated as DeskSOS's.
function Test-IsForeignNode($proc) {
    if (-not $proc -or $proc.Name -ne 'node.exe') { return $true }
    if (Test-IsRepoProcess $proc) { return $false }
    # Drop the leading executable token, then look for an absolute path
    $scriptArgs = $proc.CommandLine -replace '^\s*("[^"]*"|\S+)\s*', ''
    return $scriptArgs -match '[A-Za-z]:[\\/]'
}

function Stop-Tree([int]$ProcessId, [string]$Label) {
    Write-Host " -> Stopping $Label (PID $ProcessId)" -ForegroundColor Yellow
    # /T also stops child processes, e.g. cargo and desksos.exe under tauri dev
    taskkill /PID $ProcessId /T /F 2>&1 | Out-Null
}

Write-Host "[1/3] Stopping DeskSOS processes from $RepoRoot ..." -ForegroundColor Cyan
$repoProcs = Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='cargo.exe' OR Name='desksos.exe'" |
    Where-Object { Test-IsRepoProcess $_ }
if ($repoProcs) {
    foreach ($p in $repoProcs) {
        if (Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue) {
            Stop-Tree $p.ProcessId $p.Name
        }
    }
} else {
    Write-Host " -> None running." -ForegroundColor Gray
}

Write-Host "[2/3] Freeing ports 5000, 5001, 1420 ..." -ForegroundColor Cyan
foreach ($port in 5000, 5001, 1420) {
    $owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    if (-not $owners) {
        Write-Host " -> Port $port is free." -ForegroundColor Gray
        continue
    }
    foreach ($ownerId in $owners) {
        if (-not $ownerId) { continue }
        $proc = Get-ProcInfo $ownerId
        if (-not (Test-IsForeignNode $proc)) {
            Stop-Tree $ownerId "$($proc.Name) on port $port"
        } else {
            $what = if ($proc) { "$($proc.Name): $($proc.CommandLine)" } else { "PID $ownerId" }
            Write-Host " -> Port $port is held by a process outside this repo; leaving it running:" -ForegroundColor Magenta
            Write-Host "    $what" -ForegroundColor Magenta
        }
    }
}

Write-Host "[3/3] Clearing Vite cache ..." -ForegroundColor Cyan
$viteCachePath = Join-Path $RepoRoot "tauri-app\node_modules\.vite"
if (Test-Path $viteCachePath) {
    Remove-Item -Recurse -Force $viteCachePath
    Write-Host " -> Cleared $viteCachePath" -ForegroundColor Green
} else {
    Write-Host " -> No Vite cache found." -ForegroundColor Gray
}

Write-Host "Done. Environment is ready for a fresh startup." -ForegroundColor Green
