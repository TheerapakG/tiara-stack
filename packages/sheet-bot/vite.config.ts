import { builtinModules } from "module";
import path from "pathe";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "~~": path.resolve(__dirname, "."),
      "@@": path.resolve(__dirname, "."),
      "~": path.resolve(__dirname, "src"),
      "@": path.resolve(__dirname, "src"),
    },
  },
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
