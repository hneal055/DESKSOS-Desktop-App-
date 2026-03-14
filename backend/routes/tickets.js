const router = require("express").Router();
const auth   = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");
const db     = require("../db");

const PRIORITY = { P1: 0, P2: 1, P3: 2 };

function toTicket(t) {
  return {
    id: t.id, title: t.title, description: t.description,
    status: t.status, priority: t.priority,
    assigneeId: t.assignee_id, assigneeName: t.assignee_name,
    requester: t.requester,
    createdAt: t.created_at, updatedAt: t.updated_at, resolvedAt: t.resolved_at,
  };
}

// GET /tickets?status=open&assigneeId=1
router.get("/", auth, (req, res) => {
  const { status, assigneeId } = req.query;
  let sql = "SELECT * FROM tickets WHERE 1=1";
  const params = [];
  if (status)     { sql += " AND status = ?";      params.push(status); }
  if (assigneeId) { sql += " AND assignee_id = ?"; params.push(assigneeId); }
  const rows = db.prepare(sql).all(...params);
  rows.sort((a, b) =>
    (PRIORITY[a.priority] - PRIORITY[b.priority]) ||
    (new Date(b.created_at) - new Date(a.created_at))
  );
  res.json(rows.map(toTicket));
});

// GET /tickets/:id
router.get("/:id", auth, (req, res) => {
  const t = db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket not found" });
  res.json(toTicket(t));
});

// POST /tickets
router.post("/", auth, (req, res) => {
  const { title, description, priority, assigneeId, assigneeName, requester } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  const now = new Date().toISOString();
  const id  = "T-" + Date.now().toString().slice(-8);
  db.prepare(`
    INSERT INTO tickets (id,title,description,status,priority,assignee_id,assignee_name,requester,created_at,updated_at,resolved_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, title, description || "", "open", priority || "P3",
         assigneeId || null, assigneeName || null, requester || null, now, now, null);
  res.status(201).json(toTicket(db.prepare("SELECT * FROM tickets WHERE id = ?").get(id)));
});

// PATCH /tickets/:id
router.patch("/:id", auth, (req, res) => {
  const t = db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id);
  if (!t) return res.status(404).json({ error: "Ticket not found" });
  const { status } = req.body;
  if (status) {
    const now = new Date().toISOString();
    db.prepare("UPDATE tickets SET status=?, updated_at=?, resolved_at=? WHERE id=?")
      .run(status, now, status === "resolved" ? now : t.resolved_at, t.id);
  }
  res.json(toTicket(db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id)));
});

module.exports = router;
