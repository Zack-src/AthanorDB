import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isAbortedError = (err: any) => {
  if (!err) return false;
  const code = err.code || err.cause?.code;
  const message = err.message || "";
  return (
    code === "ECONNABORTED" ||
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    message.includes("ECONNABORTED") ||
    message.includes("ECONNRESET") ||
    message.includes("EPIPE")
  );
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
        configure: (proxy) => {
          proxy.on("proxyReqWs", (_proxyReq, _req, socket: any) => {
            if (socket) {
              const origEmit = socket.emit;
              socket.emit = function (event: string | symbol, ...args: any[]) {
                if (event === "error" && isAbortedError(args[0])) {
                  return false;
                }
                return origEmit.apply(this, [event, ...args] as [string | symbol, ...any[]]);
              };
            }
          });

          proxy.on("error", (err) => {
            if (isAbortedError(err)) return;
          });

          const origEmit = proxy.emit;
          proxy.emit = function (event: string | symbol, ...args: unknown[]) {
            if (event === "error" && isAbortedError(args[0])) {
              return false;
            }
            return origEmit.apply(this, [event, ...args] as [string | symbol, ...unknown[]]);
          };
        },
      },
    },
  },
});

