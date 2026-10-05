# DeskSOS Operations Runbook

Procedures for running the DeskSOS backend under PM2 on a self-hosted Windows
machine, and for building, installing and supporting the DeskSOS desktop app.

The production backend runs on **FORD-DC01** (LAN IP 192.168.12.196), the same
PC used for development. Dev and production are kept apart by port, database
and settings:

| | Development | Production |
|---|---|---|
| Port | 5000, plain HTTP | **5443, HTTPS** |
| Database | `backend/data/desksos.db` (test data, fixed `password123` logins) | `backend/data/desksos-prod.db` (real accounts) |
| Settings | `backend/.env` | `backend/.env` (JWT secret) + `env_production` in `backend/ecosystem.config.js` (port, TLS, database) |
| Started by | `start-all.ps1` | PM2, via the **DeskSOS Backend Startup** task at boot |
| Desktop app URL | `http://localhost:5000` | `https://FORD-DC01:5443` |

---

## 1. At a glance

| Component | Runs on | Port | Started by |
|---|---|---|---|
| Backend (production) | FORD-DC01 | 5443 (HTTPS) | PM2, via the **DeskSOS Backend Startup** task at boot |
| Backend (development) | FORD-DC01 | 5000 (HTTP) | `start-all.ps1` → `npm run dev` |
| Vite dev server | FORD-DC01 | 1420 | `start-all.ps1` → `npm run tauri dev` |
| Desktop app | Every user's PC | none | Start menu → **DeskSOS** |

| What | Where (relative to repo) |
|---|---|
| Backend secrets and settings | `backend/.env`; production overrides in `backend/ecosystem.config.js` |
| Production database | `backend/data/desksos-prod.db` (excluded from git) |
| Backups (14 kept) | `backend/data/backups/` |
| Logs | `backend/logs/` (`access.log`, `pm2-out-1.log`, `pm2-err-1.log`, `startup.log`, `backup.log`, `monitor.log`) |
| TLS certificate | `backend/certs/server.crt`, `server.key` |

| Scheduled task | When | Does |
|---|---|---|
| DeskSOS Backend Startup | Boot + 1 min | `start-production.ps1 -SkipBuild` |
| DeskSOS Daily Backup | 02:00 daily | `backup-prod.ps1` (production database only) |
| DeskSOS Health Monitor | Every 5 min | `monitor-health.ps1`, emails on outage/recovery |

> `start-all.ps1` is safe to run alongside production: it leaves PM2's
> processes and port 5443 alone. It does close any open DeskSOS desktop
> window (`desksos.exe`), including an installed copy.

---

## 2. PM2 complete teardown

Use this before first-time setup, when moving the backend to a different
machine, or to stop DeskSOS completely.

### 2.1 Run the teardown

From `backend/` in an **elevated** PowerShell 7 window:

```powershell
pwsh scripts/pm2-teardown.ps1                 # PM2 only; scheduled tasks kept
pwsh scripts/pm2-teardown.ps1 -RemoveTasks    # also removes the DeskSOS scheduled tasks
```

What it does, in order:

1. Deletes every PM2 process named `desksos-backend`, **from any folder**. The
   older checkout at `C:\Projects\DESKSOS\backend\server` uses the same name.
2. Runs `pm2 save --force` with the list empty, so nothing gets restored later.
3. Removes the `pm2-windows-startup` logon hook (`HKCU\...\Run\PM2`). That hook
   restored the saved list at logon and could bring back the old checkout's backend.
4. Runs `pm2 kill` to stop the PM2 daemon. `pm2-logrotate` stops with it and
   starts again with the daemon next time.
5. With `-RemoveTasks`, unregisters the `DeskSOS *` scheduled tasks.

It does **not** touch the database, backups, logs, `.env`, certificates, PM2
itself or the `pm2-logrotate` settings.

### 2.2 Doing it by hand (same result)

```powershell
pm2 delete desksos-backend
pm2 save --force
Remove-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\Run -Name PM2 -ErrorAction SilentlyContinue
pm2 kill
Unregister-ScheduledTask -TaskName "DeskSOS *" -Confirm:$false   # optional, needs admin
```

### 2.3 Verify

```powershell
pm2 ls                                                    # daemon not running, or no desksos-backend
Get-NetTCPConnection -LocalPort 5443 -State Listen        # no output = production port free
Get-ScheduledTask -TaskName "DeskSOS *"                   # gone if you used -RemoveTasks
```

