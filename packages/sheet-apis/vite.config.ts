import { fileURLToPath } from "url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: [
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
      deps: { alwaysBundle: [/^.*$/] },
    },
  ],
  lint: {
    ignorePatterns: ["dist"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
