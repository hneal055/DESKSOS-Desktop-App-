$ErrorActionPreference = "Stop"

$APP_NAME    = "DeskSOS"
$APP_VERSION = "1.0.0"
$ROOT        = Split-Path -Parent $MyInvocation.MyCommand.Path
$BUNDLE_DIR  = Join-Path $ROOT "src-tauri\target\release\bundle"
$NSIS_EXE    = Join-Path $BUNDLE_DIR "nsis\DeskSOS_${APP_VERSION}_x64-setup.exe"
$MSI_FILE    = Join-Path $BUNDLE_DIR "msi\DeskSOS_${APP_VERSION}_x64_en-US.msi"

function Write-Header {
    Clear-Host
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "   $APP_NAME  v$APP_VERSION  -  Installer"  -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step([string]$msg)  { Write-Host "  >> $msg" -ForegroundColor Yellow }
function Write-OK([string]$msg)    { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Fail([string]$msg)  { Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Write-Info([string]$msg)  { Write-Host "  $msg" -ForegroundColor Gray }

Write-Header

# ── 1. Choose installer type ────────────────────────────────────────────────
$hasNsis = Test-Path $NSIS_EXE
$hasMsi  = Test-Path $MSI_FILE

if (-not $hasNsis -and -not $hasMsi) {
    Write-Step "No pre-built installer found. Building now..."
    Write-Info "This requires Node.js and Rust to be installed."
    Write-Host ""

    # Check Node.js
    $nodeCheck = node --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Node.js is not installed."
        Write-Info "Download from: https://nodejs.org"
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-OK "Node.js: $nodeCheck"

    # Check Rust/Cargo
    $cargoCheck = cargo --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Rust/Cargo is not installed."
        Write-Info "Install from: https://rustup.rs"
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-OK "Cargo: $cargoCheck"

    # Install npm dependencies
    Write-Step "Installing npm dependencies..."
    Set-Location $ROOT
    npm install --silent
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm install failed."
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-OK "Dependencies installed."

    # Build
    Write-Step "Building $APP_NAME (this takes several minutes)..."
    npm run tauri:build
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Build failed. Check output above."
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-OK "Build complete."

    # Re-check for installer
    $hasNsis = Test-Path $NSIS_EXE
    $hasMsi  = Test-Path $MSI_FILE
}

# ── 2. Pick installer ────────────────────────────────────────────────────────
Write-Header

if ($hasNsis) {
    Write-OK "Found installer: $(Split-Path -Leaf $NSIS_EXE)"
    $installer = $NSIS_EXE
    $installerType = "NSIS (.exe)"
} elseif ($hasMsi) {
    Write-OK "Found installer: $(Split-Path -Leaf $MSI_FILE)"
    $installer = $MSI_FILE
    $installerType = "MSI"
} else {
    Write-Fail "No installer found after build. Something went wrong."
    Read-Host "Press Enter to exit"
    exit 1
}

# ── 3. Offer choice if both exist ───────────────────────────────────────────
if ($hasNsis -and $hasMsi) {
    Write-Host ""
    Write-Host "  Two installer formats are available:" -ForegroundColor White
    Write-Host "    [1] NSIS Setup (.exe)  - Recommended, includes uninstaller" -ForegroundColor White
    Write-Host "    [2] MSI Package        - For enterprise/Group Policy deployments" -ForegroundColor White
    Write-Host ""
    $choice = Read-Host "  Choose installer [1/2] (default: 1)"
    if ($choice -eq "2") {
        $installer = $MSI_FILE
        $installerType = "MSI"
    } else {
        $installer = $NSIS_EXE
        $installerType = "NSIS (.exe)"
    }
}

# ── 4. Run installer ─────────────────────────────────────────────────────────
Write-Host ""
Write-Step "Launching $installerType installer..."
Write-Info "Follow the on-screen prompts to complete installation."
Write-Host ""

try {
    if ($installerType -eq "MSI") {
        Start-Process msiexec.exe -ArgumentList "/i `"$installer`" /qb" -Wait
    } else {
        Start-Process -FilePath $installer -Wait
    }
} catch {
    Write-Fail "Installer failed to launch: $_"
    Read-Host "Press Enter to exit"
    exit 1
}

# ── 5. Done ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Info "$APP_NAME is now installed on this machine."
Write-Info "Launch it from the Start Menu or Desktop shortcut."
Write-Host ""

$launch = Read-Host "Launch DeskSOS now? (Y/n)"
if ($launch -ne "n" -and $launch -ne "N") {
    $exePath = "$env:LOCALAPPDATA\$APP_NAME\$APP_NAME.exe"
    if (Test-Path $exePath) {
        Start-Process $exePath
    } else {
        Write-Info "Could not find installed executable. Launch from Start Menu."
    }
}
