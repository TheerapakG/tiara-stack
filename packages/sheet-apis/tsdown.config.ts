import { defineConfig } from "tsdown";
import { fileURLToPath } from "url";

export default defineConfig([
  {
    entry: {
      api: fileURLToPath(new URL("./src/api.ts", import.meta.url)),
      schema: fileURLToPath(new URL("./src/schema.ts", import.meta.url)),
    },
    sourcemap: true,
  },
  {
    entry: {
      index: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
    sourcemap: true,
    external: ["playwright", "playwright-core"],
    noExternal: [/^.*$/],
  },
]);
