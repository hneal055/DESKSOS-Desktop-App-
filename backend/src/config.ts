import "dotenv/config";

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
