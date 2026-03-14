const request = require("supertest");
const app     = require("../server");

let token;

beforeAll(async () => {
  const res = await request(app)
    .post("/auth/login")
    .send({ email: "admin@desksos.com", password: "password123" });
  token = res.body.token;
});

afterAll(() => { if (app.close) app.close(); });

const auth = () => ({ Authorization: `Bearer ${token}` });

describe("GET /chat/channels", () => {
  it("returns 3 seeded channels", async () => {
    const res = await request(app).get("/chat/channels").set(auth());
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(3);
    const names = res.body.map(c => c.name);
    expect(names).toContain("general");
    expect(names).toContain("incidents");
  });

  it("rejects unauthenticated request", async () => {
    const res = await request(app).get("/chat/channels");
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /chat/channels/:id/messages", () => {
  it("returns seeded messages for ch1", async () => {
    const res = await request(app).get("/chat/channels/ch1/messages").set(auth());
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    const msg = res.body[0];
    expect(msg).toHaveProperty("id");
    expect(msg).toHaveProperty("text");
    expect(msg).toHaveProperty("timestamp");
    expect(msg).toHaveProperty("userName");
  });

  it("returns empty array for channel with no messages", async () => {
    const res = await request(app).get("/chat/channels/ch-nonexistent/messages").set(auth());
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe("POST /chat/channels/:id/messages", () => {
  it("posts a message and it appears in the channel", async () => {
    const postRes = await request(app)
      .post("/chat/channels/ch1/messages")
      .set(auth())
      .send({ text: "Hello from Jest test" });
    expect(postRes.statusCode).toBe(201);
    expect(postRes.body.text).toBe("Hello from Jest test");
    expect(postRes.body).toHaveProperty("id");

    const getRes = await request(app).get("/chat/channels/ch1/messages").set(auth());
    const found = getRes.body.find(m => m.text === "Hello from Jest test");
    expect(found).toBeDefined();
  });

  it("rejects empty text", async () => {
    const res = await request(app)
      .post("/chat/channels/ch1/messages")
      .set(auth())
      .send({ text: "" });
    expect(res.statusCode).toBe(400);
  });
});
