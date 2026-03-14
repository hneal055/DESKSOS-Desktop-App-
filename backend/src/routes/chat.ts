import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import auth from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import db from "../db.js";
import { Message } from "../types/index.js";
import { PostMessageSchema, PostMessageInput } from "../validation.js";

const router = Router();

router.get("/channels", auth, (_req: Request, res: Response): void => {
  const channels = db.prepare(
    "SELECT id, name, unread_count as unreadCount FROM channels"
  ).all();
  res.json(channels);
});

router.get("/channels/:id/messages", auth, (req: Request, res: Response): void => {
  const msgs = db.prepare(
    "SELECT id, channel_id as channelId, user_id as userId, user_name as userName, text, timestamp " +
    "FROM messages WHERE channel_id = ? ORDER BY timestamp ASC"
  ).all(req.params.id as string);
  res.json(msgs);
});

router.post("/channels/:id/messages", auth, validate(PostMessageSchema), (req: Request, res: Response): void => {
  const { text } = req.body as PostMessageInput;
  const msg: Message = {
    id: uuidv4(),
    channelId: req.params.id as string,
    userId: req.user!.id,
    userName: req.user!.name ?? req.user!.email,
    text,
    timestamp: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO messages (id,channel_id,user_id,user_name,text,timestamp) VALUES (?,?,?,?,?,?)"
  ).run(msg.id, msg.channelId, msg.userId, msg.userName, msg.text, msg.timestamp);
  const io = req.app.get("io");
  if (io) io.to(req.params.id as string).emit("message", msg);
  res.status(201).json(msg);
});

export default router;
