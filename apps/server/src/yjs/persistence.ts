import * as Y from "yjs";
import { db } from "../db.js";

export function loadSnapshot(projectId: string): Uint8Array | undefined {
  const row = db.prepare("SELECT yjs_state FROM snapshots WHERE project_id = ?").get(projectId) as
    | { yjs_state: Buffer }
    | undefined;
  return row ? new Uint8Array(row.yjs_state) : undefined;
}

export function saveSnapshot(projectId: string, doc: Y.Doc): void {
  const state = Buffer.from(Y.encodeStateAsUpdate(doc));
  db.prepare(
    `INSERT INTO snapshots (project_id, yjs_state, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(project_id) DO UPDATE SET yjs_state = excluded.yjs_state, updated_at = excluded.updated_at`,
  ).run(projectId, state);
}

export function appendRevision(projectId: string, author: string, update: Uint8Array): void {
  db.prepare(
    `INSERT INTO revisions (id, project_id, author, yjs_update, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
  ).run(crypto.randomUUID(), projectId, author, Buffer.from(update));
}

export function listRevisions(projectId: string) {
  return db
    .prepare(`SELECT id, author, label, created_at FROM revisions WHERE project_id = ? ORDER BY created_at ASC`)
    .all(projectId);
}
