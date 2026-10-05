// Sentry error tracking. Must be imported before anything else in server.ts so
// it can instrument express/http. Does nothing unless SENTRY_DSN is set.
import "dotenv/config";
import * as Sentry from "@sentry/node";

export const SENTRY_ENABLED = Boolean(process.env.SENTRY_DSN) && process.env.NODE_ENV !== "test";

if (SENTRY_ENABLED) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    // Errors only; no performance tracing or request bodies.
    tracesSampleRate: 0,
  });
}
