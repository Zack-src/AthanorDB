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

// Overridable so more than one checkout (e.g. a second git worktree) can run
// the dev stack side by side without both binding the same ports. Defaults
// match the values every existing setup already expects.
const WEB_PORT = Number(process.env.VITE_WEB_PORT) || 5173;
const API_PORT = Number(process.env.VITE_API_PORT) || 3001;

export default defineConfig({
  plugins: [react(), svgr()],
  server: {
    port: WEB_PORT,
    proxy: {
      "/api": `http://localhost:${API_PORT}`,
      "/ws": {
        target: `ws://localhost:${API_PORT}`,
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

