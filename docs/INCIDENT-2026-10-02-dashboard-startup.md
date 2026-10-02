# Incident Report: Local Dashboard Startup Restored

**Date:** 2026-10-02
**Scope:** DeskSOS Desktop: Tauri/React dashboard (`tauri-app/`) and Express API (`backend/`), local development on Windows
**Status:** Resolved for local development. Follow-up items listed at the end.

---

## Summary

The desktop dashboard would not come up locally. The first report blamed two things: Vite binding to IPv6 vs IPv4, and CORS blocking login. Investigation showed CORS was already configured correctly in the backend that actually runs. The real blockers were:

1. Uncommitted changes that replaced working code with stand-in versions. These covered the backend entry file, the Rust command layer, and the main React UI. The Rust changes stopped the app compiling at all.
2. The real backend refusing to start because of a `JWT_SECRET` conflict on the machine.
3. Port 5000 already being taken by a different project's backend.
4. The backend's `npm run dev` script being broken (already broken before this incident).

All four were fixed or worked around, and the dashboard now launches from the committed code.

---

## Timeline of actions

### 1. Reviewed the proposed fix
The first fix proposal changed `tauri-app/vite.config.ts` and `backend/server.js`.

- **Vite change (kept):** `host: "127.0.0.1"` was added to the dev server config. This forces Vite onto IPv4 so it doesn't hit the Windows `localhost` → `::1` (IPv6) mismatch. The change is correct and harmless.
- **`backend/server.js` change (rejected):** this was a full rewrite, not just a CORS tweak. It:
  - stopped using every real route module (auth, dashboard, chat, assets, network, tickets)
  - added a stand-in login that accepted `admin@desksos.com` with **any password**
  - removed JWT checks on Socket.IO connections
  - removed `.env` loading, the `/health` endpoint, and `module.exports`

  `backend/server.js` was restored from git, and the rewritten version was saved to `C:\tmp\server.js.mock-backup`.

### 2. Found the real backend entry point
`npm start`, the Dockerfile and Railway all run `backend/dist/server.js`. That file is compiled from **`backend/src/server.ts`**, not from the root `backend/server.js`.

- The real server already restricts CORS to an allow-list in `backend/src/config.ts`: `http://localhost:1420`, `tauri://localhost`, `https://tauri.localhost` and `http://tauri.localhost`. Commit `9d5c7c7` added this. **No CORS code change was needed.**
- The root `backend/server.js` was an old, unused entry file. It was **deleted** so nobody edits the wrong file again.
- `tauri-app/Install-DeskSOS.ps1` now builds the backend if needed and starts `node dist/server.js` instead of `node server.js`.
- `PROJECT-STRUCTURE.md` now describes the `src/` → `dist/` layout.

### 3. Fixed the backend failing to start (`JWT_SECRET`)
The real server refuses to start unless `JWT_SECRET` is at least 32 characters. It kept failing even after the secret was rotated with `backend/scripts/rotate-secret.ps1`.

- **Root cause:** a `JWT_SECRET` (28 characters) is set as a **Windows user environment variable**. `dotenv` never overrides variables that already exist, so the value in `backend/.env` was ignored.
- **Workaround:** the backend was started with `JWT_SECRET` set to the `.env` value for that one process. The user-level variable was left alone, since it probably belongs to the other project (see step 4).

### 4. Worked around the port 5000 conflict
Port 5000 was held by PM2 running `desksos-backend` from a **different project** (`C:\Projects\DESKSOS\backend\server`). That service was healthy and was not touched.

- This repo's backend was started on **port 5001** instead.
- `http://localhost:5001` and `ws://localhost:5001` were added to the CSP `connect-src` in `tauri-app/src-tauri/tauri.conf.json` so the app is allowed to connect to it.
- The dashboard was launched with `VITE_API_URL=http://localhost:5001`.

### 5. Worked around the broken `npm run dev`
`npm run dev` (`ts-node src/server.ts`) fails with `Cannot find module './config.js'`, because `ts-node` can't resolve the `.js` import paths used in the TypeScript source. This was already broken before this incident. The compiled build works, so the backend was run as `node dist/server.js` after `npm run build`.

