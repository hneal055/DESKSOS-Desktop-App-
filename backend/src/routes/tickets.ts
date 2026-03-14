import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import auth from "../middleware/auth.js";
import db from "../db.js";
import { Ticket, TicketResponse } from "../types/index.js";

const router = Router();

const PRIORITY: Record<string, number> = { P1: 0, P2: 1, P3: 2 };

function toTicket(t: Ticket): TicketResponse {
  return {
    id: t.id, title: t.title, description: t.description,
    status: t.status, priority: t.priority,
    assigneeId: t.assignee_id, assigneeName: t.assignee_name,
    requester: t.requester,
    createdAt: t.created_at, updatedAt: t.updated_at, resolvedAt: t.resolved_at,
  };
}

// GET /tickets?status=open&assigneeId=1
router.get("/", auth, (req: Request, res: Response): void => {
  const { status, assigneeId } = req.query as { status?: string; assigneeId?: string };
  let sql = "SELECT * FROM tickets WHERE 1=1";
  const params: string[] = [];
  if (status)     { sql += " AND status = ?";       params.push(status); }
  if (assigneeId) { sql += " AND assignee_id = ?";  params.push(assigneeId); }
  const rows = db.prepare(sql).all(...params) as Ticket[];
  rows.sort((a, b) =>
    (PRIORITY[a.priority] - PRIORITY[b.priority]) ||
    (new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  );
  res.json(rows.map(toTicket));
});

// GET /tickets/:id
router.get("/:id", auth, (req: Request, res: Response): void => {
  const t = db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id) as Ticket | undefined;
  if (!t) { res.status(404).json({ error: "Ticket not found" }); return; }
  res.json(toTicket(t));
});

// POST /tickets
router.post("/", auth, (req: Request, res: Response): void => {
  const { title, description, priority, assigneeId, assigneeName, requester } =
    req.body as {
      title?: string; description?: string; priority?: string;
      assigneeId?: string; assigneeName?: string; requester?: string;
    };
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const now = new Date().toISOString();
  const id  = "T-" + Date.now().toString().slice(-8);
  db.prepare(`
    INSERT INTO tickets
      (id,title,description,status,priority,assignee_id,assignee_name,requester,created_at,updated_at,resolved_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, title, description ?? "", "open", priority ?? "P3",
         assigneeId ?? null, assigneeName ?? null, requester ?? null, now, now, null);
  const created = db.prepare("SELECT * FROM tickets WHERE id = ?").get(id) as Ticket;
  res.status(201).json(toTicket(created));
});

// PATCH /tickets/:id
router.patch("/:id", auth, (req: Request, res: Response): void => {
  const t = db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id) as Ticket | undefined;
  if (!t) { res.status(404).json({ error: "Ticket not found" }); return; }
  const { status } = req.body as { status?: string };
  if (status) {
    const now = new Date().toISOString();
    db.prepare("UPDATE tickets SET status=?, updated_at=?, resolved_at=? WHERE id=?")
      .run(status, now, status === "resolved" ? now : t.resolved_at, t.id);
  }
  const updated = db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id) as Ticket;
  res.json(toTicket(updated));
});

export default router;
