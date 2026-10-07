const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawnSync } = require("child_process");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const script = path.join(__dirname, "..", "scripts", "add-user.js");

describe("scripts/add-user.js", () => {
  let dir, dbPath;
  const run = (...args) =>
    spawnSync(process.execPath, [script, ...args], { env: { ...process.env, DATABASE_PATH: dbPath }, encoding: "utf8" });
  const query = (sql, ...p) => {
    const db = new Database(dbPath, { readonly: true }); // closed so Windows can delete the temp dir
    try { return db.prepare(sql).all(...p); } finally { db.close(); }
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "desksos-adduser-"));
    dbPath = path.join(dir, "test.db");
    const db = new Database(dbPath);
    db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'technician')");
    db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)").run("1", "Admin", "admin@desksos.com", bcrypt.hashSync("x", 4), "admin");
    db.close();
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("creates a technician by default with a working one-time password", () => {
    const res = run("--name", "Jane Doe", "--email", "Jane@Example.com");
    expect(res.status).toBe(0);
    const pw = res.stdout.match(/Password: (\S+)/)[1];
    expect(pw).toHaveLength(16);
    const [u] = query("SELECT * FROM users WHERE email = ?", "jane@example.com"); // stored lowercase
    expect(u).toMatchObject({ name: "Jane Doe", role: "technician" });
    expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(bcrypt.compareSync(pw, u.password)).toBe(true);
  });

  it("creates an admin when asked", () => {
    expect(run("--name", "Sam", "--email", "sam@example.com", "--role", "admin").status).toBe(0);
    expect(query("SELECT role FROM users WHERE email = 'sam@example.com'")[0].role).toBe("admin");
  });

  it("refuses duplicates, bad input, unknown options and conflicting modes without changes", () => {
    for (const a of [
      ["--name", "Dup", "--email", "ADMIN@desksos.com"],          // duplicate (case-insensitive)
      ["--name", "X", "--email", "not-an-email"],
      ["--name", "X", "--email", "x@example.com", "--role", "owner"],
      ["--email", "x@example.com"],                                // missing name
      ["--name", "X", "--email", "x@example.com", "--prodd"],      // mistyped option
      ["--name", "X", "--email", "x@example.com", "--list"],       // two modes
      ["--name"],                                                  // missing value
    ]) {
      expect(run(...a).status).toBe(1);
    }
    expect(query("SELECT COUNT(*) AS c FROM users")[0].c).toBe(1);
  });

  it("removes an account, but never the only admin", () => {
    run("--name", "Jane", "--email", "jane@example.com");
    const res = run("--remove", "JANE@example.com");
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/rotate-secret\.ps1/); // explains existing sessions
    expect(query("SELECT COUNT(*) AS c FROM users WHERE email = 'jane@example.com'")[0].c).toBe(0);
    expect(run("--remove", "admin@desksos.com").status).toBe(1);
    expect(run("--remove", "nobody@example.com").status).toBe(1);
    expect(query("SELECT COUNT(*) AS c FROM users")[0].c).toBe(1);
  });

  it("lists accounts without changing anything", () => {
    const res = run("--list");
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/admin\s+admin@desksos\.com/);
  });
});
