<#
.SYNOPSIS
    Uninstall DeskSOS from workstation

.DESCRIPTION
    Removes DeskSOS application cleanly from the system
    Includes cleanup of shortcuts and registry entries
#>

# Check if running as admin
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This script must be run as Administrator"
    pause
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DeskSOS Uninstallation Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kill running process
Write-Host "[1/4] Stopping application..." -ForegroundColor Yellow
$process = Get-Process -Name "desksos" -ErrorAction SilentlyContinue
if ($process) {
    Stop-Process -Name "desksos" -Force
    Start-Sleep -Seconds 2
    Write-Host "  ✓ Application stopped" -ForegroundColor Green
} else {
    Write-Host "  ! Application not running" -ForegroundColor Gray
}

# Find and run uninstaller
Write-Host ""
Write-Host "[2/4] Uninstalling application..." -ForegroundColor Yellow
$regEntry = Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" | 
            Where-Object { $_.DisplayName -like "*DeskSOS*" } | 
            Select-Object -First 1

if ($regEntry -and $regEntry.UninstallString) {
    Write-Host "  Found uninstaller: $($regEntry.DisplayName)"
    
    if ($regEntry.UninstallString -like "*msiexec*") {
        # MSI uninstall
        $productCode = $regEntry.PSChildName
        $msiArgs = @("/x", $productCode, "/quiet", "/norestart")
        Write-Host "  Uninstalling via MSI..."
        $process = Start-Process msiexec.exe -ArgumentList $msiArgs -Wait -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-Host "  ✓ Uninstallation successful" -ForegroundColor Green
        } else {
            Write-Warning "  Uninstall returned code: $($process.ExitCode)"
        }
    } else {
        # EXE uninstall
        Write-Host "  Running uninstaller..."
        Start-Process $regEntry.UninstallString -ArgumentList "/S" -Wait
        Write-Host "  ✓ Uninstallation complete" -ForegroundColor Green
    }
} else {
    Write-Warning "  No uninstaller found in registry"
}

# Manual cleanup
Write-Host ""
Write-Host "[3/4] Cleaning up files..." -ForegroundColor Yellow

$installPath = "C:\Program Files\DeskSOS"
if (Test-Path $installPath) {
    Remove-Item $installPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Removed: $installPath" -ForegroundColor Green
} else {
    Write-Host "  ! Directory not found: $installPath" -ForegroundColor Gray
}

# Remove shortcuts
Write-Host ""
Write-Host "[4/4] Removing shortcuts..." -ForegroundColor Yellow

$shortcuts = @(
    "C:\Users\Public\Desktop\DeskSOS.lnk",
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\DeskSOS.lnk"
)

foreach ($shortcut in $shortcuts) {
    if (Test-Path $shortcut) {
        Remove-Item $shortcut -Force
        Write-Host "  ✓ Removed: $shortcut" -ForegroundColor Green
    }
}

# Verification
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Uninstallation Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$stillExists = Test-Path "C:\Program Files\DeskSOS\DeskSOS.exe"
if (-not $stillExists) {
    Write-Host "✓ DeskSOS has been successfully removed" -ForegroundColor Green
} else {
    Write-Warning "! Some files may remain. Manual cleanup required:"
    Write-Host "  Delete: C:\Program Files\DeskSOS"
}

Write-Host ""
pause
