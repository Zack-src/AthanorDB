import Fastify from "fastify";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import { registerProjectRoutes } from "./routes/projects.js";
import { getRoom } from "./yjs/room.js";

const app = Fastify({ logger: true });
await app.register(websocket);

app.get("/api/health", async () => ({ status: "ok" }));
registerProjectRoutes(app);

app.register(async (instance) => {
  instance.get("/ws/:projectId", { websocket: true }, (socket: WebSocket, req) => {
    const { projectId } = req.params as { projectId: string };
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
