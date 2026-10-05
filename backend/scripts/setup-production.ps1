<#
.SYNOPSIS
    One-time setup of the DeskSOS production backend on this PC (PM2, HTTPS 5443).

      1. TLS certificate for localhost, this PC's name and LAN IP (mkcert)
      2. Windows Firewall rule for TCP 5443 (Domain/Private networks)
      3. Build + first start under PM2 (start-production.ps1)
      4. Scheduled tasks: backend startup at boot, daily backup, health monitor
      5. Health check, and the generated admin password on first start

    Run from an elevated PowerShell 7 window. Safe to re-run.
    On first run Windows asks to install the mkcert certificate authority: click Yes.

.EXAMPLE
    pwsh C:\Projects\DESKSOS-Desktop\backend\scripts\setup-production.ps1
#>
param(
    [int]$Port = 5443
)

$ErrorActionPreference = "Stop"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Run this from an elevated pwsh window (right-click PowerShell 7 -> Run as administrator)."
    exit 1
}

$root    = (Resolve-Path "$PSScriptRoot\..").Path
$hostName = $env:COMPUTERNAME
$lanIps  = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notmatch '^(127|169\.254)\.' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Loopback' } |
    Select-Object -ExpandProperty IPAddress
$healthUrl = "https://${hostName}:$Port/health"
Set-Location $root

Write-Host ""
Write-Host "=== DeskSOS - production setup on $hostName ===" -ForegroundColor Cyan

# ── 1. Certificate ───────────────────────────────────────────────────────────
Write-Host "[1/5] TLS certificate..." -ForegroundColor Yellow
$names = @("localhost", "127.0.0.1", $hostName) + $lanIps
Write-Host "      Names: $($names -join ', ')"
& "$PSScriptRoot\gen-cert.ps1" -Names $names
if (-not (Test-Path "$root\certs\server.crt")) { Write-Error "Certificate was not created."; exit 1 }

# ── 2. Firewall ──────────────────────────────────────────────────────────────
Write-Host "[2/5] Firewall rule for TCP $Port..." -ForegroundColor Yellow
if (-not (Get-NetFirewallRule -DisplayName "DeskSOS Backend" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "DeskSOS Backend" -Direction Inbound -Protocol TCP `
        -LocalPort $Port -Action Allow -Profile Domain, Private | Out-Null
    Write-Host "      Created." -ForegroundColor Green
} else {
    Write-Host "      Already present." -ForegroundColor Gray
}

# ── 3. Build + start ─────────────────────────────────────────────────────────
Write-Host "[3/5] Build and start under PM2..." -ForegroundColor Yellow
& "$PSScriptRoot\start-production.ps1"
if ($LASTEXITCODE -ne 0) { Write-Error "start-production.ps1 failed."; exit 1 }
& pm2 save *> $null

# ── 4. Scheduled tasks ───────────────────────────────────────────────────────
Write-Host "[4/5] Scheduled tasks..." -ForegroundColor Yellow
& "$PSScriptRoot\register-tasks.ps1" -BackendAutostart -HealthUrl $healthUrl

# ── 5. Verify ────────────────────────────────────────────────────────────────
Write-Host "[5/5] Verifying $healthUrl ..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
try {
    $h = Invoke-RestMethod $healthUrl -TimeoutSec 10
    Write-Host "      status=$($h.status) db=$($h.db)" -ForegroundColor Green
} catch {
    Write-Warning "      Health check failed: $($_.Exception.Message). See: pm2 logs desksos-backend"
}

# PM2 appends the process id to log names (pm2-out-1.log), so match any suffix
$outLogs = Get-ChildItem "$root\logs" -Filter "pm2-out*.log" -ErrorAction SilentlyContinue
$loginLines = if ($outLogs) {
    $outLogs | Select-String -Pattern "(Admin|Technician):\s+\S+@desksos\.com" | Select-Object -Last 2
}
Write-Host ""
if ($loginLines) {
    Write-Host "Production logins (generated on first start; change both after logging in):" -ForegroundColor Cyan
    $loginLines | ForEach-Object { Write-Host "  $($_.Line.Trim())" }
} else {
    Write-Host "Production database already existed; passwords unchanged." -ForegroundColor Gray
}
Write-Host ""
Write-Host "Server URL for desktop apps: https://${hostName}:$Port" -ForegroundColor Cyan
Write-Host "CA certificate for user PCs: $(mkcert -CAROOT)\rootCA.pem   (never share rootCA-key.pem)" -ForegroundColor Cyan
Write-Host ""
