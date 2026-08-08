import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";

// `db.ts` creates/opens its sqlite file at import time (see its module-level
// `new Database(DB_PATH)`), so the env var has to be set before anything
// that transitively imports it — a static `import` at the top of this file
// would already have run by then. A fresh temp path per test run also means
// this suite never touches the real dev/prod database.
process.env.ATHANORDB_DB_PATH = join(tmpdir(), `athanordb-test-${randomUUID()}.sqlite`);
process.env.ATHANORDB_COOKIE_SECURE = "false";

const { db } = await import("../db.js");
const { createSession, resolveSession, destroySession, purgeExpiredSessions, requireUser, requireAdmin } =
  await import("./session.js");

function insertUser(overrides: { email?: string; isAdmin?: 0 | 1; displayName?: string | null } = {}): string {
  const id = randomUUID();
  db.prepare("INSERT INTO users (id, email, password_hash, is_admin, display_name) VALUES (?, ?, ?, ?, ?)").run(
    id,
    overrides.email ?? `${id}@example.com`,
    "irrelevant-for-these-tests",
    overrides.isAdmin ?? 0,
    overrides.displayName ?? null,
  );
  return id;
}

/** Records what the route handler would have sent, instead of a real Fastify reply. */
function mockReply() {
  const cookiesSet: { name: string; value: string }[] = [];
  const cookiesCleared: string[] = [];
  let statusCode: number | undefined;
  let body: unknown;
  const reply = {
    setCookie(name: string, value: string) {
      cookiesSet.push({ name, value });
      return reply;
    },
    clearCookie(name: string) {
      cookiesCleared.push(name);
      return reply;
    },
    code(c: number) {
      statusCode = c;
      return reply;
    },
    send(b: unknown) {
      body = b;
      return reply;
    },
  };
  return { reply, cookiesSet, cookiesCleared, getStatus: () => statusCode, getBody: () => body };
}

function mockRequest(cookies: Record<string, string> = {}, user: unknown = undefined) {
  return { cookies, user } as unknown as FastifyRequest;
}

test("createSession -> resolveSession round-trips to the same user", () => {
  const userId = insertUser({ email: "alice@example.com", displayName: "Alice" });
  const { reply, cookiesSet } = mockReply();
  createSession(userId, reply as unknown as FastifyReply);
  assert.equal(cookiesSet.length, 1);

  const { name, value } = cookiesSet[0];
  const resolved = resolveSession(mockRequest({ [name]: value }), mockReply().reply as unknown as FastifyReply);
  assert.ok(resolved);
  assert.equal(resolved?.id, userId);
  assert.equal(resolved?.email, "alice@example.com");
  assert.equal(resolved?.displayName, "Alice");
  assert.equal(resolved?.isAdmin, false);
});

test("resolveSession falls back to the email's local part when display name is unset", () => {
  const userId = insertUser({ email: "bob@example.com", displayName: null });
  const { reply, cookiesSet } = mockReply();
  createSession(userId, reply as unknown as FastifyReply);
  const resolved = resolveSession(
    mockRequest({ [cookiesSet[0].name]: cookiesSet[0].value }),
    mockReply().reply as unknown as FastifyReply,
  );
  assert.equal(resolved?.displayName, "bob");
});

test("resolveSession returns null with no cookie, an unknown session id, or a garbage one", () => {
  assert.equal(resolveSession(mockRequest(), mockReply().reply as unknown as FastifyReply), null);
  assert.equal(
    resolveSession(mockRequest({ athanordb_sid: randomUUID() }), mockReply().reply as unknown as FastifyReply),
    null,
    "well-formed but never-issued session id",
  );
  assert.equal(
    resolveSession(mockRequest({ athanordb_sid: "not-a-uuid-at-all" }), mockReply().reply as unknown as FastifyReply),
    null,
  );
});

test("resolveSession rejects an expired session", () => {
  const userId = insertUser();
  const { reply, cookiesSet } = mockReply();
  createSession(userId, reply as unknown as FastifyReply);
  const { name, value } = cookiesSet[0];

  db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(new Date(Date.now() - 1000).toISOString(), value);

  const resolved = resolveSession(mockRequest({ [name]: value }), mockReply().reply as unknown as FastifyReply);
  assert.equal(resolved, null);
});

