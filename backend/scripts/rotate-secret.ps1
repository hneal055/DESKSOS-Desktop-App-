<#
.SYNOPSIS
    Rotates the JWT_SECRET in backend/.env and restarts the backend gracefully.

    All existing user sessions will be invalidated after the restart — users
    will be prompted to log in again.  Run this during a maintenance window or
    off-peak hours.

.EXAMPLE
    cd backend
    pwsh scripts/rotate-secret.ps1           # rotate + prompt to restart

    pwsh scripts/rotate-secret.ps1 -Restart  # rotate + restart via PM2 automatically
#>
param(
    [switch]$Restart   # pass -Restart to auto-reload PM2 after rotating
)

$envFile = "$PSScriptRoot\..\env" -replace "\\env$", "\.env"
$envFile = (Resolve-Path "$PSScriptRoot\..\").Path + ".env"

if (-not (Test-Path $envFile)) {
    Write-Error ".env not found at $envFile. Copy .env.example and fill in values first."
    exit 1
}

# Generate a new 64-byte (512-bit) base64 secret
$newSecret = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64))

Write-Host ""
Write-Host "New JWT_SECRET generated (64 bytes / 512 bits)."
Write-Host ""

# Read existing .env, replace or append JWT_SECRET
$lines = Get-Content $envFile
$found = $false
$newLines = $lines | ForEach-Object {
    if ($_ -match '^JWT_SECRET=') {
        $found = $true
        "JWT_SECRET=$newSecret"
    } else {
        $_
    }
}
if (-not $found) {
    $newLines += "JWT_SECRET=$newSecret"
}

Set-Content $envFile $newLines -Encoding UTF8
Write-Host "JWT_SECRET updated in: $envFile"
Write-Host ""
Write-Host "WARNING: All active user sessions are now invalid."
Write-Host "         Users will need to log in again after the backend restarts."
Write-Host ""

if ($Restart) {
    $pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
    if ($pm2) {
        Write-Host "Reloading PM2 process (zero-downtime)..."
        & pm2 reload desksos-backend
        if ($LASTEXITCODE -eq 0) {
            Write-Host "PM2 reload complete."
        } else {
            Write-Warning "PM2 reload failed. Restart manually: pm2 restart desksos-backend"
        }
    } else {
        Write-Warning "PM2 not found. Restart the backend manually to apply the new secret."
    }
} else {
    Write-Host "Next step: restart the backend to apply the new secret."
    Write-Host "  PM2:   pm2 reload desksos-backend"
    Write-Host "  Manual: npm run build && npm start"
}
