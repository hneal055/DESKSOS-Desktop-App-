# DeskSOS — Desktop Support Toolkit

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Tauri](https://img.shields.io/badge/Tauri-2.0-orange)
![React](https://img.shields.io/badge/React-18.3-61dafb)
![Node](https://img.shields.io/badge/Node.js-20-green)
![Tests](https://img.shields.io/badge/tests-82%20passing-brightgreen)

DeskSOS is a native Windows desktop IT helpdesk application built with Tauri v2 + React 18. It pairs a feature-rich diagnostic front-end with a hardened Node.js + Express + TypeScript backend providing real-time chat, ticket management, remote session signaling, and live system monitoring.

---

## Features

| Module | Description |
|--------|-------------|
| **Dashboard** | Live ticket queue stats (open / in-progress / resolved) |
| **Ticket Builder** | Submit and track support tickets |
| **Chat** | Real-time channels via Socket.IO (REST + WebSocket) |
| **Remote Session** | WebRTC screen-share signaling with presence tracking |
| **Network Tools** | Flush DNS, renew IP, reset Winsock, adapt info |
| **Network Diagnostics** | Gateway / DNS / internet / VPN health checks |
| **Network Fixes** | One-click common network remediations |
| **Disk Health / Space** | SMART status and storage usage |
| **Memory Consumers** | Top processes by RSS |
| **Running Services** | Windows service status viewer |
| **Event Log / Recent Errors** | System event viewer |
| **Installed Software** | Asset software inventory |
| **Windows Update** | Update status and pending patches |

---

## Architecture

```
tauri-app/                     Tauri v2 + React 18 + TypeScript + Vite + Tailwind
  src/components/modules/      17 UI modules
  src/contexts/AuthContext.tsx  JWT (in-memory — never localStorage)
  e2e/                         Playwright end-to-end tests

backend/                       Node.js + Express + TypeScript (port 5000)
  src/server.ts                TLS, Helmet, rate limiting, Morgan, Socket.IO
  src/config.ts                Env validation (process.exit on bad config)
  src/routes/                  auth, dashboard, chat, assets, network, tickets
  src/db.ts                    better-sqlite3, seeded schema
  src/validation.ts            Zod schemas for all endpoints
  scripts/
    start-production.ps1       Daily startup: build → backup → PM2 start/reload
    backup-db.js               SQLite hot backup with rotation (14-day default)
    rotate-secret.ps1          JWT secret rotation + PM2 reload
    gen-cert.ps1               mkcert trusted cert (+ .NET self-signed fallback)
  ecosystem.config.js          PM2 process supervisor config
```

---

## Quick Start — Development

### Prerequisites

- Node.js 20+
- Rust 1.75+ (`rustup install stable`)
- Visual Studio Build Tools (Windows SDK)

```powershell
git clone https://github.com/hneal055/DESKSOS-Desktop-App-.git
cd DESKSOS-Desktop-App-

# Backend
cd backend
npm install
cp .env.example .env          # fill in JWT_SECRET (see .env.example)
npm run dev                   # starts on http://localhost:5000

# Desktop app (new terminal)
cd tauri-app
npm install
npm run tauri:dev
```

Default seeded credentials: `admin@desksos.com` / `password123`

---

## Production Deployment

### First-time setup

```powershell
# 1. Install PM2 globally
npm install -g pm2

# 2. Generate a TLS certificate (installs mkcert local CA — trusted by Tauri WebView)
cd backend
winget install FiloSottile.mkcert     # install mkcert (recommended)
pwsh scripts/gen-cert.ps1             # creates backend/certs/server.crt + server.key

# 3. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET, TLS_CERT_PATH, TLS_KEY_PATH, NODE_ENV=production

# 4. Register PM2 to start on OS boot
pm2 startup
pm2 save

# 5. Daily startup (build + backup + start)
pwsh scripts/start-production.ps1
```

### Daily startup

```powershell
cd backend
pwsh scripts/start-production.ps1        # build → backup → PM2 start/reload

# Or via npm:
npm run start:daily
```

This single script:
1. Compiles TypeScript → `dist/`
2. Hot-backs up `desksos.db` to `data/backups/` (keeps 14 days)
3. Starts or zero-downtime reloads the PM2 process

Use `-SkipBuild` if the binary is already compiled: `pwsh scripts/start-production.ps1 -SkipBuild`

### Common operations

| Task | Command |
|------|---------|
| View process status | `pm2 status` |
| Tail logs | `pm2 logs desksos-backend` |
| Zero-downtime reload | `pm2 reload desksos-backend` |
| Manual DB backup | `npm run backup` |
| Rotate JWT secret | `pwsh scripts/rotate-secret.ps1 -Restart` |
| Regenerate TLS cert | `pwsh scripts/gen-cert.ps1` |

---

## Testing

```powershell
# Backend (Jest + Supertest) — 57 tests, 8 suites
cd backend && npm test

# Frontend (Vitest + React Testing Library) — 16 tests
cd tauri-app && npm test

# End-to-end (Playwright + Chromium) — 9 tests
cd tauri-app && npm run test:e2e
```

CI runs all three suites on every push: `backend → desktop → e2e`

---

## Security

| Control | Implementation |
|---------|---------------|
| Input validation | Zod schemas on every endpoint |
| Auth | bcrypt, JWT in-memory only, 32-char minimum secret |
| Rate limiting | 200 req/15 min global · 20 req/15 min on `/auth` |
| Security headers | Helmet |
| CORS | Locked to Tauri origins (`tauri://localhost`, `https://tauri.localhost`) |
| TLS | Enforced in production (`process.exit(1)` if cert not configured) |
| CSP | Strict Tauri Content Security Policy |
| RBAC | Role-based access control middleware on all routes |
| Logging | Rotating daily access log (14-day retention, 10 MB max) |
| Secrets | `JWT_SECRET` never in source; `rotate-secret.ps1` for rotation |

---

## Environment Variables

See [backend/.env.example](backend/.env.example) for full documentation.

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | ✅ | Min 32 chars — generate: `node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"` |
| `PORT` | no | API port (default: 5000) |
| `NODE_ENV` | no | `development` / `production` / `test` |
| `TLS_CERT_PATH` | prod | Path to PEM certificate |
| `TLS_KEY_PATH` | prod | Path to PEM private key |
| `CORS_ORIGINS` | no | Comma-separated allowed origins |
| `DATABASE_PATH` | no | SQLite path (default: `./data/desksos.db`) |
| `BACKUP_DIR` | no | Backup directory (default: `./data/backups`) |
| `BACKUP_KEEP` | no | Days of backups to retain (default: 14) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri v2 + WebView2 |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js 20, Express 5, TypeScript strict |
| Database | SQLite via better-sqlite3 |
| Real-time | Socket.IO 4 |
| Auth | JWT + bcrypt |
| Validation | Zod |
| Process manager | PM2 |
| Backend tests | Jest + Supertest |
| Frontend tests | Vitest + React Testing Library |
| E2E tests | Playwright + Chromium |
| CI | GitHub Actions |

---

## System Requirements

| Component | Requirement |
|-----------|-------------|
| OS | Windows 10 (1809+) or Windows 11 |
| RAM | 256 MB minimum |
| Disk | 50 MB + database |
| Node.js | 20+ (backend host) |
| Permissions | Standard user (some diagnostics require admin) |

---

## License

Proprietary — internal use only. © 2026 DeskSOS Team. All rights reserved.
