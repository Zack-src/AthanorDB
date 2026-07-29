import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { requireAdmin, requireUser } from "../auth/session.js";

interface UserRow {
  id: string;
  email: string;
  is_admin: number;
  display_name: string | null;
  created_at: string;
}

const MIN_PASSWORD_LENGTH = 8;

export function registerUserRoutes(app: FastifyInstance): void {
  // Admin-only: needed by the Teams admin-console UI's member picker.
  // Deliberately minimal beyond that plus the password endpoints below — no
  // admin-driven edit/delete/deactivate. Nothing in the spec asks for those,
  // and the cascade implications (owned projects, revision authorship)
  // aren't worth speculative handling.
  app.get("/api/users", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const rows = db
      .prepare("SELECT id, email, is_admin, display_name, created_at FROM users ORDER BY created_at ASC")
      .all() as UserRow[];
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      isAdmin: row.is_admin === 1,
      displayName: row.display_name?.trim() || row.email.split("@")[0],
      createdAt: row.created_at,
    }));
  });

  app.patch("/api/users/me", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { displayName } = (req.body ?? {}) as { displayName?: string };
    const trimmed = displayName?.trim().slice(0, 64);
    if (!trimmed) {
      reply.code(400);
      return { error: "displayName is required" };
    }
    db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(trimmed, user.id);
    return { ...user, displayName: trimmed };
  });

  // Self-service: requires the current password, unlike the admin reset below.
  app.patch("/api/users/me/password", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    const { currentPassword, newPassword } = (req.body ?? {}) as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) {
      reply.code(400);
      return { error: "currentPassword and newPassword are required" };
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      reply.code(400);
      return { error: `newPassword must be at least ${MIN_PASSWORD_LENGTH} characters` };
    }
    const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as
      | { password_hash: string }
      | undefined;
    if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
      reply.code(401);
      return { error: "current password is incorrect" };
    }
    const passwordHash = await hashPassword(newPassword);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, user.id);
    return { changed: true };
  });

  // Admin override — no current-password check, since the whole point is
  // recovering a user who can't provide one. Kills every existing session for
  // that account so the old password can't keep being used anywhere it's
  // still logged in.
  app.patch("/api/users/:id/password", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    const { id } = req.params as { id: string };
    if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(id)) {
      reply.code(404);
      return { error: "not found" };
    }
    const { newPassword } = (req.body ?? {}) as { newPassword?: string };
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      reply.code(400);
      return { error: `newPassword must be at least ${MIN_PASSWORD_LENGTH} characters` };
    }
    const passwordHash = await hashPassword(newPassword);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    return { reset: true };
  });
}
