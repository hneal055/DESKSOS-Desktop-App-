import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for DeskSOS.
 * globalSetup starts backend on :5001 (NODE_ENV=test, :memory: SQLite).
 * webServer starts the Vite dev server on :1420.
 * VITE_API_URL is overridden via tauri-app/.env.test.
 */
export default defineConfig({
  tsconfig: "./tsconfig.e2e.json",
  testDir: "./e2e",
  timeout: 20_000,
  expect: { timeout: 6_000 },
  fullyParallel: false,   // tests share one backend process
  workers: 1,
  retries: 1,             // re-run once on flaky CI
  reporter: [["list"], ["html", { open: "never" }]],

  globalSetup:    "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    command: "npx vite --mode test --port 1420",
    port: 1420,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
