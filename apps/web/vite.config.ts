import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
          const origEmit = proxy.emit;
          proxy.emit = function (event: string | symbol, ...args: unknown[]) {
            if (event === "error") {
              const err = args[0] as { code?: string; message?: string } | undefined;
              if (
                err?.code === "ECONNABORTED" ||
                err?.code === "ECONNRESET" ||
                err?.message?.includes("ECONNABORTED") ||
                err?.message?.includes("ECONNRESET")
              ) {
                return false;
              }
            }
            return origEmit.apply(this, [event, ...args] as [string | symbol, ...unknown[]]);
          };
        },
      },
    },
  },
});
