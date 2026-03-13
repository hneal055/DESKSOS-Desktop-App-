#Requires -Version 5.1
<#
.SYNOPSIS
    DeskSOS - Full Stack Installer & Deployment Manager

.DESCRIPTION
    Interactive console UI for installing, configuring, and verifying all three
    DeskSOS components: Desktop App, Backend API, and Mobile Companion App.

.NOTES
    Run from: C:\Projects\DESKSOS\tauri-app\
    Requires: Node.js 22+, Rust/Cargo (for desktop build), Android Studio (for mobile)
#>

$ErrorActionPreference = "Stop"

# ---- Constants ---------------------------------------------------------------
$APP_NAME      = "DeskSOS"
$APP_VERSION   = "1.0.0"
$ROOT          = Split-Path -Parent $MyInvocation.MyCommand.Path   # tauri-app/
$PROJECT_ROOT  = Split-Path -Parent $ROOT                           # DESKSOS/
$BUNDLE_DIR    = Join-Path $ROOT      "src-tauri\target\release\bundle"
$NSIS_EXE      = Join-Path $BUNDLE_DIR "nsis\DeskSOS_${APP_VERSION}_x64-setup.exe"
$MSI_FILE      = Join-Path $BUNDLE_DIR "msi\DeskSOS_${APP_VERSION}_x64_en-US.msi"
$BACKEND_DIR   = Join-Path $PROJECT_ROOT "backend"
$MOBILE_DIR    = Join-Path $PROJECT_ROOT "DeskSOSMobile"
$DEPLOY_DIR    = Join-Path $PROJECT_ROOT "deployment-package"

# ---- UI Helpers --------------------------------------------------------------
function Show-Header {
    Clear-Host
    Write-Host ""
    Write-Host "  +------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "  |      DeskSOS  v$APP_VERSION  -  Installer & Deployer        |" -ForegroundColor Cyan
    Write-Host "  |      IT Support Toolkit  -  Full Stack                |" -ForegroundColor Cyan
    Write-Host "  +------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host ""
}

function Show-SectionHeader([string]$title) {
    Write-Host ""
    Write-Host "  ---- $title " -ForegroundColor DarkCyan
    Write-Host ""
}

