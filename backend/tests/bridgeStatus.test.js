// Outbox visibility (readiness plan task 3.6). Bridge configured before the app loads.
process.env.ENTERPRISE_INGEST_URL = "http://enterprise.test/api/ingest/incidents";
process.env.ENTERPRISE_INGEST_KEY = "test-ingest-key";

const request = require("supertest");
const { app } = require("../src/server");
const db = require("../src/db").default;
const { outboxStatus, outboxProblems, isLoopbackAddress } = require("../src/enterpriseBridge");

const login = async (email) =>
  (await request(app).post("/auth/login").send({ email, password: "password123" })).body.token;

const put = (ticketId, status, createdAt, lastError = null) =>
  db.prepare(`
    INSERT OR REPLACE INTO enterprise_outbox (ticket_id, status, attempts, next_attempt_at, last_error, created_at)
    VALUES (?, ?, 1, ?, ?, ?)
  `).run(ticketId, status, createdAt, lastError, createdAt);

afterAll(() => { if (app.close) app.close(); });
beforeEach(() => db.prepare("DELETE FROM enterprise_outbox").run());

describe("outboxStatus", () => {
  it("is empty and enabled with nothing queued", () => {
    expect(outboxStatus()).toEqual({
      enabled: true, pending: 0, failed: 0, sent: 0, oldestPendingAt: null, oldestPendingMinutes: null,
    });
  });

  it("counts by status and reports the age of the oldest pending ticket", () => {
    const now = new Date("2026-10-06T12:00:00.000Z");
    put("T-001", "pending", "2026-10-06T10:30:00.000Z", "Request failed: fetch failed (ECONNREFUSED: )");
    put("T-002", "pending", "2026-10-06T11:50:00.000Z");
    put("T-003", "failed", "2026-10-06T09:00:00.000Z", "HTTP 400: Validation failed");
    put("T-004", "sent", "2026-10-06T08:00:00.000Z");
    expect(outboxStatus(now)).toEqual({
      enabled: true, pending: 2, failed: 1, sent: 1,
      oldestPendingAt: "2026-10-06T10:30:00.000Z", oldestPendingMinutes: 90,
    });
  });

  it("lists undelivered tickets oldest first, without sent ones", () => {
    put("T-002", "pending", "2026-10-06T11:50:00.000Z");
    put("T-003", "failed", "2026-10-06T09:00:00.000Z", "HTTP 400: Validation failed");
    put("T-004", "sent", "2026-10-06T08:00:00.000Z");
    expect(outboxProblems().map((p) => [p.ticketId, p.status, p.lastError])).toEqual([
      ["T-003", "failed", "HTTP 400: Validation failed"],
      ["T-002", "pending", null],
    ]);
  });
});

describe("GET /dashboard/bridge", () => {
  it("gives admins the status and the undelivered tickets", async () => {
    put("T-001", "pending", new Date(Date.now() - 5 * 60_000).toISOString(), "HTTP 401: Invalid or missing API key");
    const res = await request(app).get("/dashboard/bridge").set({ Authorization: `Bearer ${await login("admin@desksos.com")}` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ enabled: true, pending: 1, failed: 0 });
    expect(res.body.oldestPendingMinutes).toBeGreaterThanOrEqual(4);
    expect(res.body.problems).toEqual([expect.objectContaining({ ticketId: "T-001", lastError: "HTTP 401: Invalid or missing API key" })]);
  });

  it("is refused for technicians and without sign-in", async () => {
    const tech = await request(app).get("/dashboard/bridge").set({ Authorization: `Bearer ${await login("tech@desksos.com")}` });
    expect(tech.statusCode).toBe(403);
    expect((await request(app).get("/dashboard/bridge")).statusCode).toBe(401);
  });
});

describe("GET /health/bridge", () => {
  it("answers local requests with counts only, no ticket content", async () => {
    put("T-001", "pending", "2026-10-06T10:30:00.000Z", "secret-looking error text");
    const res = await request(app).get("/health/bridge"); // supertest connects over loopback
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ["enabled", "failed", "oldestPendingAt", "oldestPendingMinutes", "pending", "sent"]
    );
    expect(JSON.stringify(res.body)).not.toMatch(/T-001|secret-looking/);
  });
});

describe("isLoopbackAddress", () => {
  it.each(["127.0.0.1", "127.5.6.7", "::1", "::ffff:127.0.0.1"])("accepts %s", (ip) => {
    expect(isLoopbackAddress(ip)).toBe(true);
  });
  it.each(["192.168.12.196", "::ffff:192.168.12.196", "2607:fb90::1", "10.0.0.1", "", undefined, "127.0.0.1.evil"])(
    "rejects %s", (ip) => { expect(isLoopbackAddress(ip)).toBe(false); }
  );
});
