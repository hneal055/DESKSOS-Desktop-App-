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

describe("GET /tickets", () => {
  it("returns all 22 seeded tickets", async () => {
    const res = await request(app).get("/tickets").set(auth());
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(22);
  });

  it("filters by status=open", async () => {
    const res = await request(app).get("/tickets?status=open").set(auth());
    expect(res.statusCode).toBe(200);
    res.body.forEach(t => expect(t.status).toBe("open"));
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("sorts by priority P1 first", async () => {
    const res = await request(app).get("/tickets?status=open").set(auth());
    expect(res.body[0].priority).toBe("P1");
  });

  it("rejects unauthenticated request", async () => {
    const res = await request(app).get("/tickets");
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /tickets/:id", () => {
  it("returns ticket by ID", async () => {
    const res = await request(app).get("/tickets/T-001").set(auth());
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe("T-001");
    expect(res.body).toHaveProperty("title");
    expect(res.body).toHaveProperty("priority");
  });

  it("returns 404 for unknown ID", async () => {
    const res = await request(app).get("/tickets/UNKNOWN").set(auth());
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /tickets", () => {
  it("creates a new ticket and persists it", async () => {
    const res = await request(app).post("/tickets").set(auth()).send({
      title: "Test ticket from Jest",
      description: "Created in test suite",
      priority: "P2",
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe("Test ticket from Jest");
    expect(res.body.status).toBe("open");
    expect(res.body.priority).toBe("P2");
    expect(res.body).toHaveProperty("id");

    // Verify it appears in list
    const list = await request(app).get("/tickets").set(auth());
    const found = list.body.find(t => t.title === "Test ticket from Jest");
    expect(found).toBeDefined();
  });

  it("rejects missing title", async () => {
    const res = await request(app).post("/tickets").set(auth()).send({ description: "No title" });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /tickets/:id", () => {
  it("updates ticket status to in-progress", async () => {
    const res = await request(app)
      .patch("/tickets/T-001")
      .set(auth())
      .send({ status: "in-progress" });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("in-progress");
  });

  it("sets resolvedAt when status is resolved", async () => {
    const res = await request(app)
      .patch("/tickets/T-002")
      .set(auth())
      .send({ status: "resolved" });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("resolved");
    expect(res.body.resolvedAt).not.toBeNull();
  });

  it("returns 404 for unknown ticket", async () => {
    const res = await request(app).patch("/tickets/BAD-ID").set(auth()).send({ status: "open" });
    expect(res.statusCode).toBe(404);
  });
});


