import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_PORT  = "5001";
const READY_PHRASE  = "running on";

declare global {
  // eslint-disable-next-line no-var
  var __E2E_BACKEND__: ChildProcess;
}

export default async function globalSetup() {
  const backendDir = path.resolve(__dirname, "../../backend");
  const distEntry  = path.join(backendDir, "dist", "server.js");

  if (!fs.existsSync(distEntry)) {
    throw new Error(
      `[E2E] Backend not built. Run: cd backend && npm run build\n  Expected: ${distEntry}`
    );
  }

  const backend = spawn("node", [distEntry], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_PATH: ":memory:",
      JWT_SECRET: "e2e-playwright-test-secret-key-min-32-chars",
      PORT: BACKEND_PORT,
      CORS_ORIGINS: "http://localhost:1420",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  global.__E2E_BACKEND__ = backend;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("[E2E] Backend did not start within 10s")),
      10_000
    );
    backend.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes(READY_PHRASE)) {
        clearTimeout(timeout);
        resolve();
      }
    });
    backend.stderr?.on("data", (d: Buffer) => process.stderr.write(d));
    backend.on("error", (err) => { clearTimeout(timeout); reject(err); });
    backend.on("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`[E2E] Backend exited with code ${code}`));
      }
    });
  });

  process.env.E2E_API_URL = `http://localhost:${BACKEND_PORT}`;
  console.log(`[E2E] Backend ready on http://localhost:${BACKEND_PORT}`);
}
