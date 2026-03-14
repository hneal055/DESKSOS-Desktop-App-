import { Router, Request, Response } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import db from "../db.js";
import { TeamMember } from "../types/index.js";

const router = Router();

router.get("/queue", auth, (_req: Request, res: Response): void => {
  const open       = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status = ?").get("open")        as { c: number }).c;
  const inProgress = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status = ?").get("in-progress") as { c: number }).c;
  const resolved   = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status = ?").get("resolved")    as { c: number }).c;
  res.json({ open, inProgress, resolved, avgResponseTime: 18 });
});

router.get("/team", auth, requireRole("admin"), (_req: Request, res: Response): void => {
  const team = db.prepare(
    "SELECT id, name, status, active_tickets as activeTickets FROM team_members"
  ).all() as TeamMember[];
  res.json(team);
});

export default router;

