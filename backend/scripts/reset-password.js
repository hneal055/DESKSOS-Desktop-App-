#!/usr/bin/env node
/**
 * DeskSOS — account recovery from the server
 *
 * Sets a user's password to a new random one, printed once. For when nobody
 * knows the current password, so scripts/change-password.ps1 can't be used.
 * Writes straight to the database, so the backend doesn't need to be running.
 *
 * Usage (from backend/):
 *   node scripts/reset-password.js --prod admin@desksos.com   # production DB
 *   node scripts/reset-password.js --prod --list              # show accounts
 *   node scripts/reset-password.js admin@desksos.com          # dev DB
 *
 * Database: --prod uses data/desksos-prod.db; otherwise DATABASE_PATH, then
 * data/desksos.db (the same defaults as the backend).
 *
 * Afterwards, sign in with the printed password and set your own with
 * scripts/change-password.ps1. Sessions already signed in stay valid until
 * their token expires; to end every session, run rotate-secret.ps1 -Restart.
 */

"use strict";

const path     = require("path");
const fs       = require("fs");
const crypto   = require("crypto");
const Database = require("better-sqlite3");
const bcrypt   = require("bcryptjs");

const args  = process.argv.slice(2);
const prod  = args.includes("--prod");
const list  = args.includes("--list");
const email = args.find((a) => !a.startsWith("--"));
const usage = "Usage: node scripts/reset-password.js [--prod] <email>   |   [--prod] --list";

if (args.includes("--help")) {
  console.log(usage);
  process.exit(0);
}
// A mistyped option (e.g. --prodd) must not silently fall back to the dev database
const unknown = args.filter((a) => a.startsWith("--") && a !== "--prod" && a !== "--list");
if (unknown.length || args.filter((a) => !a.startsWith("--")).length > 1 || (!list && !email)) {
  if (unknown.length) console.error(`Unknown option: ${unknown.join(", ")}`);
  console.error(usage);
  process.exit(1);
}

const dataDir = path.join(__dirname, "..", "data");
const dbPath  = prod ? path.join(dataDir, "desksos-prod.db")
                     : process.env.DATABASE_PATH ?? path.join(dataDir, "desksos.db");

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { fileMustExist: true });
db.pragma("busy_timeout = 5000"); // the running backend may hold a brief lock

if (list) {
  const users = db.prepare("SELECT email, name, role FROM users ORDER BY email").all();
  console.log(`Accounts in ${dbPath}:`);
  for (const u of users) console.log(`  ${u.role.padEnd(10)}  ${u.email}  (${u.name})`);
  process.exit(0);
}

const user = db.prepare("SELECT id, email, role FROM users WHERE email = ? COLLATE NOCASE").get(email);
if (!user) {
  console.error(`No account with email ${email} in ${dbPath}. Use --list to see accounts.`);
  process.exit(1);
}

const password = crypto.randomBytes(12).toString("base64url"); // 16 characters
db.prepare("UPDATE users SET password = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), user.id);

console.log("=".repeat(64));
console.log(`  Password reset for ${user.email} (${user.role})`);
console.log(`  Database: ${dbPath}`);
console.log(`  New password: ${password}`);
console.log("  It is shown only once. Sign in, then set your own with:");
console.log(`    pwsh scripts/change-password.ps1 -Email ${user.email}`);
console.log("=".repeat(64));
