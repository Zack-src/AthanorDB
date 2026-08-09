import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runMigrations, MIGRATIONS } from "./migrations.js";

const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/** A bare `projects` table missing the columns the migrations are meant to add — the pre-migration shape. */
function freshDbMissingColumns(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL);
  `);
  return db;
}

test("runMigrations adds every missing column and sets user_version to the latest", () => {
  const db = freshDbMissingColumns();
  runMigrations(db);
  const columns = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  assert.ok(columns.some((c) => c.name === "status"));
  assert.ok(columns.some((c) => c.name === "owner_id"));
  assert.equal(db.pragma("user_version", { simple: true }), LATEST_VERSION);
});

test("runMigrations is a no-op the second time — nothing left pending once user_version is current", () => {
  const db = freshDbMissingColumns();
  runMigrations(db);
  assert.doesNotThrow(() => runMigrations(db));
  assert.equal(db.pragma("user_version", { simple: true }), LATEST_VERSION);
});

test("a database that reached the current shape some other way (columns present, user_version stale) doesn't get double-ALTERed", () => {
  const db = freshDbMissingColumns();
  // Simulate e.g. a restore from an old backup taken before this file existed.
  db.exec("ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  db.exec("ALTER TABLE projects ADD COLUMN owner_id TEXT REFERENCES users(id)");
  assert.doesNotThrow(() => runMigrations(db));
  const columns = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  assert.equal(columns.filter((c) => c.name === "status").length, 1, "not double-added");
  assert.equal(db.pragma("user_version", { simple: true }), LATEST_VERSION, "still catches up to the latest version");
});

test("a fresh database whose CREATE TABLE already has every current column (the normal new-install path) still ends up at the latest user_version", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      owner_id TEXT REFERENCES users(id)
    );
  `);
  runMigrations(db);
  assert.equal(db.pragma("user_version", { simple: true }), LATEST_VERSION);
});
