#Requires -Version 7
<#
.SYNOPSIS
    Builds a signed DeskSOS release and puts everything an office PC needs in
    one folder: release\DeskSOS-<version>\ at the repository root.

.DESCRIPTION
    1. Finds the code-signing certificate ("DeskSOS Internal Code Signing") in
       the current user's certificate store. Its private key never leaves this
       PC (it was created non-exportable). Decision D4, revised 2026-10-07.
    2. Installs packages if package-lock.json changed, then runs `tauri build`
       with signing switched on for this build only (nothing machine-specific
       is committed to tauri.conf.json, so CI and other PCs are unaffected).
    3. Checks that the installers and the app are signed with that certificate
       and timestamped.
    4. Copies into release\DeskSOS-<version>\:
         DeskSOS_<v>_x64-setup.exe      recommended installer (installs WebView2 if missing)
         DeskSOS_<v>_x64_en-US.msi      for scripted deployment
         desksos-ca.crt                 DeskSOS server CA (public), from Enterprise
         desksos-codesign.cer           this signing certificate (public)
         Trust-DeskSOS.ps1              one-time setup per PC (run as administrator)
         SHA256SUMS.txt                 checksums of everything above

    Release builds talk to https://FORD-DC01:5443 (tauri-app/.env.production).
    Raise "version" in src-tauri/tauri.conf.json before each release.

.EXAMPLE
    pwsh tauri-app\scripts\build-release.ps1
    pwsh tauri-app\scripts\build-release.ps1 -NoTimestamp   # offline build
#>
param(
    [string]$CertSubject = "CN=DeskSOS Internal Code Signing, O=DeskSOS, OU=FORD-DC01",
    [string]$TimestampUrl = "http://timestamp.digicert.com",
    [switch]$NoTimestamp,
    [string]$CaCert = "C:\Projects\DESKSOS\backend\server\certs\desksos-ca.crt",
    # Re-check and re-package the last build without compiling again
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$app = (Resolve-Path "$PSScriptRoot\..").Path            # tauri-app
$repo = (Resolve-Path "$app\..").Path
function Fail([string]$m) { Write-Host "FAILED: $m" -ForegroundColor Red; exit 1 }
function Step([string]$m) { Write-Host "`n== $m" -ForegroundColor Cyan }

Step "Signing certificate"
$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -eq $CertSubject -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) } |
    Sort-Object NotAfter -Descending | Select-Object -First 1
if (-not $cert) { Fail "no valid '$CertSubject' certificate with a private key in Cert:\CurrentUser\My (see docs/OPERATIONS.md §6.2)" }
Write-Host "  $($cert.Thumbprint), expires $($cert.NotAfter.ToString('yyyy-MM-dd'))"
if (-not (Test-Path $CaCert)) { Fail "DeskSOS CA certificate not found at $CaCert" }

