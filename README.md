# DeskSOS: Desktop Support Toolkit

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Tauri](https://img.shields.io/badge/Tauri-2-orange)
![React](https://img.shields.io/badge/React-18-61dafb)
![Node](https://img.shields.io/badge/Node.js-20%2B-green)

DeskSOS is a Windows desktop helpdesk app built with **Tauri 2 + React 18**. It has two parts:

- **The desktop app (`tauri-app/`)** runs on each user's PC. It handles diagnostics, one-click fixes and ticket building.
- **The backend (`backend/`)** is a Node.js + Express + TypeScript server on FORD-DC01. It provides sign-in, tickets, chat and remote-session signaling.

New tickets are also forwarded to **DeskSOS Enterprise**, the operations dashboard, where **Critical** tickets raise an alarm.

**Running the production server?** Start with [docs/OPERATIONS.md](docs/OPERATIONS.md), the runbook. It covers setup, daily operation, backups, the Enterprise bridge, building and distributing the app, and troubleshooting.

---

## Features

The desktop app has 17 modules.

| Module | What it does | Needs the server |
|---|---|---|
| **Dashboard** | Ticket queue stats (open, in progress, resolved) | Yes |
| **Ticket Builder** | Gathers diagnostics and submits a ticket (forwarded to Enterprise) | Yes |
| **Chat** | Real-time channels (Socket.IO) | Yes |
| **Remote Session** | WebRTC screen-share signaling with presence | Yes |
| **Network Tools / Diagnostics / Fixes / Adapters** | Flush DNS, renew IP, reset Winsock; gateway, DNS, internet and VPN checks | No |
| **Disk Health / Disk Space** | SMART status and storage use | No |
| **Memory Consumers / Running Services** | Top processes and Windows services | No |
| **Event Log / Recent Errors** | System events | No |
| **Installed Software / Windows Update** | Software inventory and update status | No |
| **Dashboard Samples** | Example dashboard views | No |

The local modules run PowerShell through Tauri. Some diagnostics need admin rights.

---

## Development and production

The same PC runs both, side by side:

| | Development | Production |
|---|---|---|
| Backend | `npm run dev`, **http://localhost:5000** | PM2 `desksos-backend`, **https://FORD-DC01:5443** |
| Database | `backend/data/desksos.db` (seeded test data) | `backend/data/desksos-prod.db` (real accounts) |
| Logins | `admin@desksos.com` / `password123` (**dev only**) | Random passwords, printed once at first start (OPERATIONS §3.6) |
| Desktop app | `npm run tauri:dev`, or the debug build `target\debug\desksos.exe` | The release build or installer (`VITE_API_URL` from `tauri-app/.env.production`) |
| Enterprise bridge | Forwards to Enterprise **dev** (`localhost:5100`) | Forwards to Enterprise **production** (`https://localhost:5543`) |

A ticket from the dev app goes to the dev servers, not production. See "Troubleshooting" in OPERATIONS.md.

---

## Quick start (development)

**Prerequisites:**

- Node.js 20+.
- Rust stable (`rustup install stable`).
- Visual Studio Build Tools (Windows SDK) for the Tauri build.

```powershell
git clone https://github.com/hneal055/DESKSOS-Desktop-App-.git DESKSOS-Desktop
cd DESKSOS-Desktop

# Backend
cd backend
npm ci
copy .env.example .env        # then set JWT_SECRET (see the comment in the file)
npm run dev                   # http://localhost:5000

# Desktop app (new terminal, from the repository root)
cd tauri-app
npm ci
npm run tauri:dev
```

`start-all.ps1` at the repository root starts both. `tauri-app/Install-DeskSOS.ps1` is an interactive menu for building, installing and checking a development setup.

---

## Production

Everything is in [docs/OPERATIONS.md](docs/OPERATIONS.md):

- **First-time setup (§3):**
  - prerequisites, including keeping the server awake
  - certificate, firewall and first start
  - scheduled tasks
  - the Enterprise bridge
- **Daily operation, and backup and restore (§4).**
- **Building and installing the desktop app on users' PCs (§6).**
- **Troubleshooting (§7).**

The most common commands, run from `backend/` in an Administrator window:

| Task | Command |
|---|---|
| Start or redeploy | `pwsh scripts/start-production.ps1` (build → backup → start or reload) |
| Status and logs | `pm2 status`, `pm2 logs desksos-backend` |
| Back up the production database | `pwsh scripts/backup-prod.ps1` |
| Change a password | `pwsh scripts/change-password.ps1 -Email <user>` |
| Reset a lost password | `node scripts/reset-password.js --prod <user>` |
| Rotate the JWT secret | `pwsh scripts/rotate-secret.ps1 -Restart` (signs everyone out) |

---

## DeskSOS Enterprise bridge

Each new ticket is written to an `enterprise_outbox` table in the same transaction that saves it. The backend then sends it to Enterprise's `POST /api/ingest/incidents` with an `X-API-Key`.

- **Delivery:** failed deliveries are retried with backoff, and the queue survives restarts.
- **Priority mapping:** P1 (Critical) → `CRITICAL`, which triggers Enterprise's alarm; P2 → `HIGH`; P3 → `MEDIUM`; P4 → `LOW`.
- **Pairing:** keys are paired with the Enterprise repo's `rotate-ingest-key.ps1` (`-Production` for production).

Details: OPERATIONS.md §3.8.

---

## Testing

```powershell
# From the repository root
npm --prefix backend test              # Jest + Supertest (in-memory database)
npm --prefix tauri-app test            # Vitest + React Testing Library
npm --prefix tauri-app run test:e2e    # Playwright (starts a test backend on :5001)
```

CI (`.github/workflows/ci.yml`) runs all three on every push and pull request: backend, then desktop, then e2e.

---

## Security

| Control | Implementation |
|---|---|
| Authentication | bcrypt password hashes. The JWT is kept in memory only, never in localStorage. `JWT_SECRET` must be at least 32 characters |
| Authorization | Role checks (`admin`, `technician`) on protected routes |
| Input validation | Zod schemas |
| Rate limiting | 200 requests per 15 minutes overall; 20 per 15 minutes on `/auth` |
| Headers | Helmet |
| CORS | Limited to the Tauri origins and the local dev server (`CORS_ORIGINS`) |
| TLS | Required in production: the server exits without a certificate. It uses a local CA (mkcert) that users' PCs trust |
| Content Security Policy | A strict Tauri CSP that only allows the DeskSOS servers |
| Logging | Daily rotating access log (10 MB maximum); optional Sentry error reporting |
| Secrets | Kept out of source control in `backend/.env` and `backend/.env.production`. Rotate the JWT secret with `rotate-secret.ps1` |

---

## Configuration

See [backend/.env.example](backend/.env.example) for every setting.

Production settings that aren't secret (port 5443, TLS paths, database, Enterprise URL) live in `backend/ecosystem.config.js` under `env_production`. **Secrets** live in `backend/.env.production`, which is loaded first in production, and `backend/.env`.

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 + WebView2 |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js 20+, Express 5, TypeScript |
| Database | SQLite (better-sqlite3) |
| Real-time | Socket.IO 4 |
| Process manager | PM2 |
| Tests | Jest + Supertest, Vitest + React Testing Library, Playwright |
| CI | GitHub Actions |

## System requirements

| Component | Requirement |
|---|---|
| Users' PCs | Windows 10 (1809+) or Windows 11, with WebView2 |
| Server | Windows with Node.js 20+, PM2 and PowerShell 7 |
| Network | Users' PCs reach `FORD-DC01:5443` on the office LAN and trust the DeskSOS CA |

## License

Proprietary, internal use only. © 2026 DeskSOS Team. All rights reserved.
