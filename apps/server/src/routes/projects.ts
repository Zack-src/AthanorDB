import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { listRevisions } from "../yjs/persistence.js";

export function registerProjectRoutes(app: FastifyInstance): void {
  app.get("/api/projects", async () => {
    return db.prepare("SELECT id, name, created_at FROM projects ORDER BY created_at DESC").all();
  });

  app.post("/api/projects", async (req, reply) => {
    const { name } = (req.body ?? {}) as { name?: string };
    if (!name?.trim()) {
      reply.code(400);
      return { error: "name is required" };
    }
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(id, name.trim());
    return reply.code(201).send({ id, name: name.trim() });
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
}
