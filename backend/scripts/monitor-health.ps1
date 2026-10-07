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
    Alert channels (user-level environment variables work for a scheduled task
    running as you; the same ones DeskSOS Enterprise's monitor uses):
      Discord: ALERT_DISCORD_WEBHOOK_URL channel webhook URL
      Teams:  ALERT_TEAMS_WEBHOOK_URL   Teams Workflows webhook ("Send webhook
                                        alerts to a channel") or incoming webhook
      Email:  ALERT_SMTP_HOST   e.g. smtp.gmail.com
              ALERT_SMTP_PORT   default 587 (STARTTLS)
              ALERT_SMTP_USER   SMTP login, also used as the From address
              ALERT_SMTP_PASS   SMTP password / app password
              ALERT_TO          recipient address
    Without any, alerts are only written to logs/monitor.log.
#>
param(
    [string]$Url = ($env:DESKSOS_HEALTH_URL ?? "http://localhost:5000/health"),
    [int]$TimeoutSec = 15,
    [int]$CertWarnDays = 14,
    # Enterprise bridge queue (plan task 3.6). /health/bridge only answers local
    # requests, so it's always read through localhost on the same port.
    [string]$BridgeUrl,
    [int]$BridgeStuckMinutes = 60,
    # Self-healing: after this many failed checks in a row, run the startup
    # task (no console window, so PM2 can't die with one). "" turns it off.
    # A file named MAINTENANCE in logs\ pauses it during deliberate work.
    [string]$RestartTask = "DeskSOS Backend Startup",
    [int]$RestartAfterChecks = 2,
    [int]$MaxRestartsPerHour = 3
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

function Send-Discord([string]$Subject, [string]$Body) {
    # Plain message; mentions are disabled so alert text can never ping @everyone.
    # Discord caps a message at 2000 characters.
    $text = "**[DeskSOS Desktop] $Subject**`n$Body"
    if ($text.Length -gt 1900) { $text = $text.Substring(0, 1900) + " ..." }
    $msg = @{ username = "DeskSOS"; content = $text; allowed_mentions = @{ parse = @() } }
    Invoke-RestMethod -Uri $env:ALERT_DISCORD_WEBHOOK_URL -Method Post -ContentType "application/json" `
        -Body ($msg | ConvertTo-Json -Depth 5) -TimeoutSec 15 -ErrorAction Stop | Out-Null
}

function Send-Teams([string]$Subject, [string]$Body) {
    # Adaptive Card message: accepted by Teams Workflows webhooks and by the
    # older incoming-webhook connectors
    $card = @{
        type        = "message"
        attachments = @(@{
                contentType = "application/vnd.microsoft.card.adaptive"
                content     = @{
                    '$schema' = "http://adaptivecards.io/schemas/adaptive-card.json"
                    type      = "AdaptiveCard"
                    version   = "1.4"
                    body      = @(
                        @{ type = "TextBlock"; size = "Medium"; weight = "Bolder"; text = "[DeskSOS Desktop] $Subject"; wrap = $true }
                        @{ type = "TextBlock"; text = $Body; wrap = $true }
                    )
                }
            })
    }
    Invoke-RestMethod -Uri $env:ALERT_TEAMS_WEBHOOK_URL -Method Post -ContentType "application/json" `
        -Body ($card | ConvertTo-Json -Depth 10) -TimeoutSec 15 -ErrorAction Stop | Out-Null
}

function Send-Email([string]$Subject, [string]$Body) {
    $cred = [pscredential]::new($env:ALERT_SMTP_USER, (ConvertTo-SecureString $env:ALERT_SMTP_PASS -AsPlainText -Force))
    Send-MailMessage -SmtpServer $env:ALERT_SMTP_HOST -Port ([int]($env:ALERT_SMTP_PORT ?? 587)) -UseSsl `
        -Credential $cred -From $env:ALERT_SMTP_USER -To $env:ALERT_TO `
        -Subject "[DeskSOS] $Subject" -Body $Body -WarningAction SilentlyContinue -ErrorAction Stop
}

# Returns $false only if every configured channel failed, so the caller keeps
# the old state and the alert is retried on the next run. If at least one
# channel delivered it, someone has been told: retrying would only repeat the
# alert on the working channel every run (e.g. Teams fine, email broken).
function Send-Alert([string]$Subject, [string]$Body) {
    Write-Log "ALERT: $Subject"
    $channels = 0; $delivered = 0
    if ($env:ALERT_DISCORD_WEBHOOK_URL) {
        $channels++
        try { Send-Discord $Subject $Body; $delivered++; Write-Log "  Sent to Discord" }
        catch { Write-Log "  Discord failed: $($_.Exception.Message)" }
    }
    if ($env:ALERT_TEAMS_WEBHOOK_URL) {
        $channels++
        try { Send-Teams $Subject $Body; $delivered++; Write-Log "  Sent to Teams" }
        catch { Write-Log "  Teams failed: $($_.Exception.Message)" }
    }
    if ($env:ALERT_SMTP_HOST -and $env:ALERT_TO -and $env:ALERT_SMTP_USER) {
        $channels++
        try { Send-Email $Subject $Body; $delivered++; Write-Log "  Sent by email" }
        catch { Write-Log "  Email failed: $($_.Exception.Message)" }
    }
    if ($channels -eq 0) { Write-Log "  (no alert channel configured; set ALERT_DISCORD_WEBHOOK_URL, ALERT_TEAMS_WEBHOOK_URL or ALERT_SMTP_*)"; return $true }
    if ($delivered -eq 0) { Write-Log "  No channel delivered the alert (will retry next run)"; return $false }
    return $true
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
# Self-healing acts only when the monitored server is this machine: the
# restart task and the MAINTENANCE file are local to wherever this runs.
$targetHost = ([uri]$Url).Host.Trim('[', ']')
$localNames = @('localhost', '127.0.0.1', '::1', $env:COMPUTERNAME) +
    @(Get-NetIPAddress -ErrorAction SilentlyContinue | ForEach-Object { $_.IPAddress })
$healLocal = $localNames -contains $targetHost   # case-insensitive
$maintenance = Test-Path (Join-Path $logDir "MAINTENANCE")
$healNote = if (-not $RestartTask -or -not $healLocal) { "" }
    elseif ($maintenance) { "`n`nMaintenance mode (logs\MAINTENANCE exists): it will NOT be restarted automatically." }
    else { "`n`nIf it's still down at the next check, it will be restarted automatically." }

$delivered = $true
if ($isUp -and -not $wasUp) {
    $delivered = Send-Alert "Backend recovered" "DeskSOS backend at $Url is responding again.`n`n$detail"
} elseif (-not $isUp -and $wasUp) {
    $delivered = Send-Alert "Backend DOWN" "DeskSOS backend at $Url failed its health check.`n`n$detail`n`nOn the server: pm2 status / pm2 logs desksos-backend$healNote"
} elseif (-not $isUp) {
    Write-Log "Still down: $detail"
}
if ($delivered) { $state.up = $isUp }

# ── Self-healing (restart a backend that stays down) ──────────────────────────
# Restarts through the startup task, never from this process: the task runs
# start-production.ps1 without a console, so PM2 isn't tied to any window.
$state.downCount = if ($isUp) { 0 } else { [int]($state.downCount ?? 0) + 1 }
$now = Get-Date
$recent = @($state.restarts | Where-Object { $_ -and ([datetime]$_) -gt $now.AddHours(-1) })
if ($isUp) {
    $state.gaveUp = $false
    $state.taskMissingAlerted = $false
} elseif ($RestartTask -and -not $healLocal) {
    Write-Log "Self-healing: off, because $targetHost isn't this machine (restarts only work on the server itself)"
} elseif ($RestartTask) {
    if ($maintenance) {
        Write-Log "Maintenance mode (MAINTENANCE file present): not restarting"
    } elseif ($state.downCount -lt $RestartAfterChecks) {
        Write-Log "Self-healing: down for $($state.downCount) check(s); restarts after $RestartAfterChecks"
    } elseif ($recent.Count -ge $MaxRestartsPerHour) {
        if (-not $state.gaveUp) {
            if (Send-Alert "Self-healing gave up" "The DeskSOS backend is still down after $($recent.Count) automatic restart(s) in the last hour. It needs a person.`n`nOn the server: pm2 logs desksos-backend; backend\logs\startup.log") {
                $state.gaveUp = $true
            }
        } else {
            Write-Log "Self-healing: gave up ($($recent.Count) restarts in the last hour)"
        }
    } else {
        $task = Get-ScheduledTask -TaskName $RestartTask -ErrorAction SilentlyContinue
        if (-not $task) {
            if (-not $state.taskMissingAlerted) {
                if (Send-Alert "Automatic restart unavailable" "The scheduled task '$RestartTask' doesn't exist on $env:COMPUTERNAME, so the service can't be restarted automatically. Register it again (see the runbook), then start it.") {
                    $state.taskMissingAlerted = $true
                }
            } else {
                Write-Log "Self-healing: task '$RestartTask' not found; not restarting"
            }
        } elseif ($task.State -eq 'Running') {
            Write-Log "Self-healing: '$RestartTask' is already running; waiting"
        } else {
            try {
                Start-ScheduledTask -TaskName $RestartTask -ErrorAction Stop
                $recent += $now.ToString('o')
                Send-Alert "Restarting automatically" "The DeskSOS backend has been down for $($state.downCount) checks. Started '$RestartTask' (attempt $($recent.Count) of $MaxRestartsPerHour this hour)." | Out-Null
            } catch {
                Send-Alert "Automatic restart failed" "Couldn't start '$RestartTask': $($_.Exception.Message)" | Out-Null
            }
        }
    }
}
$state.restarts = $recent

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
