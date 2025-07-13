import { globSync } from "glob";
import { builtinModules } from "module";
import path from "pathe";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const filePaths = globSync("./src/**/*.ts", { nodir: true }).map((file) =>
  fileURLToPath(new URL(file, import.meta.url)),
);

export default defineConfig({
  build: {
    target: "es2017",
    lib: {
      entry: Object.fromEntries(
        filePaths.map((filePath) => {
          const relativePath = path.relative("./src", filePath);
          const parsed = path.parse(relativePath);
          const module = path.join(
            parsed.dir.replace(/\.+\//g, ""),
            parsed.name,
          );

          return [module, filePath];
        }),
      ),
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
