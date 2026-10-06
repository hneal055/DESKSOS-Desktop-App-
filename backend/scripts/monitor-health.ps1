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
    [int]$CertWarnDays = 14,
    # Enterprise bridge queue (plan task 3.6). /health/bridge only answers local
    # requests, so it's always read through localhost on the same port.
    [string]$BridgeUrl,
    [int]$BridgeStuckMinutes = 60
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

# Returns $false only when an email was attempted and failed, so the caller can
# keep the previous state and retry the alert on the next run.
function Send-Alert([string]$Subject, [string]$Body) {
    Write-Log "ALERT: $Subject"
    if (-not ($env:ALERT_SMTP_HOST -and $env:ALERT_TO -and $env:ALERT_SMTP_USER)) {
        Write-Log "  (email not configured; set ALERT_SMTP_* and ALERT_TO to receive alerts)"
        return $true
    }
    try {
        $cred = [pscredential]::new($env:ALERT_SMTP_USER, (ConvertTo-SecureString $env:ALERT_SMTP_PASS -AsPlainText -Force))
        Send-MailMessage -SmtpServer $env:ALERT_SMTP_HOST -Port ([int]($env:ALERT_SMTP_PORT ?? 587)) -UseSsl `
            -Credential $cred -From $env:ALERT_SMTP_USER -To $env:ALERT_TO `
            -Subject "[DeskSOS] $Subject" -Body $Body -WarningAction SilentlyContinue -ErrorAction Stop
        return $true
    } catch {
        Write-Log "  Email failed: $($_.Exception.Message) (will retry next run)"
        return $false
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

# Record a state change only once its alert has gone out; a failed email leaves
# the old state in place so the transition (and its alert) is retried next run.
$delivered = $true
if ($isUp -and -not $wasUp) {
    $delivered = Send-Alert "Backend recovered" "DeskSOS backend at $Url is responding again.`n`n$detail"
} elseif (-not $isUp -and $wasUp) {
    $delivered = Send-Alert "Backend DOWN" "DeskSOS backend at $Url failed its health check.`n`n$detail`n`nOn the server: pm2 status / pm2 logs desksos-backend"
} elseif (-not $isUp) {
    Write-Log "Still down: $detail"
}
if ($delivered) { $state.up = $isUp }

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
            if (Send-Alert "TLS certificate expires in $daysLeft day(s)" "The certificate for $($uri.Host) expires on $expires. Renew it (scripts/gen-cert.ps1) and run: pm2 reload desksos-backend") {
                $state.certWarned = Get-Date -Format "yyyy-MM-dd"
            }
        }
    } catch {
        Write-Log "Certificate check failed: $($_.Exception.Message)"
    }
}

# ── Enterprise bridge queue (task 3.6) ─────────────────────────────────────────
# Alerts once when the oldest undelivered ticket passes $BridgeStuckMinutes, once
# when it clears, and once for each new ticket Enterprise rejected outright.
if ($isUp) {
    if (-not $BridgeUrl) { $BridgeUrl = "{0}://localhost:{1}/health/bridge" -f $uri.Scheme, $uri.Port }
    try {
        $b = Invoke-RestMethod $BridgeUrl -TimeoutSec $TimeoutSec -ErrorAction Stop
        if ($b.enabled) {
            $stuck = $b.pending -gt 0 -and $b.oldestPendingMinutes -ge $BridgeStuckMinutes
            $wasStuck = [bool]$state.bridgeStuck
            $queue = "$($b.pending) ticket(s) waiting; the oldest has waited $($b.oldestPendingMinutes) minute(s)."
            if ($stuck -and -not $wasStuck) {
                if (Send-Alert "Enterprise bridge stuck" "Tickets aren't reaching DeskSOS Enterprise. $queue`n`nOn the server: pm2 logs desksos-backend (look for [enterprise-bridge]); details for admins: GET /dashboard/bridge. Common causes: Enterprise is down, or the ingest key doesn't match (rotate-ingest-key.ps1 -Production).") {
                    $state.bridgeStuck = $true
                }
            } elseif (-not $stuck -and $wasStuck) {
                if (Send-Alert "Enterprise bridge recovered" "Queued tickets are reaching DeskSOS Enterprise again. $($b.pending) still pending.") {
                    $state.bridgeStuck = $false
                }
            } elseif ($stuck) {
                Write-Log "Bridge still stuck: $queue"
            }
            $seen = [int]($state.bridgeFailedSeen ?? 0)
            if ($b.failed -gt $seen) {
                $new = $b.failed - $seen
                if (Send-Alert "Enterprise rejected $new ticket(s)" "DeskSOS Enterprise refused $new ticket(s) and they won't be retried ($($b.failed) in total). Admins can see which and why at GET /dashboard/bridge.") {
                    $state.bridgeFailedSeen = $b.failed
                }
            } elseif ($b.failed -lt $seen) {
                $state.bridgeFailedSeen = $b.failed
            }
        }
    } catch {
        # Older backends don't have /health/bridge; note it once a day, not every run
        if ($state.bridgeCheckWarned -ne (Get-Date -Format "yyyy-MM-dd")) {
            Write-Log "Bridge status unavailable at ${BridgeUrl}: $($_.Exception.Message)"
            $state.bridgeCheckWarned = Get-Date -Format "yyyy-MM-dd"
        }
    }
}

$state | ConvertTo-Json | Set-Content $stateFile
