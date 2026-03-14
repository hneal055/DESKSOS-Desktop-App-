<#
.SYNOPSIS
    Generates a self-signed TLS certificate for DeskSOS backend (localhost).
    Uses .NET — no OpenSSL required.

.OUTPUTS
    backend/certs/server.crt  (PEM certificate)
    backend/certs/server.key  (PEM private key)

.EXAMPLE
    cd backend
    pwsh scripts/gen-cert.ps1
#>
param(
    [string]$OutDir    = "$PSScriptRoot\..\certs",
    [int]   $ValidDays = 825   # Apple / Chrome max accepted validity
)

$OutDir = Resolve-Path -LiteralPath (New-Item -ItemType Directory -Force $OutDir)

Write-Host "Generating self-signed cert for localhost (valid $ValidDays days)..."

# Create the certificate in the Windows cert store (CurrentUser\My) then export
$cert = New-SelfSignedCertificate `
    -DnsName "localhost","127.0.0.1" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddDays($ValidDays) `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -KeyUsage DigitalSignature, KeyEncipherment `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1")  # TLS server auth

# ── Export certificate (public) ───────────────────────────────────────────────
$certPath = Join-Path $OutDir "server.crt"
$certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$b64 = [Convert]::ToBase64String($certBytes)
$pem = "-----BEGIN CERTIFICATE-----`n"
for ($i = 0; $i -lt $b64.Length; $i += 64) {
    $pem += $b64.Substring($i, [Math]::Min(64, $b64.Length - $i)) + "`n"
}
$pem += "-----END CERTIFICATE-----"
Set-Content $certPath $pem -Encoding ASCII
Write-Host "  Certificate: $certPath"

# ── Export private key ────────────────────────────────────────────────────────
$keyPath = Join-Path $OutDir "server.key"
$rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
$keyBytes = $rsa.ExportPkcs8PrivateKey()
$keyB64   = [Convert]::ToBase64String($keyBytes)
$keyPem   = "-----BEGIN PRIVATE KEY-----`n"
for ($i = 0; $i -lt $keyB64.Length; $i += 64) {
    $keyPem += $keyB64.Substring($i, [Math]::Min(64, $keyB64.Length - $i)) + "`n"
}
$keyPem += "-----END PRIVATE KEY-----"
Set-Content $keyPath $keyPem -Encoding ASCII
Write-Host "  Private key: $keyPath"

# ── Clean up from cert store ──────────────────────────────────────────────────
Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force

Write-Host ""
Write-Host "Done. Add to backend/.env:"
Write-Host "  TLS_CERT_PATH=./certs/server.crt"
Write-Host "  TLS_KEY_PATH=./certs/server.key"
Write-Host ""
Write-Host "NOTE: This is a self-signed cert. Browsers will show a warning."
Write-Host "      For production, use a cert from a trusted CA or Let's Encrypt."
