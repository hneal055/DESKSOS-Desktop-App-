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
  ?? "http://localhost:1420,tauri://localhost,https://tauri.localhost";

export const CORS_ORIGINS: string[] = rawOrigins.split(",").map((o) => o.trim()).filter(Boolean);