$conf = Get-Content (Join-Path $app 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json
$version = $conf.version
Write-Host "  Version: $version"

if ($SkipBuild) { Write-Host "`n== Build skipped (-SkipBuild): checking and packaging the last build" -ForegroundColor Cyan }
else {
Step "Packages"
Push-Location $app
try {
    $installed = 'node_modules\.package-lock.json'
    if (-not (Test-Path $installed) -or (Get-Item package-lock.json).LastWriteTime -gt (Get-Item $installed).LastWriteTime) {
        npm ci; if ($LASTEXITCODE) { Fail "npm ci" }
    } else { Write-Host "  Up to date" }

    Step "Build and sign (this takes several minutes)"
    $windows = @{ certificateThumbprint = $cert.Thumbprint; digestAlgorithm = 'sha256' }
    if (-not $NoTimestamp) { $windows.timestampUrl = $TimestampUrl }
    $override = @{ bundle = @{ windows = $windows } } | ConvertTo-Json -Depth 5 -Compress
    $overrideFile = Join-Path $env:TEMP "desksos-sign-$PID.json"
    Set-Content $overrideFile $override -Encoding utf8NoBOM
    try {
        npx tauri build --config $overrideFile
        if ($LASTEXITCODE) { Fail "tauri build" }
    } finally { Remove-Item $overrideFile -ErrorAction SilentlyContinue }
} finally { Pop-Location }
}

Step "Verify signatures"
$bundle = Join-Path $app 'src-tauri\target\release\bundle'
$files = @(
    (Join-Path $bundle "nsis\DeskSOS_${version}_x64-setup.exe"),
    (Join-Path $bundle "msi\DeskSOS_${version}_x64_en-US.msi")
)
foreach ($f in $files) { if (-not (Test-Path $f)) { Fail "missing build output $f" } }
# Tauri signs the app binary just before packing it into each installer, then
# restores the unsigned original in target\release. So check the copy that's
# actually installed: unpack the MSI (an administrative image, no install).
$unpacked = Join-Path $env:TEMP "desksos-msi-check-$PID"
try {
    $p = Start-Process msiexec.exe -ArgumentList '/a', "`"$($files[1])`"", '/qn', "TARGETDIR=`"$unpacked`"" -Wait -PassThru
    if ($p.ExitCode -ne 0) { Fail "couldn't unpack the MSI to check it (msiexec exit $($p.ExitCode))" }
    $inner = Get-ChildItem $unpacked -Recurse -Filter 'desksos.exe' | Select-Object -First 1
    if (-not $inner) { Fail "desksos.exe not found inside the MSI" }
    $innerCopy = Join-Path $env:TEMP "desksos-installed-$PID.exe"
    Copy-Item $inner.FullName $innerCopy
    $checkFiles = $files + $innerCopy
} finally { Remove-Item $unpacked -Recurse -Force -ErrorAction SilentlyContinue }
# A signature passes only if it's Valid, or if the one problem is that the
# self-made certificate isn't a trusted root on this build PC. That case is
# proven separately: the signer must chain to exactly our certificate when
# it's supplied as the only extra trust anchor (revocation not checked).
function Test-DeskSOSSignature([string]$Path) {
    $sig = Get-AuthenticodeSignature $Path
    $name = Split-Path $Path -Leaf
    if (-not $sig.SignerCertificate -or $sig.SignerCertificate.Thumbprint -ne $cert.Thumbprint) { Fail "$name is not signed with the DeskSOS certificate ($($sig.Status))" }
    if ($sig.Status -ne 'Valid') {
        if ($sig.Status -ne 'UnknownError') { Fail "${name}: signature status $($sig.Status): $($sig.StatusMessage)" }
        $chain = [Security.Cryptography.X509Certificates.X509Chain]::new()
        $chain.ChainPolicy.RevocationMode = 'NoCheck'
        $chain.ChainPolicy.VerificationFlags = 'AllowUnknownCertificateAuthority'
        [void]$chain.ChainPolicy.ExtraStore.Add($cert)
        $built = $chain.Build($sig.SignerCertificate)
        $root = $chain.ChainElements[$chain.ChainElements.Count - 1].Certificate
        $onlyUntrusted = @($chain.ChainStatus | Where-Object { $_.Status -ne 'UntrustedRoot' }).Count -eq 0
        if (-not ($built -and $onlyUntrusted -and $root.Thumbprint -eq $cert.Thumbprint)) {
            Fail "${name}: signature isn't valid ($($sig.StatusMessage); chain: $(($chain.ChainStatus | ForEach-Object Status) -join ', '))"
        }
    }
    if (-not $NoTimestamp -and -not $sig.TimeStamperCertificate) { Fail "$name is not timestamped" }
    return $sig
}

foreach ($f in $checkFiles) {
    if (-not (Test-Path $f)) { Fail "missing build output $f" }
    $sig = Test-DeskSOSSignature $f
    $label = if ($f -eq $innerCopy) { 'desksos.exe (installed app, from the MSI)' } else { Split-Path $f -Leaf }
    Write-Host ("  {0}: signed by DeskSOS{1}" -f $label, $(if ($sig.TimeStamperCertificate) { ", timestamped" } else { "" }))
}
Remove-Item $innerCopy -ErrorAction SilentlyContinue

Step "Release folder"
$out = Join-Path $repo "release\DeskSOS-$version"
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory $out | Out-Null
Copy-Item $files[0], $files[1] $out
Copy-Item $CaCert (Join-Path $out 'desksos-ca.crt')
Export-Certificate -Cert $cert -FilePath (Join-Path $out 'desksos-codesign.cer') -Type CERT | Out-Null
Copy-Item (Join-Path $repo 'deployment-package\Trust-DeskSOS.ps1') $out
# Sign the trust script too, so a PC can check who made it before running it
# as administrator (compare the signer with the fingerprint in the runbook)
$trustScript = Join-Path $out 'Trust-DeskSOS.ps1'
$tsArgs = @{ FilePath = $trustScript; Certificate = $cert; HashAlgorithm = 'SHA256' }
if (-not $NoTimestamp) { $tsArgs.TimestampServer = $TimestampUrl }
$null = Set-AuthenticodeSignature @tsArgs
$null = Test-DeskSOSSignature $trustScript
Write-Host "  Trust-DeskSOS.ps1: signed by DeskSOS$(if (-not $NoTimestamp) { ', timestamped' })"
Get-ChildItem $out -File | Where-Object Name -ne 'SHA256SUMS.txt' | ForEach-Object {
    "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.Name
} | Set-Content (Join-Path $out 'SHA256SUMS.txt') -Encoding ascii

Write-Host "`nRelease ready: $out" -ForegroundColor Green
Get-ChildItem $out | Format-Table Name, @{ n = 'Size (MB)'; e = { [math]::Round($_.Length / 1MB, 2) } } -AutoSize
Write-Host "Per PC: copy the folder, run Trust-DeskSOS.ps1 as administrator once, then the setup .exe."
Write-Host "Fingerprints to check on each PC (also in docs/OPERATIONS.md section 6.3):"
Write-Host ("  DeskSOS server CA:    {0}" -f ([Security.Cryptography.X509Certificates.X509Certificate2]::new($CaCert)).Thumbprint)
Write-Host ("  DeskSOS code signing: {0}" -f $cert.Thumbprint)
