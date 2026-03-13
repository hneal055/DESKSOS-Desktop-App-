<#
.SYNOPSIS
    Installs the DeskSOS RemoteSession module into any compatible Tauri + React project.

.DESCRIPTION
    Copies RemoteSession.tsx, adds socket.io-client to package.json, and patches
    App.tsx (import + modules array entry) so the 📡 Remote tab appears in the sidebar.

.PARAMETER TargetProject
    Absolute path to the root of the target Tauri + React project.

.EXAMPLE
    .\Add-RemoteSession.ps1 -TargetProject "C:\Projects\MyOtherApp"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$TargetProject
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─── Paths ────────────────────────────────────────────────────────────────────
$ScriptDir      = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceRoot     = Split-Path -Parent $ScriptDir         # tauri-app/
$SourceTsx      = Join-Path $SourceRoot "src\components\modules\RemoteSession.tsx"

$TargetModules  = Join-Path $TargetProject "src\components\modules"
$TargetAppTsx   = Join-Path $TargetProject "src\App.tsx"
$TargetPkg      = Join-Path $TargetProject "package.json"

# ─── Validation ───────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "DeskSOS  →  Add-RemoteSession" -ForegroundColor Cyan
Write-Host "Target : $TargetProject" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path $TargetProject)) {
    Write-Error "Target project not found: $TargetProject"
    exit 1
}
foreach ($required in @($TargetModules, $TargetAppTsx, $TargetPkg)) {
    if (-not (Test-Path $required)) {
        Write-Error "Required path missing in target project:`n  $required`nIs this a Tauri + React app?"
        exit 1
    }
}
if (-not (Test-Path $SourceTsx)) {
    Write-Error "Source file not found: $SourceTsx`nRun this script from inside the DeskSOS tauri-app/scripts/ folder."
    exit 1
}

# ─── 1. Copy RemoteSession.tsx ────────────────────────────────────────────────
$DestTsx = Join-Path $TargetModules "RemoteSession.tsx"
if (Test-Path $DestTsx) {
    Write-Host "[SKIP]  RemoteSession.tsx already exists — not overwriting." -ForegroundColor Yellow
} else {
    Copy-Item $SourceTsx $DestTsx
    Write-Host "[OK]    Copied RemoteSession.tsx → src/components/modules/" -ForegroundColor Green
}

# ─── 2. Patch package.json (add socket.io-client) ────────────────────────────
$pkgRaw  = Get-Content $TargetPkg -Raw
$pkgJson = $pkgRaw | ConvertFrom-Json

$socketVersion = "^4.8.3"
if ($pkgJson.dependencies.PSObject.Properties.Name -contains "socket.io-client") {
    Write-Host "[SKIP]  socket.io-client already in package.json." -ForegroundColor Yellow
} else {
    $pkgJson.dependencies | Add-Member -MemberType NoteProperty -Name "socket.io-client" -Value $socketVersion
    $pkgJson | ConvertTo-Json -Depth 10 | Set-Content $TargetPkg -Encoding UTF8 -NoNewline
    Write-Host "[OK]    Added socket.io-client $socketVersion to package.json" -ForegroundColor Green
}

# ─── 3. Patch App.tsx — import ────────────────────────────────────────────────
$appContent = Get-Content $TargetAppTsx -Raw
$importLine = 'import RemoteSession from "./components/modules/RemoteSession";'

if ($appContent -match [regex]::Escape($importLine)) {
    Write-Host "[SKIP]  RemoteSession import already present in App.tsx." -ForegroundColor Yellow
} else {
    # Insert after the last import statement in the file
    $lastImportMatch = ([regex]'(?m)^import .+;$').Matches($appContent) | Select-Object -Last 1
    if (-not $lastImportMatch) {
        Write-Error "Could not locate any import statement in $TargetAppTsx"
        exit 1
    }
    $insertAt = $lastImportMatch.Index + $lastImportMatch.Length
    $appContent = $appContent.Insert($insertAt, "`nimport RemoteSession from `"./components/modules/RemoteSession`";")
    Write-Host "[OK]    Added RemoteSession import to App.tsx" -ForegroundColor Green
}

# ─── 4. Patch App.tsx — modules array entry ───────────────────────────────────
$moduleEntry   = '{ id: "remote",     name: "📡 Remote",        component: <RemoteSession /> }'
$entryPattern  = [regex]::Escape('component: <RemoteSession />')

if ($appContent -match $entryPattern) {
    Write-Host "[SKIP]  Remote module entry already present in App.tsx modules array." -ForegroundColor Yellow
} else {
    # Find the closing ]; of the modules array and insert the entry before it
    $arrayCloseMatch = ([regex]'(?m)^\s*\];').Matches($appContent) | Select-Object -First 1
    if (-not $arrayCloseMatch) {
        Write-Error "Could not locate the modules array closing ]; in $TargetAppTsx"
        exit 1
    }
    $indent     = "    "
    $newEntry   = "`n${indent}$moduleEntry,"
    $insertAt   = $arrayCloseMatch.Index
    $appContent = $appContent.Insert($insertAt, $newEntry)
    Write-Host "[OK]    Registered '📡 Remote' in modules array in App.tsx" -ForegroundColor Green
}

Set-Content $TargetAppTsx -Value $appContent -Encoding UTF8 -NoNewline

# ─── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "All done. Run the following to finish:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  cd `"$TargetProject`""                   -ForegroundColor White
Write-Host "  npm install"                              -ForegroundColor White
Write-Host "  npm run tauri:build"                      -ForegroundColor White
Write-Host ""
Write-Host "Requirements:" -ForegroundColor Gray
Write-Host "  • Target must be a Tauri + React app with src/components/modules/ and src/App.tsx" -ForegroundColor Gray
Write-Host "  • DeskSOS Enterprise signaling server must be running on port 9000 for Remote to connect" -ForegroundColor Gray
Write-Host ""