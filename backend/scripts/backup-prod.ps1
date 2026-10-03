<#
.SYNOPSIS
    Backs up the production database (path defined in ecosystem.config.js)
    via backup-db.js, appending output to logs/backup.log.

    Used by start-production.ps1 and the "DeskSOS Daily Backup" task.
    The development DB (data/desksos.db) is not backed up.
#>
$root = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $root
New-Item -ItemType Directory -Force (Join-Path $root "logs") | Out-Null
$log = Join-Path $root "logs\backup.log"

$env:DATABASE_PATH = node -p "require('./ecosystem.config.js').apps[0].env_production.DATABASE_PATH"
if (-not (Test-Path $env:DATABASE_PATH)) {
    "$(Get-Date -Format s) No production database yet ($env:DATABASE_PATH); nothing to back up." |
        Tee-Object -FilePath $log -Append
    exit 0
}

"$(Get-Date -Format s) Backup starting" | Add-Content $log
node scripts/backup-db.js *>&1 | Tee-Object -FilePath $log -Append
exit $LASTEXITCODE
