import { builtinModules } from "module";
import path from "pathe";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node22",
    lib: {
      entry: {
        index: path.resolve(__dirname, "src/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [...builtinModules, /^node:/],
    },
  },
});
