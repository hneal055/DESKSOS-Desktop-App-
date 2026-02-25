<#
.SYNOPSIS
    Deploy DeskSOS via Group Policy Object (GPO)

.DESCRIPTION
    Creates a GPO to deploy DeskSOS to all computers in specified OU
    Requires Domain Admin privileges

.PARAMETER NetworkSharePath
    UNC path where the MSI installer is stored (e.g., \\DC01\Software$\DeskSOS)

.PARAMETER OUPath
    Distinguished name of the OU to link the GPO (e.g., "OU=IT Support,OU=Workstations,DC=contoso,DC=com")

.PARAMETER GPOName
    Name of the GPO to create (default: "Deploy DeskSOS Toolkit")

.EXAMPLE
    .\GPO-Deployment.ps1 -NetworkSharePath "\\DC01\Software$\DeskSOS" -OUPath "OU=IT Support,OU=Workstations,DC=contoso,DC=com"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$NetworkSharePath,
    
    [Parameter(Mandatory=$true)]
    [string]$OUPath,
    
    [Parameter(Mandatory=$false)]
    [string]$GPOName = "Deploy DeskSOS Toolkit"
)

# Check if running as admin
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This script must be run as Administrator (Domain Admin)"
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DeskSOS GPO Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Copy MSI to network share
Write-Host "[1/5] Copying installer to network share..." -ForegroundColor Yellow
$msiPath = Join-Path $PSScriptRoot "DeskSOS_1.0.0_x64_en-US.msi"
if (-not (Test-Path $msiPath)) {
    Write-Error "MSI installer not found: $msiPath"
    exit 1
}

# Create network share directory if it doesn''t exist
$networkMsiPath = Join-Path $NetworkSharePath "DeskSOS_1.0.0_x64_en-US.msi"
$shareDir = Split-Path $networkMsiPath -Parent
if (-not (Test-Path $shareDir)) {
    New-Item -ItemType Directory -Path $shareDir -Force | Out-Null
    Write-Host "  ✓ Created directory: $shareDir" -ForegroundColor Green
}

Copy-Item $msiPath $networkMsiPath -Force
Write-Host "  ✓ Copied to: $networkMsiPath" -ForegroundColor Green

# Step 2: Import Group Policy module
Write-Host "[2/5] Loading Group Policy module..." -ForegroundColor Yellow
try {
    Import-Module GroupPolicy -ErrorAction Stop
    Write-Host "  ✓ Module loaded" -ForegroundColor Green
} catch {
    Write-Error "Failed to load Group Policy module. Ensure RSAT tools are installed."
    exit 1
}

# Step 3: Create new GPO
Write-Host "[3/5] Creating Group Policy Object..." -ForegroundColor Yellow
try {
    # Check if GPO already exists
    $existingGPO = Get-GPO -Name $GPOName -ErrorAction SilentlyContinue
    if ($existingGPO) {
        Write-Warning "  GPO ''$GPOName'' already exists. Updating..."
        $gpo = $existingGPO
    } else {
        $gpo = New-GPO -Name $GPOName -Comment "Automatic deployment of DeskSOS Desktop Support Toolkit"
        Write-Host "  ✓ Created GPO: $GPOName" -ForegroundColor Green
    }
} catch {
    Write-Error "Failed to create GPO: $_"
    exit 1
}

# Step 4: Configure software installation
Write-Host "[4/5] Configuring software installation policy..." -ForegroundColor Yellow
try {
    # Create registry entry for MSI deployment
    $regPath = "HKLM\Software\Microsoft\Windows\CurrentVersion\Group Policy\AppMgmt\{$($gpo.Id)}"
    
    # Note: Actual GPO software installation requires COM objects or manual configuration
    Write-Warning "  Manual step required:"
    Write-Host "    1. Open Group Policy Management (gpmc.msc)" -ForegroundColor Cyan
    Write-Host "    2. Edit GPO: $GPOName" -ForegroundColor Cyan
    Write-Host "    3. Navigate to: Computer Configuration → Policies → Software Settings → Software Installation" -ForegroundColor Cyan
    Write-Host "    4. Right-click → New → Package" -ForegroundColor Cyan
    Write-Host "    5. Browse to: $networkMsiPath" -ForegroundColor Cyan
    Write-Host "    6. Deployment method: Assigned" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Or run this command to open GPO editor:" -ForegroundColor Yellow
    Write-Host "    Start-Process gpmc.msc -ArgumentList ''/edit:$($gpo.Id)''" -ForegroundColor Gray
    
} catch {
    Write-Warning "Could not fully automate GPO configuration: $_"
}

# Step 5: Link GPO to OU
Write-Host "[5/5] Linking GPO to OU..." -ForegroundColor Yellow
try {
    $existingLink = Get-GPInheritance -Target $OUPath -ErrorAction Stop | 
                    Select-Object -ExpandProperty GpoLinks | 
                    Where-Object { $_.DisplayName -eq $GPOName }
    
    if ($existingLink) {
        Write-Host "  ! GPO already linked to OU" -ForegroundColor Yellow
    } else {
        New-GPLink -Name $GPOName -Target $OUPath -ErrorAction Stop | Out-Null
        Write-Host "  ✓ Linked to: $OUPath" -ForegroundColor Green
    }
} catch {
    Write-Error "Failed to link GPO to OU: $_"
    Write-Error "Please verify OU path: $OUPath"
    exit 1
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deployment Configuration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Complete manual GPO software installation configuration (see above)"
Write-Host "  2. Test GPO on a single workstation: gpupdate /force"
Write-Host "  3. Verify installation: C:\Program Files\DeskSOS\DeskSOS.exe"
Write-Host "  4. Roll out to all workstations (effective on next reboot)"
Write-Host ""
Write-Host "GPO Details:" -ForegroundColor Cyan
Write-Host "  Name: $GPOName"
Write-Host "  ID: $($gpo.Id)"
Write-Host "  Linked to: $OUPath"
Write-Host "  MSI Path: $networkMsiPath"
Write-Host ""
