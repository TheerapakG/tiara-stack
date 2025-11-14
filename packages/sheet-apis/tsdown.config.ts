import { fileURLToPath } from "url";
import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      index: fileURLToPath(new URL("src/index.ts", import.meta.url)),
    },
    sourcemap: true,
  },
  {
    entry: {
      runServer: fileURLToPath(new URL("src/runServer.ts", import.meta.url)),
    },
    sourcemap: true,
    external: ["playwright", "playwright-core"],
    noExternal: [/^.*$/],
  },
]);