function Write-Step([string]$msg)  { Write-Host "  >> $msg" -ForegroundColor Yellow }
function Write-OK([string]$msg)    { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Warn([string]$msg)  { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail([string]$msg)  { Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Write-Info([string]$msg)  { Write-Host "         $msg" -ForegroundColor Gray }
function Pause-Screen              { Write-Host ""; Read-Host "  Press Enter to continue" | Out-Null }

function Test-Command([string]$cmd) {
    return $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue)
}

# ---- Prerequisite Check ------------------------------------------------------
function Show-PrereqCheck {
    Show-Header
    Show-SectionHeader "Prerequisite Check"

    $checks = @(
        @{ Name = "Node.js 22+";   Cmd = "node";  Args = "--version" },
        @{ Name = "npm";           Cmd = "npm";   Args = "--version" },
        @{ Name = "Rust / Cargo";  Cmd = "cargo"; Args = "--version" },
        @{ Name = "Git";           Cmd = "git";   Args = "--version" }
    )

    $allOk = $true
    foreach ($c in $checks) {
        if (Test-Command $c.Cmd) {
            $ver = & $c.Cmd $c.Args 2>&1 | Select-Object -First 1
            Write-OK "$($c.Name): $ver"
        } else {
            Write-Fail "$($c.Name) not found"
            $allOk = $false
        }
    }

    # Android SDK (optional - mobile only)
    $androidHome = $env:ANDROID_HOME
    if (-not $androidHome) { $androidHome = "$env:LOCALAPPDATA\Android\Sdk" }
    if (Test-Path $androidHome) {
        Write-OK "Android SDK: $androidHome"
    } else {
        Write-Warn "Android SDK not found (required only for mobile builds)"
        Write-Info "Expected: $androidHome"
    }

    Write-Host ""
    if ($allOk) {
        Write-OK "All core prerequisites satisfied."
    } else {
        Write-Warn "Some prerequisites are missing. Desktop/mobile builds may fail."
    }

    Pause-Screen
}

# ---- Desktop: Build ----------------------------------------------------------
function Invoke-DesktopBuild {
    Show-Header
    Show-SectionHeader "Desktop App - Build"

    if (-not (Test-Command "node"))  { Write-Fail "Node.js not found. Install from https://nodejs.org"; Pause-Screen; return }
    if (-not (Test-Command "cargo")) { Write-Fail "Rust not found. Install from https://rustup.rs";    Pause-Screen; return }

    Write-Step "Installing npm dependencies..."
    Set-Location $ROOT
    npm install --silent
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed."; Pause-Screen; return }
    Write-OK "Dependencies ready."

    Write-Step "Building DeskSOS desktop app (this takes a few minutes)..."
    npm run tauri:build
    if ($LASTEXITCODE -ne 0) { Write-Fail "Build failed. See output above."; Pause-Screen; return }

    Write-OK "Build complete."
    Write-Info "MSI : $MSI_FILE"
    Write-Info "EXE : $NSIS_EXE"
    Pause-Screen
}

# ---- Desktop: Install --------------------------------------------------------
function Invoke-DesktopInstall {
    Show-Header
    Show-SectionHeader "Desktop App - Install"

    $hasNsis = Test-Path $NSIS_EXE
    $hasMsi  = Test-Path $MSI_FILE

    # Fall back to deployment-package copies
    if (-not $hasNsis) {
        $alt = Join-Path $DEPLOY_DIR "DeskSOS_${APP_VERSION}_x64-setup.exe"
        if (Test-Path $alt) { $hasNsis = $true; $NSIS_EXE = $alt }
    }
    if (-not $hasMsi) {
        $alt = Join-Path $DEPLOY_DIR "DeskSOS_${APP_VERSION}_x64_en-US.msi"
        if (Test-Path $alt)  { $hasMsi  = $true; $MSI_FILE  = $alt }
    }

    if (-not $hasNsis -and -not $hasMsi) {
        Write-Fail "No installer found. Run option [2] to build first."
        Pause-Screen; return
    }

    # Choose installer
    $installer = $null
    if ($hasNsis -and $hasMsi) {
        Write-Host "  Two installer formats available:" -ForegroundColor White
        Write-Host "    [1] Setup EXE   (recommended - includes uninstaller)"
        Write-Host "    [2] MSI Package (enterprise / Group Policy deployment)"
        Write-Host ""
        $choice = Read-Host "  Choose [1/2] (default: 1)"
        $installer = if ($choice -eq "2") { $MSI_FILE } else { $NSIS_EXE }
    } elseif ($hasNsis) {
        $installer = $NSIS_EXE
    } else {
        $installer = $MSI_FILE
    }

    Write-Step "Launching installer: $(Split-Path -Leaf $installer)"
    Write-Info "Follow the on-screen prompts."
    Write-Host ""

    try {
        if ($installer -match "\.msi$") {
            $logPath = "$env:TEMP\DeskSOS_Install.log"
            $msiArgs = @("/i", "`"$installer`"", "/quiet", "/norestart", "/l*v", "`"$logPath`"")
            $proc = Start-Process msiexec.exe -ArgumentList $msiArgs -Wait -PassThru
            if ($proc.ExitCode -notin @(0, 1641, 3010)) {
                Write-Fail "MSI install failed (exit $($proc.ExitCode)). Log: $logPath"
                Pause-Screen; return
            }
        } else {
            Start-Process $installer -Wait
        }
        Write-OK "Desktop app installed successfully."
    } catch {
        Write-Fail "Installation error: $_"
    }

    Pause-Screen
}

# ---- Backend: Start ----------------------------------------------------------
function Invoke-BackendStart {
    Show-Header
    Show-SectionHeader "Backend API - Start"

    if (-not (Test-Path $BACKEND_DIR)) {
        Write-Fail "backend/ directory not found at: $BACKEND_DIR"
        Pause-Screen; return
    }
    if (-not (Test-Command "node")) {
        Write-Fail "Node.js not found. Install from https://nodejs.org"
        Pause-Screen; return
    }

    # Install deps if needed
    $nm = Join-Path $BACKEND_DIR "node_modules"
    if (-not (Test-Path $nm)) {
        Write-Step "Installing backend dependencies..."
        Push-Location $BACKEND_DIR
        npm install --silent
        Pop-Location
        Write-OK "Dependencies installed."
    }

    # Verify .env
    $envFile = Join-Path $BACKEND_DIR ".env"
    if (-not (Test-Path $envFile)) {
        Write-Warn ".env not found - creating default..."
        "PORT=5000`nJWT_SECRET=desksos-super-secret-jwt-key-change-in-production" |
            Set-Content $envFile -Encoding UTF8
        Write-OK ".env created (update JWT_SECRET before production use)."
    } else {
        Write-OK ".env found."
    }

    # Stop any existing backend job/process cleanly before starting
    $existingJob = Get-Job -Name "Backend" -ErrorAction SilentlyContinue
    if ($existingJob) {
        Write-Warn "Existing Backend job found (ID $($existingJob.Id), state: $($existingJob.State)) - stopping it..."
        Stop-Job  $existingJob -ErrorAction SilentlyContinue
        Remove-Job $existingJob -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }

    # Kill any node process still holding port 5000
    $portOwner = netstat -ano 2>$null | Select-String ":5000 " | ForEach-Object {
        ($_ -split "\s+")[-1]
    } | Select-Object -First 1
    if ($portOwner -and $portOwner -match "^\d+$") {
        $nodeProc = Get-Process -Id $portOwner -ErrorAction SilentlyContinue
        if ($nodeProc -and $nodeProc.Name -like "node*") {
            Write-Warn "Killing stale node process (PID $portOwner) on port 5000..."
            Stop-Process -Id $portOwner -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        } elseif ($portOwner -ne "0") {
            Write-Warn "Port 5000 is held by PID $portOwner ($($nodeProc.Name)) - not a node process. Aborting."
            Pause-Screen; return
        }
    }

    Write-Step "Starting backend API in background..."
    $backendDir = $BACKEND_DIR
    $job = Start-Job -Name "Backend" -ScriptBlock {
        param($dir)
        Set-Location $dir
        node server.js 2>&1
    } -ArgumentList $backendDir

    Start-Sleep -Seconds 3

    # Re-check port to confirm server actually bound
    $portBound = (netstat -ano 2>$null | Select-String ":5000 ") -ne $null
    if ($portBound) {
        Write-OK "Backend started (Job ID: $($job.Id)) on port 5000."
    } else {
        Write-Fail "Backend failed to bind to port 5000."
        Write-Host ""
        Write-Info "Job output:"
        Receive-Job $job -ErrorAction SilentlyContinue | ForEach-Object { Write-Info $_ }
        Remove-Job $job -Force -ErrorAction SilentlyContinue
        Pause-Screen; return
    }

    Write-Host ""
    Write-Info "Seeded credentials:"
    Write-Info "  admin@desksos.com / password123"
    Write-Info "  tech@desksos.com  / password123"
    Write-Info ""
    Write-Info "Stop with:  Stop-Job -Name Backend; Remove-Job -Name Backend"

    Pause-Screen
}

# ---- Backend: Status ---------------------------------------------------------
function Show-BackendStatus {
    Show-Header
    Show-SectionHeader "Backend API - Status"

    $portUp = (Test-NetConnection -ComputerName localhost -Port 5000 -InformationLevel Quiet -WarningAction SilentlyContinue)
    if ($portUp) {
        Write-OK "Backend reachable on port 5000."
    } else {
        Write-Warn "Port 5000 not responding - backend may not be running. Use option [4] to start it."
    }

    # Show running jobs
    $jobs = Get-Job -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Running" }
    if ($jobs) {
        Write-Host ""
        Write-Info "Active PowerShell background jobs:"
        $jobs | Format-Table Id, Name, State -AutoSize | Out-String | ForEach-Object { Write-Info $_ }
    }

    # Test key endpoints
    Write-Host ""
    Write-Step "Testing API endpoints..."
    $endpoints = @(
        "http://localhost:5000/dashboard/queue",
        "http://localhost:5000/chat/channels",
        "http://localhost:5000/assets/AST-001"
    )
    foreach ($ep in $endpoints) {
        try {
            $r = Invoke-WebRequest $ep -TimeoutSec 3 -ErrorAction Stop
            Write-OK "$ep  [$($r.StatusCode)]"
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
            if ($code -eq 401) {
                Write-OK "$ep  [401 - JWT required]"
            } else {
                Write-Fail "$ep  [$code]"
            }
        }
    }

    Pause-Screen
}

# ---- Mobile: Setup -----------------------------------------------------------
function Invoke-MobileSetup {
    Show-Header
    Show-SectionHeader "Mobile App - Setup and Build"

    if (-not (Test-Path $MOBILE_DIR)) {
        Write-Fail "DeskSOSMobile/ not found at: $MOBILE_DIR"
        Pause-Screen; return
    }
    if (-not (Test-Command "node")) {
        Write-Fail "Node.js not found."
        Pause-Screen; return
    }

    # Install deps
    Write-Step "Installing mobile dependencies..."
    Push-Location $MOBILE_DIR
    npm install --silent
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed."; Pop-Location; Pause-Screen; return }
    Write-OK "Dependencies installed."

    # Android SDK check
    $androidHome = $env:ANDROID_HOME
    if (-not $androidHome) { $androidHome = "$env:LOCALAPPDATA\Android\Sdk" }
    if (Test-Path $androidHome) {
        $env:ANDROID_HOME = $androidHome
        Write-OK "Android SDK: $androidHome"
    } else {
        Write-Warn "ANDROID_HOME not set. Android builds require Android Studio."
        Write-Info "Install from: https://developer.android.com/studio"
    }

    Write-Host ""
    Write-Host "  Choose build target:" -ForegroundColor White
    Write-Host "    [1] Android (emulator / device)"
    Write-Host "    [2] Start Metro bundler only"
    Write-Host "    [3] Back"
    Write-Host ""
    $choice = Read-Host "  Choice"
    switch ($choice) {
        "1" {
            Write-Step "Launching Android build in new window..."
            Write-Info "Ensure an emulator is running or a device is connected via USB."
            $mobileDir   = $MOBILE_DIR
            $androidSdk  = $androidHome
            Start-Process powershell -ArgumentList "-NoExit", "-Command",
                "Set-Location '$mobileDir'; `$env:ANDROID_HOME='$androidSdk'; npm run android"
            Write-OK "Android build launched."
        }
        "2" {
            Write-Step "Starting Metro bundler on port 8081..."
            $mobileDir = $MOBILE_DIR
            Start-Process powershell -ArgumentList "-NoExit", "-Command",
                "Set-Location '$mobileDir'; npx react-native start --port 8081"
            Write-OK "Metro launched in new window."
        }
    }
    Pop-Location
    Pause-Screen
}

# ---- Verify All --------------------------------------------------------------
function Invoke-VerifyAll {
    Show-Header
    Show-SectionHeader "Full System Verification"

    $results = [System.Collections.Generic.List[PSCustomObject]]::new()

    # Desktop app
    $exePath = "C:\Program Files\DeskSOS\DeskSOS.exe"
    if (Test-Path $exePath) {
        $fi = Get-Item $exePath
        Write-OK "Desktop app installed  ($([math]::Round($fi.Length/1MB,2)) MB)"
        $results.Add([PSCustomObject]@{ Component="Desktop App"; Status="INSTALLED" })
    } else {
        Write-Warn "Desktop app not found at $exePath"
        $results.Add([PSCustomObject]@{ Component="Desktop App"; Status="NOT FOUND" })
    }

    # Desktop running
    $proc = Get-Process -Name "desksos" -ErrorAction SilentlyContinue
    if ($proc) {
        Write-OK "Desktop app running  (PID $($proc.Id), $([math]::Round($proc.WorkingSet64/1MB,1)) MB RAM)"
        $results.Add([PSCustomObject]@{ Component="Desktop Process"; Status="RUNNING" })
    } else {
        Write-Info "Desktop app not currently running (normal)"
        $results.Add([PSCustomObject]@{ Component="Desktop Process"; Status="IDLE" })
    }

    # Registry
    $reg = Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" `
               -ErrorAction SilentlyContinue |
           Where-Object { $_.DisplayName -like "*DeskSOS*" } |
           Select-Object -First 1
    if ($reg) {
        Write-OK "Registry entry: $($reg.DisplayName) $($reg.DisplayVersion)"
        $results.Add([PSCustomObject]@{ Component="Registry"; Status="PRESENT" })
    } else {
        Write-Warn "Registry entry not found (portable install?)"
        $results.Add([PSCustomObject]@{ Component="Registry"; Status="MISSING" })
    }

    # Backend API
    try {
        $r = Invoke-WebRequest "http://localhost:5000/dashboard/queue" -TimeoutSec 3 -ErrorAction Stop
        Write-OK "Backend API on port 5000  [$($r.StatusCode)]"
        $results.Add([PSCustomObject]@{ Component="Backend API"; Status="RUNNING" })
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 401) {
            Write-OK "Backend API on port 5000 - auth required [401]"
            $results.Add([PSCustomObject]@{ Component="Backend API"; Status="RUNNING" })
        } else {
            Write-Warn "Backend API not reachable on port 5000"
            $results.Add([PSCustomObject]@{ Component="Backend API"; Status="OFFLINE" })
        }
    }

    # Mobile project
    $mobilePkg = Join-Path $MOBILE_DIR "package.json"
    if (Test-Path $mobilePkg) {
        $nm   = Join-Path $MOBILE_DIR "node_modules"
        $deps = if (Test-Path $nm) { "deps installed" } else { "run npm install" }
        Write-OK "Mobile project found  ($deps)"
        $results.Add([PSCustomObject]@{ Component="Mobile App"; Status="PRESENT" })
    } else {
        Write-Fail "Mobile project not found at $MOBILE_DIR"
        $results.Add([PSCustomObject]@{ Component="Mobile App"; Status="NOT FOUND" })
    }

    # Admin check
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
                [Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin) {
        Write-OK "Running as Administrator"
        $results.Add([PSCustomObject]@{ Component="Admin Rights"; Status="YES" })
    } else {
        Write-Warn "Standard user - some desktop features limited"
        $results.Add([PSCustomObject]@{ Component="Admin Rights"; Status="NO" })
    }

    Show-SectionHeader "Summary"
    $results | Format-Table Component, Status -AutoSize | Out-String | ForEach-Object { Write-Host "  $_" }

    Write-Host "  System:" -ForegroundColor Gray
    Write-Info "  Computer : $env:COMPUTERNAME"
    Write-Info "  User     : $env:USERNAME"
    Write-Info "  OS       : $((Get-CimInstance Win32_OperatingSystem).Caption)"
    Write-Info "  Build    : $((Get-CimInstance Win32_OperatingSystem).BuildNumber)"

    Pause-Screen
}

# ---- Enterprise Deploy -------------------------------------------------------
function Show-EnterpriseDeploy {
    Show-Header
    Show-SectionHeader "Enterprise Deployment (GPO)"

    Write-Host "  The deployment-package/ folder contains:" -ForegroundColor White
    Write-Host ""
    Write-Host "    GPO-Deployment.ps1      - Domain-wide MSI rollout via Group Policy"
    Write-Host "    Manual-Deployment.ps1   - Silent install on a single machine"
    Write-Host "    Verify-Installation.ps1 - Post-install health check"
    Write-Host "    Uninstall.ps1           - Silent removal"
    Write-Host ""
    Write-Host "  Quick reference:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "    # Single machine (run as Administrator):"
    Write-Host "    cd `"$DEPLOY_DIR`""                                        -ForegroundColor Gray
    Write-Host "    .\Manual-Deployment.ps1"                                   -ForegroundColor Gray
    Write-Host ""
    Write-Host "    # Domain-wide GPO rollout:"
    Write-Host "    .\GPO-Deployment.ps1 \"                                    -ForegroundColor Gray
    Write-Host "        -NetworkSharePath '\\DC01\Software`$\DeskSOS' \"      -ForegroundColor Gray
    Write-Host "        -OUPath 'OU=IT Support,DC=contoso,DC=com'"            -ForegroundColor Gray
    Write-Host ""
    Write-Host "    # Verify after deployment:"
    Write-Host "    .\Verify-Installation.ps1"                                 -ForegroundColor Gray

    Pause-Screen
}

# ---- Main Menu ---------------------------------------------------------------
function Show-MainMenu {
    Show-Header

    Write-Host "  DESKTOP APP" -ForegroundColor White
    Write-Host "    [1]  Check prerequisites"
    Write-Host "    [2]  Build desktop app  (Rust + Tauri)"
    Write-Host "    [3]  Install desktop app"
    Write-Host ""
    Write-Host "  BACKEND API" -ForegroundColor White
    Write-Host "    [4]  Start backend API  (port 5000)"
    Write-Host "    [5]  Show backend status and test endpoints"
    Write-Host ""
    Write-Host "  MOBILE APP" -ForegroundColor White
    Write-Host "    [6]  Setup and build mobile app  (Android / Metro)"
    Write-Host ""
    Write-Host "  SYSTEM" -ForegroundColor White
    Write-Host "    [7]  Verify full installation"
    Write-Host "    [8]  Enterprise / GPO deployment guide"
    Write-Host "    [Q]  Quit"
    Write-Host ""
}

# ---- Entry Point -------------------------------------------------------------
do {
    Show-MainMenu
    $choice = Read-Host "  Select option"
    switch ($choice.ToUpper()) {
        "1" { Show-PrereqCheck }
        "2" { Invoke-DesktopBuild }
        "3" { Invoke-DesktopInstall }
        "4" { Invoke-BackendStart }
        "5" { Show-BackendStatus }
        "6" { Invoke-MobileSetup }
        "7" { Invoke-VerifyAll }
        "8" { Show-EnterpriseDeploy }
        "Q" {
            Show-Header
            Write-Host "  Goodbye." -ForegroundColor Cyan
            Write-Host ""
            break
        }
        default {
            Write-Host "  Invalid option. Try again." -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
} while ($choice.ToUpper() -ne "Q")
