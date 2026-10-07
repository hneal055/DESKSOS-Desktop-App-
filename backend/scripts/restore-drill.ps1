#Requires -Version 7
<#
.SYNOPSIS
    Restore drill for DeskSOS Desktop (readiness plan task 3.3): proves a backup
    can be restored and served, without touching production.

.DESCRIPTION
    1. Picks a backup (the newest in data\backups unless -Backup is given)
    2. Copies it to a scratch folder and runs PRAGMA integrity_check
    3. Counts tickets, users, chat messages and Enterprise outbox rows; every
       table must be readable
    4. Starts a throwaway backend on that copy: its own port, plain HTTP, a
       temporary secret, and the Enterprise bridge switched OFF (so queued
       tickets in an old backup are never re-sent to Enterprise)
    5. Checks /health, that /tickets refuses an anonymous request (401), and
       that a signed-in request returns every ticket in the backup. The token
       is signed with the throwaway server's temporary secret for an existing
       account, expires in 5 minutes, and is useless against production.
    6. Stops it, deletes the scratch folder, appends PASS/FAIL to
       logs\restore-drill.log

    Needs the built backend (dist\). No administrator rights needed.
    data\backups holds production backups (backup-prod.ps1, start-production.ps1)
    and any manual dev backups (npm run backup); pass -Backup to pick one.

.EXAMPLE
    pwsh backend\scripts\restore-drill.ps1
    pwsh backend\scripts\restore-drill.ps1 -Backup backend\data\backups\desksos-2026-10-07T07-00-03.db
#>
param(
    [string]$Backup,
    [int]$Port = 5197
)

$ErrorActionPreference = 'Stop'
$backend = (Resolve-Path "$PSScriptRoot\..").Path
$log = Join-Path $backend 'logs\restore-drill.log'
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null

function Result([bool]$ok, [string]$detail) {
    $line = "{0}  {1}  {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), ($ok ? 'PASS' : 'FAIL'), $detail
    Add-Content -Path $log -Value $line
    Write-Host $line -ForegroundColor ($ok ? 'Green' : 'Red')
    exit ($ok ? 0 : 1)
}

if (-not $Backup) {
    $Backup = Get-ChildItem (Join-Path $backend 'data\backups') -Filter '*.db' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
    if (-not $Backup) { Result $false "no backup found in data\backups" }
}
if (-not (Test-Path $Backup)) { Result $false "backup file not found: $Backup" }
if (-not (Test-Path (Join-Path $backend 'dist\server.js'))) { Result $false "no build: run npm run build in backend" }
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { Result $false "port $Port is in use; pass -Port" }

$scratch = Join-Path ([IO.Path]::GetTempPath()) ("desksos-desktop-restore-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory $scratch | Out-Null
$db = Join-Path $scratch 'restored.db'
$proc = $null
try {
    Copy-Item $Backup $db
    Write-Host "Backup:  $Backup"

    $check = @'
const Database = require(process.argv[1]);
let db;
try { db = new Database(process.argv[2], { readonly: true, fileMustExist: true }); db.pragma("schema_version"); }
catch (e) { console.log(JSON.stringify({ error: e.message })); process.exit(0); }
const integrity = db.pragma("integrity_check", { simple: true });
const n = (t) => { try { return db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c; } catch { return -1; } };
let reader = null;
try { reader = db.prepare("SELECT id, email, role, name FROM users ORDER BY role = 'admin' DESC, id LIMIT 1").get() ?? null; } catch {}
console.log(JSON.stringify({ integrity, tickets: n("tickets"), users: n("users"), messages: n("messages"), outbox: n("enterprise_outbox"), reader }));
'@
    $counts = node -e $check (Join-Path $backend 'node_modules\better-sqlite3') $db | ConvertFrom-Json
    if ($counts.error) { Result $false "not a readable SQLite database: $($counts.error) ($Backup)" }
    Write-Host ("Check:   integrity {0}; {1} tickets, {2} users, {3} messages, {4} outbox rows" -f $counts.integrity, $counts.tickets, $counts.users, $counts.messages, $counts.outbox)
    if ($counts.integrity -ne 'ok') { Result $false "integrity_check: $($counts.integrity) ($Backup)" }
    foreach ($t in 'tickets', 'messages', 'outbox') {
        if ($counts.$t -lt 0) { Result $false "a required table is missing or unreadable ($t) ($Backup)" }
    }
    if ($counts.users -lt 1 -or -not $counts.reader) { Result $false "no user accounts in the backup ($Backup)" }

    # Throwaway backend: own port, HTTP, temporary secret, no production
    # settings, bridge OFF (empty URL and key win over backend\.env, because
    # dotenv never overrides variables that are already set)
    $bytes = [byte[]]::new(48); [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    $secret = [Convert]::ToBase64String($bytes)
    $psi = [Diagnostics.ProcessStartInfo]::new('node', (Join-Path $backend 'dist\server.js'))
    $psi.WorkingDirectory = $scratch
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    foreach ($k in 'TLS_CERT_PATH', 'TLS_KEY_PATH', 'ENTERPRISE_INGEST_URL', 'ENTERPRISE_INGEST_KEY', 'SENTRY_DSN') { $psi.Environment[$k] = '' }
    $psi.Environment['NODE_ENV'] = 'development'
    $psi.Environment['PORT'] = "$Port"
    $psi.Environment['DATABASE_PATH'] = $db
    $psi.Environment['JWT_SECRET'] = $secret
    $proc = [Diagnostics.Process]::Start($psi)

    $health = $null
    for ($i = 0; $i -lt 30 -and -not $health; $i++) {
        Start-Sleep -Milliseconds 500
        try { $health = Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 2 } catch { }
        if ($proc.HasExited) { break }
    }
    if (-not $health -or $health.status -ne 'ok') { Result $false "restored backend did not report healthy ($Backup)" }

    $anon = try { (Invoke-WebRequest "http://127.0.0.1:$Port/tickets" -TimeoutSec 5 -SkipHttpErrorCheck).StatusCode } catch { 0 }
    if ($anon -ne 401) { Result $false "restored backend: anonymous /tickets returned $anon, expected 401 ($Backup)" }

    $env:DRILL_SECRET = $secret
    $sign = 'const jwt=require(process.argv[1]);const u=JSON.parse(process.argv[2]);' +
            'console.log(jwt.sign({id:u.id,email:u.email,role:u.role,name:u.name},process.env.DRILL_SECRET,{expiresIn:"5m"}))'
    $token = node -e $sign (Join-Path $backend 'node_modules\jsonwebtoken') ($counts.reader | ConvertTo-Json -Compress)
    Remove-Item Env:DRILL_SECRET
    $list = try { Invoke-RestMethod "http://127.0.0.1:$Port/tickets" -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 10 } catch { $null }
    $got = if ($null -eq $list) { -1 } else { @($list).Count }
    if ($got -ne $counts.tickets) { Result $false "restored backend returned $got tickets when signed in, expected $($counts.tickets) ($Backup)" }

    Result $true ("{0}: integrity ok, {1} tickets, {2} users, {3} messages, {4} outbox rows; served healthy on :{5}; {6} tickets read back signed in; bridge off" -f (Split-Path $Backup -Leaf), $counts.tickets, $counts.users, $counts.messages, $counts.outbox, $Port, $got)
}
finally {
    if ($proc -and -not $proc.HasExited) { $proc.Kill($true); $proc.WaitForExit(5000) | Out-Null }
    Remove-Item $scratch -Recurse -Force -ErrorAction SilentlyContinue
}
