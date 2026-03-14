import "./config.js";
import { JWT_SECRET, PORT, CORS_ORIGINS } from "./config.js";
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import morgan from "morgan";
import jwt from "jsonwebtoken";
import { JwtPayload } from "./types/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

import authRoute      from "./routes/auth.js";
import dashboardRoute from "./routes/dashboard.js";
import chatRoute      from "./routes/chat.js";
import assetsRoute    from "./routes/assets.js";
import networkRoute   from "./routes/network.js";
import ticketsRoute   from "./routes/tickets.js";

const app    = express();
const server = http.createServer(app);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no Origin header (server-to-server, curl in dev)
    if (!origin || CORS_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

const io = new SocketIOServer(server, {
  cors: { origin: CORS_ORIGINS, methods: ["GET", "POST"] },
});

// Request logging — "combined" writes Apache-style logs (IP, method, status, user-agent)
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Security headers
app.use(helmet());

// Rate limiters
const skipInTest = () => process.env.NODE_ENV === "test";

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, please try again later." },
});

app.use(globalLimiter);
app.use(cors(corsOptions));
app.use(express.json());
app.set("io", io);

app.use("/auth",      authLimiter, authRoute);
app.use("/dashboard", dashboardRoute);
app.use("/chat",      chatRoute);
app.use("/assets",    assetsRoute);
app.use("/network",   networkRoute);
app.use("/tickets",   ticketsRoute);
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// 404 for any unknown route (before error handler)
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Global error handler — must have 4 params to be recognised by Express
app.use(errorHandler);

io.use((socket, next) => {
  const token = (socket.handshake.auth as { token?: string }).token;
  if (!token) { next(new Error("Unauthorized")); return; }
  try {
    socket.data.user = jwt.verify(token, JWT_SECRET) as JwtPayload;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

// ── Presence tracking for Remote Sessions ────────────────────────────────────
// Maps userId → { displayName, socketId }
const presence = new Map<string, { name: string; socketId: string }>();

function broadcastPresence(): void {
  const users = Array.from(presence.entries()).map(([id, v]) => ({ id, name: v.name }));
  io.emit("presence:update", { onlineUsers: users });
}

io.on("connection", (socket) => {
  const user = socket.data.user as JwtPayload;
  console.log("Socket connected:", user.email);

  // ── Chat rooms ─────────────────────────────────────────────────────────────
  socket.on("join",  (ch: string) => socket.join(ch));
  socket.on("leave", (ch: string) => socket.leave(ch));

  // ── Remote-session presence ───────────────────────────────────────────────
  socket.on("user:join", (data: { name?: string }) => {
    const displayName = data.name?.trim() || user.name || user.email;
    presence.set(user.id, { name: displayName, socketId: socket.id });
    broadcastPresence();
  });

  // Helper: forward an event to a specific user by userId
  const routeTo = (targetId: string, event: string, payload: unknown): void => {
    const entry = presence.get(targetId);
    if (entry) io.to(entry.socketId).emit(event, payload);
  };

  // ── WebRTC signaling relay ────────────────────────────────────────────────
  socket.on("remote:request",       (d: Record<string, unknown>) => routeTo(d.targetUserId as string, "remote:request",       d));
  socket.on("remote:accept",        (d: Record<string, unknown>) => routeTo(d.techId        as string, "remote:accepted",     d));
  socket.on("remote:decline",       (d: Record<string, unknown>) => routeTo(d.techId        as string, "remote:declined",     d));
  socket.on("remote:offer",         (d: Record<string, unknown>) => routeTo(d.techId        as string, "remote:offer",        d));
  socket.on("remote:answer",        (d: Record<string, unknown>) => routeTo(d.targetUserId  as string, "remote:answer",       d));
  socket.on("remote:ice-candidate", (d: Record<string, unknown>) => routeTo(d.targetId      as string, "remote:ice-candidate",d));
  socket.on("remote:end",           (d: Record<string, unknown>) => routeTo(d.targetId      as string, "remote:end",          d));

  socket.on("disconnect", () => {
    presence.delete(user.id);
    broadcastPresence();
    console.log("Socket disconnected:", user.email);
  });
});

if (require.main === module) {
  server.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`DeskSOS API running on http://0.0.0.0:${PORT}`);
    console.log(`  CORS origins: ${CORS_ORIGINS.join(", ")}`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[DeskSOS] Port ${PORT} is already in use.`);
      process.exit(1);
    } else {
      throw err;
    }
  });
}

export { app, server, io };