Port 5000 belongs to the dev backend (`start-all.ps1`) and isn't affected by
the teardown.

### 2.4 Optional: remove PM2 entirely

```powershell
npm uninstall -g pm2 pm2-windows-startup
Remove-Item -Recurse -Force "$HOME\.pm2"     # PM2 state, module settings, PM2's own logs
```

---

## 3. First-time server setup

Do this once on FORD-DC01. Start from a clean state (section 2).

### 3.0 Quick path

After the prerequisites (3.1) and the `.env` check (3.4), one elevated command
does 3.3 and 3.5–3.7 and prints the generated logins:

```powershell
pwsh C:\Projects\DESKSOS-Desktop\backend\scripts\setup-production.ps1
```

On first run, Windows asks to install the mkcert certificate authority. Click
**Yes**. The script is safe to re-run. The sections below describe each step it
performs.

### 3.1 Prerequisites

```powershell
winget install OpenJS.NodeJS.LTS
winget install Microsoft.PowerShell
winget install FiloSottile.mkcert
npm install -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

### 3.2 Remove the stale `JWT_SECRET` user variable

A 28-character `JWT_SECRET` set as a Windows user environment variable will
stop the backend from starting, because it overrides `backend/.env`.
`start-production.ps1` clears it for PM2, but delete it anyway:

```powershell
[Environment]::SetEnvironmentVariable('JWT_SECRET', $null, 'User')
```

### 3.3 Create the TLS certificate

Include every name that user PCs will use to reach the server:

```powershell
cd backend
pwsh scripts/gen-cert.ps1 -Names localhost,127.0.0.1,FORD-DC01,192.168.12.196
```

This writes `certs/server.crt` and `certs/server.key`, and installs the mkcert
root CA on **this** machine. User PCs need that CA too (section 6.3).

### 3.4 Check `backend/.env` and `ecosystem.config.js`

`backend/.env` is shared by dev and production. It needs only the JWT secret
(plus optional Sentry). Don't put TLS paths in it, or the dev backend
would switch to HTTPS too:

```ini
PORT=5000
JWT_SECRET=<88-char value — generate with the command below>
# Optional
# SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
```

Generate a secret with
`node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"`,
or later rotate it with `pwsh scripts/rotate-secret.ps1 -Restart`.

The production-only settings live in `env_production` in
`backend/ecosystem.config.js`. They override `.env` when PM2 starts the backend:

```js
NODE_ENV: "production",
PORT: "5443",
TLS_CERT_PATH: "./certs/server.crt",
TLS_KEY_PATH: "./certs/server.key",
DATABASE_PATH: "./data/desksos-prod.db",
```

### 3.5 Open the firewall

From an elevated window:

```powershell
New-NetFirewallRule -DisplayName "DeskSOS Backend" -Direction Inbound -Protocol TCP `
    -LocalPort 5443 -Action Allow -Profile Domain,Private
