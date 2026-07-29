import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import { getProjectRow, registerProjectRoutes } from "./routes/projects.js";
import { getRoom } from "./yjs/room.js";

const app = Fastify({ logger: true });
await app.register(websocket);

app.get("/api/health", async () => ({ status: "ok" }));
registerProjectRoutes(app);

// Single-process production deployment: serve the built web app once it
// exists. In dev, apps/web runs its own Vite server and proxies /api and /ws
// here instead, so this is a no-op until `npm run build -w apps/web` runs.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, "../../web/dist");
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });
  app.log.info(`serving built web app from ${webDist}`);
}

app.register(async (instance) => {
  instance.get("/ws/:projectId", { websocket: true }, (socket: WebSocket, req) => {
    const { projectId } = req.params as { projectId: string };

    // Every REST route checks the project exists before touching its room —
    // this was the one path that didn't. Skipping it let anyone crash the
    // whole process with a single connect+disconnect to a made-up id: the
    // room got created regardless, and `Room.leave()`'s snapshot insert
    // against a nonexistent `project_id` throws a foreign-key error that
    // was never caught, taking the entire server down for every project.
    if (!getProjectRow(projectId)) {
      socket.close(4404, "project not found");
      return;
    }

    const author = ((req.query as Record<string, string>)?.user ?? "anonymous").slice(0, 64);
    const room = getRoom(projectId);

    room.join(socket, author);
    app.log.info(`${author} joined project ${projectId}`);

    socket.on("message", (data: Buffer) => {
      room.receive(socket, new Uint8Array(data));
    });

    socket.on("close", () => {
      room.leave(socket);
      app.log.info(`${author} left project ${projectId}`);
    });
  });
});

const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
