import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: fileURLToPath(new URL("src/index.ts", import.meta.url)),
    },
    sourcemap: true,
    deps: {
      onlyBundle: false,
    },
  },
  lint: {
    ignorePatterns: ["dist"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
