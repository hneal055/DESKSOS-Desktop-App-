const router = require("express").Router();
const auth   = require("../middleware/auth");
const db     = require("../db");

router.get("/queue", auth, (req, res) => {
  const open       = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status = ?").get("open").c;
  const inProgress = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status = ?").get("in-progress").c;
  const resolved   = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status = ?").get("resolved").c;
  res.json({ open, inProgress, resolved, avgResponseTime: 18 });
});

router.get("/team", auth, (req, res) => {
  res.json(db.prepare("SELECT id, name, status, active_tickets as activeTickets FROM team_members").all());
});

module.exports = router;
