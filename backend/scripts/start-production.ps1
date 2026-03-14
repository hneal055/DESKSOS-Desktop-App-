<#
.SYNOPSIS
    DeskSOS daily startup + maintenance script.

    Run this once at system boot or at the start of each working day.
    It handles:
      1. Building the TypeScript backend (if dist/ is stale)
      2. Backing up the database
      3. Starting / reloading the backend via PM2

.EXAMPLE
    cd backend
    pwsh scripts/start-production.ps1

    # To skip the build step (already built):
    pwsh scripts/start-production.ps1 -SkipBuild

.NOTES
    Requires PM2 to be installed globally: npm install -g pm2
    First-time setup:
      pm2 startup     # registers PM2 to start on OS boot
      pm2 save        # saves the process list
#>
param(
    [switch]$SkipBuild   # skip TypeScript compilation
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $root

Write-Host ""
Write-Host "=== DeskSOS — Production Startup ===" -ForegroundColor Cyan
Write-Host "  Working directory: $root"
Write-Host ""

# ── 1. Check PM2 ─────────────────────────────────────────────────────────────
$pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2) {
    Write-Error "PM2 not found. Install it with: npm install -g pm2"
    exit 1
}

# ── 2. Build backend ─────────────────────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Host "[1/3] Building TypeScript backend..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed. Fix TypeScript errors before starting."
        exit 1
    }
    Write-Host "      Build complete." -ForegroundColor Green
} else {
    Write-Host "[1/3] Skipping build (-SkipBuild flag set)." -ForegroundColor DarkGray
}
Write-Host ""

# ── 3. Backup database ───────────────────────────────────────────────────────
Write-Host "[2/3] Backing up database..." -ForegroundColor Yellow
node scripts/backup-db.js
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Database backup failed — continuing startup anyway."
}
Write-Host ""

# ── 4. Start / reload PM2 ───────────────────────────────────────────────────
Write-Host "[3/3] Starting backend via PM2..." -ForegroundColor Yellow

$running = & pm2 id desksos-backend 2>$null
if ($running -and $running -notmatch '^\[\]') {
    Write-Host "      Process exists — reloading (zero-downtime)..."
    & pm2 reload ecosystem.config.js --env production
} else {
    Write-Host "      Starting new PM2 process..."
    & pm2 start ecosystem.config.js --env production
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "PM2 failed to start. Check logs: pm2 logs desksos-backend"
    exit 1
}

Write-Host ""
Write-Host "=== Startup complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  pm2 status                     # process list"
Write-Host "  pm2 logs desksos-backend       # tail logs"
Write-Host "  pm2 reload desksos-backend     # zero-downtime reload"
Write-Host "  npm run backup                 # manual DB backup"
Write-Host "  pwsh scripts/rotate-secret.ps1 -Restart  # rotate JWT secret"
Write-Host ""
