import "./config.js";
import { JWT_SECRET, PORT } from "./config.js";
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import jwt from "jsonwebtoken";
import { JwtPayload } from "./types/index.js";

import authRoute      from "./routes/auth.js";
import dashboardRoute from "./routes/dashboard.js";
import chatRoute      from "./routes/chat.js";
import assetsRoute    from "./routes/assets.js";
import networkRoute   from "./routes/network.js";
import ticketsRoute   from "./routes/tickets.js";

const app    = express();
const server = http.createServer(app);
const io     = new SocketIOServer(server, { cors: { origin: "*" } });

// Security headers
app.use(helmet());

// Rate limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, please try again later." },
});

app.use(globalLimiter);
app.use(cors());
app.use(express.json());
app.set("io", io);

app.use("/auth",      authLimiter, authRoute);
app.use("/dashboard", dashboardRoute);
app.use("/chat",      chatRoute);
app.use("/assets",    assetsRoute);
app.use("/network",   networkRoute);
app.use("/tickets",   ticketsRoute);
app.get("/health", (_req, res) => res.json({ status: "ok" }));

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

io.on("connection", (socket) => {
  const user = socket.data.user as JwtPayload | undefined;
  console.log("Socket connected:", user?.email);
  socket.on("join",  (ch: string) => socket.join(ch));
  socket.on("leave", (ch: string) => socket.leave(ch));
  socket.on("disconnect", () => console.log("Socket disconnected:", user?.email));
});

if (require.main === module) {
  server.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`DeskSOS API running on http://0.0.0.0:${PORT}`);
    console.log("  admin@desksos.com / password123");
    console.log("  tech@desksos.com  / password123");
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

export { app };
