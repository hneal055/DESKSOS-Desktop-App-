<#
.SYNOPSIS
    Generates a locally-trusted TLS certificate for the DeskSOS backend
    (localhost / 127.0.0.1).

    Preferred path — mkcert (recommended):
      mkcert installs a local CA into the Windows / Firefox / Java trust stores
      so the Tauri WebView and browsers accept the cert without any warning.

        winget install FiloSottile.mkcert     # install mkcert
        cd backend
        pwsh scripts/gen-cert.ps1             # generates trusted cert

    Fallback path (self-signed):
      If mkcert is not found the script falls back to a .NET self-signed cert.
      The Tauri WebView will NOT trust it automatically — use mkcert instead.

.OUTPUTS
    backend/certs/server.crt  (PEM certificate)
    backend/certs/server.key  (PEM private key)
#>
param(
    [string]$OutDir    = "$PSScriptRoot\..\certs",
    [int]   $ValidDays = 825   # Apple / Chrome max accepted validity
)

$OutDir = (New-Item -ItemType Directory -Force $OutDir).FullName

# ── Try mkcert first (locally-trusted cert) ──────────────────────────────────
$mkcert = Get-Command mkcert -ErrorAction SilentlyContinue

if ($mkcert) {
    Write-Host "mkcert found — generating locally-trusted certificate..."
    Write-Host ""

    # Install the local CA into the system trust store (idempotent)
    & mkcert -install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "mkcert -install failed. Try running as Administrator."
        exit 1
    }

    # Generate cert + key for localhost / 127.0.0.1
    Push-Location $OutDir
    & mkcert -cert-file server.crt -key-file server.key localhost 127.0.0.1
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Error "mkcert failed to generate certificate."
        exit 1
    }
    Pop-Location

    Write-Host ""
    Write-Host "Done. Locally-trusted certificate created:"
    Write-Host "  Certificate : $OutDir\server.crt"
    Write-Host "  Private key : $OutDir\server.key"
    Write-Host ""
    Write-Host "Add to backend/.env:"
    Write-Host "  TLS_CERT_PATH=./certs/server.crt"
    Write-Host "  TLS_KEY_PATH=./certs/server.key"
    exit 0
}

# ── Fallback: .NET self-signed cert ──────────────────────────────────────────
Write-Warning "mkcert not found — falling back to a self-signed certificate."
Write-Warning "The Tauri WebView will NOT trust this cert automatically."
Write-Warning ""
Write-Warning "To generate a trusted cert instead, install mkcert:"
Write-Warning "  winget install FiloSottile.mkcert   (Windows Package Manager)"
Write-Warning "  choco install mkcert                (Chocolatey)"
Write-Warning "  scoop install mkcert                (Scoop)"
Write-Warning ""
Write-Warning "Then re-run this script."
Write-Warning ""

$certPath = Join-Path $OutDir "server.crt"
$keyPath  = Join-Path $OutDir "server.key"

Write-Host "Generating self-signed cert for localhost (valid $ValidDays days)..."

$cert = New-SelfSignedCertificate `
    -DnsName "localhost","127.0.0.1" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddDays($ValidDays) `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -KeyUsage DigitalSignature, KeyEncipherment `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1")

# Export certificate (public)
$certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$b64 = [Convert]::ToBase64String($certBytes)
$pem = "-----BEGIN CERTIFICATE-----`n"
for ($i = 0; $i -lt $b64.Length; $i += 64) {
    $pem += $b64.Substring($i, [Math]::Min(64, $b64.Length - $i)) + "`n"
}
$pem += "-----END CERTIFICATE-----"
Set-Content $certPath $pem -Encoding ASCII

# Export private key
$rsa     = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
$keyBytes = $rsa.ExportPkcs8PrivateKey()
$keyB64   = [Convert]::ToBase64String($keyBytes)
$keyPem   = "-----BEGIN PRIVATE KEY-----`n"
for ($i = 0; $i -lt $keyB64.Length; $i += 64) {
    $keyPem += $keyB64.Substring($i, [Math]::Min(64, $keyB64.Length - $i)) + "`n"
}
$keyPem += "-----END PRIVATE KEY-----"
Set-Content $keyPath $keyPem -Encoding ASCII

# Remove from cert store
Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force

Write-Host "  Certificate : $certPath"
Write-Host "  Private key : $keyPath"
Write-Host ""
Write-Host "Add to backend/.env:"
Write-Host "  TLS_CERT_PATH=./certs/server.crt"
Write-Host "  TLS_KEY_PATH=./certs/server.key"
