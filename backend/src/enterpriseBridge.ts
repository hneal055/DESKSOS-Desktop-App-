// DeskSOS Enterprise bridge (phase 2).
//
// New tickets are queued in the enterprise_outbox table in the same transaction
// that creates them, then a background worker forwards them to the Enterprise
// ingest API (POST /api/ingest/incidents). The outbox lives in SQLite, so
// queued tickets survive restarts and periods when Enterprise is unreachable.
//
// Enterprise de-duplicates on (source, externalId), so a retry after a lost
// response never creates a second incident.

import db from "./db.js";
import { Ticket } from "./types/index.js";
import {
  BRIDGE_ENABLED,
  ENTERPRISE_INGEST_URL,
  ENTERPRISE_INGEST_KEY,
  ENTERPRISE_SOURCE,
} from "./config.js";

export interface BridgeOptions {
  url: string;
  apiKey: string;
  source: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  batchSize?: number;
}

export interface OutboxRunSummary {
  sent: number;
  retried: number;
  failed: number;
}

const SEVERITY_BY_PRIORITY: Record<Ticket["priority"], string> = {
  P1: "CRITICAL",
  P2: "HIGH",
  P3: "MEDIUM",
  P4: "LOW",
};

const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 60 * 60_000;
const POLL_INTERVAL_MS = 15_000;

// 30s, 1m, 2m, 4m ... capped at 1h
export function backoffMs(attempts: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_DELAY_MS);
}

// Auth/config problems (401/403), timeouts, throttling and server errors can
// clear up on their own or once an operator fixes the key, so keep retrying.
// Any other 4xx means Enterprise rejected the payload; retrying won't help.
export function isRetryableStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 408 || status === 429 || status >= 500;
}

export function buildPayload(t: Ticket, source: string) {
  return {
    source,
    externalId: t.id,
    title: t.title,
    // Enterprise requires a non-empty description; Desktop allows blank ones
    description: t.description?.trim() || t.title,
    severity: SEVERITY_BY_PRIORITY[t.priority] ?? "MEDIUM",
    category: "Desktop Support",
    requester: t.requester ?? undefined,
    assignedTo: t.assignee_name ?? undefined,
  };
}

export function enqueueTicket(ticketId: string, now: Date = new Date()): void {
  const ts = now.toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO enterprise_outbox (ticket_id, status, attempts, next_attempt_at, created_at)
    VALUES (?, 'pending', 0, ?, ?)
  `).run(ticketId, ts, ts);
}

type DueRow = Ticket & { outbox_attempts: number };

let running = false;

export async function processOutbox(opts: BridgeOptions): Promise<OutboxRunSummary> {
  const summary: OutboxRunSummary = { sent: 0, retried: 0, failed: 0 };
  // The poll timer and kicks from new tickets can overlap; one run at a time
  if (running) return summary;
  running = true;

  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? (() => new Date());

  try {
    const rows = db.prepare(`
      SELECT o.attempts AS outbox_attempts, t.*
      FROM enterprise_outbox o
      JOIN tickets t ON t.id = o.ticket_id
      WHERE o.status = 'pending' AND o.next_attempt_at <= ?
      ORDER BY o.created_at
      LIMIT ?
    `).all(now().toISOString(), opts.batchSize ?? 20) as DueRow[];

    for (const row of rows) {
      const attempts = row.outbox_attempts + 1;
      let error: string;
      let retryable: boolean;

      try {
        const res = await fetchImpl(opts.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": opts.apiKey },
          body: JSON.stringify(buildPayload(row, opts.source)),
          signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
          // fetch keeps custom headers like X-API-Key on cross-origin 307/308
          // redirects, so following one could hand the key to another host
          redirect: "error",
        });

        if (res.ok) {
          const body = (await res.json().catch(() => ({}))) as { id?: unknown };
          db.prepare(`
            UPDATE enterprise_outbox
            SET status = 'sent', attempts = ?, enterprise_id = ?, sent_at = ?, last_error = NULL
            WHERE ticket_id = ?
          `).run(attempts, body.id != null ? String(body.id) : null, now().toISOString(), row.id);
          summary.sent++;
          console.log(`[enterprise-bridge] ${row.id} forwarded (Enterprise incident ${body.id ?? "?"})`);
          continue;
        }

        const text = await res.text().catch(() => "");
        error = `HTTP ${res.status}${text ? `: ${text.slice(0, 300)}` : ""}`;
        retryable = isRetryableStatus(res.status);
      } catch (err) {
        // Node's fetch reports most failures as just "fetch failed"; the real
        // reason (refused connection, untrusted certificate, DNS) is in cause
        const cause = (err as { cause?: { message?: string; code?: string } }).cause;
        const detail = cause ? ` (${cause.code ? `${cause.code}: ` : ""}${cause.message ?? ""})` : "";
        error = `Request failed: ${(err as Error).message}${detail}`;
        retryable = true;
      }

      if (!retryable) {
        db.prepare(`
          UPDATE enterprise_outbox SET status = 'failed', attempts = ?, last_error = ? WHERE ticket_id = ?
        `).run(attempts, error, row.id);
        summary.failed++;
        console.error(`[enterprise-bridge] ${row.id} rejected by Enterprise, not retrying: ${error}`);
        continue;
      }

      const delay = backoffMs(attempts);
      db.prepare(`
        UPDATE enterprise_outbox SET attempts = ?, next_attempt_at = ?, last_error = ? WHERE ticket_id = ?
      `).run(attempts, new Date(now().getTime() + delay).toISOString(), error, row.id);
      summary.retried++;
      console.warn(
        `[enterprise-bridge] ${row.id} attempt ${attempts} failed (${error}); retrying in ${Math.round(delay / 1000)}s`
      );
      // Enterprise is down or rejecting our key: the rest of the batch would
      // fail the same way, so leave it for the next run
      break;
    }
  } finally {
    running = false;
  }

  return summary;
}

let timer: NodeJS.Timeout | null = null;
let activeOptions: BridgeOptions | null = null;

function runSafely(): void {
  if (!activeOptions) return;
  processOutbox(activeOptions).catch((err) =>
    console.error(`[enterprise-bridge] Outbox run failed: ${(err as Error).message}`)
  );
}

// The API key travels in a header, so it must not cross the network in clear
// text: require HTTPS unless the URL points at this machine. Returns an error
// message, or null when the URL is acceptable.
export function checkIngestUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return `ENTERPRISE_INGEST_URL is not a valid URL: ${raw}`;
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const loopback = host === "localhost" || host === "::1" || /^127\.\d+\.\d+\.\d+$/.test(host);
  if (url.protocol === "https:" || (url.protocol === "http:" && loopback)) return null;
  return `ENTERPRISE_INGEST_URL must use https:// (plain http:// is only allowed for localhost): ${raw}`;
}

