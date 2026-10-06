const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync, spawnSync } = require("child_process");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const script = path.join(__dirname, "..", "scripts", "reset-password.js");

describe("scripts/reset-password.js", () => {
  let dir, dbPath;
  const run = (...args) =>
    spawnSync(process.execPath, [script, ...args], { env: { ...process.env, DATABASE_PATH: dbPath }, encoding: "utf8" });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "desksos-reset-"));
    dbPath = path.join(dir, "test.db");
    const db = new Database(dbPath);
    db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL)");
    const insert = db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)");
    insert.run("1", "Admin", "admin@desksos.com", bcrypt.hashSync("old-admin-pw", 4), "admin");
    insert.run("2", "Tech", "tech@desksos.com", bcrypt.hashSync("old-tech-pw", 4), "technician");
    db.close();
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const hashOf = (email) => {
    const db = new Database(dbPath, { readonly: true }); // closed so Windows can delete the temp dir
    try { return db.prepare("SELECT password FROM users WHERE email = ?").get(email).password; } finally { db.close(); }
  };

  it("sets a new random password for that account only, and prints it once", () => {
    const res = run("ADMIN@desksos.com"); // email match ignores case
    expect(res.status).toBe(0);
    const printed = res.stdout.match(/New password: (\S+)/)[1];
    expect(printed).toHaveLength(16);
    expect(bcrypt.compareSync(printed, hashOf("admin@desksos.com"))).toBe(true);
    expect(bcrypt.compareSync("old-admin-pw", hashOf("admin@desksos.com"))).toBe(false);
    expect(bcrypt.compareSync("old-tech-pw", hashOf("tech@desksos.com"))).toBe(true);
  });

  it("lists accounts without changing anything", () => {
    const before = hashOf("admin@desksos.com");
    const out = execFileSync(process.execPath, [script, "--list"], { env: { ...process.env, DATABASE_PATH: dbPath }, encoding: "utf8" });
    expect(out).toMatch(/admin\s+admin@desksos\.com/);
    expect(out).toMatch(/technician\s+tech@desksos\.com/);
    expect(hashOf("admin@desksos.com")).toBe(before);
  });

  it("fails without changes for an unknown email, a missing database, or no arguments", () => {
    expect(run("nobody@desksos.com").status).toBe(1);
    expect(spawnSync(process.execPath, [script, "admin@desksos.com"], { env: { ...process.env, DATABASE_PATH: path.join(dir, "missing.db") }, encoding: "utf8" }).status).toBe(1);
    expect(run().status).toBe(1);
    expect(fs.existsSync(path.join(dir, "missing.db"))).toBe(false);
  });
});
