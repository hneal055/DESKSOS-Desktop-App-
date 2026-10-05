// Bridge not configured: creating tickets must not queue anything. Set to empty
// rather than deleted, since dotenv would otherwise fill them in from .env.
process.env.ENTERPRISE_INGEST_URL = "";
process.env.ENTERPRISE_INGEST_KEY = "";

const request = require("supertest");
const { app } = require("../src/server");
const db = require("../src/db").default;

it("does not queue tickets when the bridge is not configured", async () => {
  const login = await request(app)
    .post("/auth/login")
    .send({ email: "admin@desksos.com", password: "password123" });

  const res = await request(app)
    .post("/tickets")
    .set({ Authorization: `Bearer ${login.body.token}` })
    .send({ title: "Local only" });

  expect(res.statusCode).toBe(201);
  expect(db.prepare("SELECT COUNT(*) AS n FROM enterprise_outbox").get().n).toBe(0);
});