test("resolveSession rolls the expiry forward and re-sets the cookie on every hit", () => {
  const userId = insertUser();
  const { reply, cookiesSet } = mockReply();
  createSession(userId, reply as unknown as FastifyReply);
  const { name, value } = cookiesSet[0];

  // Set it to something soon (but not expired) first — createSession's own
  // expiry is already ~30 days out, so comparing against that directly risks
  // both timestamps landing in the same millisecond in a fast test run.
  // Rolling forward from something obviously closer makes the "after" value
  // unambiguous regardless of clock resolution.
  const soon = new Date(Date.now() + 60_000).toISOString();
  db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(soon, value);

  const { reply: reply2, cookiesSet: cookiesSet2 } = mockReply();
  resolveSession(mockRequest({ [name]: value }), reply2 as unknown as FastifyReply);
  const after = (db.prepare("SELECT expires_at FROM sessions WHERE id = ?").get(value) as { expires_at: string })
    .expires_at;

  assert.ok(new Date(after).getTime() > new Date(soon).getTime(), "rolled forward from the ~1-minute mark to ~30 days out");
  assert.equal(cookiesSet2.length, 1, "the session cookie is re-set on every resolve, not just on login");
  assert.equal(cookiesSet2[0].value, value, "same session id, just a later expiry");
});

test("destroySession deletes the row and clears the cookie — resolveSession then fails", () => {
  const userId = insertUser();
  const { reply, cookiesSet } = mockReply();
  createSession(userId, reply as unknown as FastifyReply);
  const { name, value } = cookiesSet[0];

  const { reply: destroyReply, cookiesCleared } = mockReply();
  destroySession(mockRequest({ [name]: value }), destroyReply as unknown as FastifyReply);
  assert.deepEqual(cookiesCleared, [name]);

  const resolved = resolveSession(mockRequest({ [name]: value }), mockReply().reply as unknown as FastifyReply);
  assert.equal(resolved, null);
});

test("destroySession with no cookie is a harmless no-op", () => {
  const { reply, cookiesCleared } = mockReply();
  destroySession(mockRequest(), reply as unknown as FastifyReply);
  assert.deepEqual(cookiesCleared, ["athanordb_sid"], "still clears the cookie client-side even if there was nothing to delete server-side");
});

test("purgeExpiredSessions deletes only sessions whose expiry has passed", () => {
  // Earlier tests in this file deliberately leave their own expired rows
  // behind (that's the scenario they're testing) — this test shares the
  // same temp database, so it asserts relationally against its own two
  // sessions rather than an exact global `removed` count.
  const userId = insertUser();
  const { reply: r1, cookiesSet: s1 } = mockReply();
  createSession(userId, r1 as unknown as FastifyReply);
  const { reply: r2, cookiesSet: s2 } = mockReply();
  createSession(userId, r2 as unknown as FastifyReply);

  db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(
    new Date(Date.now() - 1000).toISOString(),
    s1[0].value,
  );

  const removed = purgeExpiredSessions();
  assert.ok(removed >= 1, "at least this test's own expired session was counted");
  assert.equal(db.prepare("SELECT 1 FROM sessions WHERE id = ?").get(s1[0].value), undefined, "expired row gone");
  assert.ok(db.prepare("SELECT 1 FROM sessions WHERE id = ?").get(s2[0].value), "live row untouched");

  const stillExpired = db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE expires_at < ?").get(
    new Date().toISOString(),
  ) as { n: number };
  assert.equal(stillExpired.n, 0, "nothing expired survives a purge, including rows other tests left behind");
});

test("requireUser passes through req.user, or 401s and returns null", () => {
  const user = { id: "u1", email: "a@b.com", isAdmin: false, displayName: "A" };
  assert.equal(requireUser(mockRequest({}, user), mockReply().reply as unknown as FastifyReply), user);

  const { reply, getStatus, getBody } = mockReply();
  assert.equal(requireUser(mockRequest({}, undefined), reply as unknown as FastifyReply), null);
  assert.equal(getStatus(), 401);
  assert.deepEqual(getBody(), { error: "authentication required" });
});

test("requireAdmin 403s a non-admin user and passes through an admin", () => {
  const admin = { id: "u1", email: "a@b.com", isAdmin: true, displayName: "A" };
  assert.equal(requireAdmin(mockRequest({}, admin), mockReply().reply as unknown as FastifyReply), admin);

  const nonAdmin = { id: "u2", email: "b@b.com", isAdmin: false, displayName: "B" };
  const { reply, getStatus, getBody } = mockReply();
  assert.equal(requireAdmin(mockRequest({}, nonAdmin), reply as unknown as FastifyReply), null);
  assert.equal(getStatus(), 403);
  assert.deepEqual(getBody(), { error: "administrator access required" });
});
