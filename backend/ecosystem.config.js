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
      // Secrets (JWT_SECRET, TLS_CERT_PATH, TLS_KEY_PATH) are NOT stored here.
      // Inject them via: pm2 start ecosystem.config.js --env production
      // and set secrets in the host environment or a .env file excluded from git.
      env_production: {
        NODE_ENV: "production",
        PORT: "5000",
      },
    },
  ],
};
