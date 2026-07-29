import type { FastifyInstance } from "fastify";
import * as Y from "yjs";
import { readProjectFromDoc, writeProjectToDoc } from "@athanordb/shared";
import {
  applyVisualMetadata,
  mergeProjectIntoExisting,
  parseDbml,
  parseSql,
  projectToDbml,
  projectToSql,
  toProject,
  type SqlDialect,
} from "@athanordb/dbml-engine";
import { db } from "../db.js";
import { listRevisions, loadSnapshot, reconstructDocAtRevision, setRevisionLabel } from "../yjs/persistence.js";
import { getRoom } from "../yjs/room.js";

const SQL_DIALECTS: SqlDialect[] = ["postgres", "mysql", "mssql"];

function isSqlDialect(value: unknown): value is SqlDialect {
  return typeof value === "string" && (SQL_DIALECTS as string[]).includes(value);
}

export function getProjectRow(id: string): { id: string; name: string } | undefined {
  return db.prepare("SELECT id, name FROM projects WHERE id = ?").get(id) as { id: string; name: string } | undefined;
}

/**
 * Same `?user=` convention the WS handler uses (index.ts), so a REST-triggered
 * doc write (import, restore) attributes to the actual acting user in
 * revision history instead of always showing up as "system" — previously the
 * only path that recorded a real author was a live WS-connected edit.
 */
function getRequestUser(req: { query: unknown }): string {
  const raw = (req.query as Record<string, string> | undefined)?.user;
  const trimmed = raw?.trim().slice(0, 64);
  return trimmed && trimmed.length > 0 ? trimmed : "system";
}

