// Bridge configured: must be set before the app (and config) is first required
process.env.ENTERPRISE_INGEST_URL = "http://enterprise.test/api/ingest/incidents";
process.env.ENTERPRISE_INGEST_KEY = "test-ingest-key";
process.env.ENTERPRISE_SOURCE = "desksos-desktop-test";

const request = require("supertest");
const { app } = require("../src/server");
const db = require("../src/db").default;
const {
  buildPayload,
  backoffMs,
  isRetryableStatus,
  checkIngestUrl,
  processOutbox,
} = require("../src/enterpriseBridge");

let token;
const auth = () => ({ Authorization: `Bearer ${token}` });

const outbox = (id) => db.prepare("SELECT * FROM enterprise_outbox WHERE ticket_id = ?").get(id);

const fakeResponse = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const opts = (fetchImpl, now = () => new Date(Date.now() + 1000)) => ({
  url: process.env.ENTERPRISE_INGEST_URL,
  apiKey: process.env.ENTERPRISE_INGEST_KEY,
  source: process.env.ENTERPRISE_SOURCE,
  fetchImpl,
  now,
});

async function createTicket(fields = {}) {
  const res = await request(app)
    .post("/tickets")
    .set(auth())
    .send({ title: "Bridge test ticket", description: "details", priority: "P1", requester: "Pat", ...fields });
  expect(res.statusCode).toBe(201);
  // Tickets created within the same millisecond would share an ID
  await new Promise((r) => setTimeout(r, 2));
  return res.body;
}

beforeAll(async () => {
  const res = await request(app)
    .post("/auth/login")
    .send({ email: "admin@desksos.com", password: "password123" });
  token = res.body.token;
});

beforeEach(() => db.prepare("DELETE FROM enterprise_outbox").run());

afterAll(() => {
  delete process.env.ENTERPRISE_INGEST_URL;
  delete process.env.ENTERPRISE_INGEST_KEY;
  delete process.env.ENTERPRISE_SOURCE;
});

describe("payload mapping", () => {
  const base = {
    id: "T-1", title: "VPN down", description: "Cannot connect", status: "open", priority: "P1",
    assignee_id: null, assignee_name: "Tech User", requester: "John", created_at: "", updated_at: "", resolved_at: null,
  };

  it("maps priority to Enterprise severity", () => {
    expect(buildPayload({ ...base, priority: "P1" }, "s").severity).toBe("CRITICAL");
    expect(buildPayload({ ...base, priority: "P2" }, "s").severity).toBe("HIGH");
    expect(buildPayload({ ...base, priority: "P3" }, "s").severity).toBe("MEDIUM");
    expect(buildPayload({ ...base, priority: "P4" }, "s").severity).toBe("LOW");
  });

  it("uses the ticket ID as externalId and carries people fields", () => {
    const p = buildPayload(base, "desksos-desktop");
    expect(p).toMatchObject({
      source: "desksos-desktop", externalId: "T-1", title: "VPN down",
      requester: "John", assignedTo: "Tech User", category: "Desktop Support",
    });
  });

  it("falls back to the title when the description is blank", () => {
    expect(buildPayload({ ...base, description: "  " }, "s").description).toBe("VPN down");
  });
});

describe("retry policy", () => {
  it("backs off exponentially from 30s and caps at 1h", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(3)).toBe(120_000);
    expect(backoffMs(20)).toBe(3_600_000);
  });

  it("retries auth, throttling and server errors but not other client errors", () => {
    [401, 403, 408, 429, 500, 502, 503].forEach((s) => expect(isRetryableStatus(s)).toBe(true));
    [400, 404, 413, 422].forEach((s) => expect(isRetryableStatus(s)).toBe(false));
  });
});

describe("ingest URL safety", () => {
  it("accepts https anywhere and plain http only for loopback", () => {
    [
      "https://enterprise.example.com/api/ingest/incidents",
      "https://FORD-DC01:5543/api/ingest/incidents",
      "http://localhost:5100/api/ingest/incidents",
      "http://127.0.0.1:5100/api/ingest/incidents",
      "http://[::1]:5100/api/ingest/incidents",
    ].forEach((u) => expect(checkIngestUrl(u)).toBeNull());
  });

  it("rejects plain http to another host, other schemes and invalid URLs", () => {
    expect(checkIngestUrl("http://FORD-DC01:5100/api/ingest/incidents")).toMatch(/must use https/);
    expect(checkIngestUrl("http://192.168.1.10/api/ingest/incidents")).toMatch(/must use https/);
    expect(checkIngestUrl("http://localhost.evil.com/api")).toMatch(/must use https/);
    expect(checkIngestUrl("ftp://localhost/x")).toMatch(/must use https/);
    expect(checkIngestUrl("not a url")).toMatch(/not a valid URL/);
  });
});

