<#
.SYNOPSIS
    One-time setup for an office PC: trusts the two DeskSOS certificates.

.DESCRIPTION
    Run once per PC, as administrator, from the release folder that also holds
    desksos-ca.crt and desksos-codesign.cer (built by build-release.ps1).

      desksos-ca.crt        DeskSOS server CA -> Trusted Root Certification Authorities
                            (the Enterprise dashboard and the Desktop app's HTTPS)
      desksos-codesign.cer  DeskSOS code signing -> Trusted Root + Trusted Publishers
                            (the installer and app show "DeskSOS" as a verified publisher)

    Both files are PUBLIC certificates; no private keys are involved.

    Before changing anything it shows both fingerprints and asks you to confirm
    they match the ones published in docs/OPERATIONS.md section 6.3 on GitHub
    (an independent source: a tampered USB stick or share can't change those).
    This script is itself signed by DeskSOS; check that first (section 6.3).

    Running it again is harmless. Works in Windows PowerShell 5.1 and 7.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\Trust-DeskSOS.ps1           # install (asks to confirm)
    powershell -ExecutionPolicy Bypass -File .\Trust-DeskSOS.ps1 -Check    # report only
    powershell -ExecutionPolicy Bypass -File .\Trust-DeskSOS.ps1 -Remove   # undo (machine and this user)
#>
param([switch]$Check, [switch]$Remove, [switch]$Yes)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$items = @(
    @{ File = 'desksos-ca.crt';       Stores = @('Root');                   Label = 'DeskSOS server CA' },
    @{ File = 'desksos-codesign.cer'; Stores = @('Root', 'TrustedPublisher'); Label = 'DeskSOS code signing' }
)

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $Check -and -not $admin) {
    Write-Host "Run this from an Administrator PowerShell window (right-click PowerShell -> Run as administrator)." -ForegroundColor Red
    exit 1
}

function Test-InStore($Cert, [string]$StoreName, [string]$Location) {
    $st = New-Object Security.Cryptography.X509Certificates.X509Store $StoreName, $Location
    $st.Open('ReadOnly')
    try { return @($st.Certificates.Find('FindByThumbprint', $Cert.Thumbprint, $false)).Count -gt 0 } finally { $st.Close() }
}

# Load both certificates first, so the fingerprints can be confirmed up front
foreach ($i in $items) {
    $path = Join-Path $here $i.File
    if (-not (Test-Path $path)) { Write-Host "Missing $($i.File) next to this script." -ForegroundColor Red; exit 1 }
    $i.Cert = New-Object Security.Cryptography.X509Certificates.X509Certificate2 $path
}

if (-not $Check -and -not $Remove -and -not $Yes) {
    Write-Host "About to trust these certificates on this PC:" -ForegroundColor Cyan
    foreach ($i in $items) { Write-Host ("  {0,-22} {1}" -f $i.Label, $i.Cert.Thumbprint) }
    Write-Host "Compare them with the fingerprints in docs/OPERATIONS.md section 6.3 (on GitHub, not this folder)."
    $answer = Read-Host "Do they match? Type YES to continue"
    if ($answer -ne 'YES') { Write-Host "Nothing was changed." -ForegroundColor Yellow; exit 1 }
}

$allMachine = $true; $anyUserOnly = $false
foreach ($i in $items) {
    $cert = $i.Cert
    Write-Host ("{0}: {1}" -f $i.Label, $cert.Thumbprint) -ForegroundColor Cyan
    foreach ($s in $i.Stores) {
        $inMachine = Test-InStore $cert $s 'LocalMachine'
        $inUser = Test-InStore $cert $s 'CurrentUser'
        if ($Check) {
            if ($inMachine) { Write-Host "  ${s}: trusted (all users)" -ForegroundColor Green }
            elseif ($inUser) { Write-Host "  ${s}: trusted for THIS USER ONLY (other accounts on this PC aren't)" -ForegroundColor Yellow; $anyUserOnly = $true; $allMachine = $false }
            else { Write-Host "  ${s}: NOT trusted" -ForegroundColor Yellow; $allMachine = $false }
            continue
        }
        if ($Remove) {
            foreach ($loc in 'LocalMachine', 'CurrentUser') {
                if (Test-InStore $cert $s $loc) {
                    $st = New-Object Security.Cryptography.X509Certificates.X509Store $s, $loc
                    $st.Open('ReadWrite')
                    try { $st.Remove($cert); Write-Host "  removed from $loc\$s" } finally { $st.Close() }
                }
            }
            continue
        }
        if ($inMachine) { Write-Host "  ${s}: already trusted" -ForegroundColor Green; continue }
        $st = New-Object Security.Cryptography.X509Certificates.X509Store $s, 'LocalMachine'
        $st.Open('ReadWrite')
        try { $st.Add($cert); Write-Host "  ${s}: added" -ForegroundColor Green } finally { $st.Close() }
    }
}

if ($Remove) {
    $left = @($items | ForEach-Object { $c = $_.Cert; $_.Stores | Where-Object { (Test-InStore $c $_ 'LocalMachine') -or (Test-InStore $c $_ 'CurrentUser') } })
    if ($left.Count) { Write-Host "`nSome copies remain (Windows may have asked to confirm removing a user certificate). Run again to retry." -ForegroundColor Yellow; exit 1 }
    Write-Host "`nDone: DeskSOS is no longer trusted for this user or for the PC. Other user accounts may have their own copies. Restart the browser."
    exit 0
}
if ($Check) {
    if ($allMachine) { Write-Host "`nThis PC trusts DeskSOS for all users." -ForegroundColor Green; exit 0 }
    if ($anyUserOnly) { Write-Host "`nTrusted for this user only. Run without -Check, as administrator, to trust it for every user." -ForegroundColor Yellow }
    else { Write-Host "`nRun without -Check, as administrator, to fix." -ForegroundColor Yellow }
    exit 1
}
Write-Host "`nDone. Close every browser window (including the tray icon) before opening https://FORD-DC01:5543, then run the DeskSOS setup .exe." -ForegroundColor Green