```

The rule covers Private and Domain networks only. Make sure this PC's Wi-Fi
network is set to **Private** (Settings → Network & internet → Wi-Fi → network
properties), or other PCs can't connect.

### 3.6 First start and verification

```powershell
cd backend
npm ci
pwsh scripts/start-production.ps1          # build → backup → PM2 start
pm2 status                                 # desksos-backend: online
Invoke-RestMethod https://FORD-DC01:5443/health   # status=ok, db=ok
```

`start-production.ps1` refuses to continue if PM2 is already running a
`desksos-backend` from another folder. If that happens, run section 2 first.

**First-start logins.** The first start creates `desksos-prod.db` with an admin
(`admin@desksos.com`) and a technician (`tech@desksos.com`), each with a
**random** password. The passwords are printed once, to `logs/pm2-out-1.log`
(`setup-production.ps1` shows them). Change both, then clear them from the log:

```powershell
pwsh scripts/change-password.ps1 -Email admin@desksos.com
pwsh scripts/change-password.ps1 -Email tech@desksos.com
pm2 flush desksos-backend          # Administrator window
```

The app has no change-password screen yet. The script calls the backend's
`PATCH /auth/change-password` and asks for passwords at hidden prompts.

### 3.7 Register the automated tasks

From an elevated window:

```powershell
pwsh scripts/register-tasks.ps1 -BackendAutostart -HealthUrl https://FORD-DC01:5443/health
```

For email alerts, set these **user** environment variables before the monitor
first runs (a Gmail app password works):

```powershell
foreach ($kv in @{ ALERT_SMTP_HOST='smtp.gmail.com'; ALERT_SMTP_PORT='587';
                   ALERT_SMTP_USER='you@gmail.com';  ALERT_SMTP_PASS='<app password>';
                   ALERT_TO='you@gmail.com' }.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($kv.Key, $kv.Value, 'User')
}
```

Ideally the health monitor runs on a **different** PC from the backend, so it
can still send an alert if the server itself goes down. To do that, run
`register-tasks.ps1 -HealthUrl ...` on that PC instead, without `-BackendAutostart`.

Test each task without waiting for its trigger:

```powershell
Start-ScheduledTask "DeskSOS Daily Backup";    Get-Content logs\backup.log -Tail 5
Start-ScheduledTask "DeskSOS Health Monitor";  Get-Content logs\monitor.log -Tail 5
```

### 3.8 Optional: forward tickets to DeskSOS Enterprise

The backend can forward every **newly created** ticket to the DeskSOS Enterprise
incident dashboard. Existing tickets are not sent. It's off until both settings
below are present. Add them to `backend/.env`, or to `env_production` if only
production should forward:

```ini
ENTERPRISE_INGEST_URL=http://localhost:5100/api/ingest/incidents
ENTERPRISE_INGEST_KEY=<same value as INGEST_API_KEY in the Enterprise backend/server/.env>
# Optional; give dev and production different values so their tickets stay distinct
ENTERPRISE_SOURCE=desksos-desktop
```

Then restart the backend. The log shows
`[enterprise-bridge] Forwarding new tickets to …` when it's active.

How delivery works:

- A new ticket is queued in the `enterprise_outbox` table in the same
  transaction that saves it, then sent within seconds.
- If Enterprise is down, rejects the key (401), or is unconfigured (503), the
  ticket stays queued and is retried after 30 s, 1 m, 2 m … up to every hour.
  The queue survives restarts.
- If Enterprise rejects the ticket itself (400), it's marked `failed` and not
  retried.
- Priorities map to severities: P1 (Critical) → CRITICAL, P2 (High) → HIGH,
  P3 (Medium) → MEDIUM, P4 (Low) → LOW.
- Status changes made later in Desktop are not forwarded.

Check the queue:

```powershell
cd backend
node -e "const db=require('better-sqlite3')('data/desksos.db');console.table(db.prepare('SELECT ticket_id,status,attempts,next_attempt_at,last_error FROM enterprise_outbox ORDER BY created_at DESC LIMIT 20').all())"
```

Use `data/desksos-prod.db` for production. To retry a `failed` ticket after
fixing the cause, set its row back to `status='pending'`.

**Production → Enterprise production.** `ecosystem.config.js` already points
production at `https://localhost:5543/api/ingest/incidents` (Enterprise
production on the same PC) with source `desksos-desktop-prod`, and sets
`NODE_EXTRA_CA_CERTS` to mkcert's root CA (`%LOCALAPPDATA%\mkcert\rootCA.pem`).
That setting is required: Node doesn't use the Windows certificate store, so
without it every request fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

Only the key is missing, and it's a secret, so it lives in
`backend/.env.production` (ignored by git, loaded only in production, and
overriding inherited values). Pair it with Enterprise production's key from
the Enterprise repo, then restart both:

```powershell
cd C:\Projects\DESKSOS
.\rotate-ingest-key.ps1 -Production
.\start-production.ps1 -SkipBuild
C:\Projects\DESKSOS-Desktop\backend\scripts\start-production.ps1 -SkipBuild
```

The production log should then show
`[enterprise-bridge] Forwarding new tickets to https://localhost:5543/...`.

---

## 4. Automated startup sequence

Once section 3 is done, nothing needs to be started by hand.

### 4.1 What happens at boot

1. Windows starts. **No one needs to log in.**
2. After 1 minute, the **DeskSOS Backend Startup** task runs
   `start-production.ps1 -SkipBuild`, logging to `logs/startup.log`:
   1. Checks that PM2 is installed
   2. Skips the build and uses the existing `dist/`
   3. Backs up the production database
   4. Clears any inherited `JWT_SECRET`, checks that no other checkout's
      `desksos-backend` is running, then starts the backend under PM2
      (`NODE_ENV=production`, port 5443, HTTPS, `desksos-prod.db`)
3. The PM2 daemon starts `pm2-logrotate` automatically.
4. Within 5 minutes, **DeskSOS Health Monitor** checks `/health`. If it fails,
   you get a "Backend DOWN" email.

