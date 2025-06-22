import { builtinModules } from "module";
import path from "pathe";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

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
  plugins: [
    dts({
      include: ["./src/**/*.ts"],
    }),
  ],
});
