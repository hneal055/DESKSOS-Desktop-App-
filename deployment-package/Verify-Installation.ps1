<#
.SYNOPSIS
    Verify DeskSOS installation on workstation

.DESCRIPTION
    Checks if DeskSOS is properly installed and functional
    Returns detailed installation status
#>

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DeskSOS Installation Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$results = @()
$allGood = $true

# Check 1: Application files
Write-Host "[1/5] Checking application files..." -ForegroundColor Yellow
$exePath = "C:\Program Files\DeskSOS\DeskSOS.exe"
if (Test-Path $exePath) {
    $fileInfo = Get-Item $exePath
    Write-Host "  ✓ Application found" -ForegroundColor Green
    Write-Host "    Path: $exePath"
    Write-Host "    Size: $([math]::Round($fileInfo.Length/1MB,2)) MB"
    Write-Host "    Modified: $($fileInfo.LastWriteTime)"
    $results += [PSCustomObject]@{Check="Application Files"; Status="PASS"}
} else {
    Write-Host "  ✗ Application not found at: $exePath" -ForegroundColor Red
    $results += [PSCustomObject]@{Check="Application Files"; Status="FAIL"}
    $allGood = $false
}

# Check 2: Registry entry
Write-Host ""
Write-Host "[2/5] Checking registry..." -ForegroundColor Yellow
$regEntry = Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue | 
            Where-Object { $_.DisplayName -like "*DeskSOS*" } | 
            Select-Object -First 1

if ($regEntry) {
    Write-Host "  ✓ Registry entry found" -ForegroundColor Green
    Write-Host "    Display Name: $($regEntry.DisplayName)"
    Write-Host "    Version: $($regEntry.DisplayVersion)"
    Write-Host "    Publisher: $($regEntry.Publisher)"
    Write-Host "    Install Date: $($regEntry.InstallDate)"
    $results += [PSCustomObject]@{Check="Registry Entry"; Status="PASS"}
} else {
    Write-Host "  ! Registry entry not found (may be normal for portable install)" -ForegroundColor Yellow
    $results += [PSCustomObject]@{Check="Registry Entry"; Status="WARN"}
}

# Check 3: Desktop shortcut
Write-Host ""
Write-Host "[3/5] Checking shortcuts..." -ForegroundColor Yellow
$shortcutPath = "C:\Users\Public\Desktop\DeskSOS.lnk"
if (Test-Path $shortcutPath) {
    Write-Host "  ✓ Desktop shortcut found" -ForegroundColor Green
    Write-Host "    Path: $shortcutPath"
    $results += [PSCustomObject]@{Check="Desktop Shortcut"; Status="PASS"}
} else {
    Write-Host "  ! Desktop shortcut not found (not critical)" -ForegroundColor Yellow
    $results += [PSCustomObject]@{Check="Desktop Shortcut"; Status="WARN"}
}

# Check 4: Process running
Write-Host ""
Write-Host "[4/5] Checking if application can start..." -ForegroundColor Yellow
if (Test-Path $exePath) {
    $runningProcess = Get-Process -Name "desksos" -ErrorAction SilentlyContinue
    if ($runningProcess) {
        Write-Host "  ✓ DeskSOS is currently running" -ForegroundColor Green
        Write-Host "    PID: $($runningProcess.Id)"
        Write-Host "    Memory: $([math]::Round($runningProcess.WorkingSet64/1MB,2)) MB"
        $results += [PSCustomObject]@{Check="Application Running"; Status="ACTIVE"}
    } else {
        Write-Host "  ! Application not currently running (this is normal)" -ForegroundColor Yellow
        $results += [PSCustomObject]@{Check="Application Running"; Status="IDLE"}
    }
} else {
    Write-Host "  ✗ Cannot check - application not installed" -ForegroundColor Red
    $results += [PSCustomObject]@{Check="Application Running"; Status="N/A"}
}

# Check 5: Permissions
Write-Host ""
Write-Host "[5/5] Checking permissions..." -ForegroundColor Yellow
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    Write-Host "  ✓ Running as Administrator (all features available)" -ForegroundColor Green
    $results += [PSCustomObject]@{Check="Admin Rights"; Status="YES"}
} else {
    Write-Host "  ! Running as Standard User (limited features)" -ForegroundColor Yellow
    Write-Host "    Run as Administrator for full functionality" -ForegroundColor Gray
    $results += [PSCustomObject]@{Check="Admin Rights"; Status="NO"}
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verification Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$results | Format-Table -AutoSize

if ($allGood) {
    Write-Host "✓ DeskSOS is properly installed and ready to use!" -ForegroundColor Green
} else {
    Write-Host "✗ Installation issues detected. Please reinstall." -ForegroundColor Red
}

Write-Host ""
Write-Host "System Information:" -ForegroundColor Cyan
Write-Host "  Computer: $env:COMPUTERNAME"
Write-Host "  User: $env:USERNAME"
Write-Host "  OS: $(Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty Caption)"
Write-Host "  Build: $(Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty BuildNumber)"
Write-Host ""

if (-not $isAdmin) {
    Write-Host "Tip: Rerun this script as Administrator for full verification" -ForegroundColor Yellow
}
