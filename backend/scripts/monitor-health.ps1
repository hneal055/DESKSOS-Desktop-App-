<#
.SYNOPSIS
    DeskSOS uptime monitor: checks /health and alerts when it goes down or recovers.

    Run every few minutes from Task Scheduler (see register-tasks.ps1), ideally
    on a different machine than the backend so a dead server still raises an alert.

    Alerts only fire on a state change (up -> down, down -> up), so an outage
    produces one email, not one every five minutes. For https URLs it also warns
    once a day when the TLS certificate expires within 14 days.

.EXAMPLE
    pwsh scripts/monitor-health.ps1 -Url https://desksos-server:5000/health

.NOTES
    Email alerts are sent when these environment variables are set (user-level
    variables work for a scheduled task running as you):
      ALERT_SMTP_HOST   e.g. smtp.gmail.com
      ALERT_SMTP_PORT   default 587 (STARTTLS)
      ALERT_SMTP_USER   SMTP login, also used as the From address
      ALERT_SMTP_PASS   SMTP password / app password
      ALERT_TO          recipient address
    Without them, alerts are only written to logs/monitor.log.
#>
param(
    [string]$Url = ($env:DESKSOS_HEALTH_URL ?? "http://localhost:5000/health"),
    [int]$TimeoutSec = 15,
    [int]$CertWarnDays = 14
)

$root      = (Resolve-Path "$PSScriptRoot\..").Path
$logDir    = Join-Path $root "logs"
$logFile   = Join-Path $logDir "monitor.log"
$stateFile = Join-Path $logDir "monitor-state.json"
New-Item -ItemType Directory -Force $logDir | Out-Null

function Write-Log([string]$Message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Add-Content -Path $logFile -Value $line
    Write-Host $line
}

function Send-Alert([string]$Subject, [string]$Body) {
    Write-Log "ALERT: $Subject"
    if (-not ($env:ALERT_SMTP_HOST -and $env:ALERT_TO -and $env:ALERT_SMTP_USER)) {
        Write-Log "  (email not configured; set ALERT_SMTP_* and ALERT_TO to receive alerts)"
        return
    }
    try {
        $cred = [pscredential]::new($env:ALERT_SMTP_USER, (ConvertTo-SecureString $env:ALERT_SMTP_PASS -AsPlainText -Force))
        Send-MailMessage -SmtpServer $env:ALERT_SMTP_HOST -Port ([int]($env:ALERT_SMTP_PORT ?? 587)) -UseSsl `
            -Credential $cred -From $env:ALERT_SMTP_USER -To $env:ALERT_TO `
            -Subject "[DeskSOS] $Subject" -Body $Body -WarningAction SilentlyContinue -ErrorAction Stop
    } catch {
        Write-Log "  Email failed: $($_.Exception.Message)"
    }
}

$state = if (Test-Path $stateFile) { Get-Content $stateFile -Raw | ConvertFrom-Json -AsHashtable } else { @{} }
$wasUp = $state.up ?? $true

# ── Health check ──────────────────────────────────────────────────────────────
$isUp = $false
$detail = ""
try {
    $res = Invoke-WebRequest $Url -TimeoutSec $TimeoutSec -SkipHttpErrorCheck -ErrorAction Stop
    $isUp = $res.StatusCode -eq 200
    $detail = "HTTP $($res.StatusCode) $($res.Content)"
} catch {
    $detail = $_.Exception.Message
}

if ($isUp -and -not $wasUp) {
    Send-Alert "Backend recovered" "DeskSOS backend at $Url is responding again.`n`n$detail"
} elseif (-not $isUp -and $wasUp) {
    Send-Alert "Backend DOWN" "DeskSOS backend at $Url failed its health check.`n`n$detail`n`nOn the server: pm2 status / pm2 logs desksos-backend"
} elseif (-not $isUp) {
    Write-Log "Still down: $detail"
}
$state.up = $isUp

# ── TLS certificate expiry (https only, at most one warning per day) ──────────
$uri = [uri]$Url
if ($isUp -and $uri.Scheme -eq "https" -and $state.certWarned -ne (Get-Date -Format "yyyy-MM-dd")) {
    try {
        $tcp = [Net.Sockets.TcpClient]::new($uri.Host, $uri.Port)
        $ssl = [Net.Security.SslStream]::new($tcp.GetStream(), $false, { $true })
        $ssl.AuthenticateAsClient($uri.Host)
        $expires = [Security.Cryptography.X509Certificates.X509Certificate2]::new($ssl.RemoteCertificate).NotAfter
        $ssl.Dispose(); $tcp.Dispose()
        $daysLeft = [int]($expires - (Get-Date)).TotalDays
        if ($daysLeft -le $CertWarnDays) {
            Send-Alert "TLS certificate expires in $daysLeft day(s)" "The certificate for $($uri.Host) expires on $expires. Renew it (scripts/gen-cert.ps1) and run: pm2 reload desksos-backend"
            $state.certWarned = Get-Date -Format "yyyy-MM-dd"
        }
    } catch {
        Write-Log "Certificate check failed: $($_.Exception.Message)"
    }
}

$state | ConvertTo-Json | Set-Content $stateFile
