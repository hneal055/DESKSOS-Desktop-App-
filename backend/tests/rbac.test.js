const request = require("supertest");
const { app } = require("../src/server");

let adminToken, techToken;

beforeAll(async () => {
  const admin = await request(app)
    .post("/auth/login")
    .send({ email: "admin@desksos.com", password: "password123" });
  adminToken = admin.body.token;

  const tech = await request(app)
    .post("/auth/login")
    .send({ email: "tech@desksos.com", password: "password123" });
  techToken = tech.body.token;
});

// ── GET /network/info ────────────────────────────────────────────────────────

describe("GET /network/info", () => {
  it("admin can access network info", async () => {
    const res = await request(app)
      .get("/network/info")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("ipv4");
  });

  it("technician is forbidden from network info", async () => {
    const res = await request(app)
      .get("/network/info")
      .set("Authorization", `Bearer ${techToken}`);
    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty("error");
  });

  it("unauthenticated request is rejected with 401", async () => {
    const res = await request(app).get("/network/info");
    expect(res.statusCode).toBe(401);
  });
});

// ── GET /dashboard/team ──────────────────────────────────────────────────────

describe("GET /dashboard/team", () => {
  it("admin can access team roster", async () => {
    const res = await request(app)
      .get("/dashboard/team")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("technician is forbidden from team roster", async () => {
    const res = await request(app)
      .get("/dashboard/team")
      .set("Authorization", `Bearer ${techToken}`);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/);
  });
});

// ── GET /dashboard/queue ─────────────────────────────────────────────────────

describe("GET /dashboard/queue", () => {
  it("both admin and technician can access queue counts", async () => {
    const adminRes = await request(app)
      .get("/dashboard/queue")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminRes.statusCode).toBe(200);

    const techRes = await request(app)
      .get("/dashboard/queue")
      .set("Authorization", `Bearer ${techToken}`);
    expect(techRes.statusCode).toBe(200);
  });
});

// ── POST /tickets (both roles should be able to create) ──────────────────────

describe("POST /tickets role access", () => {
  it("technician can create a ticket", async () => {
    const res = await request(app)
      .post("/tickets")
      .set("Authorization", `Bearer ${techToken}`)
      .send({ title: "Tech-created ticket", priority: "P2" });
    expect(res.statusCode).toBe(201);
  });

  it("admin can create a ticket", async () => {
    const res = await request(app)
      .post("/tickets")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Admin-created ticket", priority: "P1" });
    expect(res.statusCode).toBe(201);
  });
});
