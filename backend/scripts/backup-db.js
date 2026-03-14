#!/usr/bin/env node
/**
 * DeskSOS — SQLite hot backup
 *
 * Uses better-sqlite3's .backup() which performs an online backup while the
 * database is live (WAL-safe, no exclusive lock required).
 *
 * Usage (manual):
 *   node scripts/backup-db.js
 *
 * Usage (scheduled — Windows Task Scheduler):
 *   Action:  node "C:\...\backend\scripts\backup-db.js"
 *   Trigger: daily at 02:00
 *
 * Usage (scheduled — Linux/macOS cron):
 *   0 2 * * * cd /opt/desksos/backend && node scripts/backup-db.js >> /var/log/desksos-backup.log 2>&1
 *
 * Environment variables:
 *   DATABASE_PATH  path to source DB         (default: ./data/desksos.db)
 *   BACKUP_DIR     directory for backups     (default: ./data/backups)
 *   BACKUP_KEEP    number of backups to keep (default: 14, oldest pruned)
 */

"use strict";

const path     = require("path");
const fs       = require("fs");
const Database = require("better-sqlite3");

async function main() {
  const dbPath    = process.env.DATABASE_PATH ?? path.join(__dirname, "..", "data", "desksos.db");
  const backupDir = process.env.BACKUP_DIR    ?? path.join(__dirname, "..", "data", "backups");
  const keepCount = Number(process.env.BACKUP_KEEP ?? "14");

  if (!fs.existsSync(dbPath)) {
    console.error(`[backup] Source database not found: ${dbPath}`);
    process.exit(1);
  }

  fs.mkdirSync(backupDir, { recursive: true });

  // Timestamped filename: desksos-2026-03-13T02-00-00.db
  const stamp    = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
  const destPath = path.join(backupDir, `desksos-${stamp}.db`);

  console.log(`[backup] ${dbPath} -> ${destPath}`);

  const db = new Database(dbPath, { readonly: true });
  try {
    // .backup() returns a Promise in better-sqlite3 v9+
    await db.backup(destPath);
    console.log("[backup] Complete.");
  } finally {
    db.close();
  }

  // ── Prune old backups ──────────────────────────────────────────────────────
  const existing = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith("desksos-") && f.endsWith(".db"))
    .sort(); // ISO timestamps sort lexicographically = oldest first

  const toPrune = existing.slice(0, Math.max(0, existing.length - keepCount));
  for (const f of toPrune) {
    fs.unlinkSync(path.join(backupDir, f));
    console.log(`[backup] Pruned old backup: ${f}`);
  }

  console.log(`[backup] Kept ${Math.min(existing.length, keepCount)} backup(s) in ${backupDir}`);
}

main().catch((err) => {
  console.error("[backup] Fatal error:", err.message);
  process.exit(1);
});
