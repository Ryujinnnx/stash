import { createReadStream } from "node:fs";
import { createRequire } from "node:module";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);

function shelbyClayWasmPlugin(): Plugin {
  const clayWasmPath = require.resolve("@shelby-protocol/clay-codes/clay.wasm");

  return {
    name: "stash-shelby-clay-wasm",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split("?")[0] ?? "";
        if (!pathname.endsWith("/clay.wasm")) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", "application/wasm");
        response.setHeader("Cache-Control", "no-cache");
        createReadStream(clayWasmPath).pipe(response);
      });
    },
  };
}

export default defineConfig({
  plugins: [shelbyClayWasmPlugin(), react()],
  optimizeDeps: {
    exclude: ["@shelby-protocol/sdk", "@shelby-protocol/clay-codes"],
  },
  define: {
    "process.env.SHELBY_ENCODING": "undefined",
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
    "process.env.APTOS_SDK_WARNINGS": "undefined",
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/@shelby-protocol")) {
            return "shelby";
          }
          if (id.includes("node_modules/@aptos-labs")) {
            return "aptos";
          }
          if (id.includes("node_modules/@tanstack")) {
            return "query";
          }
          if (id.includes("node_modules/framer-motion") || id.includes("node_modules/gsap")) {
            return "motion";
          }
          return undefined;
        },
      },
    },
  },
});
