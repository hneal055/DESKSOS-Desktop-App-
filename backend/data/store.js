const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// --- Users ---
const users = [
  { id: '1', name: 'Admin User',  email: 'admin@desksos.com', password: bcrypt.hashSync('password123', 10), role: 'admin' },
  { id: '2', name: 'Tech User',   email: 'tech@desksos.com',  password: bcrypt.hashSync('password123', 10), role: 'technician' },
];

// --- Channels ---
const channels = [
  { id: 'ch1', name: 'general',       unreadCount: 2 },
  { id: 'ch2', name: 'incidents',     unreadCount: 0 },
  { id: 'ch3', name: 'announcements', unreadCount: 1 },
];

// --- Messages ---
const messages = {
  ch1: [
    { id: uuidv4(), channelId: 'ch1', userId: '1', userName: 'Admin User', text: 'Welcome to DeskSOS!',   timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: uuidv4(), channelId: 'ch1', userId: '2', userName: 'Tech User',  text: 'Thanks, great tool!',   timestamp: new Date(Date.now() - 1800000).toISOString() },
  ],
  ch2: [
    { id: uuidv4(), channelId: 'ch2', userId: '1', userName: 'Admin User', text: 'P1 incident resolved - network outage on floor 3', timestamp: new Date(Date.now() - 7200000).toISOString() },
  ],
  ch3: [
    { id: uuidv4(), channelId: 'ch3', userId: '1', userName: 'Admin User', text: 'Maintenance window tonight 11pm - 1am', timestamp: new Date(Date.now() - 86400000).toISOString() },
  ],
};

// --- Assets ---
const assets = {
  'ASSET-001': { id: 'a1', code: 'ASSET-001', type: 'Laptop',  status: 'Active',    serialNumber: 'SN-2024-ABC123', location: 'Floor 2 - Desk 14', assignedUser: 'John Smith', maintenanceHistory: [{ id: 'm1', date: '2025-11-01', description: 'RAM upgrade to 16GB', technician: 'Tech User' }, { id: 'm2', date: '2026-01-15', description: 'SSD replacement', technician: 'Admin User' }] },
  'ASSET-002': { id: 'a2', code: 'ASSET-002', type: 'Desktop', status: 'In Repair', serialNumber: 'SN-2023-XYZ789', location: 'IT Storage Room',    assignedUser: 'Unassigned', maintenanceHistory: [{ id: 'm3', date: '2026-02-20', description: 'PSU failure - awaiting parts', technician: 'Tech User' }] },
  'ASSET-003': { id: 'a3', code: 'ASSET-003', type: 'Monitor', status: 'Active',    serialNumber: 'SN-2025-MON456', location: 'Floor 1 - Desk 7',   assignedUser: 'Jane Doe',   maintenanceHistory: [] },
};

// --- Team ---
const team = [
  { id: '1', name: 'Admin User', status: 'online', activeTickets: 3 },
  { id: '2', name: 'Tech User',  status: 'online', activeTickets: 5 },
  { id: '3', name: 'Sarah K.',   status: 'away',   activeTickets: 1 },
  { id: '4', name: 'Mike R.',    status: 'offline', activeTickets: 0 },
];

