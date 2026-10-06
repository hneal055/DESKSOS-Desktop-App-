<#
.SYNOPSIS
    Registers DeskSOS maintenance tasks in Windows Task Scheduler.

      DeskSOS Backend Startup at boot (+1 min) -> scripts/start-production.ps1
                              -SkipBuild (only with -BackendAutostart)
      DeskSOS Daily Backup    daily at 02:00 -> scripts/backup-db.js (keeps 14)
      DeskSOS Health Monitor  every 5 minutes -> scripts/monitor-health.ps1
                              (only when -HealthUrl is given)

    Tasks run as the current user whether or not anyone is logged on. Run from
    an elevated (Run as administrator) pwsh window. Re-running updates them.

.EXAMPLE
    pwsh scripts/register-tasks.ps1                       # backup only
    pwsh scripts/register-tasks.ps1 -HealthUrl https://FORD-DC01:5443/health
    pwsh scripts/register-tasks.ps1 -BackendAutostart -HealthUrl https://FORD-DC01:5443/health

.NOTES
    Backups land in data/backups by default. To keep a copy off this machine,
    set a user-level BACKUP_DIR pointing at a OneDrive-synced folder. (S4U tasks
    have no network credentials, so a \\server\share path will not work.)
    Remove the tasks with:
      Unregister-ScheduledTask -TaskName "DeskSOS*" -Confirm:$false
#>
param(
    [string]$HealthUrl,
    [switch]$BackendAutostart,
    [string]$BackupTime = "02:00"
)

$ErrorActionPreference = "Stop"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Run this from an elevated pwsh window (right-click PowerShell 7 -> Run as administrator)."
    exit 1
}
$root = (Resolve-Path "$PSScriptRoot\..").Path
# Prefer the MSI install: its path is stable across updates AND it can run in
# S4U tasks. The Store's App Execution Alias (WindowsApps\pwsh.exe) can't be
# launched when nobody is signed in, so tasks using it fail with 0x80070005.
$msi   = Join-Path $env:ProgramFiles "PowerShell\7\pwsh.exe"
$alias = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\pwsh.exe"
$pwsh  = if (Test-Path $msi) { $msi } elseif (Test-Path $alias) { $alias } else { (Get-Command pwsh).Source }
if ($pwsh -eq $alias) {
    Write-Warning "Only the Microsoft Store PowerShell was found. Scheduled tasks can't start it while nobody is signed in (error 0x80070005)."
    # winget's default for this package is the MSIX (Store-style) build, so ask for the MSI
    Write-Warning "Install the MSI version, then run this script again:  winget install --id Microsoft.PowerShell --source winget --installer-type wix"
}
Write-Host "Tasks will use: $pwsh"
# RunLevel Highest: PM2's daemon is only reachable from the same elevation
# level, and setup/maintenance happen in elevated windows, so tasks match that.
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

New-Item -ItemType Directory -Force (Join-Path $root "logs") | Out-Null

# ── Backend startup at boot ───────────────────────────────────────────────────
if ($BackendAutostart) {
    $startScript = Join-Path $root "scripts\start-production.ps1"
    $bootTrigger = New-ScheduledTaskTrigger -AtStartup
    $bootTrigger.Delay = "PT1M"   # give networking a minute to come up
    $startCmd = "& '$startScript' -SkipBuild *>> '$root\logs\startup.log'"
    Register-ScheduledTask -TaskName "DeskSOS Backend Startup" -Force `
        -Description "Starts the DeskSOS backend under PM2 at boot" `
        -Action (New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -Command `"$startCmd`"" -WorkingDirectory $root) `
        -Trigger $bootTrigger -Principal $principal -Settings $settings | Out-Null
    Write-Host "Registered: DeskSOS Backend Startup (at boot +1 min, log: logs/startup.log)" -ForegroundColor Green
}

# ── Daily backup ──────────────────────────────────────────────────────────────
$backupScript = Join-Path $root "scripts\backup-prod.ps1"
Register-ScheduledTask -TaskName "DeskSOS Daily Backup" -Force `
    -Description "Hot backup of the DeskSOS production SQLite database" `
    -Action (New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -File `"$backupScript`"") `
    -Trigger (New-ScheduledTaskTrigger -Daily -At $BackupTime) `
    -Principal $principal -Settings $settings | Out-Null
Write-Host "Registered: DeskSOS Daily Backup (daily at $BackupTime, log: logs/backup.log)" -ForegroundColor Green

# ── Health monitor ────────────────────────────────────────────────────────────
if ($HealthUrl) {
    $monitorScript = Join-Path $root "scripts\monitor-health.ps1"
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
        -RepetitionInterval (New-TimeSpan -Minutes 5)
    Register-ScheduledTask -TaskName "DeskSOS Health Monitor" -Force `
        -Description "Checks DeskSOS /health and emails on outage/recovery" `
        -Action (New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -File `"$monitorScript`" -Url `"$HealthUrl`"") `
        -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
    Write-Host "Registered: DeskSOS Health Monitor (every 5 min -> $HealthUrl, log: logs/monitor.log)" -ForegroundColor Green
} else {
    Write-Host "Skipped health monitor (pass -HealthUrl once the backend's address is decided)." -ForegroundColor DarkGray
}