### 4.2 While running

| Event | Automatic response |
|---|---|
| Backend crashes | PM2 restarts it after 3 s (up to 10 times; it must stay up 10 s to count as a successful start) |
| Memory over 512 MB | PM2 restarts it |
| Backend down or back up | One email for each change (monitor) |
| TLS certificate within 14 days of expiry | One email a day |
| 02:00 | Database backup; the oldest copies beyond 14 are deleted |
| Midnight or 10 MB | PM2 logs rotate (14 kept, compressed) |
| Unhandled server error | Sentry email, if `SENTRY_DSN` is set |

### 4.3 Manual operations

> **Run every `pm2` command from an Administrator PowerShell window.** The
> production PM2 daemon runs elevated (setup and the boot task both run as
> administrator). A non-elevated window can't reach it, and running `pm2` there
> starts a second, broken daemon.

| Task | Command (from `backend/`) |
|---|---|
| Status | `pm2 status` |
| Live logs | `pm2 logs desksos-backend` |
| Live CPU/memory | `pm2 monit` |
| Restart without downtime | `pm2 reload desksos-backend` |
| Stop / start | `pm2 stop desksos-backend` / `pm2 start desksos-backend` |
| Deploy new code | `git pull; npm ci; pwsh scripts/start-production.ps1` (build → backup → reload) |
| Manual backup (production DB) | `pwsh scripts/backup-prod.ps1` (`npm run backup` backs up the dev DB) |
| Change a user's password | `pwsh scripts/change-password.ps1 -Email <user>` |
| Rotate JWT secret | `pwsh scripts/rotate-secret.ps1 -Restart` (logs everyone out) |
| Renew certificate | `pwsh scripts/gen-cert.ps1 -Names localhost,127.0.0.1,FORD-DC01,192.168.12.196; pm2 reload desksos-backend` |
| Simulate a reboot | `Start-ScheduledTask "DeskSOS Backend Startup"` |

### 4.4 Restoring a backup

```powershell
pwsh scripts/backup-prod.ps1      # 1. consistent rollback copy (includes WAL changes) in data\backups
pm2 stop desksos-backend          # 2. Administrator window
Remove-Item data\desksos-prod.db-wal, data\desksos-prod.db-shm -ErrorAction SilentlyContinue
Copy-Item data\backups\desksos-<timestamp>.db data\desksos-prod.db
pm2 start desksos-backend
```

Step 1 matters: copying `desksos-prod.db` by hand misses recent changes that
are still in the `-wal` file. To undo a bad restore, restore the backup taken
in step 1 the same way.

---

## 5. Desktop app: development

In PowerShell 7:

```powershell
pwsh C:\Projects\DESKSOS-Desktop\start-all.ps1
```

1. Stops old dev Node processes (sparing PM2 and production), cargo and
   desksos, frees ports 5000, 5001 and 1420, and clears the Vite cache.
2. Opens a **backend window** (`npm run dev`, plain HTTP on 5000). It clears the
   stale `JWT_SECRET` so `backend/.env` is used. Check there's no `FATAL` line.
3. Opens a **Tauri window** (`npm run tauri dev`). Vite starts on 1420, Rust
   compiles, and the **DeskSOS desktop window** opens. The first build after a
   cache clear takes about a minute.
4. Log in from the **desktop window**. A `localhost:1420` browser tab can't run
   local diagnostics. It's only useful for checking layout.

---

## 6. Desktop app: building and distributing

### 6.1 Point the build at the server

Both settings are already in place for FORD-DC01. Change them only if the
server moves.

- `tauri-app/.env.production`:

  ```ini
  VITE_API_URL=https://FORD-DC01:5443
  ```

- The CSP `connect-src` list in `tauri-app/src-tauri/tauri.conf.json`
  (`app.security.csp`) must include the same host, or the app blocks its own
  requests:

  ```text
  https://FORD-DC01:5443 wss://FORD-DC01:5443
  ```

The build uses the machine name, not the IP, because the Wi-Fi IP comes from
DHCP and can change. If user PCs can't resolve `FORD-DC01`, give this PC a DHCP
reservation in the router, then switch both settings to `https://192.168.12.196:5443`.
The certificate already covers the IP.

### 6.2 Build

1. Increase `version` in `tauri-app/src-tauri/tauri.conf.json` (e.g. `1.0.0` → `1.0.1`).
2. Build:
   ```powershell
   cd C:\Projects\DESKSOS-Desktop\tauri-app
   npm ci
   npm run tauri build
   ```
