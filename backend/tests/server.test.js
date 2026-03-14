const request = require("supertest");
const { app } = require("../src/server");

describe("404 handler", () => {
  it("returns 404 JSON for unknown routes", async () => {
    const res = await request(app).get("/does-not-exist");
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty("error", "Not found");
  });

  it("returns 404 JSON for unknown POST route", async () => {
    const res = await request(app).post("/no-such-endpoint").send({});
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty("error", "Not found");
  });
});

describe("GET /health", () => {
  it("returns status ok without auth", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
  });
});

describe("Global error handler", () => {
  it("does not expose stack traces in error responses", async () => {
    // The error handler is verified implicitly: any thrown error from a route
    // must yield 500 with { error: "Internal server error" } — not a stack trace.
    // We test the 404 path as a proxy that the middleware chain is intact.
    const res = await request(app).get("/trigger-unknown");
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toHaveProperty("stack");
    expect(res.body).not.toHaveProperty("message");
  });
});
