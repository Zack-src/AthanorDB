import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { normalizeEmail } from "../auth/email.js";
import { MAX_PASSWORD_LENGTH, verifyPassword } from "../auth/password.js";
import { createSession, destroySession, requireUser } from "../auth/session.js";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  is_admin: number;
  display_name: string | null;
}

/**
 * Login is the one unauthenticated route that does expensive work (scrypt) and
 * guards every account, so it gets a per-IP limit: 10 attempts a minute is
 * far beyond human typing and far below anything useful for guessing.
 */
const LOGIN_RATE_LIMIT = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post("/api/auth/login", LOGIN_RATE_LIMIT, async (req, reply) => {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    const normalized = normalizeEmail(email);
    if (!normalized || !password) {
      reply.code(400);
      return { error: "email and password are required" };
    }
    // Bail before hashing: an arbitrarily long password would otherwise make
    // every failed attempt disproportionately expensive to serve.
    if (password.length > MAX_PASSWORD_LENGTH) {
      reply.code(401);
      return { error: "invalid email or password" };
    }

    const row = db.prepare("SELECT id, email, password_hash, is_admin, display_name FROM users WHERE email = ?").get(
      normalized,
    ) as UserRow | undefined;
    // Generic error either way — doesn't reveal whether the email is registered.
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      reply.code(401);
      return { error: "invalid email or password" };
    }

    createSession(row.id, reply);
    return {
      id: row.id,
      email: row.email,
      isAdmin: row.is_admin === 1,
      displayName: row.display_name?.trim() || row.email.split("@")[0],
    };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    destroySession(req, reply);
    return { loggedOut: true };
  });

  app.get("/api/auth/me", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;
    return user;
  });
}
