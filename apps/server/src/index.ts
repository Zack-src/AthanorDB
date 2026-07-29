import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import { resolveSession } from "./auth/session.js";
import { getEffectivePermission } from "./permissions.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerInvitationRoutes } from "./routes/invitations.js";
import { getProjectRow, registerProjectRoutes } from "./routes/projects.js";
import { registerTeamRoutes } from "./routes/teams.js";
import { registerUserRoutes } from "./routes/users.js";
import { getRoom } from "./yjs/room.js";

const app = Fastify({ logger: true });
await app.register(websocket);
await app.register(fastifyCookie);

// Resolves the session cookie into `req.user` for every request but never
// rejects here — public routes (login, health, invite-accept once it exists)
// need to stay reachable. Each route that requires a user calls
// `requireUser`/`requireAdmin` itself (see auth/session.ts).
app.addHook("onRequest", async (req, reply) => {
  req.user = resolveSession(req, reply);
});

app.get("/api/health", async () => ({ status: "ok" }));
registerAuthRoutes(app);
registerInvitationRoutes(app);
registerUserRoutes(app);
registerTeamRoutes(app);
registerProjectRoutes(app);

// Single-process production deployment: serve the built web app once it
// exists. In dev, apps/web runs its own Vite server and proxies /api and /ws
// here instead, so this is a no-op until `npm run build -w apps/web` runs.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, "../../web/dist");
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });
  // The SPA has client-side "routes" outside App.tsx's in-memory view-switching:
  // a freshly loaded (not client-navigated) `/invite/:token` or `/project/:id`
  // link, e.g. pasted into a browser or opened from a bookmark. @fastify/static
  // only serves the file matching the request path, so those paths 404 without
  // this explicit fallback to index.html (Vite's dev server already does this
  // by default, so dev needs no equivalent).
  app.get("/invite/:token", (_req, reply) => reply.sendFile("index.html"));
  app.get("/project/:id", (_req, reply) => reply.sendFile("index.html"));
  app.log.info(`serving built web app from ${webDist}`);
}

app.register(async (instance) => {
  instance.get(
    "/ws/:projectId",
    {
      websocket: true,
      // Runs before the HTTP upgrade completes, so a rejection here sends a
      // plain 401/404 instead of the connection ever becoming a WebSocket —
      // stricter and simpler than closing the socket post-upgrade.
      preHandler: async (req, reply) => {
        if (!req.user) {
          reply.code(401).send({ error: "authentication required" });
          return;
        }
        const { projectId } = req.params as { projectId: string };
        // Every REST route checks the project exists before touching its room —
        // this was the one path that didn't. Skipping it let anyone crash the
        // whole process with a single connect+disconnect to a made-up id: the
        // room got created regardless, and `Room.leave()`'s snapshot insert
        // against a nonexistent `project_id` throws a foreign-key error that
        // was never caught, taking the entire server down for every project.
        if (!getProjectRow(projectId)) {
          reply.code(404).send({ error: "project not found" });
          return;
        }
        if (!getEffectivePermission(req.user.id, projectId)) {
          reply.code(403).send({ error: "forbidden" });
          return;
        }
      },
    },
    (socket: WebSocket, req) => {
      const { projectId } = req.params as { projectId: string };
      const author = req.user!.displayName;
      const canWrite = getEffectivePermission(req.user!.id, projectId) !== "view";
      const room = getRoom(projectId);

      room.join(socket, author, canWrite);
      app.log.info(`${author} joined project ${projectId}`);

      socket.on("message", (data: Buffer) => {
        room.receive(socket, new Uint8Array(data));
      });

      socket.on("close", () => {
        room.leave(socket);
        app.log.info(`${author} left project ${projectId}`);
      });
    },
  );
});

const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
