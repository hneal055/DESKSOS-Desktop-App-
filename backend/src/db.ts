import crypto from "crypto";
import path from "path";
import Database, { Database as DB } from "better-sqlite3";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const DB_PATH: string =
  process.env.DATABASE_PATH ?? path.join(__dirname, "..", "data", "desksos.db");

const db: DB = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---- Schema ------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    email    TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role     TEXT NOT NULL DEFAULT 'technician'
  );
  CREATE TABLE IF NOT EXISTS tickets (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    description   TEXT,
    status        TEXT NOT NULL DEFAULT 'open',
    priority      TEXT NOT NULL DEFAULT 'P3',
    assignee_id   TEXT,
    assignee_name TEXT,
    requester     TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    resolved_at   TEXT
  );
  CREATE TABLE IF NOT EXISTS channels (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    unread_count INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS messages (
    id         TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    user_name  TEXT NOT NULL,
    text       TEXT NOT NULL,
    timestamp  TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS assets (
    id            TEXT PRIMARY KEY,
    code          TEXT UNIQUE NOT NULL,
    type          TEXT,
    status        TEXT,
    serial_number TEXT,
    location      TEXT,
    assigned_user TEXT
  );
  CREATE TABLE IF NOT EXISTS asset_maintenance (
    id          TEXT PRIMARY KEY,
    asset_id    TEXT NOT NULL,
    date        TEXT,
    description TEXT,
    technician  TEXT
  );
  CREATE TABLE IF NOT EXISTS team_members (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    status         TEXT DEFAULT 'offline',
    active_tickets INTEGER DEFAULT 0
  );
`);

// ---- Seed (runs once on first launch) ----------------------------------------
function seedIfEmpty(): void {
  const count = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
  if (count > 0) return;

  const now = Date.now();

  const isProd = process.env.NODE_ENV === "production";

  // In production: generate random passwords and print them ONCE; in dev use fixed passwords for convenience
  const adminPwd = isProd ? crypto.randomBytes(16).toString("hex") : "password123";
  const techPwd  = isProd ? crypto.randomBytes(16).toString("hex") : "password123";

  const insUser = db.prepare(
    "INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)"
  );
  insUser.run("1", "Admin User", "admin@desksos.com", bcrypt.hashSync(adminPwd, 10), "admin");
  insUser.run("2", "Tech User",  "tech@desksos.com",  bcrypt.hashSync(techPwd,  10), "technician");

  if (isProd) {
    console.log("=".repeat(60));
    console.log("  DESKSOS FIRST-RUN CREDENTIALS — SAVE THESE NOW");
    console.log("  They will NOT be shown again.");
    console.log("=".repeat(60));
    console.log(`  Admin:      admin@desksos.com  /  ${adminPwd}`);
    console.log(`  Technician: tech@desksos.com   /  ${techPwd}`);
    console.log("=".repeat(60));
    console.log("  Change both passwords immediately after first login.");
    console.log("=".repeat(60));
  }

  const insCh = db.prepare("INSERT INTO channels (id,name,unread_count) VALUES (?,?,?)");
  insCh.run("ch1", "general",       2);
  insCh.run("ch2", "incidents",     0);
  insCh.run("ch3", "announcements", 1);

  const insMsg = db.prepare(
    "INSERT INTO messages (id,channel_id,user_id,user_name,text,timestamp) VALUES (?,?,?,?,?,?)"
  );
  insMsg.run(uuidv4(), "ch1", "1", "Admin User", "Welcome to DeskSOS!",                    new Date(now - 3600000).toISOString());
  insMsg.run(uuidv4(), "ch1", "2", "Tech User",  "Thanks, great tool!",                    new Date(now - 1800000).toISOString());
  insMsg.run(uuidv4(), "ch2", "1", "Admin User", "P1 incident resolved - network outage on floor 3", new Date(now - 7200000).toISOString());
  insMsg.run(uuidv4(), "ch3", "1", "Admin User", "Maintenance window tonight 11pm - 1am",  new Date(now - 86400000).toISOString());

  const insAsset = db.prepare(
    "INSERT INTO assets (id,code,type,status,serial_number,location,assigned_user) VALUES (?,?,?,?,?,?,?)"
  );
  insAsset.run("a1", "ASSET-001", "Laptop",  "Active",    "SN-2024-ABC123", "Floor 2 - Desk 14", "John Smith");
  insAsset.run("a2", "ASSET-002", "Desktop", "In Repair", "SN-2023-XYZ789", "IT Storage Room",   "Unassigned");
  insAsset.run("a3", "ASSET-003", "Monitor", "Active",    "SN-2025-MON456", "Floor 1 - Desk 7",  "Jane Doe");

  const insMaint = db.prepare(
    "INSERT INTO asset_maintenance (id,asset_id,date,description,technician) VALUES (?,?,?,?,?)"
  );
  insMaint.run("m1", "a1", "2025-11-01", "RAM upgrade to 16GB",        "Tech User");
  insMaint.run("m2", "a1", "2026-01-15", "SSD replacement",            "Admin User");
  insMaint.run("m3", "a2", "2026-02-20", "PSU failure - awaiting parts","Tech User");

  const insTeam = db.prepare(
    "INSERT INTO team_members (id,name,status,active_tickets) VALUES (?,?,?,?)"
  );
  insTeam.run("1", "Admin User", "online",  3);
  insTeam.run("2", "Tech User",  "online",  5);
  insTeam.run("3", "Sarah K.",   "away",    1);
  insTeam.run("4", "Mike R.",    "offline", 0);

  const insTicket = db.prepare(`
    INSERT INTO tickets
      (id,title,description,status,priority,assignee_id,assignee_name,requester,created_at,updated_at,resolved_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `);

  type TicketSeed = [string, string, string, string, string, string, string, string, number, number, number | null];
  const seeds: TicketSeed[] = [
    ["T-001","Cannot connect to VPN",                "User reports VPN client fails to connect since yesterday.",             "open",        "P1","2","Tech User", "John Smith",    7200000,  3600000, null],
    ["T-002","Printer offline on Floor 3",            "HP LaserJet showing offline. Print spooler restarted.",                "open",        "P2","2","Tech User", "Amy Chen",     10800000,  9000000, null],
    ["T-003","Outlook not syncing emails",            "User inbox not updating since 9am.",                                   "open",        "P2","1","Admin User","Bob Johnson",  14400000, 12000000, null],
    ["T-004","New laptop setup request",              "Onboarding for new hire starting Monday.",                             "open",        "P3","1","Admin User","HR Dept",      86400000, 82800000, null],
    ["T-005","Blue screen on workstation WS-042",     "BSOD occurring randomly, error IRQL_NOT_LESS_OR_EQUAL.",               "open",        "P1","3","Sarah K.",  "Mark Davis",    1800000,   900000, null],
    ["T-006","Password reset request",                "User locked out after too many failed attempts.",                      "open",        "P3","2","Tech User", "Lisa Wong",     3600000,  3600000, null],
    ["T-007","Slow network on 2nd floor",             "Multiple users reporting slow speeds.",                                "open",        "P1","1","Admin User","Floor 2 Staff", 5400000,  4800000, null],
    ["T-008","Monitor flickering WS-017",             "External monitor flickers intermittently.",                            "open",        "P3","2","Tech User", "Carlos M.",    21600000, 18000000, null],
    ["T-009","Software installation - AutoCAD",       "Architect team needs AutoCAD 2026 installed.",                         "open",        "P2","3","Sarah K.",  "Design Team",  43200000, 39600000, null],
    ["T-010","Shared drive permissions issue",        "Finance team cannot access Q1 reports folder.",                        "open",        "P2","1","Admin User","Finance Dept", 28800000, 25200000, null],
    ["T-011","Webcam not detected in Teams",          "Logitech C920 not showing in Teams device settings.",                  "open",        "P3","2","Tech User", "Tom Baker",    54000000, 50400000, null],
    ["T-012","Keyboard unresponsive WS-009",          "Wireless keyboard stops responding after ~10 mins.",                   "open",        "P3","2","Tech User", "Nina Patel",   36000000, 32400000, null],
    ["T-013","Email migration to M365",               "Migrating 50 mailboxes from on-prem Exchange to M365.",               "in-progress", "P1","1","Admin User","IT Director",172800000,  7200000, null],
    ["T-014","Server room heat alarm",                "Sensor triggered at 28C. HVAC contacted.",                            "in-progress", "P1","1","Admin User","Facilities",   10800000,  1800000, null],
    ["T-015","Deploy Windows 11 update KB5",          "Rolling out cumulative update to 120 endpoints.",                     "in-progress", "P2","2","Tech User", "Security Team",259200000, 3600000, null],
    ["T-016","VoIP phone config - Exec Suite",        "Configuring 8 new Polycom phones in executive suite.",                "in-progress", "P2","2","Tech User", "Office Mgr",   86400000, 14400000, null],
    ["T-017","AD group policy review",                "Annual GPO audit. Reviewing 45 policies.",                            "in-progress", "P2","1","Admin User","Compliance",  432000000, 21600000, null],
    ["T-018","Backup restore test",                   "Monthly DR test - restoring VM snapshot.",                            "in-progress", "P3","3","Sarah K.",  "IT Manager",   21600000,  7200000, null],
    ["T-019","SSL cert renewal - intranet",           "Wildcard cert expiring in 14 days.",                                  "in-progress", "P1","1","Admin User","Web Team",     72000000, 10800000, null],
    ["T-020","DNS resolution fixed",                  "Flushed DNS cache and updated forwarders.",                           "resolved",    "P1","1","Admin User","IT Staff",     86400000, 43200000, 43200000],
    ["T-021","Teams meeting room AV fixed",           "Surface Hub restarted and firmware updated.",                         "resolved",    "P2","2","Tech User", "Facilities",  172800000, 86400000, 86400000],
    ["T-022","Malware removed from WS-031",           "Quarantined and removed PUP.Optional. Full scan clean.",              "resolved",    "P1","2","Tech User", "Security",    259200000,172800000,172800000],
  ];

  for (const [id, title, desc, status, priority, aId, aName, req, cOff, uOff, rOff] of seeds) {
    insTicket.run(
      id, title, desc, status, priority, aId, aName, req,
      new Date(now - cOff).toISOString(),
      new Date(now - uOff).toISOString(),
      rOff !== null ? new Date(now - rOff).toISOString() : null
    );
  }
}

seedIfEmpty();

export default db;

