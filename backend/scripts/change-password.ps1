<#
.SYNOPSIS
    Changes a DeskSOS user's password via the backend API (PATCH /auth/change-password).
    Passwords are read from hidden prompts, never from the command line.

.EXAMPLE
    pwsh scripts/change-password.ps1 -Email admin@desksos.com
    pwsh scripts/change-password.ps1 -Email tech@desksos.com -Server https://FORD-DC01:5443
#>
param(
    [Parameter(Mandatory)] [string]$Email,
    [string]$Server = "https://FORD-DC01:5443"
)

function Read-Secret([string]$Prompt) {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    [Net.NetworkCredential]::new("", $secure).Password
}

$current = Read-Secret "Current password for $Email"
$new     = Read-Secret "New password (min 8 characters)"
$confirm = Read-Secret "Confirm new password"
if ($new -ne $confirm) { Write-Error "New passwords don't match."; exit 1 }

try {
    $login = Invoke-RestMethod "$Server/auth/login" -Method Post -ContentType "application/json" `
        -Body (@{ email = $Email; password = $current } | ConvertTo-Json)
} catch {
    Write-Error "Login failed for $Email (wrong current password, or server unreachable)."
    exit 1
}

try {
    Invoke-RestMethod "$Server/auth/change-password" -Method Patch -ContentType "application/json" `
        -Headers @{ Authorization = "Bearer $($login.token)" } `
        -Body (@{ currentPassword = $current; newPassword = $new } | ConvertTo-Json) | Out-Null
    Write-Host "Password changed for $Email." -ForegroundColor Green
} catch {
    $detail = $_.ErrorDetails.Message ?? $_.Exception.Message
    Write-Error "Change failed: $detail"
    exit 1
}
