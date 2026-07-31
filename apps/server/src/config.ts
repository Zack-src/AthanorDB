/**
 * Single place where environment configuration is read, validated and
 * documented. Everything else imports `config` rather than touching
 * `process.env`, so a malformed value fails loudly at boot instead of silently
 * falling back to a default halfway through a request.
 */

const isProduction = process.env.NODE_ENV === "production";

function fail(message: string): never {
  console.error(`[config] ${message}`);
  process.exit(1);
}

function readPort(): number {
  const raw = process.env.PORT;
  if (raw === undefined || raw.trim() === "") return 3001;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`PORT must be an integer between 1 and 65535 (got ${JSON.stringify(raw)})`);
  }
  return port;
}

function readCookieSecure(): boolean {
  const raw = process.env.ATHANORDB_COOKIE_SECURE;
  if (raw === undefined || raw.trim() === "") {
    // Self-hosted deployments may legitimately run plain HTTP on a LAN, so this
    // can't just default to true — but silently shipping non-`Secure` session
    // cookies in production is exactly the kind of thing nobody notices.
    if (isProduction) {
      console.warn(
        "[config] ATHANORDB_COOKIE_SECURE is not set — session cookies will NOT be marked Secure. " +
          'Set ATHANORDB_COOKIE_SECURE=true when running behind TLS, or =false to silence this warning.',
      );
    }
    return false;
  }
  if (raw !== "true" && raw !== "false") {
    fail(`ATHANORDB_COOKIE_SECURE must be "true" or "false" (got ${JSON.stringify(raw)})`);
  }
  return raw === "true";
}

function readSizeMb(name: string, fallbackMb: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallbackMb * 1024 * 1024;
  const mb = Number(raw);
  if (!Number.isFinite(mb) || mb <= 0 || mb > 512) {
    fail(`${name} must be a size in megabytes between 0 and 512 (got ${JSON.stringify(raw)})`);
  }
  return Math.round(mb * 1024 * 1024);
}

/** Extra origins allowed to make state-changing requests, on top of the app's own host. */
function readAllowedOrigins(): string[] {
  const raw = process.env.ATHANORDB_ALLOWED_ORIGINS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export const config = {
  isProduction,
  port: readPort(),
  dbPath: process.env.ATHANORDB_DB_PATH ?? "./data/athanordb.sqlite",
  cookieSecure: readCookieSecure(),
  /** Max REST body — DBML/SQL imports are the big ones. */
  bodyLimit: readSizeMb("ATHANORDB_MAX_BODY_MB", 4),
  /** Max single WebSocket frame — a Yjs sync/update for a large schema. */
  wsMaxPayload: readSizeMb("ATHANORDB_MAX_WS_FRAME_MB", 8),
  allowedOrigins: readAllowedOrigins(),
} as const;
