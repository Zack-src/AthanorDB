import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db.js";

export interface SessionUser {
  id: string;
  email: string;
  isAdmin: boolean;
  displayName: string;
}

const SESSION_COOKIE = "athanordb_sid";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, rolling

interface UserRow {
  id: string;
  email: string;
  is_admin: number;
  display_name: string | null;
}

interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
}

function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    // Self-hosted deployments may run plain HTTP — defaulting `secure` to
    // true would silently lock those out. Opt in via env var once TLS is in
    // front of the app.
    secure: process.env.ATHANORDB_COOKIE_SECURE === "true",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    isAdmin: row.is_admin === 1,
    displayName: row.display_name?.trim() || row.email.split("@")[0],
  };
}

export function createSession(userId: string, reply: FastifyReply): void {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(id, userId, expiresAt);
  reply.setCookie(SESSION_COOKIE, id, cookieOptions(SESSION_TTL_MS));
}

export function destroySession(req: FastifyRequest, reply: FastifyReply): void {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (sessionId) db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

/**
 * Resolves the session cookie into a verified user, rolling the session's
 * expiry forward on every hit (and re-setting the cookie to match). Never
 * rejects the request itself — this runs in a global `onRequest` hook so
 * public routes (login, invite accept, health) stay reachable; callers that
 * need a user call `requireUser`/`requireAdmin` against the resolved value.
 */
export function resolveSession(req: FastifyRequest, reply: FastifyReply): SessionUser | null {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (!sessionId) return null;

  const session = db.prepare("SELECT id, user_id, expires_at FROM sessions WHERE id = ?").get(sessionId) as
    | SessionRow
    | undefined;
  if (!session || new Date(session.expires_at).getTime() < Date.now()) return null;

  const user = db.prepare("SELECT id, email, is_admin, display_name FROM users WHERE id = ?").get(session.user_id) as
    | UserRow
    | undefined;
  if (!user) return null;

  const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare("UPDATE sessions SET last_seen_at = datetime('now'), expires_at = ? WHERE id = ?").run(
    newExpiresAt,
    session.id,
  );
  reply.setCookie(SESSION_COOKIE, session.id, cookieOptions(SESSION_TTL_MS));

  return toSessionUser(user);
}

export function requireUser(req: FastifyRequest, reply: FastifyReply): SessionUser | null {
  if (req.user) return req.user;
  reply.code(401).send({ error: "authentication required" });
  return null;
}

export function requireAdmin(req: FastifyRequest, reply: FastifyReply): SessionUser | null {
  const user = requireUser(req, reply);
  if (!user) return null;
  if (!user.isAdmin) {
    reply.code(403).send({ error: "administrator access required" });
    return null;
  }
  return user;
}