export function registerProjectRoutes(app: FastifyInstance): void {
  app.get("/api/projects", async () => {
    return db.prepare("SELECT id, name, created_at FROM projects ORDER BY created_at DESC").all();
  });

  app.post("/api/projects", async (req, reply) => {
    const { name } = (req.body ?? {}) as { name?: string };
    const trimmed = name?.trim();
    if (!trimmed) {
      reply.code(400);
      return { error: "name is required" };
    }
    if (trimmed.length > 200) {
      reply.code(400);
      return { error: "name must be 200 characters or fewer" };
    }
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(id, trimmed);
    return reply.code(201).send({ id, name: trimmed });
  });

  app.get("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = db.prepare("SELECT id, name, created_at FROM projects WHERE id = ?").get(id);
    if (!project) {
      reply.code(404);
      return { error: "not found" };
    }
    return project;
  });

  app.get("/api/projects/:id/revisions", async (req) => {
    const { id } = req.params as { id: string };
    return listRevisions(id);
  });

  app.patch("/api/projects/:id/revisions/:revisionId", async (req, reply) => {
    const { id, revisionId } = req.params as { id: string; revisionId: string };
    const { label } = (req.body ?? {}) as { label?: string | null };
    const trimmed = typeof label === "string" ? label.trim() : null;
    const ok = setRevisionLabel(id, revisionId, trimmed && trimmed.length > 0 ? trimmed : null);
    if (!ok) {
      reply.code(404);
      return { error: "no such revision for this project" };
    }
    return { labeled: true };
  });

  app.get("/api/projects/:id/revisions/:revisionId", async (req, reply) => {
    const { id, revisionId } = req.params as { id: string; revisionId: string };
    const row = getProjectRow(id);
    if (!row) {
      reply.code(404);
      return { error: "not found" };
    }
    const doc = reconstructDocAtRevision(id, revisionId);
    if (!doc) {
      reply.code(404);
      return { error: "no such revision for this project" };
    }
    return readProjectFromDoc(doc, row.id, row.name);
  });

  app.post("/api/projects/:id/revisions/:revisionId/restore", async (req, reply) => {
    const { id, revisionId } = req.params as { id: string; revisionId: string };
    const row = getProjectRow(id);
    if (!row) {
      reply.code(404);
      return { error: "not found" };
    }
    const doc = reconstructDocAtRevision(id, revisionId);
    if (!doc) {
      reply.code(404);
      return { error: "no such revision for this project" };
    }
    const project = readProjectFromDoc(doc, row.id, row.name);
    const room = getRoom(id);
    room.doc.transact(() => writeProjectToDoc(room.doc, project), getRequestUser(req));
    return { restored: true };
  });

  app.get("/api/projects/:id/snapshot", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = getProjectRow(id);
    if (!row) {
      reply.code(404);
      return { error: "not found" };
    }
    const room = getRoom(id);
    return readProjectFromDoc(room.doc, row.id, row.name);
  });

  app.post("/api/projects/:id/snapshot/restore", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = getProjectRow(id);
    if (!row) {
      reply.code(404);
      return { error: "not found" };
    }
    const snapshot = loadSnapshot(id);
    if (!snapshot) {
      reply.code(404);
      return { error: "no snapshot saved yet" };
    }
    const room = getRoom(id);
    const snapshotDoc = new Y.Doc();
    Y.applyUpdate(snapshotDoc, snapshot);
    const project = readProjectFromDoc(snapshotDoc, row.id, row.name);
    room.doc.transact(() => writeProjectToDoc(room.doc, project), getRequestUser(req));
    return { restored: true };
  });

  app.post("/api/projects/:id/import", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = getProjectRow(id);
    if (!row) {
      reply.code(404);
      return { error: "not found" };
    }
    const body = (req.body ?? {}) as { source?: string; dialect?: string };
    if (!body.source?.trim()) {
      reply.code(400);
      return { error: "source is required" };
    }

    let database: ReturnType<typeof parseSql>;
    if (body.dialect) {
      if (!isSqlDialect(body.dialect)) {
        reply.code(400);
        return { error: `dialect must be one of ${SQL_DIALECTS.join(", ")}` };
      }
      try {
        database = parseSql(body.source, body.dialect);
      } catch (err) {
        reply.code(400);
        return { error: `SQL parse error: ${(err as Error).message}` };
      }
    } else {
      try {
        database = parseDbml(body.source);
      } catch (err) {
        reply.code(400);
        return { error: `DBML parse error: ${(err as Error).message}` };
      }
    }

    const parsed = body.dialect ? toProject(database, row.name) : applyVisualMetadata(toProject(database, row.name), body.source);
    const room = getRoom(id);
    // Merge by table/field name rather than a blind overwrite, so reimporting
    // an updated schema keeps existing tables' positions/detail level instead
    // of resetting the whole layout every time.
    const existingProject = readProjectFromDoc(room.doc, row.id, row.name);
    const merged = mergeProjectIntoExisting(existingProject, parsed);
    room.doc.transact(() => writeProjectToDoc(room.doc, merged), getRequestUser(req));
    return { imported: true, tables: merged.tables.length };
  });

  app.get("/api/projects/:id/revisions/:revisionId/export/dbml", async (req, reply) => {
    const { id, revisionId } = req.params as { id: string; revisionId: string };
    const { visual } = req.query as { visual?: string };
    const row = getProjectRow(id);
    if (!row) {
      reply.code(404);
      return { error: "not found" };
    }
    const doc = reconstructDocAtRevision(id, revisionId);
    if (!doc) {
      reply.code(404);
      return { error: "no such revision for this project" };
    }
    const project = readProjectFromDoc(doc, row.id, row.name);
    return reply.type("text/plain").send(projectToDbml(project, { includeVisualMetadata: visual === "1" }));
  });

  app.get("/api/projects/:id/revisions/:revisionId/export/sql", async (req, reply) => {
    const { id, revisionId } = req.params as { id: string; revisionId: string };
    const { dialect } = req.query as { dialect?: string };
    if (!isSqlDialect(dialect)) {
      reply.code(400);
      return { error: `dialect query param must be one of ${SQL_DIALECTS.join(", ")}` };
    }
    const row = getProjectRow(id);
    if (!row) {
      reply.code(404);
      return { error: "not found" };
    }
    const doc = reconstructDocAtRevision(id, revisionId);
    if (!doc) {
      reply.code(404);
      return { error: "no such revision for this project" };
    }
    const project = readProjectFromDoc(doc, row.id, row.name);
    try {
      return reply.type("text/plain").send(projectToSql(project, dialect));
    } catch (err) {
      reply.code(400);
      return { error: `export failed: ${(err as Error).message}` };
    }
  });

  app.get("/api/projects/:id/export/dbml", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { visual } = req.query as { visual?: string };
    const row = getProjectRow(id);
    if (!row) {
      reply.code(404);
      return { error: "not found" };
    }
    const room = getRoom(id);
    const project = readProjectFromDoc(room.doc, row.id, row.name);
    return reply.type("text/plain").send(projectToDbml(project, { includeVisualMetadata: visual === "1" }));
  });

  app.get("/api/projects/:id/export/sql", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { dialect } = req.query as { dialect?: string };
    if (!isSqlDialect(dialect)) {
      reply.code(400);
      return { error: `dialect query param must be one of ${SQL_DIALECTS.join(", ")}` };
    }
    const row = getProjectRow(id);
    if (!row) {
      reply.code(404);
      return { error: "not found" };
    }
    const room = getRoom(id);
    const project = readProjectFromDoc(room.doc, row.id, row.name);
    try {
      return reply.type("text/plain").send(projectToSql(project, dialect));
    } catch (err) {
      reply.code(400);
      return { error: `export failed: ${(err as Error).message}` };
    }
  });
}
