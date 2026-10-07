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

    Both files are PUBLIC certificates; no private keys are involved. Running
    it again is harmless. Works in Windows PowerShell 5.1 and PowerShell 7.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\Trust-DeskSOS.ps1           # install
    powershell -ExecutionPolicy Bypass -File .\Trust-DeskSOS.ps1 -Check    # report only
    powershell -ExecutionPolicy Bypass -File .\Trust-DeskSOS.ps1 -Remove   # undo
#>
param([switch]$Check, [switch]$Remove)

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

$allOk = $true
foreach ($i in $items) {
    $path = Join-Path $here $i.File
    if (-not (Test-Path $path)) { Write-Host "Missing $($i.File) next to this script." -ForegroundColor Red; exit 1 }
    $cert = New-Object Security.Cryptography.X509Certificates.X509Certificate2 $path
    Write-Host ("{0}: {1}" -f $i.Label, $cert.Thumbprint) -ForegroundColor Cyan
    foreach ($s in $i.Stores) {
        $store = New-Object Security.Cryptography.X509Certificates.X509Store $s, 'LocalMachine'
        $store.Open($(if ($Check) { 'ReadOnly' } else { 'ReadWrite' }))
        try {
            $present = @($store.Certificates.Find('FindByThumbprint', $cert.Thumbprint, $false)).Count -gt 0
            if ($Remove) {
                if ($present) { $store.Remove($cert); Write-Host "  removed from LocalMachine\$s" } else { Write-Host "  not in LocalMachine\$s" }
            } elseif ($Check) {
                # Also accept the current user's store: mkcert, and the import
                # wizard's "Current User" choice, put certificates there
                $userStore = New-Object Security.Cryptography.X509Certificates.X509Store $s, 'CurrentUser'
                $userStore.Open('ReadOnly')
                try { $inUser = @($userStore.Certificates.Find('FindByThumbprint', $cert.Thumbprint, $false)).Count -gt 0 } finally { $userStore.Close() }
                $state = if ($present) { 'trusted (all users)' } elseif ($inUser) { 'trusted (this user only)' } else { 'NOT trusted' }
                Write-Host ("  {0}: {1}" -f $s, $state) -ForegroundColor $(if ($present -or $inUser) { 'Green' } else { 'Yellow' })
                if (-not ($present -or $inUser)) { $allOk = $false }
            } elseif ($present) {
                Write-Host "  LocalMachine\${s}: already trusted" -ForegroundColor Green
            } else {
                $store.Add($cert); Write-Host "  LocalMachine\${s}: added" -ForegroundColor Green
            }
        } finally { $store.Close() }
    }
}

if ($Remove) { Write-Host "`nDone. Restart the browser." ; exit 0 }
if ($Check) { if ($allOk) { Write-Host "`nThis PC trusts DeskSOS." -ForegroundColor Green; exit 0 } else { Write-Host "`nRun without -Check, as administrator, to fix." -ForegroundColor Yellow; exit 1 } }
Write-Host "`nDone. Close every browser window (including the tray icon) before opening https://FORD-DC01:5543, then run the DeskSOS setup .exe." -ForegroundColor Green
