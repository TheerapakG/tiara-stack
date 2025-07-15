import { builtinModules } from "module";
import path from "pathe";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    target: "es2017",
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["es"],
    },
    rollupOptions: {
      treeshake: {
        moduleSideEffects: "no-external",
      },
      external: [...builtinModules, /^node:/],
    },
    minify: "terser",
    terserOptions: {
      compress: {
        toplevel: false,
      },
    },
  },
  plugins: [
    dts({
      include: ["./src/**/*.ts"],
    }),
  ],
});
