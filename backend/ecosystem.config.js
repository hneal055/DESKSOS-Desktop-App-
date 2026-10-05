/**
 * PM2 process manager config for DeskSOS backend.
 *
 * Usage:
 *   npm install -g pm2          # install PM2 once
 *   npm run build               # compile TypeScript -> dist/
 *   pm2 start ecosystem.config.js --env production
 *
 *   pm2 save                    # persist across reboots
 *   pm2 startup                 # install OS startup hook
 *
 * Common commands:
 *   pm2 status                  # process list
 *   pm2 logs desksos-backend    # tail logs
 *   pm2 reload desksos-backend  # zero-downtime restart
 *   pm2 stop   desksos-backend
 */

const path = require("path");

module.exports = {
  apps: [
    {
      name: "desksos-backend",
      script: "dist/server.js",
      cwd: __dirname,

      // ── Instance & restart policy ────────────────────────────────────────
      instances: 1,               // single instance (SQLite is not concurrent-write safe)
      exec_mode: "fork",          // fork (not cluster) for SQLite compatibility
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",          // must stay up 10 s to count as a successful start
      restart_delay: 3000,        // wait 3 s between crash-restarts

      // ── Monitoring ───────────────────────────────────────────────────────
      max_memory_restart: "512M", // restart if RSS exceeds 512 MB

      // ── Log management ───────────────────────────────────────────────────
      // Access logs are written by Morgan -> rotating-file-stream (logs/access.log).
      // PM2 captures stdout/stderr separately.
      out_file : "logs/pm2-out.log",
      error_file: "logs/pm2-err.log",
      merge_logs: false,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // ── Environment: development ─────────────────────────────────────────
      env: {
        NODE_ENV: "development",
        PORT: "5000",
      },

      // ── Environment: production ──────────────────────────────────────────
      // Production shares this PC with development, so it gets its own port
      // and database; dev (npm run dev) keeps 5000/HTTP and data/desksos.db.
      // TLS paths live here rather than in .env so dev stays on plain HTTP.
      // JWT_SECRET still comes from backend/.env (excluded from git).
      env_production: {
        NODE_ENV: "production",
        PORT: "5443",
        TLS_CERT_PATH: "./certs/server.crt",
        TLS_KEY_PATH: "./certs/server.key",
        DATABASE_PATH: "./data/desksos-prod.db",

        // Forward new tickets to DeskSOS Enterprise production (same PC).
        // The key is a secret: it lives in backend/.env.production as
        // ENTERPRISE_INGEST_KEY (set it with the Enterprise repo's
        // rotate-ingest-key.ps1 -Production). Without it the bridge stays off.
        ENTERPRISE_INGEST_URL: process.env.DESKSOS_ENTERPRISE_URL || "https://localhost:5543/api/ingest/incidents",
        ENTERPRISE_SOURCE: "desksos-desktop-prod",
        // Node doesn't use the Windows certificate store, so trust the mkcert
        // CA that issued Enterprise's certificate. Read once at startup.
        NODE_EXTRA_CA_CERTS: process.env.DESKSOS_CA_CERT || path.join(process.env.LOCALAPPDATA || "", "mkcert", "rootCA.pem"),
      },
    },
  ],
};
