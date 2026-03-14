const { io: ioClient }               = require("socket.io-client");
const request                        = require("supertest");
const { app, server, io: ioServer }  = require("../src/server");

let adminToken, techToken, port;

const connect = (token) =>
  new Promise((resolve, reject) => {
    const s = ioClient(`http://localhost:${port}`, {
      auth: { token },
      reconnection: false,
    });
    s.once("connect",       () => resolve(s));
    s.once("connect_error", (err) => { s.disconnect(); reject(err); });
  });

// Resolves on the next matching presence:update (ignores non-matching broadcasts)
const waitForPresence = (socket, predicate, ms = 4000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off("presence:update", handler);
      reject(new Error("Timeout: presence:update predicate"));
    }, ms);
    function handler(data) {
      if (predicate(data.onlineUsers)) {
        clearTimeout(t);
        socket.off("presence:update", handler);
        resolve(data);
      }
    }
    socket.on("presence:update", handler);
  });

const waitFor = (socket, event, ms = 3000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout: ${event}`)), ms);
    socket.once(event, (d) => { clearTimeout(t); resolve(d); });
  });

beforeAll(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;

  const [a, t] = await Promise.all([
    request(app).post("/auth/login").send({ email: "admin@desksos.com", password: "password123" }),
    request(app).post("/auth/login").send({ email: "tech@desksos.com",  password: "password123" }),
  ]);
  adminToken = a.body.token;
  techToken  = t.body.token;
});

afterAll(async () => {
  await new Promise((resolve) => ioServer.close(resolve));
  await new Promise((resolve) => server.close(resolve));
});

// ── Auth middleware ───────────────────────────────────────────────────────────
describe("Socket.IO -- Authentication middleware", () => {
  it("rejects connection without token", async () => {
    await expect(connect(undefined)).rejects.toThrow("Unauthorized");
  });

  it("rejects connection with invalid token", async () => {
    await expect(connect("not-a-valid-jwt")).rejects.toThrow("Invalid token");
  });
});

// ── Presence ─────────────────────────────────────────────────────────────────
describe("Socket.IO -- Presence", () => {
  it("client registers and appears in presence:update broadcast", async () => {
    const s = await connect(adminToken);
    const p  = waitForPresence(s, (users) => users.some((u) => u.name === "Admin Test"));
    s.emit("user:join", { name: "Admin Test" });
    const { onlineUsers } = await p;
    expect(onlineUsers.some((u) => u.name === "Admin Test")).toBe(true);
    s.disconnect();
  });

  it("presence clears after disconnect", async () => {
    const s1 = await connect(adminToken);
    const s2 = await connect(techToken);

    // s1 registers
    const s1Joined = waitForPresence(s1, (users) => users.some((u) => u.name === "Admin Test"));
    s1.emit("user:join", { name: "Admin Test" });
    await s1Joined;

    // Wait for update where Admin Test is absent (fires after s1 disconnects)
    const gone = waitForPresence(s2, (users) => !users.some((u) => u.name === "Admin Test"));
    s1.disconnect();
    const { onlineUsers } = await gone;
    expect(onlineUsers.some((u) => u.name === "Admin Test")).toBe(false);
    s2.disconnect();
  });
});

// ── Signaling relay ───────────────────────────────────────────────────────────
describe("Socket.IO -- Remote session signaling relay", () => {
  it("routes remote:request from tech to end-user", async () => {
    const tech    = await connect(adminToken);
    const endUser = await connect(techToken);

    // tech joins and waits for endUser entry to appear in presence
    tech.emit("user:join", { name: "Tech" });

    const p2 = waitForPresence(tech, (users) => users.some((u) => u.name === "EndUser"));
    endUser.emit("user:join", { name: "EndUser" });
    const { onlineUsers } = await p2;

    const target = onlineUsers.find((u) => u.name === "EndUser");
    expect(target).toBeDefined();

    // tech sends remote:request to endUser
    const incoming = waitFor(endUser, "remote:request");
    tech.emit("remote:request", {
      targetUserId: target.id,
      techId: "tech-x",
      techName: "Tech",
      sessionId: "sess-abc",
    });
    const received = await incoming;
    expect(received.sessionId).toBe("sess-abc");
    expect(received.techName).toBe("Tech");

    tech.disconnect();
    endUser.disconnect();
  });
});