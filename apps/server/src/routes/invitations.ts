import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { hashPassword } from "../auth/password.js";
import { createSession, requireAdmin } from "../auth/session.js";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface InvitationRow {
  token: string;
  email: string;
  is_admin: number;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

function invitationStatus(row: InvitationRow): "pending" | "accepted" | "expired" {
  if (row.accepted_at) return "accepted";
  if (new Date(row.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

export function registerInvitationRoutes(app: FastifyInstance): void {
  app.post("/api/invitations", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;

    const { email, isAdmin } = (req.body ?? {}) as { email?: string; isAdmin?: boolean };
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      reply.code(400);
      return { error: "a valid email is required" };
    }
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(normalized)) {
      reply.code(409);
      return { error: "a user with this email already exists" };
    }

    // Only one pending invite per email makes sense — replace rather than accumulate.
    db.prepare("DELETE FROM invitations WHERE email = ? AND accepted_at IS NULL").run(normalized);

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();
    db.prepare(
      "INSERT INTO invitations (token, email, is_admin, invited_by, expires_at) VALUES (?, ?, ?, ?, ?)",
    ).run(token, normalized, isAdmin ? 1 : 0, admin.id, expiresAt);

    return reply.code(201).send({ token, inviteUrl: `/invite/${token}`, email: normalized, expiresAt });
  });

  app.get("/api/invitations", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const rows = db
      .prepare("SELECT token, email, is_admin, invited_by, created_at, expires_at, accepted_at FROM invitations ORDER BY created_at DESC")
      .all() as InvitationRow[];
    return rows.map((row) => ({
      token: row.token,
      email: row.email,
      isAdmin: row.is_admin === 1,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      status: invitationStatus(row),
    }));
  });

  app.delete("/api/invitations/:token", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const { token } = req.params as { token: string };
    db.prepare("DELETE FROM invitations WHERE token = ? AND accepted_at IS NULL").run(token);
    return { revoked: true };
  });

  // Public — this is the one way to create an account without already having one.
  app.post("/api/invitations/:token/accept", async (req, reply) => {
    const { token } = req.params as { token: string };
    const invitation = db
      .prepare("SELECT token, email, is_admin, invited_by, created_at, expires_at, accepted_at FROM invitations WHERE token = ?")
      .get(token) as InvitationRow | undefined;
    if (!invitation || invitationStatus(invitation) !== "pending") {
      reply.code(400);
      return { error: "this invitation is no longer valid" };
    }

    const { password } = (req.body ?? {}) as { password?: string };
    if (!password || password.length < 8) {
      reply.code(400);
      return { error: "password must be at least 8 characters" };
    }

    const passwordHash = await hashPassword(password);
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO users (id, email, password_hash, is_admin) VALUES (?, ?, ?, ?)").run(
      id,
      invitation.email,
      passwordHash,
      invitation.is_admin,
    );
    db.prepare("UPDATE invitations SET accepted_at = datetime('now') WHERE token = ?").run(token);

    createSession(id, reply);
    return { id, email: invitation.email, isAdmin: invitation.is_admin === 1, displayName: invitation.email.split("@")[0] };
  });
}
