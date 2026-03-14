const path    = require('path');
const Database = require('better-sqlite3');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'data', 'desksos.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---- Schema ----------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    email    TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role     TEXT NOT NULL DEFAULT 'technician'
  );
  CREATE TABLE IF NOT EXISTS tickets (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    description  TEXT,
    status       TEXT NOT NULL DEFAULT 'open',
    priority     TEXT NOT NULL DEFAULT 'P3',
    assignee_id  TEXT,
    assignee_name TEXT,
    requester    TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    resolved_at  TEXT
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

// ---- Seed (runs once on first launch) --------------------------------------
function seedIfEmpty() {
  if (db.prepare('SELECT COUNT(*) as c FROM users').get().c > 0) return;

  const now = Date.now();

  // Users
  const insUser = db.prepare('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)');
  insUser.run('1','Admin User','admin@desksos.com', bcrypt.hashSync('password123',10),'admin');
  insUser.run('2','Tech User', 'tech@desksos.com',  bcrypt.hashSync('password123',10),'technician');

  // Channels
  const insCh = db.prepare('INSERT INTO channels (id,name,unread_count) VALUES (?,?,?)');
  insCh.run('ch1','general',2);
  insCh.run('ch2','incidents',0);
  insCh.run('ch3','announcements',1);

  // Messages
  const insMsg = db.prepare('INSERT INTO messages (id,channel_id,user_id,user_name,text,timestamp) VALUES (?,?,?,?,?,?)');
  insMsg.run(uuidv4(),'ch1','1','Admin User','Welcome to DeskSOS!',           new Date(now-3600000).toISOString());
  insMsg.run(uuidv4(),'ch1','2','Tech User', 'Thanks, great tool!',           new Date(now-1800000).toISOString());
  insMsg.run(uuidv4(),'ch2','1','Admin User','P1 incident resolved - network outage on floor 3', new Date(now-7200000).toISOString());
  insMsg.run(uuidv4(),'ch3','1','Admin User','Maintenance window tonight 11pm - 1am',             new Date(now-86400000).toISOString());

  // Assets
  const insAsset = db.prepare('INSERT INTO assets (id,code,type,status,serial_number,location,assigned_user) VALUES (?,?,?,?,?,?,?)');
  insAsset.run('a1','ASSET-001','Laptop', 'Active',   'SN-2024-ABC123','Floor 2 - Desk 14','John Smith');
  insAsset.run('a2','ASSET-002','Desktop','In Repair','SN-2023-XYZ789','IT Storage Room',  'Unassigned');
  insAsset.run('a3','ASSET-003','Monitor','Active',   'SN-2025-MON456','Floor 1 - Desk 7', 'Jane Doe');

  const insMaint = db.prepare('INSERT INTO asset_maintenance (id,asset_id,date,description,technician) VALUES (?,?,?,?,?)');
  insMaint.run('m1','a1','2025-11-01','RAM upgrade to 16GB','Tech User');
  insMaint.run('m2','a1','2026-01-15','SSD replacement','Admin User');
  insMaint.run('m3','a2','2026-02-20','PSU failure - awaiting parts','Tech User');

  // Team
  const insTeam = db.prepare('INSERT INTO team_members (id,name,status,active_tickets) VALUES (?,?,?,?)');
  insTeam.run('1','Admin User','online',3);
  insTeam.run('2','Tech User', 'online',5);
  insTeam.run('3','Sarah K.',  'away',  1);
  insTeam.run('4','Mike R.',   'offline',0);

  // Tickets
  const insTicket = db.prepare(`
    INSERT INTO tickets (id,title,description,status,priority,assignee_id,assignee_name,requester,created_at,updated_at,resolved_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `);
  const T = (id,title,desc,status,priority,aId,aName,req,cOff,uOff,rOff) => insTicket.run(
    id,title,desc,status,priority,aId,aName,req,
    new Date(now-cOff).toISOString(),
    new Date(now-uOff).toISOString(),
    rOff != null ? new Date(now-rOff).toISOString() : null
  );
  T('T-001','Cannot connect to VPN',                 'User reports VPN client fails to connect since yesterday. Tried reinstalling, same result.',                              'open',        'P1','2','Tech User', 'John Smith',   7200000, 3600000,null);
  T('T-002','Printer offline on Floor 3',             'HP LaserJet showing offline. Print spooler restarted but issue persists.',                                               'open',        'P2','2','Tech User', 'Amy Chen',    10800000, 9000000,null);
  T('T-003','Outlook not syncing emails',             'User inbox not updating since 9am. Other Outlook users on same floor unaffected.',                                       'open',        'P2','1','Admin User','Bob Johnson', 14400000,12000000,null);
  T('T-004','New laptop setup request',               'Onboarding for new hire starting Monday. Needs laptop provisioned with standard IT image.',                              'open',        'P3','1','Admin User','HR Dept',     86400000,82800000,null);
  T('T-005','Blue screen on workstation WS-042',      'BSOD occurring randomly, error IRQL_NOT_LESS_OR_EQUAL. Minidump attached.',                                             'open',        'P1','3','Sarah K.',  'Mark Davis',   1800000,  900000,null);
  T('T-006','Password reset request',                 'User locked out after too many failed attempts. Account requires admin unlock.',                                         'open',        'P3','2','Tech User', 'Lisa Wong',    3600000, 3600000,null);
  T('T-007','Slow network on 2nd floor',              'Multiple users reporting slow speeds. Running speed tests: 2Mbps vs expected 100Mbps.',                                  'open',        'P1','1','Admin User','Floor 2 Staff',5400000, 4800000,null);
  T('T-008','Monitor flickering WS-017',              'External monitor flickers intermittently. Tried different DP cable, still flickering.',                                  'open',        'P3','2','Tech User', 'Carlos M.',   21600000,18000000,null);
  T('T-009','Software installation - AutoCAD',        'Architect team needs AutoCAD 2026 installed on 3 workstations. License keys provided.',                                 'open',        'P2','3','Sarah K.',  'Design Team', 43200000,39600000,null);
  T('T-010','Shared drive permissions issue',         'Finance team cannot access Q1 reports folder. Permissions appear correct in AD.',                                       'open',        'P2','1','Admin User','Finance Dept',28800000,25200000,null);
  T('T-011','Webcam not detected in Teams',           'Logitech C920 not showing in Teams device settings. Works in Device Manager.',                                          'open',        'P3','2','Tech User', 'Tom Baker',   54000000,50400000,null);
  T('T-012','Keyboard unresponsive WS-009',           'Wireless keyboard stops responding after ~10 mins. Battery replaced, same issue.',                                      'open',        'P3','2','Tech User', 'Nina Patel',  36000000,32400000,null);
  T('T-013','Email migration to M365',                'Migrating 50 mailboxes from on-prem Exchange to M365. Phase 1 of 3 in progress.',                                      'in-progress', 'P1','1','Admin User','IT Director', 172800000, 7200000,null);
  T('T-014','Server room heat alarm',                 'Sensor triggered at 28C. HVAC contacted. Monitoring temps every 15 mins.',                                              'in-progress', 'P1','1','Admin User','Facilities',  10800000, 1800000,null);
  T('T-015','Deploy Windows 11 update KB5',           'Rolling out cumulative update to 120 endpoints via SCCM. 63/120 complete.',                                            'in-progress', 'P2','2','Tech User', 'Security Team',259200000,3600000,null);
  T('T-016','VoIP phone config - Exec Suite',         'Configuring 8 new Polycom phones in executive suite. Extension mapping in progress.',                                   'in-progress', 'P2','2','Tech User', 'Office Mgr',  86400000,14400000,null);
  T('T-017','AD group policy review',                 'Annual GPO audit. Reviewing 45 policies for security compliance.',                                                      'in-progress', 'P2','1','Admin User','Compliance',  432000000,21600000,null);
  T('T-018','Backup restore test',                    'Monthly DR test - restoring VM snapshot to test environment and verifying data integrity.',                              'in-progress', 'P3','3','Sarah K.',  'IT Manager',  21600000, 7200000,null);
  T('T-019','SSL cert renewal - intranet',            'Wildcard cert expiring in 14 days. CSR generated, waiting for CA approval.',                                            'in-progress', 'P1','1','Admin User','Web Team',    72000000,10800000,null);
  T('T-020','DNS resolution fixed',                   'Flushed DNS cache and updated forwarders. All users confirmed resolved.',                                               'resolved',    'P1','1','Admin User','IT Staff',    86400000,43200000,43200000);
  T('T-021','Teams meeting room AV fixed',            'Surface Hub restarted and firmware updated. Meeting room back online.',                                                  'resolved',    'P2','2','Tech User', 'Facilities',  172800000,86400000,86400000);
  T('T-022','Malware removed from WS-031',            'Quarantined and removed PUP.Optional. Full scan clean. User briefed on phishing.',                                     'resolved',    'P1','2','Tech User', 'Security',    259200000,172800000,172800000);
}

seedIfEmpty();

module.exports = db;