// Starts the background worker. No-op unless the bridge is configured.
export function startBridge(): boolean {
  if (!BRIDGE_ENABLED || timer) return Boolean(timer);
  // A bad URL disables sending instead of crashing the backend. New tickets
  // are still queued, and are sent once the URL is fixed and the backend restarts.
  const urlError = checkIngestUrl(ENTERPRISE_INGEST_URL);
  if (urlError) {
    console.error(`[enterprise-bridge] Disabled: ${urlError}`);
    return false;
  }
  activeOptions = { url: ENTERPRISE_INGEST_URL, apiKey: ENTERPRISE_INGEST_KEY, source: ENTERPRISE_SOURCE };
  timer = setInterval(runSafely, POLL_INTERVAL_MS);
  timer.unref();
  runSafely();
  console.log(`[enterprise-bridge] Forwarding new tickets to ${ENTERPRISE_INGEST_URL} as "${ENTERPRISE_SOURCE}"`);
  return true;
}

export function stopBridge(): void {
  if (timer) clearInterval(timer);
  timer = null;
  activeOptions = null;
}

// ── Outbox visibility (readiness plan task 3.6) ─────────────────────────────

export interface OutboxStatus {
  enabled: boolean;
  pending: number;
  failed: number;
  sent: number;
  oldestPendingAt: string | null;
  oldestPendingMinutes: number | null;
}

// Counts only: no ticket content, so it's safe for the local health monitor
export function outboxStatus(now: Date = new Date()): OutboxStatus {
  const rows = db.prepare("SELECT status, COUNT(*) AS c FROM enterprise_outbox GROUP BY status").all() as
    { status: string; c: number }[];
  const count = (s: string) => rows.find((r) => r.status === s)?.c ?? 0;
  const oldest = (db.prepare("SELECT MIN(created_at) AS t FROM enterprise_outbox WHERE status = 'pending'").get() as
    { t: string | null }).t;
  return {
    enabled: BRIDGE_ENABLED,
    pending: count("pending"),
    failed: count("failed"),
    sent: count("sent"),
    oldestPendingAt: oldest,
    oldestPendingMinutes: oldest ? Math.max(0, Math.floor((now.getTime() - Date.parse(oldest)) / 60_000)) : null,
  };
}

export interface OutboxProblem {
  ticketId: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  nextAttemptAt: string;
}

// Tickets that haven't reached Enterprise, oldest first, for admins
export function outboxProblems(limit = 20): OutboxProblem[] {
  return db.prepare(`
    SELECT ticket_id AS ticketId, status, attempts, last_error AS lastError,
           created_at AS createdAt, next_attempt_at AS nextAttemptAt
    FROM enterprise_outbox WHERE status IN ('pending', 'failed')
    ORDER BY created_at LIMIT ?
  `).all(limit) as OutboxProblem[];
}

// True for requests from this machine only (IPv4, IPv6 and IPv4-mapped loopback)
export function isLoopbackAddress(ip: string | undefined): boolean {
  if (!ip) return false;
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  return v4 === "::1" || /^127\.\d+\.\d+\.\d+$/.test(v4);
}

// Called after a ticket is queued so it's sent right away instead of waiting
// for the next poll. Does nothing if the worker isn't running.
export function kickBridge(): void {
  runSafely();
}
