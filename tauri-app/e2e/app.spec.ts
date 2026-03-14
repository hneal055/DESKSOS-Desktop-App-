/**
 * E2E integration tests — Login → Dashboard → Chat
 *
 * These run against:
 *  - Vite dev server on http://localhost:1420  (webServer in playwright.config.ts)
 *  - Real Express backend on http://localhost:5001  (started in global-setup.ts)
 *    NODE_ENV=test → in-memory SQLite seeded with admin@desksos.com / password123
 */
import { test, expect, Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@desksos.com";
const ADMIN_PASS  = "password123";

// ── helpers ──────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASS);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Sidebar nav is the auth gate — wait for it
  await expect(page.getByRole("button", { name: /Dashboard/i })).toBeVisible({ timeout: 8000 });
}

// ── Login ─────────────────────────────────────────────────────────────────────

test.describe("Login", () => {
  test("shows login form on first load", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("rejects wrong password with error message", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid credentials/i)).toBeVisible({ timeout: 5000 });
  });

  test("logs in with valid credentials and shows app nav", async ({ page }) => {
    await login(page);
    await expect(page.getByText(/admin/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Ticket/i })).toBeVisible();
  });
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test("shows ticket queue stats panel", async ({ page }) => {
    await expect(page.getByText(/open/i)).toBeVisible({ timeout: 5000 });
  });

  test("navigates to Ticket Builder via sidebar", async ({ page }) => {
    await page.getByRole("button", { name: /Ticket/i }).click();
    // TicketBuilder renders "Issue Description" label
    await expect(page.getByText("Issue Description")).toBeVisible({ timeout: 5000 });
  });
});

// ── Chat ──────────────────────────────────────────────────────────────────────

test.describe("Chat", () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test("opens chat and shows Channels heading", async ({ page }) => {
    await page.getByRole("button", { name: /Chat/i }).click();
    await expect(page.getByRole("heading", { name: "Channels" })).toBeVisible({ timeout: 5000 });
  });

  test("shows at least one channel in the list", async ({ page }) => {
    await page.getByRole("button", { name: /Chat/i }).click();
    // Channels render as "# name" — getByText with regex
    await expect(page.getByRole("button", { name: /^# / }).first()).toBeVisible({ timeout: 5000 });
  });

  test("sends a message and it appears in the thread", async ({ page }) => {
    await page.getByRole("button", { name: /Chat/i }).click();
    // Wait for a channel to be selected (textarea becomes enabled)
    await expect(page.getByPlaceholder(/Message #/i)).toBeEnabled({ timeout: 5000 });
    const msg = `E2E test message ${Date.now()}`;
    await page.getByPlaceholder(/Message #/i).fill(msg);
    await page.getByRole("button", { name: /^Send$/i }).click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 5000 });
  });

  test("sign-out returns to login screen", async ({ page }) => {
    await page.getByRole("button", { name: /Sign out/i }).click();
    await expect(page.getByLabel("Email")).toBeVisible({ timeout: 5000 });
  });
});
