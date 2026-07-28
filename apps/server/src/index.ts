import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { db } from "./db.js";

const app = Fastify({ logger: true });
await app.register(websocket);

app.get("/api/health", async () => ({ status: "ok" }));

app.get("/api/projects", async () => {
  return db.prepare("SELECT id, name, created_at FROM projects ORDER BY created_at DESC").all();
});

app.register(async (instance) => {
  instance.get("/ws/:projectId", { websocket: true }, (socket, req) => {
    const { projectId } = req.params as { projectId: string };
    app.log.info(`client connected to project ${projectId}`);

    socket.on("message", (raw: Buffer) => {
      // Placeholder: Yjs update relay goes here (Phase 3).
      socket.send(raw.toString());
    });

    socket.on("close", () => {
      app.log.info(`client disconnected from project ${projectId}`);
    });
  });
});

const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
