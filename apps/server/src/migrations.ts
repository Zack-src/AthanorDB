import type Database from "better-sqlite3";

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

/**
 * Ordered, one-way migrations applied on top of the baseline schema (the
 * `CREATE TABLE IF NOT EXISTS` block in `db.ts`, itself idempotent and safe
 * to run unconditionally on every boot — a brand-new install gets the full
 * current shape for free and simply has nothing pending here).
 *
 * Tracked via SQLite's built-in `PRAGMA user_version` rather than a separate
 * migrations table: one integer, set atomically in the same transaction as
 * the schema change it corresponds to, with no per-row bookkeeping needed
 * for what is — and is expected to stay — a short linear list. Replaces the
 * two one-off `PRAGMA table_info` + guarded `ALTER TABLE` checks that used
 * to live directly in `db.ts`; the next schema change is a new entry here
 * instead of another hand-rolled check that's easy to forget.
 *
 * Each `up` still guards its own `ALTER` (checking the column doesn't
 * already exist) rather than trusting `user_version` alone — belt and
 * suspenders against a database that reached the current shape some other
 * way (e.g. restored from an old backup that predates this file existing).
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "projects.status column",
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
      if (!columns.some((c) => c.name === "status")) {
        db.exec("ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
      }
    },
  },
  {
    version: 2,
    name: "projects.owner_id column",
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
      if (!columns.some((c) => c.name === "owner_id")) {
        db.exec("ALTER TABLE projects ADD COLUMN owner_id TEXT REFERENCES users(id)");
      }
    },
  },
];

/** Applies every migration above the database's current `user_version`, each in its own transaction, in order. */
export function runMigrations(db: Database.Database): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  const pending = MIGRATIONS.filter((m) => m.version > current).sort((a, b) => a.version - b.version);
  for (const migration of pending) {
    db.transaction(() => {
      migration.up(db);
      // Interpolated rather than bound: PRAGMA doesn't accept `?` parameters,
      // and `migration.version` is a compile-time constant from the array
      // above, never user input.
      db.pragma(`user_version = ${migration.version}`);
    })();
    console.log(`[db] applied migration ${migration.version}: ${migration.name}`);
  }
}
