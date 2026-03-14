const request = require("supertest");
const app     = require("../server");

let token;

beforeAll(async () => {
  const res = await request(app)
    .post("/auth/login")
    .send({ email: "tech@desksos.com", password: "password123" });
  token = res.body.token;
});

afterAll(() => { if (app.close) app.close(); });

const auth = () => ({ Authorization: `Bearer ${token}` });

describe("GET /assets/:code", () => {
  it("returns asset ASSET-001 with maintenance history", async () => {
    const res = await request(app).get("/assets/ASSET-001").set(auth());
    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe("ASSET-001");
    expect(res.body.type).toBe("Laptop");
    expect(res.body.status).toBe("Active");
    expect(res.body).toHaveProperty("serialNumber");
    expect(Array.isArray(res.body.maintenanceHistory)).toBe(true);
    expect(res.body.maintenanceHistory.length).toBe(2);
  });

  it("is case-insensitive for code lookup", async () => {
    const res = await request(app).get("/assets/asset-001").set(auth());
    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe("ASSET-001");
  });

  it("returns 404 for unknown asset", async () => {
    const res = await request(app).get("/assets/ASSET-999").set(auth());
    expect(res.statusCode).toBe(404);
  });

  it("rejects unauthenticated request", async () => {
    const res = await request(app).get("/assets/ASSET-001");
    expect(res.statusCode).toBe(401);
  });
});
