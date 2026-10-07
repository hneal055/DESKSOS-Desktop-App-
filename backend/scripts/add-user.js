#!/usr/bin/env node
/**
 * DeskSOS — create (or remove) a user account from the server
 *
 * Desktop has no user-management screen, so this is how an administrator
 * gives each person their own account. It writes straight to the database,
 * so the backend can stay running.
 *
 * Usage (from backend/):
 *   node scripts/add-user.js --prod --name "Jane Doe" --email jane@example.com            # technician
 *   node scripts/add-user.js --prod --name "Sam Lee"  --email sam@example.com --role admin
 *   node scripts/add-user.js --prod --remove jane@example.com
 *   node scripts/add-user.js --prod --list
 *
 * A new account gets a random password, printed once. Hand it over in person,
 * by phone or by text, never by email. The user can change it afterwards with
 * scripts/change-password.ps1.
 *
 * Database: --prod uses data/desksos-prod.db; otherwise DATABASE_PATH, then
 * data/desksos.db (the same defaults as the backend and reset-password.js).
 *
 * Removing an account stops new sign-ins at once, but a session that is
 * already signed in stays valid until its token expires (up to 7 days),
 * because the backend doesn't re-check the account on each request. To end
 * every session now: pwsh scripts/rotate-secret.ps1 -Restart (signs everyone out).
 */

"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const ROLES = ["technician", "admin"];
const usage = [
  "Usage:",
  "  node scripts/add-user.js [--prod] --name <name> --email <email> [--role technician|admin]",
  "  node scripts/add-user.js [--prod] --remove <email>",
  "  node scripts/add-user.js [--prod] --list",
].join("\n");

// ── Arguments ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = { prod: false, list: false };
const valued = new Set(["--name", "--email", "--role", "--remove"]);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--help") { console.log(usage); process.exit(0); }
  if (a === "--prod") { opts.prod = true; continue; }
  if (a === "--list") { opts.list = true; continue; }
  if (valued.has(a)) {
    const v = args[i + 1];
    if (v === undefined || v.startsWith("--")) { console.error(`${a} needs a value.\n${usage}`); process.exit(1); }
    opts[a.slice(2)] = v;
    i++;
    continue;
  }
  // A mistyped option must not silently fall back to another database or role
  console.error(`Unknown argument: ${a}\n${usage}`);
  process.exit(1);
}
const modes = [opts.list, opts.remove !== undefined, opts.name !== undefined || opts.email !== undefined].filter(Boolean).length;
if (modes !== 1) { console.error(usage); process.exit(1); }

const dataDir = path.join(__dirname, "..", "data");
const dbPath = opts.prod ? path.join(dataDir, "desksos-prod.db")
                         : process.env.DATABASE_PATH ?? path.join(dataDir, "desksos.db");
if (!fs.existsSync(dbPath)) { console.error(`Database not found: ${dbPath}`); process.exit(1); }
const db = new Database(dbPath, { fileMustExist: true });
db.pragma("busy_timeout = 5000"); // the running backend may hold a brief lock

const findByEmail = (email) => db.prepare("SELECT id, name, email, role FROM users WHERE email = ? COLLATE NOCASE").get(email);

// ── List ─────────────────────────────────────────────────────────────────────
if (opts.list) {
  const users = db.prepare("SELECT email, name, role FROM users ORDER BY email").all();
  console.log(`Accounts in ${dbPath}:`);
  for (const u of users) console.log(`  ${u.role.padEnd(10)}  ${u.email}  (${u.name})`);
  process.exit(0);
}

// ── Remove ───────────────────────────────────────────────────────────────────
if (opts.remove !== undefined) {
  const user = findByEmail(opts.remove);
  if (!user) { console.error(`No account with email ${opts.remove} in ${dbPath}. Use --list to see accounts.`); process.exit(1); }
  if (user.role === "admin") {
    const admins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get().c;
    if (admins <= 1) { console.error("That's the only admin account; create another admin first."); process.exit(1); }
  }
  // Tickets keep their history: only the user row goes
  db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  console.log(`Removed ${user.email} (${user.role}) from ${dbPath}.`);
  console.log("New sign-ins are refused now. A session already signed in stays valid until it expires (up to 7 days);");
  console.log("to end every session at once: pwsh scripts/rotate-secret.ps1 -Restart  (signs everyone out)");
  process.exit(0);
}

// ── Add ──────────────────────────────────────────────────────────────────────
const name = (opts.name ?? "").trim();
const email = (opts.email ?? "").trim().toLowerCase();
const role = (opts.role ?? "technician").trim().toLowerCase();
const problems = [];
if (!name) problems.push("--name is required");
if (name.length > 100) problems.push("--name must be at most 100 characters");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push("--email must be a valid email address");
if (!ROLES.includes(role)) problems.push(`--role must be one of ${ROLES.join(", ")}`);
if (problems.length) { console.error(problems.join("\n") + "\n" + usage); process.exit(1); }
if (findByEmail(email)) { console.error(`An account with email ${email} already exists. Use reset-password.js to give it a new password.`); process.exit(1); }

const password = crypto.randomBytes(12).toString("base64url"); // 16 characters
db.prepare("INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)")
  .run(crypto.randomUUID(), name, email, bcrypt.hashSync(password, 10), role);

console.log("=".repeat(64));
console.log(`  Created ${email} (${role}) for ${name}`);
console.log(`  Database: ${dbPath}`);
console.log(`  Password: ${password}`);
console.log("  It is shown only once. Give it to them in person, by phone or text.");
console.log("  They sign in to the DeskSOS app with this email and password.");
console.log("=".repeat(64));
