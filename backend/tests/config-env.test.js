const path = require("path");
const { envFilesFor } = require("../src/config");

describe("env files", () => {
  it("production loads .env.production first, overriding inherited values, then .env without overriding", () => {
    expect(envFilesFor("production", "/srv").map((f) => [path.basename(f.path), f.override]))
      .toEqual([[".env.production", true], [".env", false]]);
  });

  it("other environments load only .env, never overriding", () => {
    expect(envFilesFor("development", "/srv").map((f) => [path.basename(f.path), f.override])).toEqual([[".env", false]]);
    expect(envFilesFor("test", "/srv").map((f) => [path.basename(f.path), f.override])).toEqual([[".env", false]]);
  });
});

describe("production PM2 settings", () => {
  const prod = require("../ecosystem.config.js").apps[0].env_production;

  it("point the bridge at Enterprise production over HTTPS with its own source", () => {
    expect(prod.ENTERPRISE_INGEST_URL).toMatch(/^https:\/\/localhost:5543\/api\/ingest\/incidents$/);
    expect(prod.ENTERPRISE_SOURCE).toBe("desksos-desktop-prod");
  });

  it("trust the mkcert CA for Node, and keep the key out of this tracked file", () => {
    expect(prod.NODE_EXTRA_CA_CERTS).toMatch(/mkcert[\\/]rootCA\.pem$/);
    expect(prod).not.toHaveProperty("ENTERPRISE_INGEST_KEY");
  });
});