// --- Tickets ---
const now = Date.now();
const tickets = [
  { id: 'T-001', title: 'Cannot connect to VPN',              description: 'User reports VPN client fails to connect since yesterday. Tried reinstalling, same result.', status: 'open',        priority: 'P1', assigneeId: '2', assigneeName: 'Tech User',  requester: 'John Smith',    createdAt: new Date(now - 7200000).toISOString(),   updatedAt: new Date(now - 3600000).toISOString(),  resolvedAt: null },
  { id: 'T-002', title: 'Printer offline on Floor 3',         description: 'HP LaserJet showing offline. Print spooler restarted but issue persists.', status: 'open',        priority: 'P2', assigneeId: '2', assigneeName: 'Tech User',  requester: 'Amy Chen',      createdAt: new Date(now - 10800000).toISOString(),  updatedAt: new Date(now - 9000000).toISOString(),  resolvedAt: null },
  { id: 'T-003', title: 'Outlook not syncing emails',         description: 'User inbox not updating since 9am. Other Outlook users on same floor unaffected.', status: 'open',        priority: 'P2', assigneeId: '1', assigneeName: 'Admin User', requester: 'Bob Johnson',   createdAt: new Date(now - 14400000).toISOString(),  updatedAt: new Date(now - 12000000).toISOString(), resolvedAt: null },
  { id: 'T-004', title: 'New laptop setup request',           description: 'Onboarding for new hire starting Monday. Needs laptop provisioned with standard IT image.', status: 'open',        priority: 'P3', assigneeId: '1', assigneeName: 'Admin User', requester: 'HR Dept',       createdAt: new Date(now - 86400000).toISOString(),  updatedAt: new Date(now - 82800000).toISOString(), resolvedAt: null },
  { id: 'T-005', title: 'Blue screen on workstation WS-042', description: 'BSOD occurring randomly, error IRQL_NOT_LESS_OR_EQUAL. Minidump attached.', status: 'open',        priority: 'P1', assigneeId: '3', assigneeName: 'Sarah K.',   requester: 'Mark Davis',    createdAt: new Date(now - 1800000).toISOString(),   updatedAt: new Date(now - 900000).toISOString(),   resolvedAt: null },
  { id: 'T-006', title: 'Password reset request',             description: 'User locked out after too many failed attempts. Account requires admin unlock.', status: 'open',        priority: 'P3', assigneeId: '2', assigneeName: 'Tech User',  requester: 'Lisa Wong',     createdAt: new Date(now - 3600000).toISOString(),   updatedAt: new Date(now - 3600000).toISOString(),  resolvedAt: null },
  { id: 'T-007', title: 'Slow network on 2nd floor',         description: 'Multiple users reporting slow speeds. Running speed tests: 2Mbps vs expected 100Mbps.', status: 'open',        priority: 'P1', assigneeId: '1', assigneeName: 'Admin User', requester: 'Floor 2 Staff', createdAt: new Date(now - 5400000).toISOString(),   updatedAt: new Date(now - 4800000).toISOString(),  resolvedAt: null },
  { id: 'T-008', title: 'Monitor flickering WS-017',         description: 'External monitor flickers intermittently. Tried different DP cable, still flickering.', status: 'open',        priority: 'P3', assigneeId: '2', assigneeName: 'Tech User',  requester: 'Carlos M.',     createdAt: new Date(now - 21600000).toISOString(),  updatedAt: new Date(now - 18000000).toISOString(), resolvedAt: null },
  { id: 'T-009', title: 'Software installation - AutoCAD',   description: 'Architect team needs AutoCAD 2026 installed on 3 workstations. License keys provided.', status: 'open',        priority: 'P2', assigneeId: '3', assigneeName: 'Sarah K.',   requester: 'Design Team',   createdAt: new Date(now - 43200000).toISOString(),  updatedAt: new Date(now - 39600000).toISOString(), resolvedAt: null },
  { id: 'T-010', title: 'Shared drive permissions issue',    description: 'Finance team cannot access Q1 reports folder. Permissions appear correct in AD.', status: 'open',        priority: 'P2', assigneeId: '1', assigneeName: 'Admin User', requester: 'Finance Dept',  createdAt: new Date(now - 28800000).toISOString(),  updatedAt: new Date(now - 25200000).toISOString(), resolvedAt: null },
  { id: 'T-011', title: 'Webcam not detected in Teams',      description: 'Logitech C920 not showing in Teams device settings. Works in Device Manager.', status: 'open',        priority: 'P3', assigneeId: '2', assigneeName: 'Tech User',  requester: 'Tom Baker',     createdAt: new Date(now - 54000000).toISOString(),  updatedAt: new Date(now - 50400000).toISOString(), resolvedAt: null },
  { id: 'T-012', title: 'Keyboard unresponsive WS-009',      description: 'Wireless keyboard stops responding after ~10 mins. Battery replaced, same issue.', status: 'open',        priority: 'P3', assigneeId: '2', assigneeName: 'Tech User',  requester: 'Nina Patel',    createdAt: new Date(now - 36000000).toISOString(),  updatedAt: new Date(now - 32400000).toISOString(), resolvedAt: null },

  { id: 'T-013', title: 'Email migration to M365',           description: 'Migrating 50 mailboxes from on-prem Exchange to M365. Phase 1 of 3 in progress.', status: 'in-progress',  priority: 'P1', assigneeId: '1', assigneeName: 'Admin User', requester: 'IT Director',   createdAt: new Date(now - 172800000).toISOString(), updatedAt: new Date(now - 7200000).toISOString(),  resolvedAt: null },
  { id: 'T-014', title: 'Server room heat alarm',            description: 'Sensor triggered at 28C. HVAC contacted. Monitoring temps every 15 mins.', status: 'in-progress',  priority: 'P1', assigneeId: '1', assigneeName: 'Admin User', requester: 'Facilities',    createdAt: new Date(now - 10800000).toISOString(),  updatedAt: new Date(now - 1800000).toISOString(),  resolvedAt: null },
  { id: 'T-015', title: 'Deploy Windows 11 update KB5',      description: 'Rolling out cumulative update to 120 endpoints via SCCM. 63/120 complete.', status: 'in-progress',  priority: 'P2', assigneeId: '2', assigneeName: 'Tech User',  requester: 'Security Team', createdAt: new Date(now - 259200000).toISOString(), updatedAt: new Date(now - 3600000).toISOString(),  resolvedAt: null },
  { id: 'T-016', title: 'VoIP phone config - Exec Suite',    description: 'Configuring 8 new Polycom phones in executive suite. Extension mapping in progress.', status: 'in-progress',  priority: 'P2', assigneeId: '2', assigneeName: 'Tech User',  requester: 'Office Mgr',    createdAt: new Date(now - 86400000).toISOString(),  updatedAt: new Date(now - 14400000).toISOString(), resolvedAt: null },
  { id: 'T-017', title: 'AD group policy review',            description: 'Annual GPO audit. Reviewing 45 policies for security compliance.', status: 'in-progress',  priority: 'P2', assigneeId: '1', assigneeName: 'Admin User', requester: 'Compliance',    createdAt: new Date(now - 432000000).toISOString(), updatedAt: new Date(now - 21600000).toISOString(), resolvedAt: null },
  { id: 'T-018', title: 'Backup restore test',               description: 'Monthly DR test - restoring VM snapshot to test environment and verifying data integrity.', status: 'in-progress',  priority: 'P3', assigneeId: '3', assigneeName: 'Sarah K.',   requester: 'IT Manager',    createdAt: new Date(now - 21600000).toISOString(),  updatedAt: new Date(now - 7200000).toISOString(),  resolvedAt: null },
  { id: 'T-019', title: 'SSL cert renewal - intranet',       description: 'Wildcard cert expiring in 14 days. CSR generated, waiting for CA approval.', status: 'in-progress',  priority: 'P1', assigneeId: '1', assigneeName: 'Admin User', requester: 'Web Team',      createdAt: new Date(now - 72000000).toISOString(),  updatedAt: new Date(now - 10800000).toISOString(), resolvedAt: null },

  { id: 'T-020', title: 'DNS resolution fixed',              description: 'Flushed DNS cache and updated forwarders. All users confirmed resolved.', status: 'resolved',     priority: 'P1', assigneeId: '1', assigneeName: 'Admin User', requester: 'IT Staff',      createdAt: new Date(now - 86400000).toISOString(),  updatedAt: new Date(now - 43200000).toISOString(), resolvedAt: new Date(now - 43200000).toISOString() },
  { id: 'T-021', title: 'Teams meeting room AV fixed',       description: 'Surface Hub restarted and firmware updated. Meeting room back online.', status: 'resolved',     priority: 'P2', assigneeId: '2', assigneeName: 'Tech User',  requester: 'Facilities',    createdAt: new Date(now - 172800000).toISOString(), updatedAt: new Date(now - 86400000).toISOString(), resolvedAt: new Date(now - 86400000).toISOString() },
  { id: 'T-022', title: 'Malware removed from WS-031',       description: 'Quarantined and removed PUP.Optional. Full scan clean. User briefed on phishing.', status: 'resolved',     priority: 'P1', assigneeId: '2', assigneeName: 'Tech User',  requester: 'Security',      createdAt: new Date(now - 259200000).toISOString(), updatedAt: new Date(now - 172800000).toISOString(), resolvedAt: new Date(now - 172800000).toISOString() },
];

module.exports = { users, channels, messages, assets, team, tickets };