### 6. Fixed the Rust compile failure
The first `tauri dev` run failed with 15 compile errors in `tauri-app/src-tauri/src/lib.rs`. Uncommitted code had pasted a second copy of `get_top_processes`, `kill_process` and the `Serialize` import, plus **two extra `run()` functions** that registered only those two commands, on top of the existing ones.

The related uncommitted `tauri-app/src/App.tsx` change had also replaced the whole dashboard (login, auth check and all modules) with a single process-list page.

- `App.tsx`, `lib.rs` and `Cargo.toml` were restored from git. Copies of the replaced versions are in `C:\tmp\desksos-rewrite-backup\`.
- `tauri dev` rebuilt automatically, compiled cleanly (in about 22 seconds), and started `target\debug\desksos.exe`.

---

## Verification

| Check | Result |
|---|---|
| Backend test suite (`npm test`, Jest) | 57/57 passed |
| `npm run build` (backend) | Succeeded |
| Backend health, `GET http://localhost:5001/health` | 200 |
| CORS from `http://localhost:1420` and `http://tauri.localhost` | Allowed, correct `Access-Control-Allow-Origin` |
| CORS from an unknown origin | Blocked |
| `POST /auth/login` (`admin@desksos.com`) from the app's origin | 200, token returned |
| Vite dev server, `http://127.0.0.1:1420` | 200 |
| Tauri app process (`desksos.exe`) | Running |
| `Install-DeskSOS.ps1` syntax check | 0 errors (the full installer was not run) |

**Not yet verified:** logging in through the dashboard window itself and clicking through its modules.

---

## How to start the dashboard locally (current state)

```powershell
# Terminal 1: backend API on 5001 (5000 is used by the other DESKSOS project)
cd backend
npm run build
$env:PORT = '5001'
$env:JWT_SECRET = ((Select-String -Path .env -Pattern '^JWT_SECRET=(.*)$').Matches[0].Groups[1].Value.Trim())
node dist/server.js

# Terminal 2: dashboard window
cd tauri-app
$env:VITE_API_URL = 'http://localhost:5001'
npm run tauri:dev
```

Default login: `admin@desksos.com` / `password123`

---

## Files changed

| File | Change |
|---|---|
| `tauri-app/vite.config.ts` | Added `host: "127.0.0.1"` (IPv4 binding) |
| `tauri-app/src-tauri/tauri.conf.json` | Added `localhost:5001` (http/ws) to the CSP `connect-src` |
| `backend/server.js` | Deleted (unused old entry file) |
| `tauri-app/Install-DeskSOS.ps1` | Builds the backend if needed, then starts `dist/server.js` |
| `PROJECT-STRUCTURE.md` | Run instructions and backend tree updated to the `src/` / `dist/` layout |
| `backend/.env` | `JWT_SECRET` rotated (not committed; file is gitignored) |
| `tauri-app/src/App.tsx`, `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml` | Uncommitted changes reverted to the committed versions (backups in `C:\tmp\desksos-rewrite-backup\`) |

None of these changes are committed yet.

---

## Follow-up items

1. **User-level `JWT_SECRET` variable:** confirm which project needs it. Remove it, or make it at least 32 characters, so the backend and the installer's "Start backend" option work without the per-process override.
2. **`npm run dev` is broken:** fix how `ts-node` resolves the `.js` import paths. Until then, `PROJECT-STRUCTURE.md` points to a dev command that doesn't work.
3. **CORS rejection returns HTTP 500:** `backend/src/server.ts:51` passes an `Error` to the CORS callback. Using `callback(null, false)` would give a normal rejection.
4. **Leftover old backend files:** `backend/routes/`, `backend/middleware/`, `backend/data/store.js` and `backend/db.js` were only used by the deleted `server.js` and can probably be removed.
5. **Port conflict:** decide whether this project should keep using 5001 locally, or whether the other project's PM2 service should move.