describe("POST /tickets with the bridge enabled", () => {
  it("queues the new ticket in the outbox", async () => {
    const t = await createTicket();
    expect(outbox(t.id)).toMatchObject({ status: "pending", attempts: 0 });
  });

  it("does not queue the seeded tickets", async () => {
    await createTicket();
    const n = db.prepare("SELECT COUNT(*) AS n FROM enterprise_outbox WHERE ticket_id LIKE 'T-0__'").get().n;
    expect(n).toBe(0);
  });
});

describe("processOutbox", () => {
  it("forwards a queued ticket and records the Enterprise incident", async () => {
    const t = await createTicket({ priority: "P2" });
    const fetchImpl = jest.fn(async () => fakeResponse(201, { id: 42 }));

    const summary = await processOutbox(opts(fetchImpl));

    expect(summary).toEqual({ sent: 1, retried: 0, failed: 0 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://enterprise.test/api/ingest/incidents");
    expect(init.headers["X-API-Key"]).toBe("test-ingest-key");
    expect(init.redirect).toBe("error");
    expect(JSON.parse(init.body)).toMatchObject({
      source: "desksos-desktop-test", externalId: t.id, severity: "HIGH", requester: "Pat",
    });
    expect(outbox(t.id)).toMatchObject({ status: "sent", attempts: 1, enterprise_id: "42", last_error: null });
  });

  it("treats a 200 duplicate response from Enterprise as sent", async () => {
    const t = await createTicket();
    await processOutbox(opts(jest.fn(async () => fakeResponse(200, { id: 7 }))));
    expect(outbox(t.id)).toMatchObject({ status: "sent", enterprise_id: "7" });
  });

  it("reschedules with backoff when Enterprise is unavailable, then succeeds", async () => {
    const t = await createTicket();
    const start = new Date(Date.now() + 1000);

    await processOutbox(opts(jest.fn(async () => fakeResponse(503, { error: "down" })), () => start));
    const row = outbox(t.id);
    expect(row).toMatchObject({ status: "pending", attempts: 1 });
    expect(row.last_error).toMatch(/HTTP 503/);
    expect(new Date(row.next_attempt_at).getTime()).toBe(start.getTime() + 30_000);

    // Not due yet: nothing is sent
    const early = jest.fn();
    await processOutbox(opts(early, () => new Date(start.getTime() + 10_000)));
    expect(early).not.toHaveBeenCalled();

    // Due: retried and delivered
    await processOutbox(opts(jest.fn(async () => fakeResponse(201, { id: 9 })), () => new Date(start.getTime() + 31_000)));
    expect(outbox(t.id)).toMatchObject({ status: "sent", attempts: 2, enterprise_id: "9" });
  });

  it("keeps retrying when the API key is rejected", async () => {
    const t = await createTicket();
    await processOutbox(opts(jest.fn(async () => fakeResponse(401, { error: "Invalid or missing API key" }))));
    expect(outbox(t.id)).toMatchObject({ status: "pending", attempts: 1 });
  });

  it("marks the ticket failed without retrying when Enterprise rejects the payload", async () => {
    const t = await createTicket();
    await processOutbox(opts(jest.fn(async () => fakeResponse(400, { error: "Validation failed" }))));
    const row = outbox(t.id);
    expect(row).toMatchObject({ status: "failed", attempts: 1 });
    expect(row.last_error).toMatch(/HTTP 400/);

    const later = jest.fn();
    await processOutbox(opts(later, () => new Date(Date.now() + 86_400_000)));
    expect(later).not.toHaveBeenCalled();
  });

  it("stops the batch after a network error instead of hammering a down server", async () => {
    const a = await createTicket();
    const b = await createTicket();
    const fetchImpl = jest.fn(async () => { throw new Error("connect ECONNREFUSED"); });

    const summary = await processOutbox(opts(fetchImpl));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({ sent: 0, retried: 1, failed: 0 });
    expect(outbox(a.id)).toMatchObject({ status: "pending", attempts: 1 });
    expect(outbox(a.id).last_error).toMatch(/ECONNREFUSED/);
    expect(outbox(b.id)).toMatchObject({ status: "pending", attempts: 0 });
  });
});
