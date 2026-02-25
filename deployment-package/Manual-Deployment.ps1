<#
.SYNOPSIS
    Deploy DeskSOS to individual workstations

.DESCRIPTION
    Installs DeskSOS Desktop Support Toolkit silently on the local machine
    Creates desktop shortcut and verifies installation

.PARAMETER InstallPath
    Installation directory (default: C:\Program Files\DeskSOS)

.PARAMETER CreateShortcut
    Create desktop shortcut for all users (default: $true)

.EXAMPLE
    .\Manual-Deployment.ps1
    .\Manual-Deployment.ps1 -CreateShortcut $false
#>

param(
    [string]$InstallPath = "C:\Program Files\DeskSOS",
    [bool]$CreateShortcut = $true
)

# Check if running as admin
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This script must be run as Administrator"
    Write-Host "Right-click PowerShell and select ''Run as Administrator''"
    pause
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DeskSOS Installation Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Find MSI installer
$msiPath = Join-Path $PSScriptRoot "DeskSOS_1.0.0_x64_en-US.msi"
if (-not (Test-Path $msiPath)) {
    # Try EXE installer
    $exePath = Join-Path $PSScriptRoot "DeskSOS_1.0.0_x64-setup.exe"
    if (Test-Path $exePath) {
        Write-Host "[INFO] Using EXE installer..." -ForegroundColor Yellow
        Write-Host "  Starting installation..."
        Start-Process $exePath -ArgumentList "/S" -Wait
        Write-Host "  ✓ Installation complete" -ForegroundColor Green
    } else {
        Write-Error "Installer not found. Please ensure DeskSOS_1.0.0_x64_en-US.msi is in the same folder."
        pause
        exit 1
    }
} else {
    Write-Host "[1/3] Installing DeskSOS..." -ForegroundColor Yellow
    Write-Host "  Installer: $msiPath"
    Write-Host "  Target: $InstallPath"
    Write-Host ""
    
    # Silent install with logging
    $logPath = "$env:TEMP\DeskSOS_Install.log"
    $msiArgs = @(
        "/i", "`"$msiPath`""
        "/quiet"
        "/norestart"
        "INSTALLDIR=`"$InstallPath`""
        "/l*v", "`"$logPath`""
    )
    
    Write-Host "  Installing (this may take 30-60 seconds)..."
    $process = Start-Process msiexec.exe -ArgumentList $msiArgs -Wait -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-Host "  ✓ Installation successful" -ForegroundColor Green
    } elseif ($process.ExitCode -eq 1641 -or $process.ExitCode -eq 3010) {
        Write-Host "  ✓ Installation successful (reboot required)" -ForegroundColor Yellow
    } else {
        Write-Error "Installation failed with error code: $($process.ExitCode)"
        Write-Host "Check log file: $logPath"
        pause
        exit 1
    }
}

# Create desktop shortcut
if ($CreateShortcut) {
    Write-Host ""
    Write-Host "[2/3] Creating desktop shortcut..." -ForegroundColor Yellow
    
    $exePath = Join-Path $InstallPath "DeskSOS.exe"
    if (Test-Path $exePath) {
        $WshShell = New-Object -comObject WScript.Shell
        $shortcutPath = "C:\Users\Public\Desktop\DeskSOS.lnk"
        $Shortcut = $WshShell.CreateShortcut($shortcutPath)
        $Shortcut.TargetPath = $exePath
        $Shortcut.IconLocation = "$exePath,0"
        $Shortcut.Description = "Desktop Support Troubleshooting Toolkit"
        $Shortcut.WorkingDirectory = $InstallPath
        $Shortcut.Save()
        
        Write-Host "  ✓ Shortcut created: $shortcutPath" -ForegroundColor Green
    } else {
        Write-Warning "  Executable not found at: $exePath"
    }
}

# Verify installation
Write-Host ""
Write-Host "[3/3] Verifying installation..." -ForegroundColor Yellow

$appPath = Join-Path $InstallPath "DeskSOS.exe"
if (Test-Path $appPath) {
    $version = (Get-Item $appPath).VersionInfo.FileVersion
    Write-Host "  ✓ Application installed" -ForegroundColor Green
    Write-Host "    Path: $appPath"
    Write-Host "    Version: $version"
} else {
    Write-Warning "  Application executable not found"
}

# Check registry
$uninstallKey = Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" | 
                Where-Object { $_.DisplayName -like "*DeskSOS*" } | 
                Select-Object -First 1

if ($uninstallKey) {
    Write-Host "  ✓ Registry entry created" -ForegroundColor Green
    Write-Host "    Display Name: $($uninstallKey.DisplayName)"
    Write-Host "    Version: $($uninstallKey.DisplayVersion)"
} else {
    Write-Warning "  Registry entry not found (this may be normal for EXE installer)"
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Launch DeskSOS:" -ForegroundColor Cyan
Write-Host "  • Double-click desktop shortcut"
Write-Host "  • Run: $appPath"
Write-Host "  • Search Windows: ''DeskSOS''"
Write-Host ""
Write-Host "Note: Some features require Administrator privileges" -ForegroundColor Yellow
Write-Host ""

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
