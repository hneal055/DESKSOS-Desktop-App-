const request = require("supertest");
const { app } = require("../src/server");

let token;

beforeAll(async () => {
  const res = await request(app)
    .post("/auth/login")
    .send({ email: "admin@desksos.com", password: "password123" });
  token = res.body.token;
});

afterAll(() => { if (app.close) app.close(); });

const auth = () => ({ Authorization: `Bearer ${token}` });

describe("GET /dashboard/queue", () => {
  it("returns live ticket counts from DB", async () => {
    const res = await request(app).get("/dashboard/queue").set(auth());
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("open");
    expect(res.body).toHaveProperty("inProgress");
    expect(res.body).toHaveProperty("resolved");
    // Seeded data: 12 open, 7 in-progress, 3 resolved
    expect(res.body.open).toBe(12);
    expect(res.body.inProgress).toBe(7);
    expect(res.body.resolved).toBe(3);
  });

  it("queue updates when a ticket is resolved", async () => {
    // Resolve one open ticket
    await request(app).patch("/tickets/T-003").set(auth()).send({ status: "resolved" });
    const res = await request(app).get("/dashboard/queue").set(auth());
    expect(res.body.open).toBe(11);
    expect(res.body.resolved).toBe(4);
  });

  it("rejects unauthenticated request", async () => {
    const res = await request(app).get("/dashboard/queue");
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /dashboard/team", () => {
  it("returns team members", async () => {
    const res = await request(app).get("/dashboard/team").set(auth());
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(4);
    const member = res.body[0];
    expect(member).toHaveProperty("id");
    expect(member).toHaveProperty("name");
    expect(member).toHaveProperty("status");
    expect(member).toHaveProperty("activeTickets");
  });
});


