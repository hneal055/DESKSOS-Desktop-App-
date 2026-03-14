const request = require("supertest");
const { app } = require("../src/server");

afterAll(() => { if (app.close) app.close(); });

describe("POST /auth/login", () => {
  it("returns token for valid admin credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@desksos.com", password: "password123" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe("admin@desksos.com");
    expect(res.body.user.role).toBe("admin");
    expect(res.body.user).not.toHaveProperty("password");
  });

  it("returns token for valid technician credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "tech@desksos.com", password: "password123" });
    expect(res.statusCode).toBe(200);
    expect(res.body.user.role).toBe("technician");
  });

  it("rejects wrong password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@desksos.com", password: "wrong" });
    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("rejects missing fields", async () => {
    const res = await request(app).post("/auth/login").send({ email: "admin@desksos.com" });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /auth/register", () => {
  it("registers a new user and returns a token", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "New Tech", email: "newtech@desksos.com", password: "pass456" });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.role).toBe("technician");
    expect(res.body.user).not.toHaveProperty("password");
  });

  it("rejects duplicate email", async () => {
    await request(app).post("/auth/register")
      .send({ name: "Dup", email: "dup@desksos.com", password: "abc123" });
    const res = await request(app).post("/auth/register")
      .send({ name: "Dup2", email: "dup@desksos.com", password: "abc123" });
    expect(res.statusCode).toBe(409);
  });

  it("rejects missing fields", async () => {
    const res = await request(app).post("/auth/register").send({ email: "x@y.com" });
    expect(res.statusCode).toBe(400);
  });
});


