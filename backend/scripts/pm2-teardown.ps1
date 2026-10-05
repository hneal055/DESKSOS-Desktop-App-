<#
.SYNOPSIS
    Complete PM2 teardown for the DeskSOS backend.

    1. Deletes every PM2 process named desksos-backend (from any folder)
    2. Saves the now-empty process list, so nothing is resurrected later
    3. Removes the pm2-windows-startup logon hook (HKCU Run "PM2")
    4. Stops the PM2 daemon (and with it pm2-logrotate)
    5. With -RemoveTasks: unregisters the "DeskSOS *" scheduled tasks
       (backend startup, daily backup, health monitor)

    Leaves PM2 itself, pm2-logrotate's settings, logs, backups and the database
    untouched. Start again with start-production.ps1 or the startup task.

.EXAMPLE
    pwsh scripts/pm2-teardown.ps1                 # PM2 only
    pwsh scripts/pm2-teardown.ps1 -RemoveTasks    # also scheduled tasks (run as administrator)
#>
param(
    [switch]$RemoveTasks
)

if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "PM2 is not installed; nothing to tear down." -ForegroundColor Gray
    exit 0
}

Write-Host ""
Write-Host "=== DeskSOS - PM2 teardown ===" -ForegroundColor Cyan

# ── 1. Delete desksos-backend processes ──────────────────────────────────────
Write-Host "[1/5] Removing desksos-backend from PM2..." -ForegroundColor Yellow
# Skip "[PM2] Spawning..." banner lines; keep only the JSON array ("[{..." or "[]")
$jlist = & pm2 jlist 2>$null | Where-Object { $_ -match '^\s*\[\s*(\{|\])' } | Select-Object -Last 1
$procs = if ($jlist) { ($jlist | ConvertFrom-Json -AsHashtable) | Where-Object { $_.name -eq "desksos-backend" } }
if ($procs) {
    foreach ($p in $procs) {
        Write-Host "      id $($p.pm_id)  status=$($p.pm2_env.status)  cwd=$($p.pm2_env.pm_cwd)"
    }
    & pm2 delete desksos-backend *> $null
    Write-Host "      Deleted." -ForegroundColor Green
} else {
    Write-Host "      None running." -ForegroundColor Gray
}

# ── 2. Clear the saved process list ──────────────────────────────────────────
Write-Host "[2/5] Saving empty process list (prevents resurrect)..." -ForegroundColor Yellow
& pm2 save --force *> $null
Write-Host "      Done." -ForegroundColor Green

# ── 3. Remove the logon resurrect hook ───────────────────────────────────────
Write-Host "[3/5] Removing pm2-windows-startup logon hook..." -ForegroundColor Yellow
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
if (Get-ItemProperty $runKey -Name PM2 -ErrorAction SilentlyContinue) {
    Remove-ItemProperty $runKey -Name PM2
    Write-Host "      Removed HKCU Run 'PM2'." -ForegroundColor Green
} else {
    Write-Host "      Not present." -ForegroundColor Gray
}

# ── 4. Stop the daemon ───────────────────────────────────────────────────────
Write-Host "[4/5] Stopping PM2 daemon..." -ForegroundColor Yellow
& pm2 kill *> $null
Write-Host "      Stopped." -ForegroundColor Green

# ── 5. Scheduled tasks ───────────────────────────────────────────────────────
Write-Host "[5/5] Scheduled tasks..." -ForegroundColor Yellow
$tasks = Get-ScheduledTask -TaskName "DeskSOS *" -ErrorAction SilentlyContinue
if (-not $RemoveTasks) {
    $names = if ($tasks) { ($tasks.TaskName -join ", ") } else { "none" }
    Write-Host "      Kept ($names). Pass -RemoveTasks to unregister them." -ForegroundColor Gray
} elseif ($tasks) {
    try {
        $tasks | Unregister-ScheduledTask -Confirm:$false -ErrorAction Stop
        Write-Host "      Unregistered: $($tasks.TaskName -join ', ')" -ForegroundColor Green
    } catch {
        Write-Warning "      Could not remove tasks ($($_.Exception.Message)). Re-run as administrator."
    }
} else {
    Write-Host "      None registered." -ForegroundColor Gray
}

# Verify nothing is left on the production port (dev uses 5000 and is left alone)
$prodPort = node -p "require('$($PSScriptRoot -replace '\\','/')/../ecosystem.config.js').apps[0].env_production.PORT"
$holder = Get-NetTCPConnection -LocalPort $prodPort -State Listen -ErrorAction SilentlyContinue
Write-Host ""
if ($holder) {
    Write-Warning "Production port $prodPort is still held by PID $($holder[0].OwningProcess) (not managed by PM2)."
} else {
    Write-Host "Teardown complete. Production port $prodPort is free." -ForegroundColor Green
}
Write-Host ""
