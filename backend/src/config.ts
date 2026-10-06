import dotenv from "dotenv";
import path from "path";

// backend/, from src/ or dist/
const BACKEND_DIR = path.resolve(__dirname, "..");

// Production loads backend/.env.production first and lets it OVERRIDE
// inherited variables, so production secrets (such as its own Enterprise
// ingest key) win over the shared .env and over stale values passed down by a
// shell or the PM2 daemon. Keep only secrets there; settings live in
// ecosystem.config.js. The shared .env is then loaded without overriding.
export function envFilesFor(nodeEnv: string | undefined, dir = BACKEND_DIR): { path: string; override: boolean }[] {
  const shared = { path: path.join(dir, ".env"), override: false };
  return nodeEnv === "production" ? [{ path: path.join(dir, ".env.production"), override: true }, shared] : [shared];
}
for (const file of envFilesFor(process.env.NODE_ENV)) dotenv.config(file);

function requireEnv(name: string, minLength = 0): string {
  const val = process.env[name];
  if (!val || val.length < minLength) {
    console.error(`[DeskSOS] FATAL: ${name} must be set${minLength ? ` and at least ${minLength} characters` : ""}.`);
    if (name === "JWT_SECRET") {
      console.error('  Generate: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'base64\'))"');
    }
    process.exit(1);
  }
  return val;
}

export const JWT_SECRET = requireEnv("JWT_SECRET", 32);
export const PORT       = process.env.PORT ?? "5000";

// Allowed CORS origins.
//
// Defaults cover every legitimate Tauri client origin:
//   http://localhost:1420   — Vite dev server (tauri dev)
//   tauri://localhost        — Tauri production app (macOS / Linux)
//   https://tauri.localhost  — Tauri production app (Windows WebView2)
//
// In production you can restrict further via CORS_ORIGINS env var:
//   CORS_ORIGINS=tauri://localhost,https://tauri.localhost
const rawOrigins = process.env.CORS_ORIGINS
  ?? "http://localhost:1420,tauri://localhost,https://tauri.localhost,http://tauri.localhost";

export const CORS_ORIGINS: string[] = rawOrigins.split(",").map((o) => o.trim()).filter(Boolean);

// DeskSOS Enterprise bridge: forward newly created tickets to the Enterprise
// ingest API. Disabled unless both URL and key are set.
//   ENTERPRISE_INGEST_URL=http://localhost:5100/api/ingest/incidents
//   ENTERPRISE_INGEST_KEY=<same value as INGEST_API_KEY on the Enterprise server>
//   ENTERPRISE_SOURCE=desksos-desktop   (optional; use distinct values per instance)
export const ENTERPRISE_INGEST_URL = process.env.ENTERPRISE_INGEST_URL?.trim() || "";
export const ENTERPRISE_INGEST_KEY = process.env.ENTERPRISE_INGEST_KEY?.trim() || "";
export const ENTERPRISE_SOURCE     = process.env.ENTERPRISE_SOURCE?.trim() || "desksos-desktop";
export const BRIDGE_ENABLED        = Boolean(ENTERPRISE_INGEST_URL && ENTERPRISE_INGEST_KEY);
