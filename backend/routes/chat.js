const router = require("express").Router();
const auth   = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");
const db     = require("../db");

router.get("/channels", auth, (req, res) => {
  res.json(db.prepare("SELECT id, name, unread_count as unreadCount FROM channels").all());
});

router.get("/channels/:id/messages", auth, (req, res) => {
  res.json(db.prepare(
    "SELECT id, channel_id as channelId, user_id as userId, user_name as userName, text, timestamp " +
    "FROM messages WHERE channel_id = ? ORDER BY timestamp ASC"
  ).all(req.params.id));
});

router.post("/channels/:id/messages", auth, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });
  const msg = {
    id: uuidv4(),
    channelId: req.params.id,
    userId: req.user.id,
    userName: req.user.name || req.user.email,
    text,
    timestamp: new Date().toISOString(),
  };
  db.prepare("INSERT INTO messages (id,channel_id,user_id,user_name,text,timestamp) VALUES (?,?,?,?,?,?)")
    .run(msg.id, msg.channelId, msg.userId, msg.userName, msg.text, msg.timestamp);
  if (req.app.get("io")) req.app.get("io").to(req.params.id).emit("message", msg);
  res.status(201).json(msg);
});

module.exports = router;
