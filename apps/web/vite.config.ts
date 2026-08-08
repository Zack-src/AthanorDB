import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import type { Socket } from "node:net";

/** Node error shape as it reaches the proxy hooks: `code` sometimes sits on the cause. */
interface MaybeNodeError {
  code?: string;
  cause?: { code?: string };
  message?: string;
}

const isAbortedError = (err: unknown) => {
  if (!err || typeof err !== "object") return false;
  const { code: ownCode, cause, message = "" } = err as MaybeNodeError;
  const code = ownCode || cause?.code;
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
  plugins: [react(), svgr()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
        configure: (proxy) => {
          proxy.on("proxyReqWs", (_proxyReq, _req, socket: Socket) => {
            if (socket) {
              const origEmit = socket.emit;
              socket.emit = function (event: string | symbol, ...args: unknown[]) {
                if (event === "error" && isAbortedError(args[0])) {
                  return false;
                }
                return origEmit.apply(this, [event, ...args] as [string | symbol, ...unknown[]]);
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

