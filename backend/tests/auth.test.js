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
      .send({ name: "New Tech", email: "newtech@desksos.com", password: "pass4567" });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.role).toBe("technician");
    expect(res.body.user).not.toHaveProperty("password");
  });

  it("rejects duplicate email", async () => {
    await request(app).post("/auth/register")
      .send({ name: "Dup", email: "dup@desksos.com", password: "abc12345" });
    const res = await request(app).post("/auth/register")
      .send({ name: "Dup2", email: "dup@desksos.com", password: "abc12345" });
    expect(res.statusCode).toBe(409);
  });

  it("rejects missing fields", async () => {
    const res = await request(app).post("/auth/register").send({ email: "x@y.com" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects password shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Weak", email: "weak@desksos.com", password: "short" });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.errors[0].message).toMatch(/8 character/);
  });
});