3. Collect the installer from `tauri-app\src-tauri\target\release\bundle\`:
   - `nsis\DeskSOS_<version>_x64-setup.exe`: **recommended**. It installs
     WebView2 if it's missing.
   - `msi\DeskSOS_<version>_x64_en-US.msi`: for Group Policy or Intune deployment.

### 6.3 Install on a user's PC

1. **Trust the server certificate (one time per PC).** On the server, run
   `mkcert -CAROOT` and copy **only** `rootCA.pem` from that folder. Never copy
   `rootCA-key.pem`. On the user's PC, from an elevated window:
   ```powershell
   Import-Certificate -FilePath .\rootCA.pem -CertStoreLocation Cert:\LocalMachine\Root
   ```
   Check by opening `https://FORD-DC01:5443/health` in Edge on that PC. It
   should show `{"status":"ok",...}` with no certificate warning.
2. **Run the installer.** It isn't code-signed, so SmartScreen shows "Windows
   protected your PC". Choose **More info → Run anyway**.
3. **Create their account** in the backend. Don't share the admin login.
4. **Launch** from Start menu → **DeskSOS** and log in.
5. **Admin rights:** Renew IP, Reset Network, Clear Queue and the AD tools need
   **Run as administrator**. The AD tools also need a domain-joined PC.

### 6.4 Update

Build with a higher `version` (6.2) and run the new installer over the old
one. Settings and login are kept. There's no auto-updater.

### 6.5 Uninstall

Settings → Apps → Installed apps → **DeskSOS** → Uninstall. Remove the server
CA too if the PC no longer needs it:

```powershell
Get-ChildItem Cert:\LocalMachine\Root | Where-Object Subject -like "*mkcert*" | Remove-Item
```

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Login shows "Login failed"; console shows `ERR_CONNECTION_REFUSED` | Backend not running | Server: `pm2 status`, `pm2 logs desksos-backend`. Dev: check the backend window. |
| Backend log: `FATAL: JWT_SECRET must be set` | Stale user-level `JWT_SECRET`, or missing from `.env` | Section 3.2; check `backend/.env` |
| Backend log: `FATAL: TLS_CERT_PATH and TLS_KEY_PATH must be set` | Production started without a certificate, or not via `ecosystem.config.js` | Section 3.3; start with `start-production.ps1` |
| `pm2 status` shows nothing / `pm2` only prints "Spawning PM2 daemon" | Window isn't elevated, so it can't reach the elevated daemon | Close it and use an Administrator window. In Task Manager, end any extra `node.exe` running `pm2\lib\Daemon.js` |
| `start-production.ps1`: "PM2 already runs a desksos-backend from …" | Old checkout registered in PM2 | `pwsh scripts/pm2-teardown.ps1`, then retry |
| `Port 5000/5443 is already in use` | Another process on that port | `Get-NetTCPConnection -LocalPort <port>` → close that process |
| Dev app shows production data, or the reverse | The wrong backend is running | Dev = `localhost:5000` + `desksos.db`; production = `FORD-DC01:5443` + `desksos-prod.db` |
| App works on FORD-DC01 but not on a user's PC | Firewall, Wi-Fi network set to Public, CA not trusted, or name not resolving | Sections 3.5, 6.3 step 1, 6.1 |
| Certificate error on a user's PC | Server name not in the certificate | Generate the cert again with `-Names …,<name the PC uses>` (3.3) |
| Dashboard diagnostics empty | Opened in a browser, not the desktop app | Use the DeskSOS desktop window |
| Nothing started after a reboot | Startup task failed | `Get-Content backend\logs\startup.log -Tail 30`; `Get-ScheduledTaskInfo "DeskSOS Backend Startup"` |
| Tasks stopped running after a PowerShell update | Task points at an old pwsh path | Run `register-tasks.ps1` again (elevated) |
| Tickets don't appear in Enterprise | Bridge not configured, or Enterprise unreachable | Look for `[enterprise-bridge]` in the backend log; check the outbox (3.8) |
| Bridge log: `HTTP 401` | `ENTERPRISE_INGEST_KEY` doesn't match Enterprise's `INGEST_API_KEY` | Fix the key and restart; queued tickets are retried automatically |
| Bridge log: `HTTP 503 … INGEST_API_KEY is not configured` | Ingest is turned off on the Enterprise side | Set `INGEST_API_KEY` in Enterprise `backend/server/.env` and restart it |
