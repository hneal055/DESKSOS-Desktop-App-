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

// Comma-separated allowed origins. Defaults to localhost dev ports.
// In production set: CORS_ORIGINS=https://your-app.com
const rawOrigins = process.env.CORS_ORIGINS ?? "http://localhost:1420,http://localhost:5000,http://localhost:3000";
export const CORS_ORIGINS: string[] = rawOrigins.split(",").map((o) => o.trim()).filter(Boolean);
